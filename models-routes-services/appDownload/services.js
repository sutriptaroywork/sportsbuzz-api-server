const AppDownloadModel = require('./model')
const { catchError, getIp } = require('../../helper/utilities.services')
const { messages, status, jsonStatus } = require('../../helper/api.responses')

class AppDownload {
  /**
     * add log to database when any download app
     * @returns data after create entry in database
     */
  async add(req, res) {
    try {
      const { iAppId } = req.body
      const ePlatform = ['A', 'I'].includes(req.header('Platform')) ? req.header('Platform') : 'O'

      const iIdExists = await AppDownloadModel.findOne({ iAppId })
      if (iIdExists) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].appId) })
      const sIpAddress = getIp(req)
      const data = await AppDownloadModel.create({ iAppId, ePlatform, sIpAddress })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].appLog), data })
    } catch (error) {
      catchError('AppDownload.add', error, req, res)
    }
  }
}

module.exports = new AppDownload()
