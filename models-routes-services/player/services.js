const PlayerModel = require('./model')
const MatchPlayerModel = require('../matchPlayer/model')
const PlayerRoleModel = require('../playerRoles/model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, removenull, getPaginationValues2, checkValidImageType } = require('../../helper/utilities.services')
const s3 = require('../../helper/s3config')
const { matchProvider, category } = require('../../data')
const config = require('../../config/config')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
class Player {
  // To store formatted Players in Player model
  async add(req, res, formatPlayer = []) {
    try {
      if (formatPlayer.length) {
        await PlayerModel.insertMany(formatPlayer)
      }
    } catch (error) {
      catchError('Player.add', error, req, res)
    }
  }

  // To add Player manually
  async addPlayer(req, res) {
    try {
      const { sKey, eRole, sportsType } = req.body
      const eCategory = sportsType.toUpperCase()

      req.body = pick(req.body, ['sImage', 'sKey', 'sName', 'nFantasyCredit', 'eRole', 'iTeamId', 'sportsType'])

      // If player already exist with the same key in our system then it'll wrong input from client side.
      const keyExist = await PlayerModel.findOne({ sKey, eCategory }).lean()
      if (keyExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cplayerKey) })

      // If player role not exist or not in proper input then we'll throw validation message accordingly.
      const role = await PlayerRoleModel.findOne({ eCategory: eCategory }).lean()
      if (!role) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cplayerRole) })

      const validRole = role.aRole.some((r) => r.sName === eRole)
      if (!validRole) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cplayerRole) })

      const data = await PlayerModel.create({ ...req.body, eCategory, iRoleId: role._id })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnewPlayer), data })
    } catch (error) {
      catchError('Player.addCricketPlayer', error, req, res)
    }
  }

  // To update Player manually by _id
  async update(req, res) {
    try {
      const { sKey, eRole, sportsType, sImage } = req.body
      const eCategory = sportsType.toUpperCase()

      req.body = pick(req.body, ['sKey', 'sName', 'nFantasyCredit', 'eRole', 'iTeamId'])
      removenull(req.body)

      // If player already exist with the same key in our system then it'll wrong input from client side.
      const keyExist = await PlayerModel.findOne({ sKey, eCategory, _id: { $ne: req.params.id } }).lean()
      if (sKey && keyExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cplayerKey) })

      // If player role not exist or not in proper input then we'll throw validation message accordingly.
      const role = await PlayerRoleModel.findOne({ eCategory: eCategory }).lean()
      if (eRole && !role) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cplayerRole) })

      const validRole = role.aRole.some((r) => r.sName === eRole)
      if (eRole && !validRole) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cplayerRole) })

      const player = await PlayerModel.findByIdAndUpdate(req.params.id, { ...req.body, eCategory, sImage }, { new: true, runValidators: true }).lean()
      if (!player) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cplayer) })

      MatchPlayerModel.updateMany({ iPlayerId: ObjectId(player._id) }, { sImage }).exec()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cplayer), data: player })
    } catch (error) {
      catchError('Player.update', error, req, res)
    }
  }

  // To get signedUrl for Player image
  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await s3.signedUrl(sFileName, sContentType, config.s3Players)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('Player.getSignedUrl', error, req, res)
    }
  }

  // To get List of Players (SportsType wise) with pagination, sorting and searching
  async list(req, res) {
    try {
      const { sportsType, eProvider } = req.query
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      const query = search ? { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      if (!eProvider) {
        query.eProvider = { $in: matchProvider }
      } else {
        query.eProvider = eProvider
      }
      query.eCategory = !sportsType ? { $in: category } : sportsType.toUpperCase()

      const results = await PlayerModel.find(query, {
        sKey: 1,
        sName: 1,
        eCategory: 1,
        eProvider: 1,
        sImage: 1,
        nFantasyCredit: 1,
        iRoleId: 1,
        eRole: 1,
        sTeamKey: 1,
        dCreatedAt: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const data = [{ results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cplayer), data: data })
    } catch (error) {
      return catchError('Player.list', error, req, res)
    }
  }

  // To get counts of Players (SportsType wise) with searching
  async getCounts(req, res) {
    try {
      const { sportsType, eProvider } = req.query
      const { search } = getPaginationValues2(req.query)

      const query = search ? { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      if (!eProvider) {
        query.eProvider = { $in: matchProvider }
      } else {
        query.eProvider = eProvider
      }
      query.eCategory = !sportsType ? { $in: category } : sportsType.toUpperCase()

      const count = await PlayerModel.countDocuments({ ...query })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', `${messages[req.userLanguage].cplayer} ${messages[req.userLanguage].cCounts}`), data: { count } })
    } catch (error) {
      return catchError('Player.getCounts', error, req, res)
    }
  }

  // To get details of single Player
  async get(req, res) {
    try {
      const data = await PlayerModel.findById(req.params.id).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cplayer) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cplayer), data })
    } catch (error) {
      catchError('Player.get', error, req, res)
    }
  }
}

module.exports = new Player()
