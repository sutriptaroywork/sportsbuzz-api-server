const TeamModel = require('../team/model')
const MatchModel = require('../match/model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, getPaginationValues2, handleCatchError, checkValidImageType } = require('../../helper/utilities.services')
const s3 = require('../../helper/s3config')
const { matchProvider, category } = require('../../data')
const config = require('../../config/config')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
class Team {
  // To store formatted Teams in Team model
  async add(req, res, formatTeam = []) {
    try {
      if (formatTeam.length) {
        await TeamModel.insertMany(formatTeam, { ordered: false })
      }
    } catch (error) {
      // catchError('Team.add', error, req, res)
      handleCatchError(error)
    }
  }

  // To add Teams manually
  async addTeam(req, res) {
    try {
      const { sKey, sportsType } = req.body
      const eCategory = sportsType.toUpperCase()

      req.body = pick(req.body, ['sImage', 'sKey', 'sName', 'sShortName', 'eStatus', 'sColorCode'])

      const teamExist = await TeamModel.findOne({ sKey, eCategory }).lean()
      if (teamExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cteamKey) })

      const data = await TeamModel.create({ ...req.body, eCategory })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnewTeam), data })
    } catch (error) {
      catchError('Team.addTeam', error, req, res)
    }
  }

  // To update Teams manually by _id
  async update(req, res) {
    try {
      const { sKey, sportsType, sImage, eStatus, sShortName, sColorCode } = req.body
      const eCategory = sportsType.toUpperCase()
      req.body = pick(req.body, ['sName', 'sKey', 'sShortName', 'eStatus', 'sColorCode'])

      const oldTeam = await TeamModel.findById(req.params.id).lean()

      const teamExist = await TeamModel.findOne({ sKey, eCategory, _id: { $ne: ObjectId(req.params.id) } }).lean()
      if (teamExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cteamKey) })
      if (oldTeam.sShortName !== sShortName) req.body.bIsNameUpdated = true
      const team = await TeamModel.findByIdAndUpdate(req.params.id, { ...req.body, eCategory, sImage, sColorCode, dUpdatedAt: Date.now() }, { new: true, runValidators: true }).lean()
      if (!team) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cteam) })

      if (team && oldTeam) {
        const { sName, sShortName, sImage, sColorCode } = team
        let homeTeamUpdate = oldTeam.sName !== sName ? { 'oHomeTeam.sName': sName } : {}
        homeTeamUpdate = oldTeam.sShortName !== sShortName ? { ...homeTeamUpdate, 'oHomeTeam.sShortName': sShortName, 'oHomeTeam.bIsNameUpdated': true } : homeTeamUpdate
        homeTeamUpdate = oldTeam.sImage !== sImage ? { ...homeTeamUpdate, 'oHomeTeam.sImage': sImage } : homeTeamUpdate
        homeTeamUpdate = oldTeam.eStatus && oldTeam.eStatus !== eStatus ? { ...homeTeamUpdate, 'oHomeTeam.eStatus': eStatus } : homeTeamUpdate
        homeTeamUpdate = oldTeam.sColorCode && oldTeam.sColorCode !== sColorCode ? { ...homeTeamUpdate, 'oHomeTeam.sColorCode': sColorCode } : homeTeamUpdate

        let awayTeamUpdate = oldTeam.sName !== sName ? { 'oAwayTeam.sName': sName } : {}
        awayTeamUpdate = oldTeam.sShortName !== sShortName ? { ...awayTeamUpdate, 'oAwayTeam.sShortName': sShortName, 'oAwayTeam.bIsNameUpdated': true } : awayTeamUpdate
        awayTeamUpdate = oldTeam.sImage !== sImage ? { ...awayTeamUpdate, 'oAwayTeam.sImage': sImage } : awayTeamUpdate
        awayTeamUpdate = oldTeam.eStatus && oldTeam.eStatus !== eStatus ? { ...awayTeamUpdate, 'awayTeamUpdate.eStatus': eStatus } : awayTeamUpdate
        awayTeamUpdate = oldTeam.sColorCode && oldTeam.sColorCode !== sColorCode ? { ...awayTeamUpdate, 'oHomeTeam.sColorCode': sColorCode } : awayTeamUpdate

        await MatchModel.updateMany({ 'oHomeTeam.iTeamId': team._id }, homeTeamUpdate)
        await MatchModel.updateMany({ 'oAwayTeam.iTeamId': team._id }, awayTeamUpdate)
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cteamDetails), data: team })
    } catch (error) {
      catchError('Team.update', error, req, res)
    }
  }

  // To get signedUrl for Teams image
  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await s3.signedUrl(sFileName, sContentType, config.s3Teams)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('Team.getSignedUrl', error, req, res)
    }
  }

  // To get List of Teams (SportsType wise) with pagination, sorting and searching
  async list(req, res) {
    try {
      const { sportsType, eProvider } = req.query
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      let query = search ? { $or: [{ sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } }, { sShortName: { $regex: new RegExp('^.*' + search + '.*', 'i') } }] } : { }

      query = eProvider ? { ...query, eProvider: eProvider } : { ...query, eProvider: { $in: matchProvider } }

      query.eCategory = !sportsType ? { $in: category } : sportsType.toUpperCase()

      const results = await TeamModel.find(query, {
        sKey: 1,
        sName: 1,
        sShortName: 1,
        eCategory: 1,
        eProvider: 1,
        sImage: 1,
        dCreatedAt: 1,
        eStatus: 1,
        sColorCode: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const data = [{ results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cteam), data })
    } catch (error) {
      return catchError('Team.list', error, req, res)
    }
  }

  // To get counts of Teams (SportsType wise) with searching
  async getCounts(req, res) {
    try {
      const { sportsType, eProvider } = req.query
      const { search } = getPaginationValues2(req.query)

      let query = search ? { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : { }

      query = eProvider ? { ...query, eProvider: eProvider } : { ...query, eProvider: { $in: matchProvider } }

      query.eCategory = !sportsType ? { $in: category } : sportsType.toUpperCase()

      const count = await TeamModel.countDocuments({ ...query })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', `${messages[req.userLanguage].cteam} ${messages[req.userLanguage].cCounts}`), data: { count } })
    } catch (error) {
      return catchError('Team.getCounts', error, req, res)
    }
  }

  // To get details of single Teams
  async get(req, res) {
    try {
      const data = await TeamModel.findById(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cteam) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cteam), data })
    } catch (error) {
      catchError('Team.get', error, req, res)
    }
  }

  // To get List of TeamName and _id field
  async teamList(req, res) {
    try {
      let { start, limit, sportsType } = req.query
      const { search } = getPaginationValues2(req.query)

      start = start || 0
      limit = limit || 10

      let query = search ? { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : { }
      query = { ...query, eCategory: sportsType.toUpperCase(), eStatus: { $ne: 'N' } }

      const results = await TeamModel.find(query, { sName: 1 }).skip(Number(start)).limit(Number(limit)).lean()
      const total = await TeamModel.countDocuments({ ...query })

      const data = [{ total, results }]
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cteam), data })
    } catch (error) {
      catchError('Team.teamList', error, req, res)
    }
  }
}

module.exports = new Team()
