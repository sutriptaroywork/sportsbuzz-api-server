const ApiLogModel = require('../apiLog/ApiLog.model')
const PrizeDistributionLogModel = require('../apiLog/PrizeDistributionLog.model')
const TransactionLogModel = require('../apiLog/TransactionLog.model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, getPaginationValues2 } = require('../../helper/utilities.services')

class ApiLog {
  async list(req, res) {//service Moved To LOGS_MS
    try {
      const { eType } = req.query
      const { start, limit, sorting } = getPaginationValues2(req.query)

      let query = { iMatchId: req.params.id }
      query = eType ? { ...query, eType } : query

      const results = await Promise.all([
        ApiLogModel.find(query, {
          sKey: 1,
          iMatchId: 1,
          eType: 1,
          sUrl: 1,
          eCategory: 1,
          eProvider: 1,
          dCreatedAt: 1
        }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean(),
        ApiLogModel.countDocuments({ ...query })
      ])

      const data = [{ total: results[1], results: results[0] }]
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cLogs), data })
    } catch (error) {
      catchError('ApiLog.list', error, req, res)
    }
  }

  async get(req, res) {//service moved to LOGS_MS
    try {
      const data = await ApiLogModel.findById(req.params.id, {
        sKey: 1,
        iMatchId: 1,
        oData: 1,
        eType: 1,
        sUrl: 1,
        eCategory: 1,
        eProvider: 1,
        createdAt: 1
      })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cLogs), data })
    } catch (error) {
      catchError('ApiLog.get', error, req, res)
    }
  }

  async getMatchLeagueLogs(req, res) {
    try {
      const { sType } = req.query
      let sKey = req.params.id

      if (sType === 'WD') {
        sKey = `wd-${sKey}`
      }

      const data = await PrizeDistributionLogModel.find({ sKey }).lean()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cLogs), data })
    } catch (error) {
      return catchError('ApiLog.getMatchLeagueLogs', error, req, res)
    }
  }

  async listTransactionLog(req, res) {//api moved to LogsMs
    try {
      const { start, limit, sorting } = getPaginationValues2(req.query)
      const { eType } = req.query

      // Added iOrderId in query
      const query = (eType === 'W') ? { iWithdrawId: Number(req.params.id) } : { $or: [{ iDepositId: req.params.id }, { iOrderId: req.params.id }] }

      const [aResult, nTotal] = await Promise.all([
        TransactionLogModel.find(query, { __v: 0, dUpdatedAt: 0 }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean(),
        TransactionLogModel.countDocuments(query)
      ])

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cLogs), data: { aResult, nTotal } })
    } catch (error) {
      return catchError('ApiLog.listTransactionLog', error, req, res)
    }
  }
}

module.exports = new ApiLog()
