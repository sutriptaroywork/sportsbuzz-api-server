const BotLogModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError } = require('../../helper/utilities.services')
const mongoose = require('mongoose')
const { ObjectId } = mongoose.Types
const { getPaginationValues } = require('../../helper/utilities.services')

class BotLog {
  async getContestLogs(req, res) {
    try {
      const { eType } = req.query
      const { start, limit, sorting } = getPaginationValues(req.query)

      const query = { iMatchLeagueId: ObjectId(req.params.id), eType: { $nin: ['CB', 'SCB'] } }
      if (eType) query.eType = eType

      const [nTotal, aData] = await Promise.all([
        BotLogModel.countDocuments(query),
        BotLogModel.find(query).populate({ path: 'oAdmin', select: 'sUsername' }).sort(sorting)
          .skip(Number(start))
          .limit(Number(limit))
          .lean()
      ])
      const data = { aData, nTotal }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cBotLogs), data })
    } catch (error) {
      return catchError('BotLog.getContestLogs', error, req, res)
    }
  }
}

module.exports = new BotLog()
