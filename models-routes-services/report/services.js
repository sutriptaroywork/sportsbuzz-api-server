const ReportModel = require('./model')
const GeneralizeReportModel = require('./generalizeReports.model')
const UserLeagueModel = require('../userLeague/model')
const UserTeamModel = require('../userTeam/model')
const MatchLeagueModel = require('../matchLeague/model')
const MatchModel = require('../match/model')
const UsersModel = require('../user/model')
const AuthLogsModel = require('../user/authlogs.model')
const UserDepositModel = require('../userDeposit/model')
const UserWithdrawModel = require('../userWithdraw/model')
const UserTdsModel = require('../userTds/model')
const AppDownloadModel = require('../appDownload/model')
const { fn, col, Op } = require('sequelize')
const ObjectId = require('mongoose').Types.ObjectId
const PassbookModel = require('../passbook/model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError } = require('../../helper/utilities.services')
const { category, appPlatform } = require('../../data')
const { generateReport, getUserCount, calculatePassbook } = require('./common')
const { bAllowDiskUse } = require('../../config/config')
// eType change
class Report {
  async matchReport(req, res) {
    try {
      const iMatchId = ObjectId(req.params.id)

      const match = await MatchModel.findOne({ _id: iMatchId, eStatus: 'CMP', dStartDate: { $lt: new Date() } }).lean()
      if (!match) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_complete })

      const reportData = await ReportModel.findOne({ iMatchId: ObjectId(iMatchId) }).lean()
      if (reportData) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].creport), data: reportData })

      const reportsData = await generateReport(iMatchId)
      const { oPrivate, oPublic, oTotal } = reportsData

      await ReportModel.deleteOne({ iMatchId })
      const data = await ReportModel.create({ oPrivate, oPublic, ...oTotal, iMatchId })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].creport), data })
    } catch (error) {
      catchError('Report.matchReport', error, req, res)
    }
  }

  async updateMatchReport(req, res) {
    try {
      const iMatchId = ObjectId(req.params.id)

      const match = await MatchModel.findOne({ _id: iMatchId, eStatus: 'CMP', dStartDate: { $lt: new Date() } }).lean()
      if (!match) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_complete })

      const reportsData = await generateReport(iMatchId)
      const { oPrivate, oPublic, oTotal } = reportsData

      await ReportModel.deleteOne({ iMatchId })
      const data = await ReportModel.create({ oPrivate, oPublic, ...oTotal, iMatchId })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].creport), data })
    } catch (error) {
      catchError('Report.updateMatchReport', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const data = await ReportModel.findOne({ iMatchId: req.params.id }).lean()

      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].creport) }) }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].creport), data })
    } catch (error) {
      return catchError('Report.get', error, req, res)
    }
  }

  /*
    To get reports for
    1. Total Users
    2. Log In Users
    3. Registered Users
    4. User Bonus
    5. Bonus Expire
    6. Withdraw
    7. Deposit
  */
  async fetchReport(req, res) {
    try {
      const data = await GeneralizeReportModel.find({}).lean()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].cgeneralizeReport), data })
    } catch (error) {
      return catchError('Report.fetchReport', error, req, res)
    }
  }

  async fetchUserReport(req, res) {
    try {
      let report
      const { eKey, eType } = req.body

      const dateQuery = getDates()

      if (eKey === 'TU') {
        const oTotalUser = {}
        oTotalUser.nTotalUsers = await getUserCount({ eType })
        oTotalUser.nTotalEmailVerifiedUsers = await getUserCount({ bIsEmailVerified: true, eType })
        oTotalUser.nTotalPhoneVerifiedUsers = await getUserCount({ bIsMobVerified: true, eType })
        report = { oTotalUser: { ...oTotalUser, dUpdatedAt: new Date() } }
      } else if (eKey === 'RU') {
        const oRegisterUser = {}
        oRegisterUser.nToday = await getUserCount({ eType, dCreatedAt: dateQuery.toDay })
        oRegisterUser.nYesterday = await getUserCount({ eType, dCreatedAt: dateQuery.yesterDay })
        oRegisterUser.nLastWeek = await getUserCount({ eType, dCreatedAt: dateQuery.week })
        oRegisterUser.nLastMonth = await getUserCount({ eType, dCreatedAt: dateQuery.month })
        oRegisterUser.nLastYear = await getUserCount({ eType, dCreatedAt: dateQuery.year })
        oRegisterUser.aPlatformWiseUser = await AuthLogsModel.aggregate([
          {
            $match: {
              eType: 'R'
            }
          },
          {
            $group: {
              _id: '$ePlatform',
              count: {
                $sum: 1
              }
            }
          },
          {
            $project: {
              _id: 0,
              eTitle: '$_id',
              nValue: '$count'
            }
          }
        ]).allowDiskUse(bAllowDiskUse).exec()
        report = { oRegisterUser: { ...oRegisterUser, dUpdatedAt: new Date() } }
      } else if (eKey === 'LU') {
        const oLoginUser = {}
        oLoginUser.nToday = await UsersModel.countDocuments({ eType, dLoginAt: dateQuery.toDay })
        oLoginUser.nYesterday = await UsersModel.countDocuments({ eType, dLoginAt: dateQuery.yesterDay })
        oLoginUser.nLastWeek = await UsersModel.countDocuments({ eType, dLoginAt: dateQuery.week })
        oLoginUser.nLastMonth = await UsersModel.countDocuments({ eType, dLoginAt: dateQuery.month })
        oLoginUser.nLastYear = await UsersModel.countDocuments({ eType, dLoginAt: dateQuery.year })
        report = { oLoginUser: { ...oLoginUser, dUpdatedAt: new Date() } }
      } else if (eKey === 'TUT') {
        const oDeposit = {}
        const eUserType = eType
        const nTotalWinnings = await PassbookModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eTransactionType: 'Win', eUserType }, raw: true })
        oDeposit.nTotalWinnings = nTotalWinnings.length ? (!nTotalWinnings[0].total ? 0 : nTotalWinnings[0].total) : 0

        const nTotalDeposits = await UserDepositModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eUserType }, raw: true })
        oDeposit.nTotalDeposits = nTotalDeposits.length ? (!nTotalDeposits[0].total ? 0 : nTotalDeposits[0].total) : 0

        const nTotalPendingDeposits = await UserDepositModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eUserType, ePaymentStatus: 'P' }, raw: true })
        oDeposit.nTotalPendingDeposits = nTotalPendingDeposits.length ? (!nTotalPendingDeposits[0].total ? 0 : nTotalPendingDeposits[0].total) : 0

        const nTotalSuccessDeposits = await UserDepositModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eUserType, ePaymentStatus: 'S' }, raw: true })
        oDeposit.nTotalSuccessDeposits = nTotalSuccessDeposits.length ? (!nTotalSuccessDeposits[0].total ? 0 : nTotalSuccessDeposits[0].total) : 0

        const nTotalCancelledDeposits = await UserDepositModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eUserType, ePaymentStatus: 'C' }, raw: true })
        oDeposit.nTotalCancelledDeposits = nTotalCancelledDeposits.length ? (!nTotalCancelledDeposits[0].total ? 0 : nTotalCancelledDeposits[0].total) : 0

        const nTotalRejectedDeposits = await UserDepositModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eUserType, ePaymentStatus: 'R' }, raw: true })
        oDeposit.nTotalRejectedDeposits = nTotalRejectedDeposits.length ? (!nTotalRejectedDeposits[0].total ? 0 : nTotalRejectedDeposits[0].total) : 0

        oDeposit.aDeposits = await UserDepositModel.findAll({ attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nCash')), 'nValue']], group: 'ePaymentGateway', where: { eUserType, ePaymentGateway: { [Op.ne]: '' }, ePaymentStatus: 'S' }, raw: true })
        report = { oDeposit: { ...oDeposit, dUpdatedAt: new Date() } }
      } else if (eKey === 'W') {
        const eUserType = eType

        const [aSuccessWithdrawals, aPendingWithdrawals, aInitiatedWithdrawals, aCancelledWithdrawals, aRejectedWithdrawals] = await Promise.all([
          UserWithdrawModel.findAll({ attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nAmount')), 'nValue']], group: 'ePaymentGateway', where: { ePaymentGateway: { [Op.ne]: '' }, ePaymentStatus: 'S', eUserType }, raw: true }),
          UserWithdrawModel.findAll({ attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nAmount')), 'nValue']], group: 'ePaymentGateway', where: { ePaymentGateway: { [Op.ne]: '' }, ePaymentStatus: 'P', eUserType }, raw: true }),
          UserWithdrawModel.findAll({ attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nAmount')), 'nValue']], group: 'ePaymentGateway', where: { ePaymentGateway: { [Op.ne]: '' }, ePaymentStatus: 'I', eUserType }, raw: true }),
          UserWithdrawModel.findAll({ attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nAmount')), 'nValue']], group: 'ePaymentGateway', where: { ePaymentGateway: { [Op.ne]: '' }, ePaymentStatus: 'C', eUserType }, raw: true }),
          UserWithdrawModel.findAll({ attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nAmount')), 'nValue']], group: 'ePaymentGateway', where: { ePaymentGateway: { [Op.ne]: '' }, ePaymentStatus: 'R', eUserType }, raw: true })
        ])
        const oWithdraw = { aSuccessWithdrawals, aPendingWithdrawals, aInitiatedWithdrawals, aCancelledWithdrawals, aRejectedWithdrawals }

        oWithdraw.nTotalWithdrawals = oWithdraw.aSuccessWithdrawals.length ? oWithdraw.aSuccessWithdrawals.reduce((acc, { nValue }) => acc + nValue, 0) : 0
        report = { oWithdraw: { ...oWithdraw, dUpdatedAt: new Date() } }
      } else if (eKey === 'UB') {
        const oUserBonus = {}
        const eUserType = eType

        const nTotal = await PassbookModel.findAll({
          attributes: [[fn('sum', col('nBonus')), 'total']],
          where: {
            eUserType,
            [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { eTransactionType: 'Deposit', nBonus: { [Op.gt]: 0 } }, { eTransactionType: 'Cashback-Contest', nBonus: { [Op.gt]: 0 } }]
          },
          raw: true
        })
        oUserBonus.nTotal = nTotal.length ? (!nTotal[0].total ? 0 : nTotal[0].total) : 0

        const nToday = await PassbookModel.findAll({ attributes: [[fn('sum', col('nBonus')), 'total']], where: { eUserType, [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { eTransactionType: 'Deposit', nBonus: { [Op.gt]: 0 } }, { eTransactionType: 'Cashback-Contest', nBonus: { [Op.gt]: 0 } }], [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.toDay.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.toDay.$lt } }] }, raw: true })
        oUserBonus.nToday = nToday.length ? (!nToday[0].total ? 0 : nToday[0].total) : 0

        const nYesterday = await PassbookModel.findAll({ attributes: [[fn('sum', col('nBonus')), 'total']], where: { eUserType, [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { eTransactionType: 'Deposit', nBonus: { [Op.gt]: 0 } }, { eTransactionType: 'Cashback-Contest', nBonus: { [Op.gt]: 0 } }], [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.yesterDay.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.yesterDay.$lt } }] }, raw: true })
        oUserBonus.nYesterday = nYesterday.length ? (!nYesterday[0].total ? 0 : nYesterday[0].total) : 0

        const nLastWeek = await PassbookModel.findAll({ attributes: [[fn('sum', col('nBonus')), 'total']], where: { eUserType, [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { eTransactionType: 'Deposit', nBonus: { [Op.gt]: 0 } }, { eTransactionType: 'Cashback-Contest', nBonus: { [Op.gt]: 0 } }], [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.week.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.week.$lt } }] }, raw: true })
        oUserBonus.nLastWeek = nLastWeek.length ? (!nLastWeek[0].total ? 0 : nLastWeek[0].total) : 0

        const nLastMonth = await PassbookModel.findAll({ attributes: [[fn('sum', col('nBonus')), 'total']], where: { eUserType, [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { eTransactionType: 'Deposit', nBonus: { [Op.gt]: 0 } }, { eTransactionType: 'Cashback-Contest', nBonus: { [Op.gt]: 0 } }], [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.month.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.month.$lt } }] }, raw: true })
        oUserBonus.nLastMonth = nLastMonth.length ? (!nLastMonth[0].total ? 0 : nLastMonth[0].total) : 0

        const nLastYear = await PassbookModel.findAll({ attributes: [[fn('sum', col('nBonus')), 'total']], where: { eUserType, [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { eTransactionType: 'Deposit', nBonus: { [Op.gt]: 0 } }, { eTransactionType: 'Cashback-Contest', nBonus: { [Op.gt]: 0 } }], [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.year.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.year.$lt } }] }, raw: true })
        oUserBonus.nLastYear = nLastYear.length ? (!nLastYear[0].total ? 0 : nLastYear[0].total) : 0
        report = { oUserBonus: { ...oUserBonus, dUpdatedAt: new Date() } }
      } else if (eKey === 'BE') {
        const oBonusExpire = {}
        const eUserType = eType

        const nTotal = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eTransactionType: 'Bonus-Expire', eUserType }, raw: true })
        oBonusExpire.nTotal = nTotal.length ? (!nTotal[0].total ? 0 : nTotal[0].total) : 0

        const nToday = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'Bonus-Expire', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.toDay.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.toDay.$lt } }] }, raw: true })
        oBonusExpire.nToday = nToday.length ? (!nToday[0].total ? 0 : nToday[0].total) : 0

        const nYesterday = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'Bonus-Expire', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.yesterDay.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.yesterDay.$lt } }] }, raw: true })
        oBonusExpire.nYesterday = nYesterday.length ? (!nYesterday[0].total ? 0 : nYesterday[0].total) : 0

        const nLastWeek = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'Bonus-Expire', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.week.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.week.$lt } }] }, raw: true })
        oBonusExpire.nLastWeek = nLastWeek.length ? (!nLastWeek[0].total ? 0 : nLastWeek[0].total) : 0

        const nLastMonth = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'Bonus-Expire', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.month.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.month.$lt } }] }, raw: true })
        oBonusExpire.nLastMonth = nLastMonth.length ? (!nLastMonth[0].total ? 0 : nLastMonth[0].total) : 0

        const nLastYear = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'Bonus-Expire', [Op.and]: [{ dCreatedAt: { [Op.gte]: dateQuery.year.$gte } }, { dCreatedAt: { [Op.lte]: dateQuery.year.$lt } }] }, raw: true })
        oBonusExpire.nLastYear = nLastYear.length ? (!nLastYear[0].total ? 0 : nLastYear[0].total) : 0
        report = { oBonusExpire: { ...oBonusExpire, dUpdatedAt: new Date() } }
      } else if (eKey === 'TDS') {
        const oTds = {}
        const eUserType = eType

        const nTotalTds = await UserTdsModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType }, raw: true })
        oTds.nTotalTds = nTotalTds.length ? (!nTotalTds[0].total ? 0 : nTotalTds[0].total) : 0

        const nTotalActiveTds = await UserTdsModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eStatus: 'A', eUserType }, raw: true })
        oTds.nTotalActiveTds = nTotalActiveTds.length ? (!nTotalActiveTds[0].total ? 0 : nTotalActiveTds[0].total) : 0

        const nTotalPendingTds = await UserTdsModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eStatus: 'P', eUserType }, raw: true })
        oTds.nTotalPendingTds = nTotalPendingTds.length ? (!nTotalPendingTds[0].total ? 0 : nTotalPendingTds[0].total) : 0

        report = { oTds: { ...oTds, dUpdatedAt: new Date() } }
      } else {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
      }
      await GeneralizeReportModel.updateOne({ eType }, { ...report }, { upsert: true })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].creport), data: { ...report } })
    } catch (error) {
      return catchError('Report.fetchUserReport', error, req, res)
    }
  }

  async playReturnReport(req, res) {
    try {
      const { eCategory, eKey, eType } = req.body
      if (eKey !== 'PR') {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
      }
      const data = await GeneralizeReportModel.findOne({
        eType,
        aPlayReturn: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }).lean()
      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cPlayReturnReport) }) }

      const dateQuery = getDates()

      const sSport = eCategory.toUpperCase()
      const { playReturnCash: nTotalCash, playReturnBonus: nTotalBonus } = await fetchReportData(sSport, 'PlayReturn', eType, { $lte: new Date() })
      const { playReturnCash: nTodayCash, playReturnBonus: nTodayBonus } = await fetchReportData(sSport, 'PlayReturn', eType, dateQuery.toDay)
      const { playReturnCash: nYesterCash, playReturnBonus: nYesterBonus } = await fetchReportData(sSport, 'PlayReturn', eType, dateQuery.yesterDay)
      const { playReturnCash: nWeekCash, playReturnBonus: nWeekBonus } = await fetchReportData(sSport, 'PlayReturn', eType, dateQuery.week)
      const { playReturnCash: nMonthCash, playReturnBonus: nMonthBonus } = await fetchReportData(sSport, 'PlayReturn', eType, dateQuery.month)
      const { playReturnCash: nYearCash, playReturnBonus: nYearBonus } = await fetchReportData(sSport, 'PlayReturn', eType, dateQuery.year)

      const report = {
        'aPlayReturn.$.nTotalCash': nTotalCash || 0,
        'aPlayReturn.$.nTotalBonus': nTotalBonus || 0,
        'aPlayReturn.$.nTodayCash': nTodayCash || 0,
        'aPlayReturn.$.nTodayBonus': nTodayBonus || 0,
        'aPlayReturn.$.nYesterCash': nYesterCash || 0,
        'aPlayReturn.$.nYesterBonus': nYesterBonus || 0,
        'aPlayReturn.$.nWeekCash': nWeekCash || 0,
        'aPlayReturn.$.nWeekBonus': nWeekBonus || 0,
        'aPlayReturn.$.nMonthCash': nMonthCash || 0,
        'aPlayReturn.$.nMonthBonus': nMonthBonus || 0,
        'aPlayReturn.$.nYearCash': nYearCash || 0,
        'aPlayReturn.$.nYearBonus': nYearBonus || 0,
        'aPlayReturn.$.dUpdatedAt': new Date()
      }

      const updateData = await GeneralizeReportModel.findOneAndUpdate({
        eType,
        aPlayReturn: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }, { ...report }, { new: true, runValidators: true, upsert: true }).lean()
      const responseData = updateData.aPlayReturn.find(({ eCategory }) => eCategory === sSport)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cPlayReturnReport), data: responseData })
    } catch (error) {
      return catchError('Report.playReturnReport', error, req, res)
    }
  }

  async playReport(req, res) {
    try {
      const { eCategory, eKey, eType } = req.body

      const dateQuery = getDates()

      if (eKey !== 'PL') {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
      }
      const data = await GeneralizeReportModel.findOne({
        eType,
        aPlayed: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }).lean()
      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cPlayReport) }) }

      const sSport = eCategory.toUpperCase()
      const { playedCash: nTotalCash, playedBonus: nTotalBonus } = await fetchReportData(sSport, 'Played', eType, { $lte: new Date() })
      const { playedCash: nTodayCash, playedBonus: nTodayBonus } = await fetchReportData(sSport, 'Played', eType, dateQuery.toDay)
      const { playedCash: nYesterCash, playedBonus: nYesterBonus } = await fetchReportData(sSport, 'Played', eType, dateQuery.yesterDay)
      const { playedCash: nWeekCash, playedBonus: nWeekBonus } = await fetchReportData(sSport, 'Played', eType, dateQuery.week)
      const { playedCash: nMonthCash, playedBonus: nMonthBonus } = await fetchReportData(sSport, 'Played', eType, dateQuery.month)
      const { playedCash: nYearCash, playedBonus: nYearBonus } = await fetchReportData(sSport, 'Played', eType, dateQuery.year)

      const report = {
        'aPlayed.$.nTotalCash': nTotalCash,
        'aPlayed.$.nTotalBonus': nTotalBonus,
        'aPlayed.$.nTodayCash': nTodayCash,
        'aPlayed.$.nTodayBonus': nTodayBonus,
        'aPlayed.$.nYesterCash': nYesterCash,
        'aPlayed.$.nYesterBonus': nYesterBonus,
        'aPlayed.$.nWeekCash': nWeekCash,
        'aPlayed.$.nWeekBonus': nWeekBonus,
        'aPlayed.$.nMonthCash': nMonthCash,
        'aPlayed.$.nMonthBonus': nMonthBonus,
        'aPlayed.$.nYearCash': nYearCash,
        'aPlayed.$.nYearBonus': nYearBonus,
        'aPlayed.$.dUpdatedAt': new Date()
      }

      const updateData = await GeneralizeReportModel.findOneAndUpdate({
        eType,
        aPlayed: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }, { ...report }, { new: true, runValidators: true, upsert: true }).lean()
      const responseData = updateData.aPlayed.find(({ eCategory }) => eCategory === sSport)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cPlayReport), data: responseData })
    } catch (error) {
      return catchError('Report.playReport', error, req, res)
    }
  }

  async cashbackReport(req, res) {
    try {
      const { eCategory, eKey, eType } = req.body
      if (eKey !== 'CC') {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
      }
      const data = await GeneralizeReportModel.findOne({
        eType,
        aCashback: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }).lean()
      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cCashbackReport) }) }

      const dateQuery = getDates()

      const sSport = eCategory.toUpperCase()
      const { cashbackCash: nTotalCash, cashbackBonus: nTotalBonus } = await fetchReportData(sSport, 'Cashback', eType, { $lte: new Date() })
      const { cashbackCash: nTodayCash, cashbackBonus: nTodayBonus } = await fetchReportData(sSport, 'Cashback', eType, dateQuery.toDay)
      const { cashbackCash: nYesterCash, cashbackBonus: nYesterBonus } = await fetchReportData(sSport, 'Cashback', eType, dateQuery.yesterDay)
      const { cashbackCash: nWeekCash, cashbackBonus: nWeekBonus } = await fetchReportData(sSport, 'Cashback', eType, dateQuery.week)
      const { cashbackCash: nMonthCash, cashbackBonus: nMonthBonus } = await fetchReportData(sSport, 'Cashback', eType, dateQuery.month)
      const { cashbackCash: nYearCash, cashbackBonus: nYearBonus } = await fetchReportData(sSport, 'Cashback', eType, dateQuery.year)

      const report = {
        'aCashback.$.nTotalCash': nTotalCash || 0,
        'aCashback.$.nTotalBonus': nTotalBonus || 0,
        'aCashback.$.nTodayCash': nTodayCash || 0,
        'aCashback.$.nTodayBonus': nTodayBonus || 0,
        'aCashback.$.nYesterCash': nYesterCash || 0,
        'aCashback.$.nYesterBonus': nYesterBonus || 0,
        'aCashback.$.nWeekCash': nWeekCash || 0,
        'aCashback.$.nWeekBonus': nWeekBonus || 0,
        'aCashback.$.nMonthCash': nMonthCash || 0,
        'aCashback.$.nMonthBonus': nMonthBonus || 0,
        'aCashback.$.nYearCash': nYearCash || 0,
        'aCashback.$.nYearBonus': nYearBonus || 0,
        'aCashback.$.dUpdatedAt': new Date()
      }

      const updateData = await GeneralizeReportModel.findOneAndUpdate({
        eType,
        aCashback: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }, { ...report }, { new: true, runValidators: true, upsert: true }).lean()
      const responseData = updateData.aCashback.find(({ eCategory }) => eCategory === sSport)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cCashbackReport), data: responseData })
    } catch (error) {
      return catchError('Report.cashbackReport', error, req, res)
    }
  }

  async cashbackReturnReport(req, res) {
    try {
      const { eCategory, eKey, eType } = req.body
      if (eKey !== 'CR') {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
      }
      const data = await GeneralizeReportModel.findOne({
        eType,
        aCashbackReturn: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }).lean()
      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cCashbackReturnReport) }) }

      const dateQuery = getDates()

      const sSport = eCategory.toUpperCase()
      const { cashbackReturnCash: nTotalCash, cashbackReturnBonus: nTotalBonus } = await fetchReportData(sSport, 'CashbackReturn', eType, { $lte: new Date() })
      const { cashbackReturnCash: nTodayCash, cashbackReturnBonus: nTodayBonus } = await fetchReportData(sSport, 'CashbackReturn', eType, dateQuery.toDay)
      const { cashbackReturnCash: nYesterCash, cashbackReturnBonus: nYesterBonus } = await fetchReportData(sSport, 'CashbackReturn', eType, dateQuery.yesterDay)
      const { cashbackReturnCash: nWeekCash, cashbackReturnBonus: nWeekBonus } = await fetchReportData(sSport, 'CashbackReturn', eType, dateQuery.week)
      const { cashbackReturnCash: nMonthCash, cashbackReturnBonus: nMonthBonus } = await fetchReportData(sSport, 'CashbackReturn', eType, dateQuery.month)
      const { cashbackReturnCash: nYearCash, cashbackReturnBonus: nYearBonus } = await fetchReportData(sSport, 'CashbackReturn', eType, dateQuery.year)

      const report = {
        'aCashbackReturn.$.nTotalCash': nTotalCash || 0,
        'aCashbackReturn.$.nTotalBonus': nTotalBonus || 0,
        'aCashbackReturn.$.nTodayCash': nTodayCash || 0,
        'aCashbackReturn.$.nTodayBonus': nTodayBonus || 0,
        'aCashbackReturn.$.nYesterCash': nYesterCash || 0,
        'aCashbackReturn.$.nYesterBonus': nYesterBonus || 0,
        'aCashbackReturn.$.nWeekCash': nWeekCash || 0,
        'aCashbackReturn.$.nWeekBonus': nWeekBonus || 0,
        'aCashbackReturn.$.nMonthCash': nMonthCash || 0,
        'aCashbackReturn.$.nMonthBonus': nMonthBonus || 0,
        'aCashbackReturn.$.nYearCash': nYearCash || 0,
        'aCashbackReturn.$.nYearBonus': nYearBonus || 0,
        'aCashbackReturn.$.dUpdatedAt': new Date()
      }

      const updateData = await GeneralizeReportModel.findOneAndUpdate({
        eType,
        aCashbackReturn: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }, { ...report }, { new: true, runValidators: true, upsert: true }).lean()
      const responseData = updateData.aCashbackReturn.find(({ eCategory }) => eCategory === sSport)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cCashbackReturnReport), data: responseData })
    } catch (error) {
      return catchError('Report.cashbackReturnReport', error, req, res)
    }
  }

  async creatorBonusReport(req, res) {
    try {
      const { eCategory, eKey } = req.body
      if (eKey !== 'CB') {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
      }
      const data = await GeneralizeReportModel.findOne({
        eType: 'U',
        aCreatorBonus: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }).lean()
      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cCreatorBonusReport) }) }

      const dateQuery = getDates()

      const sSport = eCategory.toUpperCase()
      const nTotal = await fetchReportData(sSport, 'CreatorBonus', 'U', { $lte: new Date() })
      const nToday = await fetchReportData(sSport, 'CreatorBonus', 'U', dateQuery.toDay)
      const nYesterday = await fetchReportData(sSport, 'CreatorBonus', 'U', dateQuery.yesterDay)
      const nWeek = await fetchReportData(sSport, 'CreatorBonus', 'U', dateQuery.week)
      const nMonth = await fetchReportData(sSport, 'CreatorBonus', 'U', dateQuery.month)
      const nYear = await fetchReportData(sSport, 'CreatorBonus', 'U', dateQuery.year)

      const report = {
        'aCreatorBonus.$.nTotal': nTotal || 0,
        'aCreatorBonus.$.nToday': nToday || 0,
        'aCreatorBonus.$.nYesterday': nYesterday || 0,
        'aCreatorBonus.$.nLastWeek': nWeek || 0,
        'aCreatorBonus.$.nLastMonth': nMonth || 0,
        'aCreatorBonus.$.nLastYear': nYear || 0,
        'aCreatorBonus.$.dUpdatedAt': new Date()
      }

      const updateData = await GeneralizeReportModel.findOneAndUpdate({
        eType: 'U',
        aCreatorBonus: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }, { ...report }, { new: true, runValidators: true, upsert: true }).lean()
      const responseData = updateData.aCreatorBonus.find(({ eCategory }) => eCategory === sSport)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cCreatorBonusReport), data: responseData })
    } catch (error) {
      return catchError('Report.creatorBonusReport', error, req, res)
    }
  }

  async creatorBonusReturnReport(req, res) {
    try {
      const { eCategory, eKey } = req.body
      if (eKey !== 'CBR') {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
      }
      const data = await GeneralizeReportModel.findOne({
        eType: 'U',
        aCreatorBonusReturn: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }).lean()
      if (!data) {
        return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cCreatorBonusReturnReport) })
      }

      const dateQuery = getDates()

      const sSport = eCategory.toUpperCase()
      const nTotal = await fetchReportData(sSport, 'CreatorBonusReturn', 'U', { $lte: new Date() })
      const nToday = await fetchReportData(sSport, 'CreatorBonusReturn', 'U', dateQuery.toDay)
      const nYesterday = await fetchReportData(sSport, 'CreatorBonusReturn', 'U', dateQuery.yesterDay)
      const nWeek = await fetchReportData(sSport, 'CreatorBonusReturn', 'U', dateQuery.week)
      const nMonth = await fetchReportData(sSport, 'CreatorBonusReturn', 'U', dateQuery.month)
      const nYear = await fetchReportData(sSport, 'CreatorBonusReturn', 'U', dateQuery.year)

      const report = {
        'aCreatorBonusReturn.$.nTotal': nTotal || 0,
        'aCreatorBonusReturn.$.nToday': nToday || 0,
        'aCreatorBonusReturn.$.nYesterday': nYesterday || 0,
        'aCreatorBonusReturn.$.nLastWeek': nWeek || 0,
        'aCreatorBonusReturn.$.nLastMonth': nMonth || 0,
        'aCreatorBonusReturn.$.nLastYear': nYear || 0,
        'aCreatorBonusReturn.$.dUpdatedAt': new Date()
      }

      const updateData = await GeneralizeReportModel.findOneAndUpdate({
        eType: 'U',
        aCreatorBonusReturn: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }, { ...report }, { new: true, runValidators: true, upsert: true }).lean()
      const responseData = updateData.aCreatorBonusReturn.find(({ eCategory }) => eCategory === sSport)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cCreatorBonusReturnReport), data: responseData })
    } catch (error) {
      return catchError('Report.creatorBonusReturnReport', error, req, res)
    }
  }

  async fetchWinReport(req, res) {
    try {
      const { eCategory, eKey, eType } = req.body
      if (eKey !== 'TW') {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
      }
      const data = await GeneralizeReportModel.findOne({
        eType,
        aWins: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }).lean()
      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cWinningReport) }) }

      const dateQuery = getDates()

      const sSport = eCategory.toUpperCase()
      const { winCash: nTotalCash, winBonus: nTotalBonus } = await fetchReportData(sSport, 'Wins', eType, { $lte: new Date() })
      const { winCash: nTodayCash, winBonus: nTodayBonus } = await fetchReportData(sSport, 'Wins', eType, dateQuery.toDay)
      const { winCash: nYesterCash, winBonus: nYesterBonus } = await fetchReportData(sSport, 'Wins', eType, dateQuery.yesterDay)
      const { winCash: nWeekCash, winBonus: nWeekBonus } = await fetchReportData(sSport, 'Wins', eType, dateQuery.week)
      const { winCash: nMonthCash, winBonus: nMonthBonus } = await fetchReportData(sSport, 'Wins', eType, dateQuery.month)
      const { winCash: nYearCash, winBonus: nYearBonus } = await fetchReportData(sSport, 'Wins', eType, dateQuery.year)

      const report = {
        'aWins.$.nTotalCash': nTotalCash || 0,
        'aWins.$.nTotalBonus': nTotalBonus || 0,
        'aWins.$.nTodayCash': nTodayCash || 0,
        'aWins.$.nTodayBonus': nTodayBonus || 0,
        'aWins.$.nYesterCash': nYesterCash || 0,
        'aWins.$.nYesterBonus': nYesterBonus || 0,
        'aWins.$.nWeekBonus': nWeekBonus || 0,
        'aWins.$.nWeekCash': nWeekCash || 0,
        'aWins.$.nMonthCash': nMonthCash || 0,
        'aWins.$.nMonthBonus': nMonthBonus || 0,
        'aWins.$.nYearCash': nYearCash || 0,
        'aWins.$.nYearBonus': nYearBonus || 0,
        'aWins.$.dUpdatedAt': new Date()
      }

      const updateData = await GeneralizeReportModel.findOneAndUpdate({
        eType,
        aWins: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }, { ...report }, { new: true, runValidators: true, upsert: true }).lean()
      const responseData = updateData.aWins.find(({ eCategory }) => eCategory === sSport)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cWinningReport), data: responseData })
    } catch (error) {
      return catchError('Report.fetchWinReport', error, req, res)
    }
  }

  async fetchWinReturnReport(req, res) {
    try {
      const { eCategory, eKey, eType } = req.body
      if (eKey !== 'TWR') {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
      }
      const data = await GeneralizeReportModel.findOne({
        eType,
        aWinReturn: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }).lean()
      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cWinningReturnReport) }) }

      const dateQuery = getDates()

      const sSport = eCategory.toUpperCase()
      const { winReturnCash: nTotalCash, winReturnBonus: nTotalBonus } = await fetchReportData(sSport, 'Wins-Return', eType, { $lte: new Date() })
      const { winReturnCash: nTodayCash, winReturnBonus: nTodayBonus } = await fetchReportData(sSport, 'Wins-Return', eType, dateQuery.toDay)
      const { winReturnCash: nYesterCash, winReturnBonus: nYesterBonus } = await fetchReportData(sSport, 'Wins-Return', eType, dateQuery.yesterDay)
      const { winReturnCash: nWeekCash, winReturnBonus: nWeekBonus } = await fetchReportData(sSport, 'Wins-Return', eType, dateQuery.week)
      const { winReturnCash: nMonthCash, winReturnBonus: nMonthBonus } = await fetchReportData(sSport, 'Wins-Return', eType, dateQuery.month)
      const { winReturnCash: nYearCash, winReturnBonus: nYearBonus } = await fetchReportData(sSport, 'Wins-Return', eType, dateQuery.year)

      const report = {
        'aWinReturn.$.nTotalCash': nTotalCash || 0,
        'aWinReturn.$.nTotalBonus': nTotalBonus || 0,
        'aWinReturn.$.nTodayCash': nTodayCash || 0,
        'aWinReturn.$.nTodayBonus': nTodayBonus || 0,
        'aWinReturn.$.nYesterCash': nYesterCash || 0,
        'aWinReturn.$.nYesterBonus': nYesterBonus || 0,
        'aWinReturn.$.nWeekBonus': nWeekBonus || 0,
        'aWinReturn.$.nWeekCash': nWeekCash || 0,
        'aWinReturn.$.nMonthCash': nMonthCash || 0,
        'aWinReturn.$.nMonthBonus': nMonthBonus || 0,
        'aWinReturn.$.nYearCash': nYearCash || 0,
        'aWinReturn.$.nYearBonus': nYearBonus || 0,
        'aWinReturn.$.dUpdatedAt': new Date()
      }

      const updateData = await GeneralizeReportModel.findOneAndUpdate({
        eType,
        aWinReturn: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }, { ...report }, { new: true, runValidators: true, upsert: true }).lean()
      const responseData = updateData.aWinReturn.find(({ eCategory }) => eCategory === sSport)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cWinningReturnReport), data: responseData })
    } catch (error) {
      return catchError('Report.fetchWinReturnReport', error, req, res)
    }
  }

  async fetchTeamReport(req, res) {
    try {
      const { eCategory, eKey, eType } = req.body
      if (eKey !== 'UT') {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
      }
      const data = await GeneralizeReportModel.findOne({
        eType,
        aTeams: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }).lean()
      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cTeamsReport) }) }

      const dateQuery = getDates()

      const sSport = eCategory.toUpperCase()
      const { nTotalTeams: nTotal } = await fetchTotalTeam(sSport, { $lte: new Date() }, eType)
      const { nTotalTeams: nToday } = await fetchTotalTeam(sSport, dateQuery.toDay, eType)
      const { nTotalTeams: nYesterday } = await fetchTotalTeam(sSport, dateQuery.yesterDay, eType)
      const { nTotalTeams: nLastWeek } = await fetchTotalTeam(sSport, dateQuery.week, eType)
      const { nTotalTeams: nLastMonth } = await fetchTotalTeam(sSport, dateQuery.month, eType)
      const { nTotalTeams: nLastYear } = await fetchTotalTeam(sSport, dateQuery.year, eType)

      const report = {
        'aTeams.$.nTotal': nTotal || 0,
        'aTeams.$.nToday': nToday || 0,
        'aTeams.$.nYesterday': nYesterday || 0,
        'aTeams.$.nLastWeek': nLastWeek || 0,
        'aTeams.$.nLastMonth': nLastMonth || 0,
        'aTeams.$.nLastYear': nLastYear || 0,
        'aTeams.$.dUpdatedAt': new Date()
      }
      const updateData = await GeneralizeReportModel.findOneAndUpdate({
        eType,
        aTeams: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }, { ...report }, { new: true, runValidators: true }).lean()
      const responseData = updateData.aTeams.find(({ eCategory }) => eCategory === sSport)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cTeamsReport), data: responseData })
    } catch (error) {
      return catchError('Report.fetchTeamReport', error, req, res)
    }
  }

  async fetchParticipantReport(req, res) {
    try {
      const { eCategory, eKey, eType } = req.body
      if (eKey !== 'LP') {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
      }
      const data = await GeneralizeReportModel.findOne({
        eType,
        aParticipants: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }).lean()
      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cParticipantReport) }) }

      const dateQuery = getDates()

      const sSport = eCategory.toUpperCase()
      const { nTotals: nTotal } = await fetchParticipants(sSport, { $lte: new Date() }, eType)
      const { nTotals: nToday } = await fetchParticipants(sSport, dateQuery.toDay, eType)
      const { nTotals: nYesterday } = await fetchParticipants(sSport, dateQuery.yesterDay, eType)
      const { nTotals: nLastWeek } = await fetchParticipants(sSport, dateQuery.week, eType)
      const { nTotals: nLastMonth } = await fetchParticipants(sSport, dateQuery.month, eType)
      const { nTotals: nLastYear } = await fetchParticipants(sSport, dateQuery.year, eType)

      const report = {
        'aParticipants.$.nTotal': nTotal || 0,
        'aParticipants.$.nToday': nToday || 0,
        'aParticipants.$.nYesterday': nYesterday || 0,
        'aParticipants.$.nLastWeek': nLastWeek || 0,
        'aParticipants.$.nLastMonth': nLastMonth || 0,
        'aParticipants.$.nLastYear': nLastYear || 0,
        'aParticipants.$.dUpdatedAt': new Date()
      }
      const updateData = await GeneralizeReportModel.findOneAndUpdate({
        eType,
        aParticipants: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }, { ...report }, { new: true, runValidators: true }).lean()
      const responseData = updateData.aParticipants.find(({ eCategory }) => eCategory === sSport)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cParticipantReport), data: responseData })
    } catch (error) {
      return catchError('Report.fetchParticipantReport', error, req, res)
    }
  }

  async fetchPrivateLeagueReport(req, res) {
    try {
      const { eCategory, eKey } = req.body
      if (!['CNCLL', 'CMPL', 'CL'].includes(eKey)) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
      }
      const data = await GeneralizeReportModel.findOne({
        eType: 'U',
        aPrivateLeague: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }).lean()
      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cPrivateLeagueReport) }) }

      const sSport = eCategory.toUpperCase()
      let oCondition = {}
      if (eKey === 'CNCLL') {
        oCondition = { bPrivateLeague: true, bCancelled: true, eCategory: sSport }
      } else if (eKey === 'CMPL') {
        oCondition = { bPrivateLeague: true, bCancelled: false, eCategory: sSport }
      } else if (eKey === 'CL') {
        oCondition = { bPrivateLeague: true, eCategory: sSport }
      }
      const dateQuery = getDates()

      const oTotalQuery = { dCreatedAt: { $lte: new Date() }, ...oCondition }
      const { nTotals: nTotal } = await fetchPrivateLeague(oTotalQuery)

      const oTodayQuery = { dCreatedAt: dateQuery.toDay, ...oCondition }
      const { nTotals: nToday } = await fetchPrivateLeague(oTodayQuery)
      const oYesterdayQuery = { dCreatedAt: dateQuery.yesterDay, ...oCondition }
      const { nTotals: nYesterday } = await fetchPrivateLeague(oYesterdayQuery)
      const oWeekQuery = { dCreatedAt: dateQuery.week, ...oCondition }
      const { nTotals: nLastWeek } = await fetchPrivateLeague(oWeekQuery)
      const oMonthQuery = { dCreatedAt: dateQuery.month, ...oCondition }
      const { nTotals: nLastMonth } = await fetchPrivateLeague(oMonthQuery)
      const oYearQuery = { dCreatedAt: dateQuery.year, ...oCondition }
      const { nTotals: nLastYear } = await fetchPrivateLeague(oYearQuery)

      let report
      if (eKey === 'CNCLL') {
        report = {
          'aPrivateLeague.$.oCancelled.nTotal': nTotal || 0,
          'aPrivateLeague.$.oCancelled.nToday': nToday || 0,
          'aPrivateLeague.$.oCancelled.nYesterday': nYesterday || 0,
          'aPrivateLeague.$.oCancelled.nLastWeek': nLastWeek || 0,
          'aPrivateLeague.$.oCancelled.nLastMonth': nLastMonth || 0,
          'aPrivateLeague.$.oCancelled.nLastYear': nLastYear || 0,
          'aPrivateLeague.$.oCancelled.dUpdatedAt': new Date()
        }
      } else if (eKey === 'CMPL') {
        report = {
          'aPrivateLeague.$.oCompleted.nTotal': nTotal || 0,
          'aPrivateLeague.$.oCompleted.nToday': nToday || 0,
          'aPrivateLeague.$.oCompleted.nYesterday': nYesterday || 0,
          'aPrivateLeague.$.oCompleted.nLastWeek': nLastWeek || 0,
          'aPrivateLeague.$.oCompleted.nLastMonth': nLastMonth || 0,
          'aPrivateLeague.$.oCompleted.nLastYear': nLastYear || 0,
          'aPrivateLeague.$.oCompleted.dUpdatedAt': new Date()
        }
      } else if (eKey === 'CL') {
        report = {
          'aPrivateLeague.$.oCreated.nTotal': nTotal || 0,
          'aPrivateLeague.$.oCreated.nToday': nToday || 0,
          'aPrivateLeague.$.oCreated.nYesterday': nYesterday || 0,
          'aPrivateLeague.$.oCreated.nLastWeek': nLastWeek || 0,
          'aPrivateLeague.$.oCreated.nLastMonth': nLastMonth || 0,
          'aPrivateLeague.$.oCreated.nLastYear': nLastYear || 0,
          'aPrivateLeague.$.oCreated.dUpdatedAt': new Date()
        }
      }
      const updateData = await GeneralizeReportModel.findOneAndUpdate({
        eType: 'U',
        aPrivateLeague: { $elemMatch: { _id: ObjectId(req.params.id), eCategory: eCategory.toUpperCase() } }
      }, { ...report }, { new: true, runValidators: true }).lean()
      let responseData = updateData.aPrivateLeague.find(({ eCategory }) => eCategory === sSport)
      if (eKey === 'CL') {
        responseData = { oCreated: responseData.oCreated, sSport }
      } else if (eKey === 'CMPL') {
        responseData = { oCompleted: responseData.oCompleted, sSport }
      } else if (eKey === 'CNCLL') {
        responseData = { oCancelled: responseData.oCancelled, sSport }
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cPrivateLeagueReport), data: responseData })
    } catch (error) {
      return catchError('Report.fetchPrivateLeagueReport', error, req, res)
    }
  }

  async fetchAppDownloadReport(req, res) {
    try {
      const { ePlatform, eKey } = req.body
      if (eKey !== 'AD') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })

      const data = await GeneralizeReportModel.findOne({
        eType: 'U',
        aAppDownload: { $elemMatch: { _id: ObjectId(req.params.id), ePlatform: ePlatform.toUpperCase() } }
      }).lean()
      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cAppDownloadReport) }) }

      const dateQuery = getDates()
      const countData = await Promise.all([
        AppDownloadModel.countDocuments({ dCreatedAt: { $lte: new Date() }, ePlatform }),
        AppDownloadModel.countDocuments({ dCreatedAt: dateQuery.toDay, ePlatform }),
        AppDownloadModel.countDocuments({ dCreatedAt: dateQuery.yesterDay, ePlatform }),
        AppDownloadModel.countDocuments({ dCreatedAt: dateQuery.week, ePlatform }),
        AppDownloadModel.countDocuments({ dCreatedAt: dateQuery.month, ePlatform }),
        AppDownloadModel.countDocuments({ dCreatedAt: dateQuery.year, ePlatform })
      ])

      const report = {
        'aAppDownload.$.nTotal': countData[0] || 0,
        'aAppDownload.$.nToday': countData[1] || 0,
        'aAppDownload.$.nYesterday': countData[2] || 0,
        'aAppDownload.$.nLastWeek': countData[3] || 0,
        'aAppDownload.$.nLastMonth': countData[4] || 0,
        'aAppDownload.$.nLastYear': countData[5] || 0,
        'aAppDownload.$.dUpdatedAt': new Date()
      }
      const updateData = await GeneralizeReportModel.findOneAndUpdate({
        eType: 'U',
        aAppDownload: { $elemMatch: { _id: ObjectId(req.params.id), ePlatform: ePlatform.toUpperCase() } }
      }, { ...report }, { new: true, runValidators: true, upsert: true }).lean()
      const responseData = updateData.aAppDownload.find((platform) => platform.ePlatform === ePlatform)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cAppDownloadReport), data: responseData })
    } catch (error) {
      return catchError('Report.fetchAppDownloadReport', error, req, res)
    }
  }

  async fetchfilterReport(req, res) {
    try {
      const { dStartDate, dEndDate, eKey, eType } = req.query

      const { isError, query } = await getDateRangeQuery([dStartDate, dEndDate])
      if (isError) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].daterange_not_proper })

      const oDateCondition = query.dStartDate
      const dDate = new Date()
      const report = {}
      if (eKey === 'USER_REPORT') {
        const query = { dCreatedAt: oDateCondition }
        const oTotalUser = {}
        oTotalUser.nTotalUsers = await UsersModel.countDocuments({ ...query, eType })
        oTotalUser.nTotalEmailVerifiedUsers = await UsersModel.countDocuments({ bIsEmailVerified: true, ...query, eType: 'U' })
        oTotalUser.nTotalPhoneVerifiedUsers = await UsersModel.countDocuments({ bIsMobVerified: true, ...query, eType: 'U' })
        report.oTotalUser = { ...oTotalUser, dUpdatedAt: dDate }

        const oRegisterUser = {}
        oRegisterUser.Total = await UsersModel.countDocuments({ ...query, eType })
        oRegisterUser.aPlatformWiseUser = await AuthLogsModel.aggregate([
          {
            $match: {
              eType: 'R'
            }
          },
          {
            $group: {
              _id: '$ePlatform',
              count: {
                $sum: 1
              }
            }
          },
          {
            $project: {
              _id: 0,
              eTitle: '$_id',
              nValue: '$count'
            }
          }
        ]).allowDiskUse(bAllowDiskUse).exec()
        report.oRegisterUser = { ...oRegisterUser, dUpdatedAt: new Date() }

        const oLoginUser = {}
        oLoginUser.Total = await UsersModel.countDocuments({ dLoginAt: oDateCondition, eType })
        report.oLoginUser = { ...oLoginUser, dUpdatedAt: new Date() }

        const oDeposit = {}
        const eUserType = eType

        const nTotalWinnings = await PassbookModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eTransactionType: 'Win', eUserType, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }, raw: true })
        oDeposit.nTotalWinnings = nTotalWinnings.length ? (!nTotalWinnings[0].total ? 0 : nTotalWinnings[0].total) : 0

        const nTotalDeposits = await UserDepositModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eUserType, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }, raw: true })
        oDeposit.nTotalDeposits = nTotalDeposits.length ? (!nTotalDeposits[0].total ? 0 : nTotalDeposits[0].total) : 0

        const nTotalPendingDeposits = await UserDepositModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eUserType, ePaymentStatus: 'P', [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }, raw: true })
        oDeposit.nTotalPendingDeposits = nTotalPendingDeposits.length ? (!nTotalPendingDeposits[0].total ? 0 : nTotalPendingDeposits[0].total) : 0

        const nTotalSuccessDeposits = await UserDepositModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eUserType, ePaymentStatus: 'S', [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }, raw: true })
        oDeposit.nTotalSuccessDeposits = nTotalSuccessDeposits.length ? (!nTotalSuccessDeposits[0].total ? 0 : nTotalSuccessDeposits[0].total) : 0

        const nTotalCancelledDeposits = await UserDepositModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eUserType, ePaymentStatus: 'C', [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }, raw: true })
        oDeposit.nTotalCancelledDeposits = nTotalCancelledDeposits.length ? (!nTotalCancelledDeposits[0].total ? 0 : nTotalCancelledDeposits[0].total) : 0

        const nTotalRejectedDeposits = await UserDepositModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eUserType, ePaymentStatus: 'R', [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }, raw: true })
        oDeposit.nTotalRejectedDeposits = nTotalRejectedDeposits.length ? (!nTotalRejectedDeposits[0].total ? 0 : nTotalRejectedDeposits[0].total) : 0

        oDeposit.aDeposits = await UserDepositModel.findAll({ attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nCash')), 'nValue']], group: 'ePaymentGateway', where: { ePaymentGateway: { [Op.ne]: '' }, ePaymentStatus: 'S', [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lte]: dEndDate } }], eUserType }, raw: true })
        report.oDeposit = { ...oDeposit, dUpdatedAt: dDate }

        const [aSuccessWithdrawals, aPendingWithdrawals, aInitiatedWithdrawals, aCancelledWithdrawals, aRejectedWithdrawals] = await Promise.all([
          UserWithdrawModel.findAll({ attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nAmount')), 'nValue']], group: 'ePaymentGateway', where: { ePaymentGateway: { [Op.ne]: '' }, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lte]: dEndDate } }], ePaymentStatus: 'S', eUserType }, raw: true }),
          UserWithdrawModel.findAll({ attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nAmount')), 'nValue']], group: 'ePaymentGateway', where: { ePaymentGateway: { [Op.ne]: '' }, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lte]: dEndDate } }], ePaymentStatus: 'P', eUserType }, raw: true }),
          UserWithdrawModel.findAll({ attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nAmount')), 'nValue']], group: 'ePaymentGateway', where: { ePaymentGateway: { [Op.ne]: '' }, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lte]: dEndDate } }], ePaymentStatus: 'I', eUserType }, raw: true }),
          UserWithdrawModel.findAll({ attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nAmount')), 'nValue']], group: 'ePaymentGateway', where: { ePaymentGateway: { [Op.ne]: '' }, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lte]: dEndDate } }], ePaymentStatus: 'C', eUserType }, raw: true }),
          UserWithdrawModel.findAll({ attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nAmount')), 'nValue']], group: 'ePaymentGateway', where: { ePaymentGateway: { [Op.ne]: '' }, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lte]: dEndDate } }], ePaymentStatus: 'R', eUserType }, raw: true })
        ])
        const oWithdraw = { aSuccessWithdrawals, aPendingWithdrawals, aInitiatedWithdrawals, aCancelledWithdrawals, aRejectedWithdrawals }

        oWithdraw.nTotalWithdrawals = oWithdraw.aSuccessWithdrawals.length ? oWithdraw.aSuccessWithdrawals.reduce((acc, { nValue }) => acc + nValue, 0) : 0
        report.oWithdraw = { ...oWithdraw, dUpdatedAt: dDate }

        const oUserBonus = {}
        const nTotal = await PassbookModel.findAll({
          attributes: [[fn('sum', col('nBonus')), 'total']],
          where: {
            eUserType,
            [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { eTransactionType: 'Deposit', nBonus: { [Op.gt]: 0 } }, { eTransactionType: 'Cashback-Contest', nBonus: { [Op.gt]: 0 } }],
            [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }]
          },
          raw: true
        })
        oUserBonus.nTotal = nTotal.length ? (!nTotal[0].total ? 0 : nTotal[0].total) : 0
        report.oUserBonus = { ...oUserBonus, dUpdatedAt: dDate }

        const oBonusExpire = {}
        const nTotals = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eTransactionType: 'Bonus-Expire', [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }, raw: true })
        oBonusExpire.nTotal = nTotals.length ? (!nTotals[0].total ? 0 : nTotals[0].total) : 0
        report.oBonusExpire = { ...oBonusExpire, dUpdatedAt: dDate }

        const oTds = {}
        const nTotalTds = await UserTdsModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }, raw: true })
        oTds.nTotalTds = nTotalTds.length ? (!nTotalTds[0].total ? 0 : nTotalTds[0].total) : 0

        const nTotalActiveTds = await UserTdsModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eStatus: 'A', [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }, raw: true })
        oTds.nTotalActiveTds = nTotalActiveTds.length ? (!nTotalActiveTds[0].total ? 0 : nTotalActiveTds[0].total) : 0

        const nTotalPendingTds = await UserTdsModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eUserType, eStatus: 'P', [Op.and]: [{ dCreatedAt: { [Op.gte]: dStartDate } }, { dCreatedAt: { [Op.lt]: dEndDate } }] }, raw: true })
        oTds.nTotalPendingTds = nTotalPendingTds.length ? (!nTotalPendingTds[0].total ? 0 : nTotalPendingTds[0].total) : 0
        report.oTds = { ...oTds, dUpdatedAt: dDate }
      } else if (eKey === 'USERTEAM_REPORT') {
        report.aTeams = []
        for (const eCategory of category) {
          const { nTotalTeams: nTotal } = await fetchTotalTeam(eCategory, oDateCondition, eType)
          report.aTeams.push({
            nTotal: nTotal || 0,
            eCategory,
            dUpdatedAt: new Date()
          })
        }
      } else if (eKey === 'PARTICIPANT_REPORT') {
        report.aParticipants = []
        for (const eCategory of category) {
          const { nTotals: nTotal } = await fetchParticipants(eCategory, oDateCondition, eType)
          report.aParticipants.push({
            nTotal: nTotal || 0,
            eCategory,
            dUpdatedAt: new Date()
          })
        }
      } else if (eKey === 'WIN_REPORT') {
        report.aWins = []
        for (const eCategory of category) {
          const { winCash: nTotalCash, winBonus: nTotalBonus } = await fetchReportData(eCategory, 'Wins', eType, oDateCondition)
          report.aWins.push({
            nTotalCash,
            nTotalBonus,
            eCategory,
            dUpdatedAt: new Date()
          })
        }
      } else if (eKey === 'PRIVATE_LEAGUE_REPORT') {
        report.aPrivateLeague = []
        for (let i = 0; i < category.length; i++) {
          report.aPrivateLeague[i] = {}
          const eCategory = category[i]
          const query = { dCreatedAt: oDateCondition }
          const aConditions = {
            CNCLL: { bPrivateLeague: true, bCancelled: true, eCategory, ...query },
            CMPL: { bPrivateLeague: true, bCancelled: false, eCategory, ...query },
            CL: { bPrivateLeague: true, eCategory, ...query }
          }
          for (const oCondition in aConditions) {
            const { nTotals: nTotal } = await fetchPrivateLeague(aConditions[oCondition])
            if (oCondition === 'CNCLL') {
              const oCancelled = {
                nTotal: nTotal || 0,
                dUpdatedAt: new Date()
              }
              report.aPrivateLeague[i].oCancelled = {}
              report.aPrivateLeague[i].oCancelled = { ...oCancelled }
            } else if (oCondition === 'CMPL') {
              const oCompleted = {
                nTotal: nTotal || 0,
                dUpdatedAt: new Date()
              }
              report.aPrivateLeague[i].oCompleted = {}
              report.aPrivateLeague[i].oCompleted = { ...oCompleted }
            } else if (oCondition === 'CL') {
              const oCreated = {
                nTotal: nTotal || 0,
                dUpdatedAt: new Date()
              }
              report.aPrivateLeague[i].oCreated = {}
              report.aPrivateLeague[i].oCreated = { ...oCreated }
            }
          }
          report.aPrivateLeague[i].eCategory = eCategory
        }
      } else if (eKey === 'PLAY_REPORT') {
        report.aPlayed = []
        for (const eCategory of category) {
          const { playedCash: nTotalCash, playedBonus: nTotalBonus } = await fetchReportData(eCategory, 'Played', eType, oDateCondition)
          report.aPlayed.push({
            nTotalCash,
            nTotalBonus,
            eCategory,
            dUpdatedAt: new Date()
          })
        }
      } else if (eKey === 'PLAY_RETURN_REPORT') {
        report.aPlayReturn = []
        for (const eCategory of category) {
          const { playReturnCash: nTotalCash, playReturnBonus: nTotalBonus } = await fetchReportData(eCategory, 'PlayReturn', eType, oDateCondition)
          report.aPlayReturn.push({
            nTotalCash,
            nTotalBonus,
            eCategory,
            dUpdatedAt: new Date()
          })
        }
      } else if (eKey === 'CASHBACK_REPORT') {
        report.aCashback = []
        for (const eCategory of category) {
          const { cashbackCash: nTotalCash, cashbackBonus: nTotalBonus } = await fetchReportData(eCategory, 'Cashback', eType, oDateCondition)
          report.aCashback.push({
            nTotalCash,
            nTotalBonus,
            eCategory,
            dUpdatedAt: new Date()
          })
        }
      } else if (eKey === 'CASHBACK_RETURN_REPORT') {
        report.aCashbackReturn = []
        for (const eCategory of category) {
          const { cashbackReturnCash: nTotalCash, cashbackReturnBonus: nTotalBonus } = await fetchReportData(eCategory, 'CashbackReturn', eType, oDateCondition)
          report.aCashbackReturn.push({
            nTotalCash,
            nTotalBonus,
            eCategory,
            dUpdatedAt: new Date()
          })
        }
      } else if (eKey === 'CREATOR_BONUS_REPORT') {
        report.aCreatorBonus = []
        for (const eCategory of category) {
          const nTotal = await fetchReportData(eCategory, 'CreatorBonus', 'U', oDateCondition)
          report.aCreatorBonus.push({
            nTotal,
            eCategory,
            dUpdatedAt: new Date()
          })
        }
      } else if (eKey === 'CREATOR_BONUS_RETURN_REPORT') {
        report.aCreatorBonusReturn = []
        for (const eCategory of category) {
          const nTotal = await fetchReportData(eCategory, 'CreatorBonusReturn', 'U', oDateCondition)
          report.aCreatorBonusReturn.push({
            nTotal,
            eCategory,
            dUpdatedAt: new Date()
          })
        }
      } else if (eKey === 'WIN_RETURN_REPORT') {
        report.aWinReturn = []
        for (const eCategory of category) {
          const { winReturnCash: nTotalCash, winReturnBonus: nTotalBonus } = await fetchReportData(eCategory, 'Wins-Return', eType, oDateCondition)
          report.aWinReturn.push({
            nTotalCash,
            nTotalBonus,
            eCategory,
            dUpdatedAt: new Date()
          })
        }
      } else if (eKey === 'APP_DOWNLOAD_REPORT') {
        report.aAppDownload = []
        for (const platform of appPlatform) {
          const nTotal = await AppDownloadModel.countDocuments({ ePlatform: platform, dCreatedAt: oDateCondition })
          report.aAppDownload.push({
            nTotal,
            ePlatform: platform,
            dUpdatedAt: new Date()
          })
        }
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].creport), data: report })
    } catch (error) {
      return catchError('Report.fetchfilterReport', error, req, res)
    }
  }

  async getUserRevenue(req, res) {
    try {
      const { aUserId } = req.body

      if (!aUserId && !aUserId.length) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cuserId) })
      const aUserIds = []
      aUserId.forEach(u => { if (ObjectId.isValid(u)) aUserIds.push(ObjectId(u)) })

      const aUserLeague = await UserLeagueModel.aggregate([
        { $match: { bCancelled: false, iUserId: { $in: aUserIds }, nPricePaid: { $gt: 0 } } },
        {
          $lookup: {
            from: 'matchleagues',
            localField: 'iMatchLeagueId',
            foreignField: '_id',
            as: 'm'
          }
        },
        { $unwind: { path: '$m' } },
        { $match: { 'm.eMatchStatus': 'CMP' } },
        {
          $addFields: {
            nTotalRevenue: {
              $switch: {
                branches: [
                  { case: { $and: [{ $eq: ['$m.bPrivateLeague', false] }, { $eq: ['$m.bPoolPrize', false] }] }, then: { $divide: [{ $subtract: [{ $multiply: ['$m.nPrice', '$m.nJoined'] }, '$m.nTotalPayout'] }, '$m.nJoined'] } },
                  { case: { $eq: ['$m.bPrivateLeague', true] }, then: { $divide: ['$m.nAdminCommission', '$m.nJoined'] } },
                  { case: { $and: [{ $eq: ['$m.bPrivateLeague', false] }, { $eq: ['$m.bPoolPrize', true] }] }, then: { $divide: [{ $subtract: [{ $multiply: ['$m.nPrice', '$m.nJoined'] }, { $divide: [{ $multiply: [{ $multiply: ['$m.nPrice', '$m.nJoined'] }, 100] }, { $sum: ['$m.nDeductPercent', 100] }] }] }, '$m.nJoined'] } }
                ]
              }
            }
          }
        },
        {
          $group: {
            _id: '$iUserId',
            platform_revenue: { $sum: '$nTotalRevenue' },
            nCashPaid: { $sum: '$actualCashUsed' },
            nCashWin: { $sum: '$nPrice' }
          }
        },
        { $project: { revenue: { $subtract: ['$nCashWin', '$nCashPaid'] }, platform_revenue: 1, _id: 1 } }
      ]).allowDiskUse(bAllowDiskUse)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cRevenue), data: aUserLeague })
    } catch (error) {
      return catchError('Report.getUserRevenue', error, req, res)
    }
  }
}

async function fetchPrivateLeague(oCondition) {
  return new Promise((resolve, reject) => {
    (async() => {
      try {
        const nTotals = await MatchLeagueModel.countDocuments({ ...oCondition })
        resolve({ nTotals })
      } catch (error) {
        reject(error)
      }
    })()
  })
}

async function fetchParticipants(sSport, oQuery, eType) {
  return new Promise((resolve, reject) => {
    (async() => {
      try {
        const aParticipants = await UserLeagueModel.countDocuments({ eType, eCategory: sSport, dCreatedAt: oQuery })
        const nTotals = aParticipants
        resolve({ nTotals })
      } catch (error) {
        reject(error)
      }
    })()
  })
}

async function fetchTotalTeam(sSport, oQuery, eType) {
  return new Promise((resolve, reject) => {
    (async() => {
      try {
        const nTotalTeams = await UserTeamModel.countDocuments({ dCreatedAt: oQuery, eType, eCategory: sSport })
        resolve({ nTotalTeams })
      } catch (error) {
        reject(error)
      }
    })()
  })
}

async function fetchReportData(sSport, sKey, eType, oQuery) {
  return new Promise((resolve, reject) => {
    (async() => {
      try {
        let data = 0
        const match = await MatchModel.find({ dStartDate: oQuery, eStatus: 'CMP', eCategory: sSport }, { _id: 1 }).lean()
        if (match.length) {
          const aMatchId = match.map(({ _id }) => _id.toString())
          switch (sKey) {
            case 'PlayReturn':
              data = await fetchData(aMatchId, sKey, eType)
              break

            case 'Played':
              data = await fetchData(aMatchId, sKey, eType)
              break

            case 'Cashback':
              data = await fetchData(aMatchId, sKey, eType)
              break

            case 'CashbackReturn':
              data = await fetchData(aMatchId, sKey, eType)
              break

            case 'CreatorBonus':
              data = await fetchData(aMatchId, sKey, eType)
              break

            case 'CreatorBonusReturn':
              data = await fetchData(aMatchId, sKey, eType)
              break

            case 'Wins':
              data = await fetchData(aMatchId, sKey, eType)
              break

            case 'Wins-Return':
              data = await fetchData(aMatchId, sKey, eType)
              break
          }
          return resolve(data)
        }

        switch (sKey) {
          case 'PlayReturn':
            resolve({ playReturnCash: 0, playReturnBonus: 0 })
            break

          case 'Played':
            resolve({ playedCash: 0, playedBonus: 0 })
            break

          case 'Cashback':
            resolve({ cashbackCash: 0, cashbackBonus: 0 })
            break

          case 'CashbackReturn':
            resolve({ cashbackReturnCash: 0, cashbackReturnBonus: 0 })
            break

          case 'CreatorBonus':
            resolve(data)
            break

          case 'CreatorBonusReturn':
            resolve(data)
            break

          case 'Wins':
            resolve({ winCash: 0, winBonus: 0 })
            break

          case 'Wins-Return':
            resolve({ winReturnCash: 0, winReturnBonus: 0 })
            break
        }
      } catch (error) {
        reject(error)
      }
    })()
  })
}

async function fetchData(aMatchId, sKey, eType) {
  return new Promise((resolve, reject) => {
    (async() => {
      try {
        const data = { eUserType: eType, aMatchId }
        if (sKey === 'PlayReturn') {
          const { nCash, nBonus } = await calculatePassbook(data, 'Play-Return')

          resolve({ playReturnCash: nCash, playReturnBonus: nBonus })
        }
        if (sKey === 'Played') {
          const { nCash, nBonus } = await calculatePassbook(data, 'Play')

          resolve({ playedCash: nCash, playedBonus: nBonus })
        }
        if (sKey === 'Cashback') {
          const { nCash, nBonus } = await calculatePassbook(data, 'Cashback-Contest')

          resolve({ cashbackCash: nCash, cashbackBonus: nBonus })
        }
        if (sKey === 'CashbackReturn') {
          const { nCash, nBonus } = await calculatePassbook(data, 'Cashback-Return')

          resolve({ cashbackReturnCash: nCash, cashbackReturnBonus: nBonus })
        }
        if (sKey === 'CreatorBonus') {
          const { nBonus } = await calculatePassbook(data, 'Creator-Bonus')

          resolve(nBonus)
        }
        if (sKey === 'CreatorBonusReturn') {
          const { nBonus } = await calculatePassbook(data, 'Creator-Bonus-Return')

          resolve(nBonus)
        }
        if (sKey === 'Wins') {
          const { nCash, nBonus } = await calculatePassbook(data, 'Win')

          resolve({ winCash: nCash, winBonus: nBonus })
        }
        if (sKey === 'Wins-Return') {
          const { nCash, nBonus } = await calculatePassbook(data, 'Win-Return')

          resolve({ winReturnCash: nCash, winReturnBonus: nBonus })
        }
      } catch (error) {
        reject(error)
      }
    })()
  })
}

async function getDateRangeQuery (aDate) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        if (aDate === 'total') resolve({ isError: false, query: { dStartDate: { $lte: new Date() } } })
        if (aDate.length !== 2) resolve({ isError: true, query: {} })
        resolve({ isError: false, query: { dStartDate: { $gte: aDate[0], $lte: aDate[1] } } })
      } catch (error) {
        resolve({ isError: true, query: {} })
      }
    })()
  })
}

module.exports = new Report()

function getDates () {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const weekStart = new Date(new Date().setDate(today.getDate() - today.getDay()))
  const weekEnd = new Date(new Date().setDate(weekStart.getDate() + 6))

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  const yearStart = new Date(today.getFullYear(), 0, 1)
  const yearEnd = new Date(today.getFullYear(), 11, 31)

  const dates = {
    toDay: {
      $gte: new Date(today.setHours(0, 0, 0)).toJSON(),
      $lt: new Date(today.setHours(23, 59, 59)).toJSON()
    },
    yesterDay: {
      $gte: new Date(yesterday.setHours(0, 0, 0)).toJSON(),
      $lt: new Date(yesterday.setHours(23, 59, 59)).toJSON()
    },
    week: {
      $gte: new Date(weekStart.setHours(0, 0, 0)).toJSON(),
      $lt: new Date(weekEnd.setHours(23, 59, 59)).toJSON()
    },
    month: {
      $gte: new Date(monthStart.setHours(0, 0, 0)).toJSON(),
      $lt: new Date(monthEnd.setHours(23, 59, 59)).toJSON()
    },
    year: {
      $gte: new Date(yearStart.setHours(0, 0, 0)).toJSON(),
      $lt: new Date(yearEnd.setHours(23, 59, 59)).toJSON()
    }
  }

  return dates
}
