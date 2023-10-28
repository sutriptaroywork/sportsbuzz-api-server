const UserWithdrawModel = require('./model')
const SettingModel = require('../setting/model')
const PassbookModel = require('../passbook/model')
const UserBalanceModel = require('../userBalance/model')
const UserTdsModel = require('../userTds/model')
const UserModel = require('../user/model')
const AdminModel = require('../admin/model')
const BankModel = require('../user/bankDetails/model')
const KycModel = require('../kyc/model')
const CredentialModel = require('../admin/credential.model')
const UsersModel = require('../user/model')
const PayoutOptionModel = require('../payoutOptions/model')
// const adminServices = require('../admin/subAdmin/services')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const db = require('../../database/sequelize')
const { literal, Op, Transaction, fn, col } = require('sequelize')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, getIp, convertToDecimal } = require('../../helper/utilities.services')
const StatisticsModel = require('../user/statistics/model')
const bcrypt = require('bcryptjs')
const { getAndProcessTDS } = require('../userWithdraw/common')
const { createTDSEntry } = require('./common')
const adminLogQueue = require('../../rabbitmq/queue/adminLogQueue')

const {
  getBenficiaryDetails,
  getUserBalance,
  requestTransfer
} = require('../../queue')
const settingServices = require('../setting/services')
const config = require('../../config/config')
const { redisClient, queuePush } = require('../../helper/redis')
const {
  reversedTransaction,
  successTransaction,
  cancellOrRejectTransaction
} = require('./common')
const { CASHFREE_ORDERID_PREFIX } = require('./../../config/common')
const { PAYOUT_STATUS_ENUMS } = require('../../enums/payoutStatusEnums/payoutStatusEnums')
const { getAdminWithdrawDepositListQuery } = require('./common')
const { REJECT_REASONS } = require('../../config/common')

const UserBalance = require('../userBalance/model')
const transactionLogQueue = require('../../rabbitmq/queue/transactionLogQueue')
class UserWithdraw {
  async adminList(req, res) {
    try {
      let {
        start = 0,
        limit = 10,
        sort = 'dCreatedAt',
        order,
        search,
        status: paymentStatus,
        method,
        datefrom,
        dateto,
        isFullResponse,
        reversedFlag
      } = req.query

      const orderBy = order && order === 'asc' ? 'ASC' : 'DESC'
      start = !start ? 0 : start
      limit = !limit ? 0 : limit
      sort = !sort ? 'dCreatedAt' : sort
      const { query, aUsers } = await getAdminWithdrawDepositListQuery(
        paymentStatus,
        method,
        search,
        'W',
        reversedFlag
      )

      if ((!datefrom || !dateto) && [true, 'true'].includes(isFullResponse)) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].date_filter_err
        })
      }

      if (datefrom && dateto) {
        query.push({ dWithdrawalTime: { [Op.gte]: datefrom } })
        query.push({ dWithdrawalTime: { [Op.lte]: dateto } })
      }

      const paginationFields = [true, 'true'].includes(isFullResponse)
        ? {}
        : {
          offset: parseInt(start),
          limit: parseInt(limit)
        }

      if (([true, 'true'].includes(isFullResponse))) query.push({ eUserType: 'U' })

      const data = await UserWithdrawModel.findAll({
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
          const aWithdrawUsers = await UserModel.find({ _id: { $in: aUserIds } }, { sName: 1, sUsername: 1, sMobNum: 1 }).lean()

          if (aWithdrawUsers.length) aUsers.push(...aWithdrawUsers)
        }
      }
      const withdrawData = await addUserFields(data, aUsers)

      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].success.replace(
          '##',
          messages[req.userLanguage].withdraw
        ),
        data: { rows: withdrawData }
      })
    } catch (error) {
      catchError('UserWithdraw.adminList', error, req, res)
    }
  }

  // To get counts of withdrawls with searching and filter
  async getCounts(req, res) {
    try {
      const {
        search,
        status: paymentStatus,
        method,
        datefrom,
        dateto,
        reversedFlag,
        isFullResponse
      } = req.query

      const { query } = await getAdminWithdrawDepositListQuery(
        paymentStatus,
        method,
        search,
        'W',
        reversedFlag
      )

      if (datefrom && dateto) {
        query.push({ dWithdrawalTime: { [Op.gte]: datefrom } })
        query.push({ dWithdrawalTime: { [Op.lte]: dateto } })
      }

      if (([true, 'true'].includes(isFullResponse))) query.push({ eUserType: 'U' })

      const count = await UserWithdrawModel.count({
        where: {
          [Op.and]: query
        },
        raw: true
      })

      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].success.replace(
          '##',
          `${messages[req.userLanguage].withdraw} ${messages[req.userLanguage].cCounts
          }`
        ),
        data: { count }
      })
    } catch (error) {
      catchError('UserWithdraw.getCounts', error, req, res)
    }
  }

  async adminWithdraw(req, res) {
    try {
      let { iUserId, nAmount, eType, sPassword, nBonus = 0 } = req.body
      let logData

      nAmount = Number(nAmount) || 0
      const iWithdrawalDoneBy = req.admin._id.toString()

      const pass = await CredentialModel.findOne({ eKey: 'PAY' }).lean()
      if (!bcrypt.compareSync(sPassword, pass.sPassword)) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].auth_failed
        })
      }
      const userData = await UsersModel.findById(iUserId, {
        eType: 1,
        sUsername: 1
      }).lean()
      if (!userData) {
        return res.status(status.Unauthorized).jsonp({
          status: jsonStatus.Unauthorized,
          message: messages[req.userLanguage].err_unauthorized
        })
      }

      try {
        const { eType: eUserType, sUsername } = userData
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          const oldWithdraw = await UserWithdrawModel.findOne(
            {
              where: { iUserId },
              order: [['id', 'DESC']],
              transaction: t,
              lock: true
            }
          )
          const nParentId = !oldWithdraw ? null : oldWithdraw.id
          const userWithdraw = await UserWithdrawModel.create(
            {
              iUserId,
              eUserType,
              nAmount,
              sIP: getIp(req),
              ePaymentGateway: 'ADMIN',
              ePaymentStatus: 'S',
              dWithdrawalTime: new Date(),
              dProcessedDate: new Date(),
              iWithdrawalDoneBy,
              nParentId
            },
            { transaction: t, lock: true }
          )
          const oldBalance = await UserBalanceModel.findOne(
            { where: { iUserId }, transaction: t, lock: true, raw: true }
          )
          const {
            nCurrentBonus: nOldBonus,
            nCurrentTotalBalance: nOldTotalBalance,
            nCurrentDepositBalance: nOldDepositBalance,
            nCurrentWinningBalance: nOldWinningBalance
          } = oldBalance

          let nCash = 0
          let nWin = 0
          if (eType === 'withdraw') {
            nCash = nAmount
            await UserBalanceModel.update(
              {
                nCurrentDepositBalance: literal(
                  `nCurrentDepositBalance - ${nAmount}`
                ),
                nCurrentTotalBalance: literal(
                  `nCurrentTotalBalance - ${nAmount}`
                ),
                nTotalWithdrawAmount: literal(
                  `nTotalWithdrawAmount + ${nAmount}`
                ),
                nTotalWithdrawCount: literal('nTotalWithdrawCount + 1')
              },
              {
                where: { iUserId },
                transaction: t,
                lock: true
              }
            )
          } else if (eType === 'winning') {
            nWin = nAmount
            await UserBalanceModel.update(
              {
                nCurrentWinningBalance: literal(
                  `nCurrentWinningBalance - ${nAmount}`
                ),
                nCurrentTotalBalance: literal(
                  `nCurrentTotalBalance - ${nAmount}`
                ),
                nTotalWithdrawAmount: literal(
                  `nTotalWithdrawAmount + ${nAmount}`
                ),
                nTotalWithdrawCount: literal('nTotalWithdrawCount + 1')
              },
              {
                where: { iUserId },
                transaction: t,
                lock: true
              }
            )
          }
          await PassbookModel.create(
            {
              iUserId,
              eUserType,
              nAmount,
              nCash: nAmount,
              nBonus,
              nOldBonus,
              nOldTotalBalance,
              nOldDepositBalance,
              nOldWinningBalance,
              eTransactionType: 'Withdraw',
              iWithdrawId: userWithdraw.id,
              eType: 'Dr',
              sRemarks: 'Withdraw by admin',
              dActivityDate: new Date(),
              eStatus: 'CMP'
            },
            { transaction: t, lock: true }
          )
          await StatisticsModel.updateOne(
            { iUserId: ObjectId(iUserId) },
            {
              $inc: {
                nActualWinningBalance: -Number(parseFloat(nWin).toFixed(2)),
                nActualDepositBalance: -Number(parseFloat(nCash).toFixed(2)),
                nWinnings: -Number(parseFloat(nWin).toFixed(2)),
                nTotalWinReturn: Number(parseFloat(nCash).toFixed(2)),
                nWithdraw: Number(parseFloat(nAmount).toFixed(2)),
                nWithdrawCount: 1
              }
            },
            { upsert: true }
          )

          logData = {
            oOldFields: {},
            oNewFields: {
              eType: nBonus
                ? 'BONUS'
                : eType === 'withdraw'
                  ? 'DEPOSIT'
                  : 'WINNING',
              nCash: nAmount,
              nBonus,
              iUserId,
              sUsername
            },
            sIP: getIp(req),
            iAdminId: ObjectId(req.admin._id),
            iUserId: ObjectId(iUserId),
            eKey: 'AW'
          }
          // await adminServices.adminLog(req, res, logData)
        })
      } catch (error) {
        return catchError('UserWithdraw.adminWithdraw', error, req, res)
      }
      if (logData) adminLogQueue.publish(logData);
      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].successfully.replace(
          '##',
          messages[req.userLanguage].withdraw
        )
      })
    } catch (error) {
      return catchError('UserWithdraw.adminWithdraw', error, req, res)
    }
  }

  async addV3(req, res) {
    try {
      let { nAmount } = req.body

      const payoutOption = await PayoutOptionModel.findById(
        req.params.id
      ).lean()
      if (!payoutOption || payoutOption.bEnable === false) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].not_exist.replace(
            '##',
            messages[req.userLanguage].invalid_payout
          )
        })
      }

      const { eKey: ePaymentGateway, nMinAmount, nMaxAmount } = payoutOption
      const nFee = payoutOption.nWithdrawFee

      nAmount = Number(nAmount) || 0
      const iUserId = req.user._id.toString()

      if (req.user.bIsInternalAccount === true) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].withdraw_not_permited.replace(
            '##',
            messages[req.userLanguage].internal_user
          )
        })
      }

      const withdrawValidation = await SettingModel.findOne({
        sKey: 'Withdraw'
      }).lean()
      if (!withdrawValidation) {
        return res.status(status.NotFound).jsonp({
          status: jsonStatus.NotFound,
          message: messages[req.userLanguage].not_exist.replace(
            '##',
            messages[req.userLanguage].cvalidationSetting
          )
        })
      }

      const symbol = await settingServices.getCurrencySymbol()
      if (nAmount < withdrawValidation.nMin) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].min_err
            .replace('##', messages[req.userLanguage].withdraw)
            .replace('#', `${withdrawValidation.nMin}`)
            .replace('₹', symbol)
        })
      }
      if (nAmount > withdrawValidation.nMax) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].max_err
            .replace('##', messages[req.userLanguage].withdraw)
            .replace('#', `${withdrawValidation.nMax}`)
            .replace('₹', symbol)
        })
      }

      let sErrorMessage = ''
      const user = await UserModel.findById(req.user._id).lean()
      if (!user.bIsMobVerified) {
        sErrorMessage = sErrorMessage
          ? sErrorMessage.concat(
            ` ${messages[req.userLanguage].mob_verify_err}`
          )
          : sErrorMessage.concat(messages[req.userLanguage].mob_verify_err)
      }

      const kycDetails = await KycModel.findOne({
        iUserId: req.user._id,
        $or: [{ 'oPan.eStatus': 'A' }, { 'oAadhaar.eStatus': 'A' }]
      }).lean()
      if (!kycDetails) {
        sErrorMessage = sErrorMessage
          ? sErrorMessage.concat(
            ` ${messages[req.userLanguage].kyc_not_approved}`
          )
          : sErrorMessage.concat(messages[req.userLanguage].kyc_not_approved)
      }
      if (kycDetails && kycDetails.oPan.eStatus !== 'A') {
        sErrorMessage = sErrorMessage
          ? sErrorMessage.concat(
            ` ${messages[req.userLanguage].pancard_not_approved}`
          )
          : sErrorMessage.concat(
            messages[req.userLanguage].pancard_not_approved
          )
      }
      if (kycDetails && kycDetails.oAadhaar.eStatus !== 'A') {
        sErrorMessage = sErrorMessage
          ? sErrorMessage.concat(
            ` ${messages[req.userLanguage].aadharcard_not_approved}`
          )
          : sErrorMessage.concat(
            messages[req.userLanguage].aadharcard_not_approved
          )
      }

      const bankDetails = await BankModel.findOne({
        iUserId: req.user._id
      }).lean()
      if (!bankDetails || !bankDetails.sAccountNo || !bankDetails.sIFSC) {
        sErrorMessage = sErrorMessage
          ? sErrorMessage.concat(
            ` ${messages[req.userLanguage].fill_bankdetails_err}`
          )
          : sErrorMessage.concat(
            messages[req.userLanguage].fill_bankdetails_err
          )
      }

      if (sErrorMessage) {
        return res
          .status(status.BadRequest)
          .jsonp({ status: jsonStatus.BadRequest, message: sErrorMessage })
      }

      let nWithdrawFee = 0
      if (nAmount >= nMinAmount && nAmount <= nMaxAmount) {
        nWithdrawFee = nFee
      }

      await this.validateWithdrawRateLimit(iUserId, req.userLanguage)

      try {
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          const oldWithdraw = await UserWithdrawModel.findOne(
            { where: { iUserId }, order: [['id', 'DESC']], transaction: t, lock: true }
          )
          const oldBalance = await UserBalanceModel.findOne(
            { where: { iUserId }, transaction: t, lock: true }
          )
          const existWithdraw = await UserWithdrawModel.findOne(
            {
              where: {
                iUserId,
                ePaymentStatus: 'P',
                ePaymentGateway: { [Op.ne]: 'ADMIN' }
              },
              attributes: [
                'id',
                'iUserId',
                'ePaymentGateway',
                'ePaymentStatus',
                'sInfo',
                'nAmount',
                'nParentId',
                'dWithdrawalTime',
                'iWithdrawalDoneBy',
                'nWithdrawFee',
                'ePlatform',
                'dProcessedDate',
                'dCreatedAt'
              ],
              transaction: t,
              lock: true
            }
          )
          if (existWithdraw) {
            return res.status(status.BadRequest).jsonp({
              status: jsonStatus.BadRequest,
              message: messages[req.userLanguage].pending_withdrawal_exists,
              data: { bPending: true, existWithdraw }
            })
          } else {
            const nParentId = !oldWithdraw ? null : oldWithdraw.id
            // const currentBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })

            // if (nAmount > currentBalance.nCurrentWinningBalance) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].insuff_balance.replace('##', messages[req.userLanguage].withdraw) })

            const {
              nCurrentBonus: nOldBonus,
              nCurrentTotalBalance: nOldTotalBalance,
              nCurrentDepositBalance: nOldDepositBalance,
              nCurrentWinningBalance: nOldWinningBalance
            } = oldBalance

            const updateObj = {
              nCurrentTotalBalance: literal(
                `nCurrentTotalBalance - ${nAmount}`
              ),
              nTotalWithdrawAmount: literal(
                `nTotalWithdrawAmount + ${nAmount}`
              ),
              nTotalWithdrawCount: literal('nTotalWithdrawCount + 1')
            }

            let updateStatsObj, resetFieldObj
            const winBifurcate = await settingServices.findSetting(
              'WinBifurcate'
            )
            if (!winBifurcate) {
              if (nAmount > nOldWinningBalance) {
                return res.status(status.BadRequest).jsonp({
                  status: jsonStatus.BadRequest,
                  message: messages[req.userLanguage].insuff_balance.replace(
                    '##',
                    messages[req.userLanguage].withdraw
                  )
                })
              }
              updateObj.nCurrentWinningBalance = literal(
                `nCurrentWinningBalance - ${nAmount}`
              )
              updateStatsObj = {
                nActualWinningBalance: -Number(parseFloat(nAmount).toFixed(2)),
                nWinnings: -Number(parseFloat(nAmount).toFixed(2))
              }
            } else {
              if (nOldWinningBalance < nAmount) {
                if (nOldWinningBalance < 0) {
                  if (nAmount > nOldDepositBalance) {
                    return res.status(status.BadRequest).jsonp({
                      status: jsonStatus.BadRequest,
                      message: messages[
                        req.userLanguage
                      ].insuff_balance.replace(
                        '##',
                        messages[req.userLanguage].withdraw
                      )
                    })
                  }
                  updateObj.nCurrentDepositBalance = literal(
                    `nCurrentDepositBalance - ${nAmount}`
                  )
                  updateStatsObj = {
                    nActualDepositBalance: -Number(
                      parseFloat(nAmount).toFixed(2)
                    ),
                    nCash: -Number(parseFloat(nAmount).toFixed(2))
                  }
                } else {
                  if (nOldDepositBalance - (nAmount - nOldWinningBalance) < 0) {
                    return res.status(status.BadRequest).jsonp({
                      status: jsonStatus.BadRequest,
                      message: messages[
                        req.userLanguage
                      ].insuff_balance.replace(
                        '##',
                        messages[req.userLanguage].withdraw
                      )
                    })
                  }

                  updateObj.nCurrentDepositBalance = literal(
                    `nCurrentDepositBalance - ${nAmount - nOldWinningBalance}`
                  )
                  updateObj.nCurrentWinningBalance = 0
                  updateStatsObj = {
                    nActualDepositBalance: -Number(
                      parseFloat(nAmount - nOldWinningBalance).toFixed(2)
                    ),
                    nCash: -Number(
                      parseFloat(nAmount - nOldWinningBalance).toFixed(2)
                    )
                  }
                  resetFieldObj = { nActualWinningBalance: 0, nWinnings: 0 }
                }
              } else {
                // if (nAmount > nOldDepositBalance) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].insuff_balance.replace('##', messages[req.userLanguage].withdraw) })

                updateObj.nCurrentWinningBalance = literal(
                  `nCurrentWinningBalance - ${nAmount}`
                )
                updateStatsObj = {
                  nActualWinningBalance: -Number(
                    parseFloat(nAmount).toFixed(2)
                  ),
                  nWinnings: -Number(parseFloat(nAmount).toFixed(2))
                }
              }
            }
            updateStatsObj = {
              ...updateStatsObj,
              nWithdraw: Number(parseFloat(nAmount).toFixed(2)),
              nWithdrawCount: 1
            }

            const userWithdraw = await UserWithdrawModel.create(
              {
                iUserId,
                eUserType: user.eType,
                nAmount,
                dWithdrawalTime: new Date(),
                nParentId,
                ePaymentGateway,
                nWithdrawFee
              },
              { transaction: t, lock: true }
            )

            await UserBalanceModel.update(updateObj, {
              where: { iUserId },
              transaction: t,
              lock: true
            })
            await PassbookModel.create(
              {
                iUserId,
                eUserType: user.eType,
                nAmount,
                nCash: nAmount,
                nOldBonus,
                nOldTotalBalance,
                nOldDepositBalance,
                nOldWinningBalance,
                eTransactionType: 'Withdraw',
                iWithdrawId: userWithdraw.id,
                eType: 'Dr',
                eStatus: 'CMP',
                sRemarks: 'Withdrawal successfully',
                nWithdrawFee
              },
              { transaction: t, lock: true }
            )
            await StatisticsModel.updateOne(
              { iUserId: ObjectId(iUserId) },
              { $inc: updateStatsObj, ...resetFieldObj },
              { upsert: true }
            )
            return res.status(status.OK).jsonp({
              status: jsonStatus.OK,
              message: messages[req.userLanguage].withdraw_request_success
            })
          }
        })
      } catch (error) {
        return catchError('UserWithdraw.addV3', error, req, res)
      }
    } catch (error) {
      const { status = '', message = '' } = error
      if (!status) {
        return catchError('UserWithdraw.addV3', error, req, res)
      }
      return res.status(status).jsonp({ status, message })
    }
  }

  async processWithdrawV2(req, res) {
    try {
      const { ePaymentStatus, reject_reason = '' } = req.body
      const { _id: iAdminId } = req.admin
      let logData
      /**
       * if ePaymentStatus = C && reject_reason = empty {
       *  store rejectReason in variable
       *  update rejectReason in database
       *  return error 'Reject reason is required' (fetch message from config.js)
       * }
       *
       */
      try {
        const oWithdraw = await UserWithdrawModel.findOne({ where: { id: req.params.id }, raw: true })

        if (ePaymentStatus === 'S' && oWithdraw.ePaymentStatus === 'P') {
          const { success: hasBalance, message: balanceSuccess } = await getUserBalance(oWithdraw.iUserId, req.params.id)
          if (!hasBalance) return res.status(status.NotAcceptable).jsonp({ status: jsonStatus.NotAcceptable, message: messages[req.userLanguage].error_payout_balance_check.replace('##', balanceSuccess) })

          const { success: BenficiaryExist, message: benSuccess } = await getBenficiaryDetails(oWithdraw.iUserId, req.params.id)
          if (!BenficiaryExist) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].error_payout_fetchOrAdd_Beneficiary.replace('##', benSuccess) })
        }

        await db.sequelize.transaction(
          {
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
          },
          async (t) => {
            const bProcessing = await redisClient.incr(
              `processWithdraw:${req.params.id}`
            )
            if (bProcessing > 1) {
              return res.status(status.BadRequest).jsonp({
                status: jsonStatus.BadRequest,
                message: messages[
                  req.userLanguage
                ].wait_for_proccessing.replace(
                  '##',
                  messages[req.userLanguage].withdraw
                )
              })
            }

            const withdraw = await UserWithdrawModel.findOne(
              {
                where: {
                  id: req.params.id,
                  ePaymentStatus: { [Op.in]: [PAYOUT_STATUS_ENUMS.PENDING, PAYOUT_STATUS_ENUMS.SUCCESS, PAYOUT_STATUS_ENUMS.INITIATED] }
                },
                raw: true,
                transaction: t,
                lock: true
              }
            )
            if (!withdraw) {
              await redisClient.del(`processWithdraw:${req.params.id}`)
              return res.status(status.BadRequest).jsonp({
                status: jsonStatus.BadRequest,
                message: messages[req.userLanguage].withdraw_process_err
              })
            } else {
              await redisClient.expire(`processWithdraw:${req.params.id}`, 20)
              const {
                iUserId,
                eUserType,
                nAmount,
                ePaymentStatus: ePaymentOldStatus,
                sInfo,
                ePlatform,
                sIP
              } = withdraw

              const oOldFields = {
                nAmount,
                ePaymentStatus: ePaymentOldStatus,
                sInfo,
                ePlatform,
                sIP
              }
              await UserWithdrawModel.update(
                {
                  iWithdrawalDoneBy: iAdminId.toString()
                },
                {
                  where: { id: req.params.id },
                  transaction: t,
                  lock: true
                }
              )
              const oldBalance = await UserBalanceModel.findOne(
                { where: { iUserId }, transaction: t, lock: true }
              )
              const {
                nCurrentBonus: nOldBonus,
                nCurrentTotalBalance: nOldTotalBalance,
                nCurrentDepositBalance: nOldDepositBalance,
                nCurrentWinningBalance: nOldWinningBalance
              } = oldBalance

              const dProcessedDate = new Date()

              if (ePaymentStatus === 'S') {
                if (ePaymentOldStatus === 'P') {
                  // ************** Add money to user account Remaining **************
                  const {
                    iUserId,
                    nAmount,
                    id: iWithdrawId,
                    nWithdrawFee = 0
                  } = withdraw

                  const passbook = await PassbookModel.findOne(
                    {
                      where: { iUserId, iWithdrawId: req.params.id },
                      attributes: ['id'],
                      transaction: t,
                      lock: true
                    }
                  )

                  const nFinalAmount = Number(nAmount - nWithdrawFee)
                  const oWithdrawalData = {
                    iUserId,
                    nFinalAmount,
                    iWithdrawId,
                    iAdminId,
                    iPassbookId: passbook.id,
                    oldBalance
                  }
                  // here, we need to calculate tds before process
                  const { isSuccess, oTDS, oData } = await getAndProcessTDS(oWithdrawalData)
                  console.log('TDS:::', oTDS)
                  if (!isSuccess || oData.nFinalAmount <= 0) {
                    return res.status(status.BadRequest).jsonp({
                      status: jsonStatus.BadRequest,
                      message: messages[req.userLanguage].withdraw_process_err
                    })
                  }
                  let {
                    success,
                    message,
                    sCurrentStatus,
                    referenceId
                  } = await requestTransfer(oData)
                  if (!referenceId) referenceId = null
                  if (success) {
                    await UserWithdrawModel.update(
                      {
                        ePaymentStatus: 'S',
                        iWithdrawalDoneBy: iAdminId.toString(),
                        dProcessedDate,
                        iTransactionId: referenceId
                      },
                      {
                        where: { id: req.params.id },
                        transaction: t,
                        lock: true
                      }
                    )
                    await PassbookModel.update(
                      { dProcessedDate },
                      {
                        where: { iWithdrawId: req.params.id },
                        transaction: t,
                        lock: true
                      }
                    )

                    // Create TDS Entry
                    const { nTDSAmount, nTaxableAmount, nPercentage, nRequestedAmount } = oTDS
                    const passbook = await PassbookModel.create({
                      iUserId,
                      eTransactionType: 'TDS',
                      eUserType: 'U',
                      eType: 'Dr',
                      nAmount: nTDSAmount,
                      nCash: nTDSAmount,
                      nOldWinningBalance,
                      nOldDepositBalance,
                      nOldTotalBalance,
                      nOldBonus,
                      sRemarks: `You have paid ${nTDSAmount} ₹ as TDS on the withdrawal of ${nRequestedAmount} ₹`,
                      dActivityDate: new Date()
                    }, { transaction: t, lock: true })

                    await UserTdsModel.create({
                      iUserId,
                      nPercentage,
                      nOriginalAmount: nTaxableAmount, // Amount on which TDS calculated
                      nAmount: nTDSAmount, // Actual TDS Amount
                      nActualAmount: convertToDecimal(nTaxableAmount - nTDSAmount), // Amount which will be given to user after TDS
                      nTaxableAmount,
                      iPassbookId: passbook.id,
                      eUserType: 'U',
                      eStatus: 'A'
                    }, { transaction: t, lock: true })

                    await queuePush('pushNotification:Withdraw', { iUserId, ePaymentStatus: 'S', sPushType: 'Transaction' })
                    await queuePush('pushNotification:TDS', { iUserId, ePaymentStatus: 'S', sPushType: 'Transaction', nRequestedAmount, nTDSAmount, nPercentage })
                  } else if (['PENDING', 'SUCCESS'].includes(sCurrentStatus)) {
                    await UserWithdrawModel.update(
                      {
                        ePaymentStatus: 'I',
                        iWithdrawalDoneBy: iAdminId.toString(),
                        dProcessedDate,
                        iTransactionId: referenceId
                      },
                      {
                        where: { id: req.params.id },
                        transaction: t,
                        lock: true
                      }
                    )
                    await PassbookModel.update(
                      { dProcessedDate },
                      {
                        where: { iWithdrawId: req.params.id },
                        transaction: t,
                        lock: true
                      }
                    )
                    return res.status(status.OK).jsonp({
                      status: jsonStatus.OK,
                      message: messages[req.userLanguage].successfully.replace(
                        '##',
                        messages[req.userLanguage].processWithdraw
                      )
                    })
                  } else {
                    return res.status(status.BadRequest).jsonp({
                      status: jsonStatus.BadRequest,
                      message: messages[
                        req.userLanguage
                      ].error_payout_process.replace('##', message)
                    })
                  }
                }
                if (ePaymentOldStatus === 'I') {
                  await UserWithdrawModel.update(
                    {
                      ePaymentStatus: 'S',
                      iWithdrawalDoneBy: iAdminId.toString(),
                      dProcessedDate
                    },
                    { where: { id: req.params.id }, transaction: t, lock: true }
                  )
                  await PassbookModel.update(
                    { dProcessedDate },
                    {
                      where: { iWithdrawId: req.params.id },
                      transaction: t,
                      lock: true
                    }
                  )
                  // Fetch TDS BreakUp
                  const oData = {
                    iUserId,
                    nFinalAmount: Number(nAmount)
                  }
                  await createTDSEntry(oData, t)
                }
                await queuePush('pushNotification:Withdraw', { iUserId, ePaymentStatus: 'S', sPushType: 'Transaction' })
              } else if (ePaymentStatus === 'C') {
                // If withdraw request for rejection but reject_reason is not set
                if (!reject_reason) {
                  return res.status(status.BadRequest).jsonp({
                    status: jsonStatus.BadRequest,
                    message: messages[req.userLanguage].reject_reason_required
                  })
                }
                // If reject_reason is uncategorized
                if (!REJECT_REASONS.includes(reject_reason)) {
                  return res.status(status.BadRequest).jsonp({
                    status: jsonStatus.BadRequest,
                    message: messages[req.userLanguage].reject_reason_invalid
                  })
                }

                const passbook = await PassbookModel.findOne(
                  { where: { iUserId, iWithdrawId: req.params.id }, transaction: t, lock: true }
                )

                if (!passbook) {
                  return res.status(status.NotFound).jsonp({
                    status: jsonStatus.NotFound,
                    message: messages[req.userLanguage].not_exist.replace(
                      '##',
                      messages[req.userLanguage].passbook
                    )
                  })
                }

                await UserWithdrawModel.update(
                  {
                    ePaymentStatus: 'R',
                    sInfo: reject_reason || '',
                    iWithdrawalDoneBy: iAdminId.toString(),
                    dProcessedDate
                  },
                  { where: { id: req.params.id }, transaction: t, lock: true }
                )
                await queuePush('pushNotification:Withdraw', { iUserId, ePaymentStatus: 'R', sPushType: 'Transaction' })

                let updateStatsObj
                const updateObj = {
                  nCurrentTotalBalance: literal(
                    `nCurrentTotalBalance + ${nAmount}`
                  ),
                  nTotalWithdrawAmount: literal(
                    `nTotalWithdrawAmount - ${nAmount}`
                  ),
                  nTotalWithdrawCount: literal('nTotalWithdrawCount - 1')
                }

                const winDiff =
                  passbook.nOldWinningBalance - passbook.nNewWinningBalance
                const depositDiff =
                  passbook.nOldDepositBalance - passbook.nNewDepositBalance
                if (depositDiff > 0) {
                  if (winDiff > 0) {
                    updateObj.nCurrentWinningBalance = literal(
                      `nCurrentWinningBalance + ${winDiff}`
                    )
                    updateObj.nCurrentDepositBalance = literal(
                      `nCurrentDepositBalance + ${depositDiff}`
                    )
                    updateStatsObj = {
                      nActualDepositBalance: Number(
                        parseFloat(depositDiff).toFixed(2)
                      ),
                      nCash: Number(parseFloat(depositDiff).toFixed(2)),
                      nActualWinningBalance: Number(
                        parseFloat(winDiff).toFixed(2)
                      ),
                      nWinnings: Number(parseFloat(winDiff).toFixed(2))
                    }
                  } else {
                    updateObj.nCurrentDepositBalance = literal(
                      `nCurrentDepositBalance + ${nAmount}`
                    )
                    updateStatsObj = {
                      nActualDepositBalance: Number(
                        parseFloat(nAmount).toFixed(2)
                      ),
                      nCash: Number(parseFloat(nAmount).toFixed(2))
                    }
                  }
                } else {
                  updateObj.nCurrentWinningBalance = literal(
                    `nCurrentWinningBalance + ${nAmount}`
                  )
                  updateStatsObj = {
                    nActualWinningBalance: Number(
                      parseFloat(nAmount).toFixed(2)
                    ),
                    nWinnings: Number(parseFloat(nAmount).toFixed(2))
                  }
                }
                updateStatsObj = {
                  ...updateStatsObj,
                  nWithdraw: -Number(parseFloat(nAmount).toFixed(2)),
                  nWithdrawCount: -1
                }

                await UserBalanceModel.update(updateObj, {
                  where: { iUserId },
                  transaction: t,
                  lock: true
                })
                await PassbookModel.create(
                  {
                    iUserId,
                    eUserType,
                    nAmount,
                    nCash: nAmount,
                    nOldBonus,
                    nOldTotalBalance,
                    nOldDepositBalance,
                    nOldWinningBalance,
                    eTransactionType: 'Withdraw-Return',
                    iWithdrawId: withdraw.id,
                    eType: 'Cr',
                    sRemarks: `${reject_reason}`,
                    dProcessedDate,
                    eStatus: 'R'
                  },
                  { transaction: t, lock: true }
                )
                await StatisticsModel.updateOne(
                  { iUserId: ObjectId(iUserId) },
                  { $inc: updateStatsObj },
                  { upsert: true }
                )
                const user = await UsersModel.find({ _id: iUserId }).lean()
                await queuePush('SendMail', {
                  sSlug: 'withdraw-rejected-email',
                  replaceData: {
                    reject_reason: reject_reason || 'unknown or uncategorized'
                  },
                  to: user.sEmail
                })
              }
              const oNewFields = {
                ...oOldFields,
                ePaymentStatus,
                sIP: getIp(req)
              }
              logData = {
                oOldFields,
                oNewFields,
                sIP: getIp(req),
                iAdminId: ObjectId(iAdminId),
                iUserId: ObjectId(iUserId),
                eKey: 'W'
              }
              await queuePush('pushNotification:Withdraw', { iUserId, ePaymentStatus: 'R', sPushType: 'Transaction' })

              // await adminServices.adminLog(req, res, logData)
              return res.status(status.OK).jsonp({
                status: jsonStatus.OK,
                message: messages[req.userLanguage].successfully.replace(
                  '##',
                  messages[req.userLanguage].processWithdraw
                )
              })
            }
          }
        )
      } catch (error) {
        return catchError('UserWithdraw.processWithdrawV2', error, req, res)
      }
      if (logData) adminLogQueue.publish(logData);
    } catch (error) {
      return catchError('UserWithdraw.processWithdrawV2', error, req, res)
    }
  }

  async userCancelWithdraw(req, res) {
    try {
      const { iWithdrawId } = req.params

      try {
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          const withdraw = await UserWithdrawModel.findOne(
            { where: { id: iWithdrawId, iUserId: req.user._id.toString() }, transaction: t, lock: true }
          )
          if (!withdraw) {
            return res.status(status.BadRequest).jsonp({
              status: jsonStatus.BadRequest,
              message: messages[req.userLanguage].not_exist.replace(
                '##',
                messages[req.userLanguage].withdraw
              )
            })
          }

          if (withdraw.ePaymentStatus !== 'P') {
            return res.status(status.BadRequest).jsonp({
              status: jsonStatus.BadRequest,
              message: messages[req.userLanguage].withdraw_process_err
            })
          }

          const { iUserId, nAmount, ePaymentGateway, eUserType } = withdraw
          const oldBalance = await UserBalanceModel.findOne(
            { where: { iUserId }, transaction: t, lock: true }
          )
          const {
            nCurrentBonus: nOldBonus,
            nCurrentTotalBalance: nOldTotalBalance,
            nCurrentDepositBalance: nOldDepositBalance,
            nCurrentWinningBalance: nOldWinningBalance
          } = oldBalance

          await UserWithdrawModel.update(
            {
              ePaymentStatus: 'C',
              sInfo: 'Withdraw cancelled by self.',
              dProcessedDate: new Date()
            },
            { where: { id: iWithdrawId }, transaction: t, lock: true }
          )

          let updateStatsObj
          const updateObj = {
            nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nAmount}`),
            nTotalWithdrawAmount: literal(`nTotalWithdrawAmount - ${nAmount}`),
            nTotalWithdrawCount: literal('nTotalWithdrawCount - 1')
          }
          const passbook = await PassbookModel.findOne(
            { where: { iUserId, iWithdrawId }, transaction: t, lock: true }
          )
          const winDiff =
            passbook.nOldWinningBalance - passbook.nNewWinningBalance
          const depositDiff =
            passbook.nOldDepositBalance - passbook.nNewDepositBalance
          if (depositDiff > 0) {
            if (winDiff > 0) {
              updateObj.nCurrentWinningBalance = literal(
                `nCurrentWinningBalance + ${winDiff}`
              )
              updateObj.nCurrentDepositBalance = literal(
                `nCurrentDepositBalance + ${depositDiff}`
              )
              updateStatsObj = {
                nActualDepositBalance: Number(
                  parseFloat(depositDiff).toFixed(2)
                ),
                nCash: Number(parseFloat(depositDiff).toFixed(2)),
                nActualWinningBalance: Number(parseFloat(winDiff).toFixed(2)),
                nWinnings: Number(parseFloat(winDiff).toFixed(2))
              }
            } else {
              updateObj.nCurrentDepositBalance = literal(
                `nCurrentDepositBalance + ${nAmount}`
              )
              updateStatsObj = {
                nActualDepositBalance: Number(parseFloat(nAmount).toFixed(2)),
                nCash: Number(parseFloat(nAmount).toFixed(2))
              }
            }
          } else {
            updateObj.nCurrentWinningBalance = literal(
              `nCurrentWinningBalance + ${nAmount}`
            )
            updateStatsObj = {
              nActualWinningBalance: Number(parseFloat(nAmount).toFixed(2)),
              nWinnings: Number(parseFloat(nAmount).toFixed(2))
            }
          }
          updateStatsObj = {
            ...updateStatsObj,
            nWithdraw: -Number(parseFloat(nAmount).toFixed(2)),
            nWithdrawCount: -1
          }

          await UserBalanceModel.update(updateObj, {
            where: { iUserId },
            transaction: t,
            lock: true
          })
          await PassbookModel.create(
            {
              iUserId,
              eUserType,
              nAmount,
              nCash: nAmount,
              nOldBonus,
              nOldTotalBalance,
              nOldDepositBalance,
              nOldWinningBalance,
              eTransactionType: 'Withdraw-Return',
              iWithdrawId: withdraw.id,
              eType: 'Cr',
              sRemarks: 'Withdraw cancelled by self.',
              eStatus: 'CNCL'
            },
            { transaction: t, lock: true }
          )
          await StatisticsModel.updateOne(
            { iUserId: ObjectId(iUserId) },
            { $inc: updateStatsObj },
            { upsert: true }
          )

          return res.status(status.OK).jsonp({
            status: jsonStatus.OK,
            message: messages[req.userLanguage].cancel_success.replace(
              '##',
              messages[req.userLanguage].withdraw
            )
          })
        })
      } catch (error) {
        return catchError('UserWithdraw.userCancelWithdraw', error, req, res)
      }
    } catch (error) {
      return catchError('UserWithdraw.userCancelWithdraw', error, req, res)
    }
  }

  async checkWithdrawRequestV2(req, res) {
    try {
      const iUserId = req.user._id.toString()
      const user = await UserModel.findById(req.user._id).lean()
      if (!user) {
        return res.status(status.Unauthorized).jsonp({
          status: jsonStatus.Unauthorized,
          message: messages[req.userLanguage].err_unauthorized
        })
      }

      if (user.bIsInternalAccount === true) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].withdraw_not_permited.replace(
            '##',
            messages[req.userLanguage].internal_user
          )
        })
      }
      try {
        let userWithdraw
        let bFlag = true
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          userWithdraw = await UserWithdrawModel.findOne(
            {
              where: {
                iUserId,
                ePaymentStatus: 'P',
                ePaymentGateway: { [Op.ne]: 'ADMIN' }
              },
              transaction: t,
              lock: true
            }
          )
          if (!userWithdraw) {
            bFlag = false
          }
        })
        if (!bFlag) {
          return res.status(status.OK).jsonp({
            status: jsonStatus.OK,
            message: messages[req.userLanguage].success.replace(
              '##',
              messages[req.userLanguage].withdraw
            ),
            data: { pending: false }
          })
        }
        userWithdraw.eUserType = undefined
        return res.status(status.OK).jsonp({
          status: jsonStatus.OK,
          message: messages[req.userLanguage].pending_withdrawal_exists,
          data: { pending: true, userWithdraw }
        })
      } catch (error) {
        return catchError('UserWithdraw.checkWithdrawLimitV2', error, req, res)
      }
    } catch (error) {
      return catchError('UserWithdraw.checkWithdrawRequestV2', error, req, res)
    }
  }

  async validateWithdrawRateLimit(iUserId, lang) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          if (config.NODE_ENV !== 'production') {
            return resolve({ status: 'success' })
          }

          const withdrawRateLimit = await settingServices.findSetting(
            'UserWithdrawRateLimit'
          )
          const withdrawRateLimitTimeFrame = await settingServices.findSetting(
            'UserWithdrawRateLimitTimeFrame'
          )

          if (!withdrawRateLimit || !withdrawRateLimitTimeFrame) {
            return resolve({ status: 'success' })
          }

          const currentDate = new Date().toISOString()
          const fromDate = new Date(
            new Date().setMinutes(
              new Date().getMinutes() -
              parseInt(withdrawRateLimitTimeFrame.nMax)
            )
          ).toISOString()

          const { count } = await UserWithdrawModel.findAndCountAll({
            where: {
              iUserId,
              dCreatedAt: {
                [Op.lte]: currentDate,
                [Op.gte]: fromDate
              }
            }
          })

          if (count >= parseInt(withdrawRateLimit.nMax)) {
            const limitExceed = {
              status: jsonStatus.TooManyRequest,
              message: messages[lang].limit_reached.replace(
                '##',
                messages[lang].cWithdrawRequest
              )
            }
            return reject(limitExceed)
          }

          resolve({ status: 'success' })
        } catch (error) {
          reject(error)
        }
      })()
    })
  }

  async cashfreeWebhook(req, res) {
    try {
      const postData = req.body
      const { event } = postData

      if (event === 'TRANSFER_REVERSED') {
        const iWithdrawId = Number(
          postData.transferId.toString().replaceAll(CASHFREE_ORDERID_PREFIX, '')
        )

        const logData = {
          iWithdrawId,
          eGateway: 'CASHFREE',
          eType: 'W',
          oReq: { sInfo: `Cashfree payout Webhook ${event} event.` },
          oRes: postData
        }
        // await queuePush('TransactionLog', logData)
        transactionLogQueue.publish(logData)

        await reversedTransaction(postData, iWithdrawId)
      }
      if (
        Number(postData.acknowledged) &&
        ['TRANSFER_SUCCESS', 'TRANSFER_ACKNOWLEDGED'].includes(event)
      ) {
        const iWithdrawId = Number(
          postData.transferId.toString().replaceAll(CASHFREE_ORDERID_PREFIX, '')
        )

        const logData = {
          iWithdrawId,
          eGateway: 'CASHFREE',
          eType: 'W',
          oReq: { sInfo: `Cashfree payout Webhook ${event} event.` },
          oRes: postData
        }
        // await queuePush('TransactionLog', logData)
        transactionLogQueue.publish(logData)

        if (iWithdrawId) await successTransaction(postData, iWithdrawId)
      }
      if (['TRANSFER_REJECTED', 'TRANSFER_FAILED'].includes(event)) {
        const iWithdrawId = Number(
          postData.transferId.toString().replaceAll(CASHFREE_ORDERID_PREFIX, '')
        )

        const logData = {
          iWithdrawId,
          eGateway: 'CASHFREE',
          eType: 'W',
          oReq: { sInfo: `Cashfree payout Webhook ${event} event.` },
          oRes: postData
        }
        // await queuePush('TransactionLog', logData)
        transactionLogQueue.publish(logData)

        const ePaymentStatus = event === 'TRANSFER_FAILED' ? 'C' : 'R'
        await cancellOrRejectTransaction(postData, ePaymentStatus, iWithdrawId)
      }
      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].action_success.replace(
          '##',
          messages[req.userLanguage].cresponseGet
        )
      })
    } catch (error) {
      return catchError('UserWithdraw.cashfreeWebhook', error, req, res)
    }
  }

  async isDebuggerMismatchOfWithdrawId(req, res) {
    try {
      const iUserId = req.params.iUserId
      const isMismatch = await isPaymentDebuggerMismatch(iUserId)
      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].action_success.replace(
          '##',
          messages[req.userLanguage].withdraw
        ),
        data: { isMismatch: isMismatch }
      })
    } catch (error) {
      return catchError('UserWithdraw.isDebuggerMismatchOfWithdrawId', error, req, res)
    }
  }
}

module.exports = new UserWithdraw()

async function isPaymentDebuggerMismatch(iUserId) {
  /**
   * Check data inside passbook and in statistics table are same or not:
   * if Not return false. Means Data is mismatch.
   */
  const [userBalance, statsData] = await Promise.all([
    await UserBalance.findOne({ where: { iUserId }, raw: true }),
    await StatisticsModel.findOne({ iUserId }).lean()
  ])

  if (!userBalance & !statsData) return true
  /**
   * Comparing userblance and stats
   * [Total Deposit][Total Withdrawal][Total Winnings][Total Bonus Earned]
   * [Current Winning Balance] [Current Bonus] [Current Deposit Balance]
   */
  switch (true) {
    case convertToDecimal(userBalance.nTotalDepositAmount) !== convertToDecimal(statsData.nDeposits):
      return true
    case convertToDecimal(userBalance.nTotalWithdrawAmount) !== convertToDecimal(statsData.nWithdraw):
      return true
    case convertToDecimal(userBalance.nTotalWinningAmount) !== convertToDecimal(statsData.nTotalWinnings):
      return true
    case convertToDecimal(userBalance.nTotalBonusEarned) !== convertToDecimal(statsData.nBonus):
      return true
    case (convertToDecimal(userBalance.nCurrentWinningBalance) - convertToDecimal(statsData.nActualWinningBalance)) !== 0:
      return true
    case (convertToDecimal(userBalance.nCurrentBonus) - convertToDecimal(statsData.nActualBonus)) !== 0:
      return true
    case (convertToDecimal(userBalance.nCurrentDepositBalance) - convertToDecimal(statsData.nActualDepositBalance)) !== 0:
      return true
  }

  // comparing [Total Played Cash]
  let nTotalPlayedCash = await PassbookModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eTransactionType: 'Play', iUserId }, raw: true })
  nTotalPlayedCash = nTotalPlayedCash.length ? convertToDecimal(!nTotalPlayedCash[0].total ? 0 : nTotalPlayedCash[0].total) : 0
  if (convertToDecimal(nTotalPlayedCash) !== convertToDecimal(statsData.nTotalPlayedCash)) return true

  // comparing [Total Played Bonus]
  let nTotalPlayedBonus = await PassbookModel.findAll({ attributes: [[fn('sum', col('nBonus')), 'total']], where: { eTransactionType: 'Play', iUserId, nBonus: { [Op.gt]: 0 } }, raw: true })
  nTotalPlayedBonus = nTotalPlayedBonus.length ? convertToDecimal(!nTotalPlayedBonus[0].total ? 0 : nTotalPlayedBonus[0].total) : 0
  if (convertToDecimal(nTotalPlayedBonus) !== convertToDecimal(statsData.nTotalPlayedBonus)) return true

  // comparing [Total Play Return Cash]
  let nTotalPlayReturnCash = await PassbookModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eTransactionType: 'Play-Return', iUserId }, raw: true })
  nTotalPlayReturnCash = nTotalPlayReturnCash.length ? convertToDecimal(!nTotalPlayReturnCash[0].total ? 0 : nTotalPlayReturnCash[0].total) : 0
  if (convertToDecimal(nTotalPlayReturnCash) !== convertToDecimal(statsData.nTotalPlayReturnCash)) return true

  // comparing [Total Play Return Bonus]
  let nTotalPlayReturnBonus = await PassbookModel.findAll({ attributes: [[fn('sum', col('nBonus')), 'total']], where: { eTransactionType: 'Play-Return', iUserId, nBonus: { [Op.gt]: 0 } }, raw: true })
  nTotalPlayReturnBonus = nTotalPlayReturnBonus.length ? convertToDecimal(!nTotalPlayReturnBonus[0].total ? 0 : nTotalPlayReturnBonus[0].total) : 0
  if (convertToDecimal(nTotalPlayReturnBonus) !== convertToDecimal(statsData.nTotalPlayReturnBonus)) return true
  return false
}

/**
 * It'll add users fields for admin withdraw list
 * @param { Array } withdraw
 * @param { Array } users
 * @returns { Array } of all users which are done withdraw
 */

async function addUserFields(withdraw, users = []) {
  let data
  const oUser = {}
  const oAdmin = {}
  const length = withdraw.length

  if (users.length) {
    data = users
  } else {
    const withdrawIds = withdraw.map((p) => ObjectId(p.iUserId))
    data = await UsersModel.find(
      { _id: { $in: withdrawIds } },
      { sMobNum: 1, sEmail: 1, sUsername: 1 }
    ).lean()
  }
  data.forEach((usr, i) => { oUser[usr._id.toString()] = i })

  const aAdminId = withdraw.map(({ iWithdrawalDoneBy }) => {
    if (iWithdrawalDoneBy) return ObjectId(iWithdrawalDoneBy)
  })

  const aAdmin = await AdminModel.find({ _id: { $in: aAdminId } }, {
    sUsername: 1,
    _id: 1
  }).lean()
  aAdmin.forEach((usr, i) => { oAdmin[usr._id.toString()] = i })

  for (let i = 0; i < length; i++) {
    const { iUserId, iWithdrawalDoneBy, ePaymentStatus } = withdraw[i]
    const user = (typeof oUser[iUserId.toString()] === 'number') ? { ...data[oUser[iUserId.toString()]] } : {}

    // const user = data.find((u) => u._id.toString() === iUserId.toString());
    if (user && !['P', 'C'].includes(ePaymentStatus) && iWithdrawalDoneBy) {
      // const admin = await AdminModel.findById(iWithdrawalDoneBy, {
      //   sUsername: 1,
      //   _id: 0,
      // }).lean();
      // const admin = aAdmin.find(({ _id }) => iWithdrawalDoneBy === _id.toString())

      const admin = (typeof oAdmin[iWithdrawalDoneBy.toString()] === 'number') ? { ...aAdmin[oAdmin[iWithdrawalDoneBy.toString()]] } : {}
      user.sName = !admin ? '' : admin.sUsername
    }
    withdraw[i] = { ...withdraw[i], ...user, _id: undefined }
  }

  return withdraw
}
