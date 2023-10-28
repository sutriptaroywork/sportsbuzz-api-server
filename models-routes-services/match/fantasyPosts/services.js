const FantasyPostModel = require('./model')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { catchError } = require('../../../helper/utilities.services')

class FantasyTips {
  // To get details of single Fantasy Posts by _id
  async get(req, res) {
    try {
      const data = await FantasyPostModel.findOne({ iFantasyPostId: req.params.id }, { iFantasyPostId: 0 }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].sfantasyTips) })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].sfantasyTips), data })
    } catch (error) {
      return catchError('FantasyTips.get', error, req, res)
    }
  }
}

module.exports = new FantasyTips()
