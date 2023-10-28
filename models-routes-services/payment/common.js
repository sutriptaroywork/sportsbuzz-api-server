const axios = require('axios')
const { queuePush } = require('../../helper/redis')
const config = require('./../../config/config')
const UserDepositModel = require('../userDeposit/model')
const PassbookModel = require('../passbook/model')
const UserBalanceModel = require('../userBalance/model')
const { literal, Transaction, Op } = require('sequelize')
const db = require('../../database/sequelize')
const PromocodeModel = require('../promocode/model')
const PromocodeStatisticServices = require('../promocode/statistics/model')
const UsersModel = require('../user/model')
const StatisticsModel = require('../user/statistics/model')
const ObjectId = require('mongoose').Types.ObjectId
const { messages, jsonStatus } = require('../../helper/api.responses')
const commonRuleServices = require('../commonRules/services')
const userBalanceServices = require('../userBalance/services')
const transactionLogQueue = require('../../rabbitmq/queue/transactionLogQueue')
// Get Payments for an Order
async function getOrderPaymentStatus(payload) {
  return new Promise((resolve, reject) => {
    const { iDepositId = '', orderId } = payload
    return axios.get(`${config.CASHFREE_STABLE_URL}/orders/${orderId}`, { headers: { 'x-client-id': config.CASHFREE_APPID, 'x-client-secret': config.CASHFREE_SECRETKEY, 'x-api-version': '2022-09-01' } })
      .then(res => {
        const logData = { iDepositId, iOrderId: orderId, ePlatform: 'AD', eGateway: 'CASHFREE', eType: 'D', oBody: payload, oReq: { url: `${config.CASHFREE_STABLE_URL}/orders/${orderId}`, orderId }, oRes: res.data }
        // queuePush('TransactionLog', logData)
        transactionLogQueue.publish(logData)

        const result = res ? (res.data && res.data.order_status ? res.data : '') : ''
        resolve({ result, isSuccess: true })
      })
      .catch(err => {
        console.log({ err })
        const res = { status: err.response.status, message: err.response.data, isSuccess: false }
        const logData = { iDepositId, iOrderId: orderId, ePlatform: 'AD', eGateway: 'CASHFREE', eType: 'D', oBody: payload, oReq: { url: `${config.CASHFREE_STABLE_URL}/orders/${orderId}`, orderId }, oRes: res }
        // queuePush('TransactionLog', logData)
        transactionLogQueue.publish(logData)
        resolve(res)
      })
  })
}

const checkCashfreeStatus = async (iOrderId) => {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const response = await axios.get(`${config.STABLE_CASHFREE_BASEURL}/orders/${iOrderId}/payments`, { headers: { 'x-api-version': '2022-01-01', 'Content-Type': 'application/json', 'x-client-id': config.CASHFREE_APPID, 'x-client-secret': config.CASHFREE_SECRETKEY } })
        const payload = response.data

        const logData = { iOrderId, eGateway: 'CASHFREE', eType: 'D', oReq: { iOrderId }, oRes: response ? response.data : {} }
        // await queuePush('TransactionLog', logData)
        transactionLogQueue.publish(logData)

        return resolve({ isSuccess: true, payload })
      } catch (error) {
        return resolve({ isSuccess: false, error: error })
      }
    })()
  })
}

const processPayment = async (deposit, payload) => {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          const existingDeposit = await UserDepositModel.findOne({ where: { id: deposit.id }, order: [['id', 'DESC']], raw: true, transaction: t, lock: true })
          if (existingDeposit?.paymentStatus) deposit.ePaymentStatus = existingDeposit.paymentStatus

          const { iUserId, ePaymentGateway, nCash = 0, nBonus = 0, nAmount } = existingDeposit

          const { payment_status: ePaymentStatus, cf_payment_id: referenceId } = payload[0] || {}
          if (deposit.ePaymentStatus !== 'S') {
            if (ePaymentStatus === 'SUCCESS') {
              let dBonusExpiryDate = new Date()
              if (deposit.sPromocode) {
                const promocode = await PromocodeModel.findOne({ sCode: deposit.sPromocode.toUpperCase() }, { nBonusExpireDays: 1 }).lean()
                const { nBonusExpireDays = 0 } = promocode
                if (nBonusExpireDays) {
                  dBonusExpiryDate.setDate(dBonusExpiryDate.getDate() + nBonusExpireDays)
                  dBonusExpiryDate.setUTCHours(23, 59) // 23:59 EOD
                } else { dBonusExpiryDate = null }
              } else {
                dBonusExpiryDate = null
              }
              // Update User Deposit details based on deposit-id or iOrderId  - Entire Deposit payload updating as sInfo
              const updateDepositResult = await UserDepositModel.update({ ePaymentStatus: 'S', ePaymentGateway, sInfo: JSON.stringify(deposit), iTransactionId: referenceId, dProcessedDate: new Date() }, { where: { id: existingDeposit.id }, transaction: t, lock: true })
              const oldBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })

              const { nCurrentBonus: nOldBonus, nCurrentTotalBalance: nOldTotalBalance, nCurrentDepositBalance: nOldDepositBalance, nCurrentWinningBalance: nOldWinningBalance } = oldBalance

              await UserBalanceModel.update({
                nCurrentDepositBalance: literal(`nCurrentDepositBalance + ${nCash}`),
                nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nCash}`),
                nTotalDepositAmount: literal(`nTotalDepositAmount + ${nCash}`),
                nTotalBonusEarned: literal(`nTotalBonusEarned + ${nBonus}`),
                nCurrentBonus: literal(`nCurrentBonus + ${nBonus}`),
                nTotalDepositCount: literal('nTotalDepositCount + 1')
              },
              {
                where: { iUserId },
                transaction: t,
                lock: true
              })

              // need to change dBonusExpiryDate : 11:59 date.setUTCHours(23,59)
              await PassbookModel.create({ iUserId, nAmount, nCash, nBonus, dBonusExpiryDate, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eTransactionType: 'Deposit', iUserDepositId: deposit.id, eType: 'Cr', sRemarks: 'Amount has been deposited successfully', dActivityDate: new Date(), iTransactionId: referenceId, eStatus: 'CMP' }, { transaction: t, lock: true })
              await StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, { $inc: { nActualBonus: Number(parseFloat(nBonus).toFixed(2)), nDeposits: nCash, nCash, nBonus, nDepositCount: 1, nActualDepositBalance: Number(parseFloat(nCash).toFixed(2)), nDepositDiscount: Number(parseFloat(nBonus).toFixed(2)) } }, { upsert: true })
              await queuePush('pushNotification:Deposit', { iUserId, ePaymentStatus: 'S', sPushType: 'Transaction' })

              // Assign referral on first deposit
              const user = await UsersModel.findOne({ _id: ObjectId(iUserId) }).lean()
              const { sReferrerRewardsOn = '', iReferredBy = '' } = user
              if (iReferredBy && sReferrerRewardsOn && sReferrerRewardsOn === 'FIRST_DEPOSIT') {
                let depositCount = await UserDepositModel.count({
                  where: {
                    iUserId,
                    ePaymentStatus: 'S'
                  }
                }, {
                  transaction: t, lock: true
                })

                depositCount += updateDepositResult[0]

                if (depositCount === 1) {
                  const referredBy = await UsersModel.findOne({ _id: iReferredBy }).lean()
                  if (referredBy) {
                    const registerReferBonus = await commonRuleServices.findRule('RR')
                    if (registerReferBonus) {
                      const refer = await userBalanceServices.referBonus({ iUserId: referredBy._id, rule: registerReferBonus, sReferCode: referredBy.sReferCode, sUserName: referredBy.sUsername, eType: referredBy.eType, nReferrals: 1, iReferById: user._id })
                      if (refer.isSuccess === false) {
                        return resolve({ alreadySuccess: false, status: jsonStatus.BadRequest, message: messages.English.went_wrong_with.replace('##', messages.English.bonus) })
                      }
                      // Add Push Notification
                      await queuePush('pushNotification:registerReferBonus', { _id: referredBy._id })
                    }
                  }
                }
              }

              if (deposit.iPromocodeId) {
                await PromocodeStatisticServices.logStats({
                  iUserId,
                  iPromocodeId: deposit.iPromocodeId,
                  nAmount: nBonus,
                  sTransactionType: 'DEPOSIT',
                  idepositId: deposit.id
                })
              }
              return resolve({ alreadySuccess: false, status: jsonStatus.OK })
            } else if (payload.length && ['CANCELLED', 'FAILED', 'USER_DROPPED', 'NOT_ATTEMPTED', 'VOID'].includes(ePaymentStatus)) {
              await UserDepositModel.update({ ePaymentStatus: 'C', sInfo: JSON.stringify(payload), iTransactionId: referenceId, dProcessedDate: new Date() }, { where: { id: existingDeposit.id }, transaction: t, lock: true })
              await queuePush('pushNotification:Deposit', { iUserId, ePaymentStatus: 'C', sPushType: 'Transaction' })
              return resolve({ alreadySuccess: false, status: jsonStatus.OK })
            } else {
              return resolve({ alreadySuccess: false, status: jsonStatus.OK })
            }
          }
        })
      } catch (error) {
        return reject(error)
      }
    })()
  })
}

module.exports = {
  getOrderPaymentStatus,
  checkCashfreeStatus,
  processPayment
}
