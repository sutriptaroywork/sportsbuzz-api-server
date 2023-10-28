const MaintenanceModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError } = require('../../helper/utilities.services')

class Maintenance {
  async get(req, res) {
    try {
      const data = await MaintenanceModel.find().lean()
      if (!data[0]) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmaintenance) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmaintenance), data: data[0] })
    } catch (error) {
      return catchError('Maintenance.get', error, req, res)
    }
  }

  async add(req, res) {
    try {
      const { sMessage, bIsMaintenanceMode } = req.body
      const data = await MaintenanceModel.create({ sMessage, bIsMaintenanceMode })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmaintenance), data: data })
    } catch (error) {
      return catchError('Maintenance.get', error, req, res)
    }
  }

  async update(req, res) {
    try {
      const { bIsMaintenanceMode, sMessage } = req.body

      const data = await MaintenanceModel.findOneAndUpdate({}, { bIsMaintenanceMode, sMessage }, { new: true, runValidators: true }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cmaintenance), data })
    } catch (error) {
      catchError('Maintenance.update', error, req, res)
    }
  }

  async getMaintenance(req, res) {
    try {
      const data = await MaintenanceModel.findOne({}, { bIsMaintenanceMode: 1, sMessage: 1, _id: 0 }).lean()
      if (!data) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].error_with.replace('##', messages[req.userLanguage].cmaintenance) })

      if (!data.bIsMaintenanceMode) delete data.sMessage
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmaintenance), data })
    } catch (error) {
      return catchError('Maintenance.get', error, req, res)
    }
  }
}
module.exports = new Maintenance()
