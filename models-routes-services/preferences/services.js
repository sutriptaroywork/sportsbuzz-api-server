const PreferencesModel = require('./model')
const UsersModel = require('../user/model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, removenull } = require('../../helper/utilities.services')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId

class Preferences {
  // To store Preferences in Preferences model
  async add(req, res) {
    try {
      const users = await UsersModel.find().lean()

      for (const user of users) {
        await PreferencesModel.create({ iUserId: user._id })
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cpreferences) })
    } catch (error) {
      return catchError('Preferences.add', error, req, res)
    }
  }

  // To update Preferences by _id
  async update(req, res) {
    try {
      req.body = pick(req.body, ['bEmails', 'bSms', 'bSound', 'bVibration', 'bPush'])
      removenull(req.body)

      const iUserId = req.params.id ? ObjectId(req.params.id) : req.user._id
      const data = await PreferencesModel.findOneAndUpdate({ iUserId: iUserId }, { ...req.body }, { new: true, runValidators: true })

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpreferences) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cpreferences), data })
    } catch (error) {
      return catchError('Preferences.update', error, req, res)
    }
  }

  // To get details of single Preferences
  async get(req, res) {
    try {
      const iUserId = req.params.id ? ObjectId(req.params.id) : req.user._id

      const data = await PreferencesModel.findOne({ iUserId }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cuserPreferences) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpreferences), data })
    } catch (error) {
      return catchError('Preferences.get', error, req, res)
    }
  }
}

module.exports = new Preferences()
