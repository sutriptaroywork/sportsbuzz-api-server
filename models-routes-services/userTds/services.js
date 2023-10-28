const UserTdsModel = require('../userTds/model')
const StatisticsModel = require('../user/statistics/model')
const UsersModel = require('../user/model')
const { Op, literal, Transaction } = require('sequelize')
const db = require('../../database/sequelize')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, searchValues, handleCatchError, convertToDecimal } = require('../../helper/utilities.services')
const ObjectId = require('mongoose').Types.ObjectId
const { tdsStatus, userType } = require('../../data')
const KycModel = require('../kyc/model')
const MatchLeagueModel = require('../matchLeague/model')
const MatchModel = require('../match/model')
const moment = require('moment')
const UserBalanceModel = require('../userBalance/model')
const PassbookModel = require('../passbook/model')
const { calculateTDS } = require('../userWithdraw/common')
const { createXlsxFile } = require('../cron/common')
const { sendMailTo } = require('../../helper/email.service')
const config = require('../../config/config')

class UserTds {
  async adminList(req, res) {
    try {
      const { start = 0, limit = 10, datefrom, dateto, search, sort = 'dCreatedAt', order, isFullResponse, eStatus, eUserType, sportsType } = req.query
      const orderBy = order && order === 'asc' ? 'ASC' : 'DESC'

      const query = []
      let users = []

      if (search) {
        const userQuery = searchValues(search)
        users = await UsersModel.find(userQuery, { sMobNum: 1, sEmail: 1, sUsername: 1, eType: 1 }).lean()
        if (!users.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTds), data: [] })
      }

      if (datefrom && dateto) {
        query.push({ dCreatedAt: { [Op.gte]: new Date(datefrom) } })
        query.push({ dCreatedAt: { [Op.lte]: new Date(dateto) } })
      }

      const userIds = users.map(user => user._id.toString())
      if (users.length) {
        query.push({ iUserId: { [Op.in]: userIds } })
      }

      const paginationFields = [true, 'true'].includes(isFullResponse) ? {} : {
        offset: parseInt(start),
        limit: parseInt(limit)
      }

      if (eStatus && tdsStatus.includes(eStatus)) {
        query.push({ eStatus })
      }

      if (eUserType && userType.includes(eUserType)) {
        query.push({ eUserType })
      }

      if (sportsType) {
        query.push({ eCategory: sportsType })
      }

      const data = await UserTdsModel.findAll({
        where: {
          [Op.and]: query
        },
        order: [[sort, orderBy]],
        ...paginationFields,
        attributes: ['id', 'iUserId', 'iMatchId', 'iMatchLeagueId', 'nAmount', 'nOriginalAmount', 'nPercentage', 'dCreatedAt', 'iPassbookId', 'iTransactionId', 'eStatus', 'eUserType', 'nActualAmount', 'nEntryFee', 'eCategory'],
        raw: true
      })

      const tdsData = users.length ? await addUserFields(data, users) : await addUserFields(data)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTds), data: tdsData })
    } catch (error) {
      return catchError('UserTds.adminList', error, req, res)
    }
  }

  async getCounts(req, res) {
    try {
      const { datefrom, dateto, search, eStatus, eUserType, sportsType } = req.query

      const query = []
      let users = []

      if (search) {
        const userQuery = searchValues(search)
        users = await UsersModel.find(userQuery, { sMobNum: 1, sEmail: 1, sUsername: 1, eType: 1 }).lean()
        if (users.length === 0) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTds), data: { count: 0, rows: [] } })
      }

      if (datefrom && dateto) {
        query.push({ dCreatedAt: { [Op.gte]: new Date(datefrom) } })
        query.push({ dCreatedAt: { [Op.lte]: new Date(dateto) } })
      }

      const userIds = users.map(user => user._id.toString())
      if (users.length) {
        query.push({ iUserId: { [Op.in]: userIds } })
      }

      if (eStatus && tdsStatus.includes(eStatus)) {
        query.push({ eStatus })
      }

      if (eUserType && userType.includes(eUserType)) {
        query.push({ eUserType })
      }

      if (sportsType) {
        query.push({ eCategory: sportsType })
      }

      const count = await UserTdsModel.count({
        where: {
          [Op.and]: query
        },
        raw: true
      })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cCounts), data: { count } })
    } catch (error) {
      return catchError('UserTds.getCount', error, req, res)
    }
  }

  async update(req, res) {
    try {
      const { eStatus } = req.body

      const tds = await UserTdsModel.findOne({
        where: { id: req.params.id },
        attributes: ['id', 'iUserId', 'nAmount', 'nOriginalAmount', 'nPercentage', 'dCreatedAt', 'iPassbookId', 'eStatus', 'nActualAmount', 'nEntryFee'],
        raw: true
      })
      if (!tds) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cTds) })

      await UserTdsModel.update({ eStatus }, { where: { id: req.params.id } })

      const data = { ...tds, eStatus }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cTds), data })
    } catch (error) {
      return catchError('UserTds.update', error, req, res)
    }
  }

  async matchLeagueTdsList(req, res) {
    try {
      const { start = 0, limit = 10, datefrom, dateto, search, sort = 'dCreatedAt', order, isFullResponse, eStatus, eUserType } = req.query
      const orderBy = order && order === 'asc' ? 'ASC' : 'DESC'

      const query = []
      let users = []

      if (search) {
        const userQuery = searchValues(search)

        users = await UsersModel.find(userQuery, { sMobNum: 1, sEmail: 1, sUsername: 1, eType: 1 }).lean()
        if (!users.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTds), data: [] })
      }

      if (datefrom && dateto) {
        query.push({ dCreatedAt: { [Op.gte]: new Date(datefrom) } })
        query.push({ dCreatedAt: { [Op.lte]: new Date(dateto) } })
      }

      const userIds = users.map(user => user._id.toString())
      if (users.length) {
        query.push({ iUserId: { [Op.in]: userIds } })
      }

      const paginationFields = [true, 'true'].includes(isFullResponse) ? {} : {
        offset: parseInt(start),
        limit: parseInt(limit)
      }

      if (eStatus && tdsStatus.includes(eStatus)) {
        query.push({ eStatus })
      }

      if (eUserType && userType.includes(eUserType)) {
        query.push({ eUserType })
      }

      const data = await UserTdsModel.findAll({
        where: {
          [Op.or]: [{ iMatchLeagueId: req.params.id.toString() }, { iMatchId: req.params.id.toString() }],
          [Op.and]: query
        },
        order: [[sort, orderBy]],
        ...paginationFields,
        attributes: ['id', 'iUserId', 'iMatchId', 'iMatchLeagueId', 'nAmount', 'nOriginalAmount', 'nPercentage', 'dCreatedAt', 'iPassbookId', 'eStatus', 'eUserType', 'nActualAmount', 'nEntryFee', 'eCategory'],
        raw: true
      })
      const results = users.length ? await addUserFields(data, users) : await addUserFields(data)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTds), data: results })
    } catch (error) {
      return catchError('UserTds.matchLeagueTdsList', error, req, res)
    }
  }

  async matchLeagueTdsCount(req, res) {
    try {
      const { datefrom, dateto, search, eStatus, eUserType } = req.query

      const query = []
      let users = []

      if (search) {
        const userQuery = searchValues(search)

        users = await UsersModel.find(userQuery, { sMobNum: 1, sEmail: 1, sUsername: 1, eType: 1 }).lean()
        if (users.length === 0) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cTds), data: { count: 0, rows: [] } })
      }

      if (datefrom && dateto) {
        query.push({ dCreatedAt: { [Op.gte]: new Date(datefrom) } })
        query.push({ dCreatedAt: { [Op.lte]: new Date(dateto) } })
      }

      const userIds = users.map(user => user._id.toString())
      if (users.length) {
        query.push({ iUserId: { [Op.in]: userIds } })
      }

      if (eStatus && tdsStatus.includes(eStatus)) {
        query.push({ eStatus })
      }

      if (eUserType && userType.includes(eUserType)) {
        query.push({ eUserType })
      }

      const count = await UserTdsModel.count({
        where: {
          [Op.or]: [{ iMatchId: req.params.id.toString() }, { iMatchLeagueId: req.params.id.toString() }],
          // iMatchLeagueId: req.params.id.toString(),
          [Op.and]: query
        },
        raw: true
      })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cCounts), data: { count } })
    } catch (error) {
      return catchError('UserTds.matchLeagueTdsCount', error, req, res)
    }
  }

  async processTDSEndOfYear(req, res) {
    try {
      console.log('::---------TDS DEDUCTION STARTED---------::')
      deductTDSEndOfYear()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].cBackgroundProcess.replace('##', messages[req.userLanguage].tdsDeduction) })
    } catch (error) {
      handleCatchError(error)
    }
  }

  async getTDSBreakUp(req, res) {
    try {
      const { nAmount } = req.body
      const oData = {
        iUserId: req.user._id.toString(),
        nFinalAmount: Number(nAmount)
      }
      if (!nAmount) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].tds_calculate_error })
      const oUserBalance = await UserBalanceModel.findOne({ where: { iUserId: oData.iUserId }, attributes: ['nCurrentWinningBalance'], raw: true })
      if (!oUserBalance) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cBalance) })

      const { oTDS } = await calculateTDS(oData)
      if (nAmount > oUserBalance?.nCurrentWinningBalance) oTDS.bEligible = true

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].tdsBreakup), data: { ...oTDS } })
    } catch (error) {
      handleCatchError(error)
    }
  }

  async getTaxFreeAmount(req, res) {
    try {
      const oData = {
        iUserId: req.user._id.toString(),
        nFinalAmount: 0
      }
      const oUserBalance = await UserBalanceModel.findOne({ where: { iUserId: oData.iUserId }, attributes: ['nCurrentWinningBalance'], raw: true })
      if (!oUserBalance) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cBalance) })

      const { oTDS } = await calculateTDS(oData)
      let { nTaxFreeAmount, bEligible } = oTDS
      if (nTaxFreeAmount > oUserBalance?.nCurrentWinningBalance) bEligible = true
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cAmount), data: { nTaxFreeAmount, bEligible } })
    } catch (error) {
      handleCatchError(error)
    }
  }
}

module.exports = new UserTds()

/**
 * It will add users fields for admin tds list
 * @param { Array } tds
 * @param { Array } users
 * @returns { Object } user's kyc , payment and other details
 */
async function addUserFields(tds, users = []) {
  let data, kycData

  if (users.length) {
    data = users
  } else {
    const tdsIds = tds.map(p => ObjectId(p.iUserId))
    data = await UsersModel.find({ _id: { $in: tdsIds } }, { sMobNum: 1, sEmail: 1, sUsername: 1, eType: 1 }).lean()
    kycData = await KycModel.find({ iUserId: { $in: tdsIds } }, { oPan: 1, iUserId: 1 }).lean()
  }
  const aMatchLeagueId = tds.map(({ iMatchLeagueId }) => iMatchLeagueId)
  const aMatchId = tds.map(({ iMatchId }) => iMatchId)

  let aMatchLeagueData = []
  let aMatchData = []
  if (aMatchLeagueId.length) {
    aMatchLeagueData = await MatchLeagueModel.find({ _id: { $in: aMatchLeagueId } }, { sName: 1, iMatchId: 1 }).populate('oMatch', ['sName']).lean()
  }
  if (aMatchId.length) {
    aMatchData = await MatchModel.find({ _id: { $in: aMatchId } }, { sName: 1 }).lean()
  }
  return tds.map(p => {
    const user = data.find(u => u._id.toString() === p.iUserId.toString())
    let kyc = {}
    if (kycData && kycData.length) {
      kyc = kycData.find(u => u.iUserId.toString() === p.iUserId.toString())
    }
    const matchLeague = (p && p.iMatchLeagueId) ? aMatchLeagueData.find(({ _id }) => _id.toString() === p.iMatchLeagueId.toString()) : {}
    const oMatch = (p && p.iMatchId) ? aMatchData.find(({ _id }) => _id.toString() === p.iMatchId.toString()) : {}
    return { ...p, ...user, ...kyc, oMatch, ...matchLeague, _id: undefined }
  })
}

async function deductTDSEndOfYear() {
  try {
    // Need to Calculate all users tds at the end of financial year
    /**
     * EOY Formula For TDS: Closing Win Balance + nTotalWithdraw + nTotalDeposit + nOpeningBalance + nDeductedTaxableAmount
     */

    // Get the Financial Year Start and End Dates
    let FINANCIAL_YEAR_END_DATE = `${new Date().getFullYear() + 1}-03-31`
    FINANCIAL_YEAR_END_DATE = moment(new Date(FINANCIAL_YEAR_END_DATE)).endOf('day').toISOString()

    // Find Count of UserBalance Entries
    const nTotal = await UserBalanceModel.count({ where: { eUserType: 'U' } })
    const nLimit = 5000
    let nSkip = 0
    let nCount = 0
    const aUserTDSReportData = []
    // Pagination Logic for chunking
    while (nSkip < nTotal) {
      const aUserBalances = await UserBalanceModel.findAll({ where: { eUserType: 'U' }, limit: nLimit, offset: nSkip, raw: true })
      for (const oUserBalance of aUserBalances) {
        const { iUserId, nCurrentWinningBalance, nCurrentDepositBalance, nCurrentTotalBalance, nCurrentBonus } = oUserBalance
        // Check User Whose TDS deducted
        const oUserTDSExist = await UserTdsModel.findOne({ where: { iUserId, bIsEOFY: true, dCreatedAt: { [Op.eq]: FINANCIAL_YEAR_END_DATE } }, raw: true })
        if (oUserTDSExist) continue

        // Get TDS Breakup
        const { oTDS } = await calculateTDS({ iUserId, nFinalAmount: Number(nCurrentWinningBalance) })
        const { nTDSAmount, nPercentage, nTaxableAmount, nTotalWithdrawalAmount, nTotalDepositedAmount, nOpeningBalanceOfYear, nTotalProcessedAmount, dFinancialYear } = oTDS
        if (nTaxableAmount <= 0) continue

        // Make Report Required Data
        const oUserTDSData = {
          iUserId,
          nOldWinningBalance: nCurrentWinningBalance,
          nCurrentWinningBalance: nCurrentWinningBalance - nTDSAmount,
          nTotalWithdrawalAmount,
          nTotalDepositedAmount,
          nOpeningBalanceOfYear,
          nTotalProcessedAmount,
          nTaxableAmount,
          nTDSAmount,
          nPercentage,
          dFinancialYear
        }
        aUserTDSReportData.push(oUserTDSData)

        // SQL Transaction
        await db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          // Deduct TDS from UserBalance
          await UserBalanceModel.update({
            nCurrentTotalBalance: literal(`nCurrentTotalBalance - ${nTDSAmount}`),
            nCurrentWinningBalance: literal(`nCurrentWinningBalance - ${nTDSAmount}`)
          }, { where: { iUserId: iUserId }, transaction: t, lock: true })

          // Create Passbook Entry For TDS
          const passbook = await PassbookModel.create({
            iUserId,
            eTransactionType: 'TDS',
            eUserType: 'U',
            eType: 'Dr',
            nAmount: nTDSAmount,
            nCash: nTDSAmount,
            nOldWinningBalance: nCurrentWinningBalance,
            nOldDepositBalance: nCurrentDepositBalance,
            nOldTotalBalance: nCurrentTotalBalance,
            nOldBonus: nCurrentBonus,
            sRemarks: `You have paid ${nTDSAmount} ₹ as TDS on the withdrawal of ${nCurrentWinningBalance} ₹`,
            dActivityDate: new Date()
          }, { transaction: t, lock: true })

          // Create  UserTDS Entry
          await UserTdsModel.create({
            iUserId,
            nPercentage,
            nOriginalAmount: nCurrentWinningBalance,
            nAmount: nTDSAmount,
            nActualAmount: convertToDecimal(nCurrentWinningBalance - nTDSAmount),
            nTaxableAmount,
            iPassbookId: passbook.id,
            eUserType: 'U',
            eStatus: 'A',
            bIsEOFY: true,
            dCreatedAt: FINANCIAL_YEAR_END_DATE,
            dUpdatedAt: FINANCIAL_YEAR_END_DATE
          }, { transaction: t, lock: true })
        })

        // Update the User Statistics
        await StatisticsModel.updateOne(
          { iUserId: ObjectId(iUserId) },
          {
            $inc: {
              nActualWinningBalance: -Number(parseFloat(nTDSAmount).toFixed(2)),
              nTDSAmount: Number(parseFloat(nTDSAmount).toFixed(2)),
              nTDSCount: 1
            }
          },
          { upsert: true }
        )

        nCount++
      }
      nSkip += nLimit
    }
    generateTDSReports(aUserTDSReportData)
    console.log('Calculted COUNT::', nCount)
  } catch (error) {
    handleCatchError(error)
  }
}

async function generateTDSReports(aTDSData) {
  try {
    const schema = [
      {
        column: 'UserId',
        type: String,
        value: object => object.iUserId,
        width: '16.5pt',
        align: 'center'
      },
      {
        column: 'Old Winning Balance',
        type: Number,
        value: object => object.nOldWinningBalance,
        align: 'center'
      },
      {
        column: 'Current Winning Balance',
        type: Number,
        width: '16.5pt',
        value: object => object.nCurrentWinningBalance,
        align: 'center'
      },
      {
        column: 'Opening Balance of Year',
        type: Number,
        width: '16.5pt',
        value: object => object.nOpeningBalanceOfYear,
        align: 'center'
      },
      {
        column: 'Total Withdrawals',
        type: Number,
        value: object => object.nTotalWithdrawalAmount,
        width: '22.5pt',
        align: 'center'
      },
      {
        column: 'Total Deposits',
        type: Number,
        value: object => object.nTotalDepositedAmount,
        align: 'center',
        height: '12pt',
        span: 2
      },
      {
        column: 'Total TDS Amount',
        type: Number,
        value: object => object.nTotalProcessedAmount,
        align: 'center',
        width: '14.5pt'
      },
      {
        column: 'Taxable Amount',
        type: Number,
        value: object => object.nTaxableAmount,
        align: 'center'
      },
      {
        column: 'TDS Amount',
        type: Number,
        value: object => object.nTDSAmount,
        align: 'center'
      },
      {
        column: 'TDS Percentage',
        type: Number,
        value: object => object.nPercentage,
        align: 'center'
      },
      {
        column: 'Financial Year',
        type: String,
        value: object => object.dFinancialYear,
        align: 'center'
      }
    ]
    const file = await createXlsxFile(schema, aTDSData, `TDSReport_${new Date()}`)
    const oOptions = {
      from: `SportsBuzz11 ${config.SMTP_FROM}`,
      to: 'vaghesh.ext@sportsbuzz11.com',
      subject: `TDS Report of ${new Date()}`
    }
    await sendMailTo({ oAttachments: file, oOptions })
  } catch (error) {
    handleCatchError(error)
  }
}

// async processTDSEndOfYearForSP(req, res) {
//   try {
//     // Need to Call Stored Procedure for TDS Deduction
//     /**
//      * EOY Formula For TDS: Closing Win Balance + nTotalWithdraw + nTotalDeposit + nOpeningBalance + nDeductedTaxableAmount
//      */

//     const sTDSInitiated = await redisClient.get('InitiatedTDS')
//     if (sTDSInitiated) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].already_initiated.replace('##', messages[req.userLanguage].cTds) })
//     const dTDSInitiatedAt = moment(new Date()).format()
//     await redisClient.incr('InitiatedTDS')

//     // Get the Financial Year Start and End Dates
//     let FINANCIAL_YEAR_START_DATE = `${new Date().getFullYear()}-04-01`
//     let FINANCIAL_YEAR_END_DATE = `${new Date().getFullYear() + 1}-03-31`
//     FINANCIAL_YEAR_START_DATE = moment(new Date(FINANCIAL_YEAR_START_DATE)).endOf('day').format()
//     FINANCIAL_YEAR_END_DATE = moment(new Date(FINANCIAL_YEAR_END_DATE)).endOf('day').format()

//     // Get the Percentage Detail from Setting
//     let _nPercentage = 0
//     const tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }, { nMax: 1 }).lean()
//     if (tdsSetting) _nPercentage = tdsSetting.nMax

//     const procedureArgument = { replacements: { _nPercentage, _dStartDate: FINANCIAL_YEAR_START_DATE, _dEndDate: FINANCIAL_YEAR_END_DATE } }
//     let oSPResult = await db.sequelize.query('CALL bulkTDSDeduction(:_nPercentage, _dStartDate,_dEndDate,@_nTotalWithrawnAmount, @_nTotalDepositedAmount)', procedureArgument)
//     oSPResult = JSON.parse(JSON.stringify(oSPResult))
//     console.log(oSPResult)
//     // Admin log
//   } catch (error) {
//     handleCatchError(error)
//     await redisClient.del('InitiatedTDS')
//   }
// }
// processTDSEndOfYear2()
