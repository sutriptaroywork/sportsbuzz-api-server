const PlayerRoleModel = require('./model')
const MatchModel = require('../match/model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError } = require('../../helper/utilities.services')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId

class PlayerRole {
  // To get List of PlayerRole (SportsType wise)
  async getPlayerRole(req, res) {
    try {
      const { sportsType } = req.query
      const eCategory = sportsType.toUpperCase()

      const data = await PlayerRoleModel.findOne({ eCategory }, { aRole: 1, eCategory: 1, _id: 0 }).lean()

      if (!data) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cplayerRole), data: [] })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cplayerRole), data: data.aRole })
    } catch (error) {
      catchError('PlayerRole.getPlayerRole', error, req, res)
    }
  }

  // To update PlayerRole by _id
  // deprecated
  async update(req, res) {
    try {
      const { nMax, nMin, nPosition } = req.body

      if (parseInt(nMin) > parseInt(nMax)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].cminumum).replace('#', messages[req.userLanguage].cmaximum) })

      const playerRole = await PlayerRoleModel.findOneAndUpdate({ eCategory: req.query.sportsType.toUpperCase(), 'aRole._id': ObjectId(req.params.id) }, {
        'aRole.$.nMax': nMax,
        'aRole.$.nMin': nMin,
        'aRole.$.nPosition': nPosition
      }, { new: true, runValidators: true }).lean()

      if (!playerRole) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cplayerRole) })

      const aPlayerRole = playerRole.aRole ? [...playerRole.aRole] : []
      MatchModel.updateMany({ eCategory: req.query.sportsType.toUpperCase(), eStatus: 'P' }, { aPlayerRole }).exec()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cplayerRole), data: playerRole })
    } catch (error) {
      catchError('PlayerRole.update', error, req, res)
    }
  }

  // To update PlayerRole by _id along with sFull name
  async updateV2(req, res) {
    try {
      const { sFullName, nMax, nMin, nPosition } = req.body
      const { sportsType } = req.query

      if (parseInt(nMin) > parseInt(nMax)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].cminumum).replace('#', messages[req.userLanguage].cmaximum) })

      const playerRole = await PlayerRoleModel.findOneAndUpdate({ eCategory: sportsType.toUpperCase(), 'aRole._id': ObjectId(req.params.id) }, {
        'aRole.$.sFullName': sFullName,
        'aRole.$.nMax': nMax,
        'aRole.$.nMin': nMin,
        'aRole.$.nPosition': nPosition
      }, { new: true, runValidators: true }).lean()

      if (!playerRole) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cplayerRole) })

      MatchModel.updateMany({ eCategory: sportsType.toUpperCase(), eStatus: 'P' }, { aPlayerRole: playerRole.aRole }).exec()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cplayerRole), data: playerRole })
    } catch (error) {
      catchError('PlayerRole.updateV2', error, req, res)
    }
  }

  // To get details of single PlayerRole by _id
  async get(req, res) {
    try {
      const data = await PlayerRoleModel.findOne({
        eCategory: req.query.sportsType.toUpperCase()
      }, { aRole: { $elemMatch: { _id: ObjectId(req.params.id) } } }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cplayerRole) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cplayerRole), data: { ...data.aRole[0], _id: data._id } })
    } catch (error) {
      catchError('PlayerRole.get', error, req, res)
    }
  }
}

module.exports = new PlayerRole()
