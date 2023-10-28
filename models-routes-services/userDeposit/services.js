const UserDepositModel = require('./model')
const PromocodeModel = require('../promocode/model')
const UserBalanceModel = require('../userBalance/model')
const PassbookModel = require('../passbook/model')
const SettingModel = require('../setting/model')
const StatisticsModel = require('../user/statistics/model')
const UsersModel = require('../user/model')
// const adminServices = require('../admin/subAdmin/services')
const PromocodeStatisticServices = require('../promocode/statistics/services')
const settingServices = require('../setting/services')
const CredentialModel = require('../admin/credential.model')
const KycModel = require('../kyc/model')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const db = require('../../database/sequelize')
const { literal, Op, Transaction } = require('sequelize')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, removenull, getIp, convertToDecimal } = require('../../helper/utilities.services')
const bcrypt = require('bcryptjs')
const config = require('../../config/config')
const commonRuleServices = require('../commonRules/services')
const userBalanceServices = require('../userBalance/services')
const { queuePush } = require('../../helper/redis')
const { CACHE_2 } = require('../../config/config')
const { CASHFREE_ORDERID_PREFIX } = require('./../../config/common')
const { redisClient } = require('../../helper/redis')
const { getAdminWithdrawDepositListQuery } = require('../userWithdraw/common')
const { getOrderPaymentStatus } = require('../payment/common')
const adminLogQueue = require('../../rabbitmq/queue/adminLogQueue')
const transactionLogQueue = require('../../rabbitmq/queue/transactionLogQueue')
class UserDeposit {
  async adminDeposit(req, res) {
    try {
      let { iUserId, nCash, nBonus, eType, sPassword } = req.body
      let logData
      const { _id: iAdminId } = req.admin

      nBonus = Number(nBonus) || 0
      nCash = Number(nCash) || 0
      const nAmount = nBonus + nCash

      const pass = await CredentialModel.findOne({ eKey: 'PAY' }).lean().cache(CACHE_2, 'credential:PAY')
      if (!bcrypt.compareSync(sPassword, pass.sPassword)) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].auth_failed })
      }
      const bonusExpireDays = await settingServices.findSetting('BonusExpireDays')
      if (!bonusExpireDays) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cbonusExpirySetting) })
      let dBonusExpiryDate = null
      if (nBonus > 0) {
        dBonusExpiryDate = new Date()
        dBonusExpiryDate.setDate(dBonusExpiryDate.getDate() + bonusExpireDays.nMax)
        dBonusExpiryDate.setUTCHours(23, 59) // 23:59 EOD
      }
      const userData = await UsersModel.findById(iUserId, { eType: 1, sUsername: 1 }).lean()

      try {
        let statUpdate = {}
        const { eType: eUserType, sUsername } = userData
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          const userDeposit = await UserDepositModel.create({ iUserId, nAmount, nCash, nBonus, ePaymentStatus: 'S', sInfo: 'Deposit by admin', eUserType, dProcessedDate: new Date() }, { transaction: t, lock: true })
          const oldBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true, raw: true })
          const { nCurrentBonus: nOldBonus, nCurrentTotalBalance: nOldTotalBalance, nCurrentDepositBalance: nOldDepositBalance, nCurrentWinningBalance: nOldWinningBalance } = oldBalance

          if (eType === 'deposit') {
            await UserBalanceModel.update({
              nCurrentDepositBalance: literal(`nCurrentDepositBalance + ${nCash}`),
              nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nCash}`),
              nCurrentBonus: literal(`nCurrentBonus + ${nBonus}`),
              nTotalBonusEarned: literal(`nTotalBonusEarned + ${nBonus}`),
              nTotalDepositAmount: literal(`nTotalDepositAmount + ${nCash}`),
              nTotalDepositCount: literal('nTotalDepositCount + 1')
            },
            {
              where: { iUserId },
              transaction: t,
              lock: true
            })
            statUpdate = { $inc: { nActualDepositBalance: Number(parseFloat(nCash).toFixed(2)), nActualBonus: Number(parseFloat(nBonus).toFixed(2)), nDeposits: Number(parseFloat(nCash).toFixed(2)), nCash: Number(parseFloat(nCash).toFixed(2)), nBonus: Number(parseFloat(nBonus).toFixed(2)), nDepositCount: 1 } }
          } else if (eType === 'winning') {
            await UserBalanceModel.update({
              nCurrentWinningBalance: literal(`nCurrentWinningBalance + ${nCash}`),
              nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nCash}`),
              nTotalWinningAmount: literal(`nTotalWinningAmount + ${nCash}`),
              nTotalDepositCount: literal('nTotalDepositCount + 1')
            },
            {
              where: { iUserId },
              transaction: t,
              lock: true
            })
            statUpdate = { $inc: { nActualWinningBalance: Number(parseFloat(nCash).toFixed(2)), nWinnings: Number(parseFloat(nCash).toFixed(2)), nTotalWinnings: Number(parseFloat(nCash).toFixed(2)), nDepositCount: 1 } }
          }
          await PassbookModel.create({ iUserId, nAmount, nCash, nBonus, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eTransactionType: 'Deposit', eUserType, iUserDepositId: userDeposit.id, eType: 'Cr', sRemarks: 'Deposit by admin', dBonusExpiryDate, dActivityDate: new Date(), eStatus: 'CMP' }, { transaction: t, lock: true })
        })

        await StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, statUpdate, { upsert: true })

        logData = { oOldFields: {}, oNewFields: { eType: nBonus ? 'BONUS' : eType === 'deposit' ? 'DEPOSIT' : 'WINNING', nCash, nBonus, iUserId, sUsername }, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: ObjectId(iUserId), eKey: 'AD' }
        // adminServices.adminLog(req, res, logData)
      } catch (error) {
        return catchError('UserDeposit.adminDeposit', error, req, res)
      }
      if (logData) adminLogQueue.publish(logData);
      // await queuePush('AdminLogs', logData)//changes Here

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].cDeposit) })
    } catch (error) {
      return catchError('UserDeposit.adminDeposit', error, req, res)
    }
  }

  
  async userDeposit(req, res) {
    try {
      req.body = pick(req.body, ['ePaymentGateway', 'ePaymentStatus', 'nAmount', 'sPromocode'])
      removenull(req.body)
      let { nAmount: depositAmount, sPromocode = '' } = req.body

      depositAmount = Number(depositAmount) || 0
      const iUserId = req.user._id.toString()
      const user = await UsersModel.findById(iUserId).lean()
      if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

      let sErrorMessage = ''
      const kycDetails = await KycModel.findOne({
        iUserId: req.user._id,
        $or: [{ 'oPan.eStatus': 'A' }, { 'oAadhaar.eStatus': 'A' }]
      }).lean()

      if (!kycDetails) {
        sErrorMessage = sErrorMessage
          ? sErrorMessage.concat(` ${messages[req.userLanguage].kyc_not_approved}`)
          : sErrorMessage.concat(messages[req.userLanguage].kyc_not_approved)
      }
      if (kycDetails && kycDetails.oPan.eStatus !== 'A') {
        sErrorMessage = sErrorMessage
          ? sErrorMessage.concat(` ${messages[req.userLanguage].pancard_not_approved}`)
          : sErrorMessage.concat(messages[req.userLanguage].pancard_not_approved)
      }
      if (kycDetails && kycDetails.oAadhaar.eStatus !== 'A') {
        sErrorMessage = sErrorMessage
          ? sErrorMessage.concat(` ${messages[req.userLanguage].aadharcard_not_approved}`)
          : sErrorMessage.concat(messages[req.userLanguage].aadharcard_not_approved)
      }
      if (sErrorMessage) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: sErrorMessage })

      await this.validateDepositRateLimit(iUserId, req.userLanguage)

      let promocodes
      let nCash = 0
      let nBonus = 0
      let dBonusExpiryDate
      let promocodeId

      if (sPromocode) {
        const promocode = await PromocodeModel.findOne({ eStatus: 'Y', sCode: sPromocode.toUpperCase(), dStartTime: { $lt: new Date(Date.now()) }, dExpireTime: { $gt: new Date(Date.now()) } }, { _id: 1, nAmount: 1, dExpireTime: 1, bIsPercent: 1, bMaxAllowForAllUser: 1, nMaxAllow: 1, nBonusExpireDays: 1, nPerUserUsage: 1, nMinAmount: 1, nMaxAmount: 1 }).lean()
        if (!promocode) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid_promo_err }) }

        const { dExpireTime, nAmount: promoAmount, bIsPercent, nBonusExpireDays, nMaxAmount, nMinAmount } = promocode

        const symbol = await settingServices.getCurrencySymbol()
        if (depositAmount && !(nMaxAmount >= convertToDecimal(depositAmount, 2) && nMinAmount <= convertToDecimal(depositAmount, 2))) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].promo_amount_err.replace('#', nMinAmount).replace('##', nMaxAmount).replace('₹', symbol) })

        promocodes = promocode
        if (dExpireTime && new Date(dExpireTime) < new Date(Date.now())) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid_promo_err }) }

        promocodeId = promocode._id.toString()
        if (bIsPercent) {
          nBonus = Number(parseFloat(parseFloat(promoAmount) * parseFloat(depositAmount) / 100).toFixed(2))
          nCash = parseFloat(depositAmount)
        } else {
          nBonus = parseFloat(promoAmount)
          nCash = parseFloat(depositAmount)
        }
        dBonusExpiryDate = new Date()
        dBonusExpiryDate.setDate(dBonusExpiryDate.getDate() + nBonusExpireDays)
      } else {
        nCash = parseFloat(depositAmount)
      }

      const depositValidation = await SettingModel.findOne({ sKey: 'Deposit' }).lean()
      if (!depositValidation) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cvalidationSetting) })

      const symbol = await settingServices.getCurrencySymbol()
      if (depositAmount < depositValidation.nMin) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].min_err.replace('##', messages[req.userLanguage].cDeposit).replace('#', `${depositValidation.nMin}`).replace('₹', symbol) })
      if (depositAmount > depositValidation.nMax) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].max_err.replace('##', messages[req.userLanguage].cDeposit).replace('#', `${depositValidation.nMax}`).replace('₹', symbol) })

      const nAmount = parseFloat(nCash) + parseFloat(nBonus)

      try {
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          let paymentStatus = 'P'
          if (user.bIsInternalAccount === true) {
            paymentStatus = 'S'
          }

          if (sPromocode) {
            const { count: allCount } = await UserDepositModel.findAndCountAll({ where: { iPromocodeId: promocodeId, ePaymentStatus: { [Op.in]: ['P', 'S'] } }, transaction: t, lock: true })
            const { count } = await UserDepositModel.findAndCountAll({ where: { iUserId, iPromocodeId: promocodeId, ePaymentStatus: { [Op.in]: ['P', 'S'] } }, transaction: t, lock: true })

            if (!promocodes.bMaxAllowForAllUser && (count >= promocodes.nMaxAllow)) {
              return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].promo_usage_limit })
            } else if ((allCount >= promocodes.nMaxAllow) || (count >= promocodes.nPerUserUsage)) {
              return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].promo_usage_limit })
            }

            await UserDepositModel.create({ iUserId, nAmount, nCash, nBonus, ePaymentStatus: paymentStatus, sInfo: `Deposit of ${symbol}${depositAmount} using ${sPromocode.toUpperCase()}`, iPromocodeId: promocodeId, sPromocode: sPromocode.toUpperCase(), eUserType: user.eType }, { transaction: t, lock: true })
          } else {
            await UserDepositModel.create({ iUserId, nAmount, nCash, nBonus, ePaymentStatus: paymentStatus, sInfo: `Deposit of ${symbol}${depositAmount}`, eUserType: user.eType }, { transaction: t, lock: true })
          }
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].cDeposit) })
        })
      } catch (error) {
        return catchError('UserDeposit.userDeposit', error, req, res)
      }
    } catch (error) {
      const { status = '', message = '' } = error
      if (!status) { return catchError('UserDeposit.userDeposit', error, req, res) }
      return res.status(status).jsonp({ status, message })
    }
  }

  async processDeposit(req, res) {
    try {
      const { ePaymentStatus } = req.body
      const { _id: iAdminId } = req.admin
      let logData

      try {
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          const bProcessing = await redisClient.incr(`processDeposit:${req.params.id}`)
          if (bProcessing > 1) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].wait_for_proccessing.replace('##', messages[req.userLanguage].cDeposit) })

          const deposit = await UserDepositModel.findOne({ where: { id: req.params.id }, transaction: t, lock: true })
          if (deposit.ePaymentStatus !== 'P') {
            await redisClient.del(`processDeposit:${req.params.id}`)
            return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].depo_already_process })
          } else {
            await redisClient.expire(`processDeposit:${req.params.id}`, 20)
            const { iUserId, nCash, nBonus = 0, ePaymentStatus: ePaymentOldStatus, sInfo, sPromocode, iPromocodeId, nAmount, ePlatform } = deposit
            const oOldFields = { nCash, nBonus, ePaymentStatus: ePaymentOldStatus, sInfo, sPromocode, iPromocodeId, nAmount, ePlatform }
            const oldBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
            let nOldBonus = 0
            let nOldTotalBalance = 0
            let nOldDepositBalance = 0
            let nOldWinningBalance = 0
            if (oldBalance) {
              const { nCurrentBonus, nCurrentTotalBalance, nCurrentDepositBalance, nCurrentWinningBalance } = oldBalance
              nOldBonus = nCurrentBonus
              nOldTotalBalance = nCurrentTotalBalance
              nOldDepositBalance = nCurrentDepositBalance
              nOldWinningBalance = nCurrentWinningBalance
            } else {
              await UserBalanceModel.create({ iUserId, eUserType: deposit.eUserType }, { transaction: t, lock: true })
            }

            const dProcessedDate = new Date()

            if (ePaymentStatus === 'S') {
              let dBonusExpiryDate
              if (deposit.iPromocodeId) {
                const promocode = await PromocodeModel.findOne({ _id: deposit.iPromocodeId.toString() }, { nBonusExpireDays: 1 }).lean()

                const { nBonusExpireDays = 0 } = promocode
                dBonusExpiryDate = new Date()
                dBonusExpiryDate.setDate(dBonusExpiryDate.getDate() + nBonusExpireDays)
                dBonusExpiryDate.setUTCHours(23, 59) // 23:59 EOD
              } else {
                dBonusExpiryDate = null
              }
              await UserDepositModel.update({ ePaymentStatus: 'S', iTransactionId: deposit.id, dProcessedDate }, { where: { id: req.params.id }, transaction: t, lock: true })

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

              await PassbookModel.create({ iUserId, nAmount, nCash, nBonus, eUserType: deposit.eUserType, dBonusExpiryDate, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eTransactionType: 'Deposit', iUserDepositId: deposit.id, eType: 'Cr', sRemarks: 'Deposit Approved.', dProcessedDate, sPromocode, eStatus: 'CMP' }, { transaction: t, lock: true })
              await StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, { $inc: { nActualDepositBalance: Number(parseFloat(nCash).toFixed(2)), nDeposits: Number(parseFloat(nCash).toFixed(2)), nCash: Number(parseFloat(nCash).toFixed(2)), nBonus: Number(parseFloat(nBonus).toFixed(2)), nActualBonus: Number(parseFloat(nBonus).toFixed(2)), nDepositCount: 1, nDepositDiscount: Number(parseFloat(nBonus).toFixed(2)) } }, { upsert: true })

              if (deposit.iPromocodeId) {
                await PromocodeStatisticServices.logStats({
                  iUserId,
                  iPromocodeId,
                  nAmount: nBonus,
                  sTransactionType: 'DEPOSIT',
                  idepositId: deposit.id
                })
              }
            } else if (ePaymentStatus === 'C') {
              await UserDepositModel.update({ ePaymentStatus: 'R', dProcessedDate }, { where: { id: req.params.id }, transaction: t, lock: true })
            }
            const oNewFields = { ...oOldFields, ePaymentStatus }
            logData = { oOldFields, oNewFields, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: ObjectId(iUserId), eKey: 'D' }
            transactionLogQueue.publish(logData)

          }
        })
      } catch (error) {
        return catchError('UserDeposit.processDeposit', error, req, res)
      }
      if (logData)  adminLogQueue.publish(logData);
      // await queuePush('AdminLogs', logData)//changes Here
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].cprocessedDeposit) })
    } catch (error) {
      return catchError('UserDeposit.processDeposit', error, req, res)
    }
  }

  async adminList(req, res) {
    try {
      let { datefrom, dateto, start = 0, limit = 10, sort = 'dCreatedAt', order, search, status: paymentStatus, method, isFullResponse } = req.query

      const orderBy = order && order === 'asc' ? 'ASC' : 'DESC'

      start = !start ? 0 : start
      limit = !limit ? 0 : limit
      sort = !sort ? 'dCreatedAt' : sort

      const { query, aUsers } = await getAdminWithdrawDepositListQuery(paymentStatus, method, search, 'D')

      if ((!datefrom || !dateto) && [true, 'true'].includes(isFullResponse)) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].date_filter_err })
      }
      if (([true, 'true'].includes(isFullResponse))) query.push({ eUserType: 'U' })

      if (datefrom && dateto) {
        query.push({ dCreatedAt: { [Op.gte]: datefrom } })
        query.push({ dCreatedAt: { [Op.lte]: dateto } })
      }
      const paginationFields = [true, 'true'].includes(isFullResponse) ? {} : {
        offset: parseInt(start),
        limit: parseInt(limit)
      }

      const data = await UserDepositModel.findAll({
        where: {
          [Op.and]: query
        },
        order: [[sort, orderBy]],
        ...paginationFields,
        raw: true
      })
      const aUserIds = []

      if (data.length) {
        data.forEach(record => {
          if (!aUsers.includes(user => user._id.toString() === record.iUserId.toString())) {
            aUserIds.push(record.iUserId.toString())
          }
        })

        if (aUserIds.length) {
          const aWithdrawUsers = await UsersModel.find({ _id: { $in: aUserIds } }, { sName: 1, sUsername: 1, sMobNum: 1 }).lean()

          if (aWithdrawUsers.length) aUsers.push(...aWithdrawUsers)
        }
      }

      if (data.length) {
        data.forEach(record => {
          if (!aUsers.includes(user => user._id.toString() === record.iUserId.toString())) {
            aUserIds.push(record.iUserId.toString())
          }
        })

        if (aUserIds.length) {
          const aWithdrawUsers = await UsersModel.find({ _id: { $in: aUserIds } }, { sName: 1, sUsername: 1, sMobNum: 1 }).lean()

          if (aWithdrawUsers.length) aUsers.push(...aWithdrawUsers)
        }
      }

      const depositData = await addUserFields(data, aUsers)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cDeposit), data: { rows: depositData } })
    } catch (error) {
      catchError('UserDeposit.adminList', error, req, res)
    }
  }

  // To get counts of deposits with searching and filter
  async getCounts(req, res) {
    try {
      const { datefrom, dateto, search, status: paymentStatus, method, isFullResponse } = req.query

      const { query } = await getAdminWithdrawDepositListQuery(paymentStatus, method, search, 'D')

      if (datefrom && dateto) {
        query.push({ dCreatedAt: { [Op.gte]: datefrom } })
        query.push({ dCreatedAt: { [Op.lte]: dateto } })
      }

      if (([true, 'true'].includes(isFullResponse))) query.push({ eUserType: 'U' })

      const count = await UserDepositModel.count({
        where: {
          [Op.and]: query
        },
        raw: true
      })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', `${messages[req.userLanguage].cDeposit} ${messages[req.userLanguage].cCounts}`), data: { count } })
    } catch (error) {
      catchError('UserDeposit.getCounts', error, req, res)
    }
  }

  /**
   * It'll create deposit data according data from payment gateway
   * @param { Object } payload
   * @param { Object } user
   * @returns { Object } of user deposit
   */
  async createDeposit(payload, user) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const iUserId = user._id.toString()
          const { eType: eUserType, bIsInternalAccount } = user
          payload = pick(payload, ['ePaymentGateway', 'ePaymentStatus', 'sInfo', 'nAmount', 'sPromocode', 'ePlatform'])
          removenull(payload)

          const { nAmount, sPromocode = '', ePaymentGateway, ePlatform } = payload
          let nCash = 0
          let nBonus = 0
          let promocodeId, promocodes

          const symbol = await settingServices.getCurrencySymbol()
          if (sPromocode) {
            const rejectPromo = { status: jsonStatus.BadRequest, message: messages.English.invalid_promo_err }
            const promocode = await PromocodeModel.findOne({ eStatus: 'Y', sCode: sPromocode.toUpperCase(), dStartTime: { $lt: new Date(Date.now()) }, dExpireTime: { $gt: new Date(Date.now()) } }, { nAmount: 1, bMaxAllowForAllUser: 1, dExpireTime: 1, bIsPercent: 1, nMaxAllow: 1, nPerUserUsage: 1, nBonusExpireDays: 1, nMaxAmount: 1, nMinAmount: 1 }).lean()
            if (!promocode) return reject(rejectPromo)

            const rejectReason = { status: jsonStatus.BadRequest, message: messages.English.promo_amount_err.replace('#', promocode.nMinAmount).replace('##', promocode.nMaxAmount).replace('₹', symbol) }
            if (nAmount && !(promocode.nMaxAmount >= convertToDecimal(nAmount, 2) && promocode.nMinAmount <= convertToDecimal(nAmount, 2))) return reject(rejectReason)

            promocodes = promocode
            const { dExpireTime, nAmount: promoAmount, bIsPercent } = promocode
            if (dExpireTime && new Date(dExpireTime) < new Date(Date.now())) { return reject(rejectPromo) }
            promocodeId = promocode._id.toString()
            if (bIsPercent) {
              nBonus = Number(parseFloat(parseFloat(promoAmount) * parseFloat(nAmount) / 100).toFixed(2))
              nCash = parseFloat(nAmount)
            } else {
              nBonus = parseFloat(promoAmount)
              nCash = parseFloat(nAmount)
            }
          } else { nCash = parseFloat(nAmount) }
          const nDeposit = parseFloat(nCash) + parseFloat(nBonus)
          const depositValidation = await SettingModel.findOne({ sKey: 'Deposit' }).lean()
          if (!depositValidation) {
            const rejectSetting = { status: jsonStatus.NotFound, message: messages.English.not_exist.replace('##', messages.English.cvalidationSetting) }
            return reject(rejectSetting)
          }

          if (nAmount < depositValidation.nMin) {
            const rejectMinErr = { status: jsonStatus.BadRequest, message: messages.English.min_err.replace('##', messages.English.cDeposit).replace('#', `${depositValidation.nMin}`).replace('₹', symbol) }
            return reject(rejectMinErr)
          }
          if (nAmount > depositValidation.nMax) {
            const rejectMaxErr = { status: jsonStatus.BadRequest, message: messages.English.max_err.replace('##', messages.English.cDeposit).replace('#', `${depositValidation.nMax}`).replace('₹', symbol) }
            return reject(rejectMaxErr)
          }
          try {
            return db.sequelize.transaction({
              isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
            }, async (t) => {
              let paymentStatus = 'P'
              let nOldBonus = 0
              let nOldTotalBalance = 0
              let nOldDepositBalance = 0
              let nOldWinningBalance = 0
              if (bIsInternalAccount === true) {
                paymentStatus = 'S'
                const oldBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
                if (oldBalance) {
                  const { nCurrentBonus, nCurrentTotalBalance, nCurrentDepositBalance, nCurrentWinningBalance } = oldBalance
                  nOldBonus = nCurrentBonus
                  nOldTotalBalance = nCurrentTotalBalance
                  nOldDepositBalance = nCurrentDepositBalance
                  nOldWinningBalance = nCurrentWinningBalance
                } else {
                  await UserBalanceModel.create({ iUserId, eUserType }, { transaction: t, lock: true })
                }
              }
              let userDeposit
              const symbol = await settingServices.getCurrencySymbol()

              if (sPromocode) {
                const [{ count: allCount }, { count }] = await Promise.all([
                  UserDepositModel.findAndCountAll({ where: { iPromocodeId: promocodeId, ePaymentStatus: { [Op.in]: ['P', 'S'] } }, transaction: t, lock: true }),
                  UserDepositModel.findAndCountAll({ where: { iUserId, iPromocodeId: promocodeId, ePaymentStatus: { [Op.in]: ['P', 'S'] } }, transaction: t, lock: true })
                ])
                if (!promocodes.bMaxAllowForAllUser && (count >= promocodes.nMaxAllow)) {
                  const rejectInvalid = { status: jsonStatus.BadRequest, message: messages.English.promo_usage_limit }
                  return reject(rejectInvalid)
                } else if ((allCount >= promocodes.nMaxAllow) || (count >= promocodes.nPerUserUsage)) {
                  const rejectInvalid = { status: jsonStatus.BadRequest, message: messages.English.promo_usage_limit }
                  return reject(rejectInvalid)
                }
                userDeposit = await UserDepositModel.create({ iUserId, nAmount: nDeposit, nCash, nBonus, eUserType, ePaymentStatus: paymentStatus, ePaymentGateway, sInfo: `Deposit of ${symbol}${nAmount}`, iPromocodeId: promocodeId, sPromocode: sPromocode.toUpperCase(), ePlatform }, { transaction: t, lock: true })
              } else {
                userDeposit = await UserDepositModel.create({ iUserId, nAmount: nDeposit, nCash, nBonus, ePaymentStatus: paymentStatus, ePaymentGateway, sInfo: `Deposit of ${symbol}${nAmount}`, ePlatform }, { transaction: t, lock: true })
              }

              // update passbook and balance
              if (bIsInternalAccount === true) {
                let dBonusExpiryDate
                if (userDeposit.iPromocodeId) {
                  const promocode = await PromocodeModel.findOne({ eStatus: 'Y', _id: userDeposit.iPromocodeId.toString() }, { nBonusExpireDays: 1 }).lean()

                  const { nBonusExpireDays = 0 } = promocode
                  dBonusExpiryDate = new Date()
                  dBonusExpiryDate.setDate(dBonusExpiryDate.getDate() + nBonusExpireDays)
                  dBonusExpiryDate.setUTCHours(23, 59) // 23:59 EOD
                } else {
                  dBonusExpiryDate = null
                }

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

                await PassbookModel.create({ iUserId, nAmount, nCash, nBonus, eUserType, dBonusExpiryDate, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eTransactionType: 'Deposit', iUserDepositId: userDeposit.id, eType: 'Cr', sRemarks: 'Deposit Approved.', eStatus: 'CMP' }, { transaction: t, lock: true })
                await StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, { $inc: { nActualDepositBalance: Number(parseFloat(nCash).toFixed(2)), nActualBonus: Number(parseFloat(nBonus).toFixed(2)), nDeposits: Number(parseFloat(nCash).toFixed(2)), nCash: Number(parseFloat(nCash).toFixed(2)), nBonus: Number(parseFloat(nBonus).toFixed(2)), nDepositCount: 1 } }, { upsert: true })
              }
              return resolve({ data: userDeposit })
            })
          } catch (error) {
            return reject(error)
          }
        } catch (error) {
          return reject(error)
        }
      })()
    })
  }

  /**
   * It'll update user balance
   * @param { Object } payload
   * @param { String } ePaymentGateway
   * @returns { Object } status of success or error
   */
  async updateBalance(payload, ePaymentGateway) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let { txStatus: ePaymentStatus, orderId, referenceId } = payload
          if (ePaymentStatus === 'PAID' || ePaymentStatus === 'CHARGED') ePaymentStatus = 'SUCCESS'
          try {
            await db.sequelize.transaction({
              isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
            }, async (t) => {
              // const logData = { iDepositId: Number(orderId), iTransactionId: referenceId, eGateway: ePaymentGateway, eType: 'D', oRes: payload }
              // await queuePush('TransactionLog', logData) // not being used

              const deposit = await UserDepositModel.findOne({ where: { iOrderId: orderId }, order: [['id', 'DESC']], raw: true, transaction: t, lock: true })
              const { iUserId, nCash = 0, nBonus = 0, nAmount, eUserType } = deposit

              if (deposit.ePaymentStatus !== 'P') {
                if (deposit.ePaymentStatus === 'C' && ePaymentStatus === 'SUCCESS') {
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

                  // Update User Deposit details based on deposit-id or iOrderId - Entire Deposit payload updating as sInfo
                  const [updateDepositResult, oldBalance] = await Promise.all([
                    UserDepositModel.update({ ePaymentStatus: 'S', sInfo: JSON.stringify(payload), iTransactionId: referenceId, iOrderId: payload.orderId, dProcessedDate: new Date() }, { where: { id: deposit.id }, transaction: t, lock: true }),
                    UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
                  ])

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

                  await Promise.all([
                    PassbookModel.create({ iUserId, nAmount, nCash, nBonus, eUserType, dBonusExpiryDate, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eTransactionType: 'Deposit', iUserDepositId: deposit.id, eType: 'Cr', sRemarks: 'Amount has been deposited successfully', dActivityDate: new Date(), iTransactionId: referenceId, sPromocode: deposit.sPromocode, eStatus: 'CMP' }, { transaction: t, lock: true }),
                    StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, { $inc: { nActualBonus: Number(parseFloat(nBonus).toFixed(2)), nActualDepositBalance: Number(parseFloat(nCash).toFixed(2)), nDeposits: Number(parseFloat(nCash).toFixed(2)), nCash: Number(parseFloat(nCash).toFixed(2)), nBonus: Number((nBonus).toFixed(2)), nDepositCount: 1, nDepositDiscount: Number(parseFloat(nBonus).toFixed(2)) } }, { upsert: true })
                  ])
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
                          const refer = await userBalanceServices.referBonus({ iUserId: referredBy._id, rule: registerReferBonus, sReferCode: referredBy.sReferCode, sUserName: referredBy.sUsername, eType: referredBy.eType, nReferrals: 1, iReferById: iUserId })

                          if (refer.isSuccess === false) {
                            return resolve({ alreadySuccess: false, status: jsonStatus.BadRequest, message: messages.English.went_wrong_with.replace('##', messages.English.bonus), ePaymentStatus: 'S' })
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
                  return resolve({ alreadySuccess: false, status: jsonStatus.OK, message: messages.English.action_success.replace('##', messages.English.cDepositeHasBeenMade), ePaymentStatus: 'S' })
                } else {
                  return resolve({ alreadySuccess: true, status: jsonStatus.OK, message: messages.English.action_success.replace('##', messages.English.cDepositeHasBeenMade), ePaymentStatus: deposit.ePaymentStatus })
                }
              } else {
                const { iUserId, nCash = 0, nBonus = 0, nAmount, eUserType } = deposit

                if (ePaymentStatus === 'SUCCESS') {
                  let dBonusExpiryDate = new Date()
                  if (deposit.sPromocode) {
                    const promocode = await PromocodeModel.findOne({ sCode: deposit.sPromocode.toUpperCase() }, { nBonusExpireDays: 1 }).lean()
                    const { nBonusExpireDays = 0 } = promocode
                    if (nBonusExpireDays) {
                      dBonusExpiryDate.setDate(dBonusExpiryDate.getDate() + nBonusExpireDays)
                    } else { dBonusExpiryDate = null }
                  } else {
                    dBonusExpiryDate = null
                  }

                  const [updateDepositResult, oldBalance] = await Promise.all([
                    UserDepositModel.update({ ePaymentStatus: 'S', sInfo: JSON.stringify(payload), iTransactionId: referenceId, iOrderId: payload.orderId, dProcessedDate: new Date() }, { where: { id: deposit.id }, transaction: t, lock: true }),
                    UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
                  ])

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

                  await Promise.all([
                    PassbookModel.create({ iUserId, nAmount, nCash, nBonus, eUserType, dBonusExpiryDate, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eTransactionType: 'Deposit', iUserDepositId: deposit.id, eType: 'Cr', sRemarks: 'Amount has been deposited successfully', dActivityDate: new Date(), iTransactionId: referenceId, sPromocode: deposit.sPromocode, eStatus: 'CMP' }, { transaction: t, lock: true }),
                    StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, { $inc: { nActualBonus: Number(parseFloat(nBonus).toFixed(2)), nActualDepositBalance: Number(parseFloat(nCash).toFixed(2)), nDeposits: Number(parseFloat(nCash).toFixed(2)), nCash: Number(parseFloat(nCash).toFixed(2)), nBonus: Number((nBonus).toFixed(2)), nDepositCount: 1, nDepositDiscount: Number(parseFloat(nBonus).toFixed(2)) } }, { upsert: true })
                  ])
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
                          const refer = await userBalanceServices.referBonus({ iUserId: referredBy._id, rule: registerReferBonus, sReferCode: referredBy.sReferCode, sUserName: referredBy.sUsername, eType: referredBy.eType, nReferrals: 1, iReferById: iUserId })

                          if (refer.isSuccess === false) {
                            return resolve({ alreadySuccess: false, status: jsonStatus.BadRequest, message: messages.English.went_wrong_with.replace('##', messages.English.bonus), ePaymentStatus: 'S' })
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
                  return resolve({ alreadySuccess: false, status: jsonStatus.OK, message: messages.English.action_success.replace('##', messages.English.cDepositeHasBeenMade), ePaymentStatus: 'S' })
                } else { }
              }
            })
          } catch (error) {
            return resolve(error)
          }
        } catch (error) {
          return resolve(error)
        }
      })()
    })
  }

  /**
   * It'll validate deposit rate limit
   * @param { String } iUserId
   * @param { String } lang
   * @returns { Object } status of success or error
   */
  async validateDepositRateLimit(iUserId, lang) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (config.NODE_ENV !== 'production') {
            return resolve({ status: 'success' })
          }
          const depositRateLimit = await settingServices.findSetting('UserDepositRateLimit')
          const depositRateLimitTimeFrame = await settingServices.findSetting('UserDepositRateLimitTimeFrame')

          if (!depositRateLimit || !depositRateLimitTimeFrame) {
            return resolve({ status: 'success' })
          }

          const currentDate = new Date().toISOString()
          const fromDate = new Date(new Date().setMinutes(new Date().getMinutes() - parseInt(depositRateLimitTimeFrame.nMax))).toISOString()

          const { count } = await UserDepositModel.findAndCountAll({
            where: {
              iUserId,
              ePaymentStatus: 'P',
              dCreatedAt: {
                [Op.lte]: currentDate,
                [Op.gte]: fromDate
              }
            }
          })

          if (count >= parseInt(depositRateLimit.nMax)) {
            const limitExceed = { status: jsonStatus.TooManyRequest, message: messages[lang].limit_reached.replace('##', messages[lang].depositRequest) }
            return reject(limitExceed)
          }
          resolve({ status: 'success' })
        } catch (error) {
          reject(error)
        }
      })()
    })
  }

  async checkUserDepositStatus(req, res) {
    try {
      const iUserId = req.user._id.toString()
      const { id: orderId } = req.params
      let data
      const user = await UsersModel.countDocuments({ _id: iUserId })
      if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

      // Fetching Deposit details based on id and reference id
      await db.sequelize.transaction(
        {
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        },
        async (t) => {
          data = await UserDepositModel.findOne({ where: { iUserId, iOrderId: orderId }, attributes: ['id', 'iOrderId', 'ePaymentGateway', 'ePaymentStatus'], order: [['id', 'DESC']], raw: true, transaction: t, lock: true })
        })
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cDeposit) })

      let { ePaymentStatus, ePaymentGateway } = data

      if (ePaymentStatus === 'P' && ePaymentGateway !== 'ADMIN') {
        const logData = { iDepositId: data.id, iOrderId: orderId, eGateway: ePaymentGateway, eType: 'D', oReq: { sInfo: `${ePaymentGateway} payment gateway order payment status.` }, oRes: {} }

        if (['CASHFREE', 'CASHFREE_UPI'].includes(ePaymentGateway)) {
          const response = await getOrderPaymentStatus({ iDepositId: data.id, orderId })
          logData.oRes = response

          const { isSuccess, result = {} } = response

          if (isSuccess) {
            const postData = { txStatus: result.order_status, orderId, referenceId: result.cf_order_id }
            const { ePaymentStatus: eUpdatedStatus } = await this.updateBalance(postData, ePaymentGateway)
            if (eUpdatedStatus) ePaymentStatus = eUpdatedStatus
          }
        }
        // await queuePush('TransactionLog', logData)
        transactionLogQueue.publish(logData)
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cDeposit), data: { ...data, ePaymentStatus } })
    } catch (error) {
      return catchError('UserDeposit.checkUserDepositStatus', error, req, res)
    }
  }
}

module.exports = new UserDeposit()

/**
 * It will add users fields for admin deposit list
 * @param { Array } deposit
 * @param { Array } users
 * @returns { Object } user deposit data
 */
async function addUserFields(deposit, users = []) {
  let data
  const oUser = {}

  if (users.length) {
    data = users
  } else {
    const depositIds = deposit.map(p => ObjectId(p.iUserId))
    data = await UsersModel.find({ _id: { $in: depositIds } }, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean()
  }
  data.forEach((usr, i) => { oUser[usr._id.toString()] = i })

  return deposit.map(p => {
    const user = (typeof oUser[p.iUserId.toString()] === 'number') ? { ...data[oUser[p.iUserId.toString()]] } : {}
    // const user = data.find(u => u._id.toString() === p.iUserId.toString())
    return { ...p, ...user, _id: undefined }
  })
}
