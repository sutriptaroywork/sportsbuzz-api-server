const CountryModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError } = require('../../helper/utilities.services')

class Country {
  async list(req, res) {
    try {
      const data = await CountryModel.find({}, { __v: 0 }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].countries), data: data })
    } catch (error) {
      return catchError('Country.list', error, req, res)
    }
  }
}

module.exports = new Country()
