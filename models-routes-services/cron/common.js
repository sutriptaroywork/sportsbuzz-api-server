const config = require('../../config/config')
const PassbookModel = require('../passbook/model')
const UserBalanceModel = require('../userBalance/model')
const UserWithdrawModel = require('../userWithdraw/model')
const UserDepositModel = require('../userDeposit/model')
const { Op, literal, fn, col, Transaction } = require('sequelize')
const db = require('../../database/sequelize')
const axios = require('axios')
const StatisticsModel = require('../user/statistics/model')
const ObjectId = require('mongoose').Types.ObjectId
const { jsonStatus } = require('../../helper/api.responses')
const { queuePush } = require('../../helper/redis')
const { validateCashfreeToken } = require('../../queue')
const writeXlsxFile = require('write-excel-file/node')
// const path = require('path')
const { handleCatchError } = require('../../helper/utilities.services')
const { sendMailTo } = require('../../helper/email.service')
const { sequelize } = require('../../database/sequelize')
const UserModel = require('../user/model')
const transactionLogQueue = require('../../rabbitmq/queue/transactionLogQueue')
const checkCashfreePayoutStatus = async (iTransferId) => {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const data = await validateCashfreeToken()
        const { isVerify, Token } = data
        if (isVerify) {
          const response = await axios.get(`${config.CASHFREE_BASEURL}/${config.CASHFREE_TRANSFER_STATUS_PATH}?transferId=${iTransferId}`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Token}` } })

          const payload = response.data

          const logData = { iWithdrawId: iTransferId, eGateway: 'CASHFREE', eType: 'W', oReq: { iTransferId }, oRes: response ? response.data : {} }
          // await queuePush('TransactionLog', logData)
          transactionLogQueue.publish(logData)

          if (payload.status !== 'ERROR') {
            return resolve({ isSuccess: true, payload: payload.data })
          } else return resolve({ isSuccess: false, error: payload })
        } else {
          return resolve({ isSuccess: false, error: data })
        }
      } catch (error) {
        return resolve({ isSuccess: false, error: error })
      }
    })()
  })
}

const processPayout = async (withdraw, payload) => {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const { iUserId, id, nAmount, eUserType } = withdraw
        const { referenceId, beneId, status: ePaymentStatus, reason, transferMode } = payload.transfer
        const sRemarks = `PaymentStatus: ${ePaymentStatus}, ReferenceId: ${referenceId}, BeneficiaryId: ${beneId}, Reason: ${reason}, TransferMode: ${transferMode}`
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          const oldBalance = await UserBalanceModel.findOne({ where: { iUserId }, raw: true, transaction: t, lock: true })
          const { nCurrentBonus: nOldBonus, nCurrentTotalBalance: nOldTotalBalance, nCurrentDepositBalance: nOldDepositBalance, nCurrentWinningBalance: nOldWinningBalance } = oldBalance

          if (ePaymentStatus === 'SUCCESS') {
            await UserWithdrawModel.update({ ePaymentStatus: 'S', iTransactionId: referenceId, sInfo: JSON.stringify(payload.transfer), dProcessedDate: new Date() }, { where: { id }, transaction: t, lock: true })
            return resolve({ alreadySuccess: false, status: jsonStatus.OK })
          } else if (['FAILED', 'ERROR', 'REJECTED'].includes(ePaymentStatus)) {
            await UserWithdrawModel.update({ ePaymentStatus: 'R', dProcessedDate: new Date() }, { where: { id }, transaction: t, lock: true })

            let updateStatsObj
            const updateObj = {
              nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nAmount}`),
              nTotalWithdrawAmount: literal(`nTotalWithdrawAmount - ${nAmount}`),
              nTotalWithdrawCount: literal('nTotalWithdrawCount - 1')
            }
            const passbook = await PassbookModel.findOne({ where: { iUserId, iWithdrawId: id }, transaction: t, lock: true })
            const winDiff = passbook.nOldWinningBalance - passbook.nNewWinningBalance
            const depositDiff = passbook.nOldDepositBalance - passbook.nNewDepositBalance
            if (depositDiff > 0) {
              if (winDiff > 0) {
                updateObj.nCurrentWinningBalance = literal(`nCurrentWinningBalance + ${winDiff}`)
                updateObj.nCurrentDepositBalance = literal(`nCurrentDepositBalance + ${depositDiff}`)
                updateStatsObj = {
                  nActualDepositBalance: Number(parseFloat(depositDiff).toFixed(2)),
                  nCash: Number(parseFloat(depositDiff).toFixed(2)),
                  nActualWinningBalance: Number(parseFloat(winDiff).toFixed(2)),
                  nWinnings: Number(parseFloat(winDiff).toFixed(2))
                }
              } else {
                updateObj.nCurrentDepositBalance = literal(`nCurrentDepositBalance + ${nAmount}`)
                updateStatsObj = {
                  nActualDepositBalance: Number(parseFloat(nAmount).toFixed(2)),
                  nCash: Number(parseFloat(nAmount).toFixed(2))
                }
              }
            } else {
              updateObj.nCurrentWinningBalance = literal(`nCurrentWinningBalance + ${nAmount}`)
              updateStatsObj = {
                nActualWinningBalance: Number(parseFloat(nAmount).toFixed(2)),
                nWinnings: Number(parseFloat(nAmount).toFixed(2))
              }
            }
            updateStatsObj = { ...updateStatsObj, nWithdraw: -(Number(parseFloat(nAmount).toFixed(2))), nWithdrawCount: -1 }
            await UserBalanceModel.update(updateObj,
              {
                where: { iUserId },
                transaction: t,
                lock: true
              })
            await PassbookModel.create({ iUserId, eUserType, nAmount, nCash: nAmount, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eTransactionType: 'Withdraw-Return', iWithdrawId: withdraw.id, eType: 'Cr', sRemarks, eStatus: 'R' }, { transaction: t, lock: true })
            await StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, { $inc: updateStatsObj }, { upsert: true })
            return resolve({ alreadySuccess: false, status: jsonStatus.OK })
          } else if (ePaymentStatus === 'REVERSED') {
            await UserWithdrawModel.update({ bReversed: true, dReversedDate: new Date() }, { where: { id }, transaction: t, lock: true })
            return resolve({ alreadySuccess: false, status: jsonStatus.OK })
          } else {
            return resolve({ alreadySuccess: false, status: jsonStatus.OK })
          }
        })
      } catch (error) {
        return reject(error)
      }
    })()
  })
}

async function writeFileData(schema, objects, sDates) {
  try {
    const data = await writeXlsxFile(objects, {
      schema,
      headerStyle: {
        backgroundColor: '#ae1d4d',
        color: '#FFFFFF',
        borderColor: '#000000',
        align: 'center',
        rowSpan: 2,
        width: '14pt',
        height: '40.01pt'
      },
      buffer: true
    })

    const oAttachments = { // binary buffer as an attachment
      filename: `MatchReports_${sDates}).xlsx`,
      content: data
    }

    const oOptions = {
      from: `SportsBuzz11 ${config.SMTP_FROM}`,
      to: config.RECEIVER_EMAIL,
      subject: `${config.EMAIL_SUBJECT} of ${sDates}`
    }
    await sendMailTo({ oAttachments, oOptions })
  } catch (err) {
    return handleCatchError(err)
  }
}

async function createXlsxFile(schema, objects, sFileName) {
  try {
    const data = await writeXlsxFile(objects, {
      schema,
      headerStyle: {
        backgroundColor: '#ae1d4d',
        color: '#FFFFFF',
        borderColor: '#000000',
        align: 'center',
        rowSpan: 2,
        width: '30pt',
        height: '30pt'
      },
      buffer: true
    })

    return {
      filename: `${sFileName}.xlsx`,
      content: data
    }
  } catch (err) {
    return handleCatchError(err)
  }
}

async function userDepositInformation(aUserId) {
  try {
    const [oUserFirstDeposit, oUserTotalDeposit, oUserFirstDepositCount, nUserTotalDepositCount, aUserDepositId, aUser] = await Promise.all([
      sequelize.query('SELECT sum(a.nCash) as total from (SELECT  iUserId , nCash FROM userdeposits where iUserId in (:aUserId) and ePaymentStatus = :status group by iUserId) as a', { replacements: { aUserId, status: 'S' }, plain: true, raw: true }),
      UserDepositModel.findAll({ attributes: [[fn('sum', col('nCash')), 'nTotalDeposit']], where: { iUserId: { [Op.in]: aUserId }, ePaymentStatus: 'S' }, plain: true, raw: true }),
      sequelize.query('SELECT count(*) as total from (SELECT  iUserId , nCash FROM userdeposits where iUserId in (:aUserId) and ePaymentStatus = :status group by iUserId) as a', { replacements: { aUserId, status: 'S' }, plain: true, raw: true }),
      UserDepositModel.count({ where: { iUserId: { [Op.in]: aUserId }, ePaymentStatus: 'S' }, plain: true, raw: true }),
      UserDepositModel.findAll({ where: { iUserId: { [Op.in]: aUserId }, ePaymentStatus: 'S' }, attributes: [[fn('DISTINCT', col('iUserId')), 'iUserId']], raw: true }),
      UserModel.find({ _id: { $in: aUserId } }, { _id: 1 }).lean()
    ])
    const nUserFirstDeposit = oUserFirstDeposit?.total || 0
    const nUserTotalDeposit = oUserTotalDeposit?.nTotalDeposit || 0
    const nUserFirstDepositCount = oUserFirstDepositCount?.total || 0
    const aDepositUserId = aUserDepositId.map(d => d.iUserId)
    const aRegisterUserId = aUser.map(u => u._id.toString())
    return { nUserFirstDeposit, nUserTotalDeposit, nUserFirstDepositCount, nUserTotalDepositCount: nUserTotalDepositCount || 0, aDepositUserId, aRegisterUserId }
  } catch (error) {
    handleCatchError(error)
  }
}

module.exports = {
  checkCashfreePayoutStatus,
  processPayout,
  writeFileData,
  createXlsxFile,
  userDepositInformation
}
