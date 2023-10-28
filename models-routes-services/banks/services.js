const BankModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, getPaginationValues } = require('../../helper/utilities.services')

class Bank {
  async listBank(req, res) {
    try {
      let { start, limit, search } = getPaginationValues(req.query)
      start = (!start) ? 0 : start
      limit = (!limit) ? 10 : limit

      const query = { eStatus: 'Y' }
      if (search) query.sName = { $regex: new RegExp('^.*' + search + '.*', 'i') }

      const nTotal = await BankModel.countDocuments(query)
      const aData = await BankModel.find(query, { sName: 1 }).sort({ sName: 1 }).skip(start).limit(limit).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cListBank), data: { nTotal, aData } })
    } catch (error) {
      return catchError('Bank.listBank', error, req, res)
    }
  }
}

module.exports = new Bank()
