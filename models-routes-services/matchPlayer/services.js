const MatchPlayerModel = require('../matchPlayer/model')
const PlayerModel = require('../player/model')
const MatchModel = require('../match/model')
const TeamModel = require('../team/model')
const ApiLogModel = require('../apiLog/ApiLog.model')
const ScorePointModel = require('../scorePoint/model')
const PlayerRoleModel = require('../playerRoles/model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, removenull, getPaginationValues2, checkValidImageType, getIp } = require('../../helper/utilities.services')
const config = require('../../config/config')
const axios = require('axios')
const playerServices = require('../player/services')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const MatchTeamsModel = require('../matchTeams/model')
const UserTeamModel = require('../userTeam/model')
const s3 = require('../../helper/s3config')
const { bAllowDiskUse, s3MatchPlayers, CACHE_1 } = config
const { fetchPlaying11FromEntitySport, fetchPlaying11FromSoccerEntitySport, fetchStarting7FromKabaddiEntitySport, fetchStarting5FromBasketballEntitySport } = require('./common')
const CombinationPlayersModel = require('./combinationPlayers.model')
const { queuePush } = require('../../helper/redis')
const MatchLeagueModel = require('../matchLeague/model')
const StatsPlayerSortModel = require('./statsPlayerSortModel')
const adminLogQueue = require('../../rabbitmq/queue/adminLogQueue')
const apiLogQueue = require('../../rabbitmq/queue/apiLogQueue')

class MatchPlayer {
  getMatchPlayers(iMatchId) {
    return MatchPlayerModel.find({ iMatchId: ObjectId(iMatchId) }, { eRole: 1, nFantasyCredit: 1, iTeamId: 1 }).lean().cache(CACHE_1, `matchplayers:${iMatchId}`)
  }

  async fetchPlaying11Cricket(req, res) {
    try {
      const match = await MatchModel.findById(req.params.id).lean()
      if (!match) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })

      let playerKey = []
      let substitutePlayerKey = []
      if (match.eProvider === 'ENTITYSPORT') {
        const result = await fetchPlaying11FromEntitySport(match, req.userLanguage)
        if (result.isSuccess === false) {
          return res.status(result.status).jsonp({ status: result.status, message: result.message })
        }
        playerKey = result.data
        substitutePlayerKey = result.sData
      } else {
        let response
        try {
          response = await axios.get(`https://api.sportradar.us/cricket-p2/en/matches/${match.sKey}/lineups.json`, { params: { api_key: config.SPORTSRADAR_API_KEY } })
        } catch (error) {
          const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data?.response?.data, sUrl: `https://api.sportradar.us/cricket-p2/en/matches/${match.sKey}/lineups.json` }
          apiLogQueue.publish(logData)
          // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data?.response?.data, sUrl: `https://api.sportradar.us/cricket-p2/en/matches/${match.sKey}/lineups.json` })
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].no_lineups })
        }

        const data = response.data ? response.data.lineups : []
        const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data, sUrl: `https://api.sportradar.us/cricket-p2/en/matches/${match.sKey}/lineups.json` }
        apiLogQueue.publish(logData)
        // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data, sUrl: `https://api.sportradar.us/cricket-p2/en/matches/${match.sKey}/lineups.json` })
        for (const val of data) {
          val.starting_lineup.map((player) => {
            playerKey.push(player.id)
          })
        }
      }
      if (!playerKey.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].no_lineups })

      await Promise.all([
        MatchPlayerModel.updateMany({ sKey: { $in: playerKey }, iMatchId: match._id }, { bShow: true }),
        MatchPlayerModel.updateMany({ sKey: { $in: substitutePlayerKey }, iMatchId: match._id }, { bSubstitute: true }),
        MatchPlayerModel.updateMany({ sKey: { $nin: playerKey }, iMatchId: match._id }, { bShow: false })
      ])

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cplaying11) })
    } catch (error) {
      catchError('MatchPlayer.fetchPlaying11Cricket', error, req, res)
    }
  }

  async fetchPlaying11Football(req, res) {
    try {
      const match = await MatchModel.findById(req.params.id).lean()
      if (!match) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })

      let playerKey = []
      // let substitutePlayerKey = []
      let response
      if (match.eProvider === 'ENTITYSPORT') {
        const result = await fetchPlaying11FromSoccerEntitySport(match, req.userLanguage)
        if (result.isSuccess === false) {
          return res.status(result.status).jsonp({ status: result.status, message: result.message })
        }
        playerKey = result.data
        // substitutePlayerKey = result.sData
      } else {
        try {
          response = await axios.get(`https://api.sportradar.us/soccer-x3/global/en/matches/${match.sKey}/lineups.json`, { params: { api_key: config.FOOTBALL_API_KEY } })
        } catch (error) {
          const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://api.sportradar.us/soccer-x3/global/en/matches/${match.sKey}/lineups.json` }
          apiLogQueue.publish(logData)
          // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://api.sportradar.us/soccer-x3/global/en/matches/${match.sKey}/lineups.json` })
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].no_lineups })
        }
        const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data, sUrl: `https://api.sportradar.us/soccer-x3/global/en/matches/${match.sKey}/lineups.json` }
        apiLogQueue.publish(logData)
        // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data, sUrl: `https://api.sportradar.us/soccer-x3/global/en/matches/${match.sKey}/lineups.json` })
        const data = response.data ? response.data.lineups : []
        for (const val of data) {
          val.starting_lineup.map((player) => {
            playerKey.push(player.id)
          })
        }
      }
      if (!playerKey.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].no_lineups })

      await Promise.all([
        MatchPlayerModel.updateMany({ sKey: { $in: playerKey }, iMatchId: match._id }, { bShow: true }),
        MatchPlayerModel.updateMany({ sKey: { $nin: playerKey }, iMatchId: match._id }, { bShow: false })
        // MatchPlayerModel.updateMany({ sKey: { $in: substitutePlayerKey }, iMatchId: match._id }, { bSubstitute: true })
      ])

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cplaying11) })
    } catch (error) {
      catchError('MatchPlayer.fetchPlaying11Football', error, req, res)
    }
  }

  // to fetch starting 7 players of kabaddi match
  async fetchStarting7Kabaddi(req, res) {
    try {
      const match = await MatchModel.findById(req.params.id).lean()
      if (!match || match.eCategory !== 'KABADDI') return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })

      let playerKey = []
      if (match.eProvider === 'ENTITYSPORT') {
        const result = await fetchStarting7FromKabaddiEntitySport(match, req.userLanguage)
        if (result.isSuccess === false) {
          return res.status(result.status).jsonp({ status: result.status, message: result.message })
        }
        playerKey = result.data
      }
      if (!playerKey.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].no_kabaddi_lineups })

      await Promise.all([
        MatchPlayerModel.updateMany({ sKey: { $in: playerKey }, iMatchId: match._id }, { bShow: true }),
        MatchPlayerModel.updateMany({ sKey: { $nin: playerKey }, iMatchId: match._id }, { bShow: false })])

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cstarting7) })
    } catch (error) {
      catchError('MatchPlayer.fetchStarting7Kabaddi', error, req, res)
    }
  }

  // to fetch starting 5 players of basketball match
  async fetchStarting5Basketball(req, res) {
    try {
      const match = await MatchModel.findById(req.params.id).lean()
      if (!match || match.eCategory !== 'BASKETBALL') return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })

      let playerKey = []
      if (match.eProvider === 'ENTITYSPORT') {
        const result = await fetchStarting5FromBasketballEntitySport(match, req.userLanguage)
        if (result.isSuccess === false) {
          return res.status(result.status).jsonp({ status: result.status, message: result.message })
        }
        playerKey = result.data
      }
      if (!playerKey.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].no_basketball_lineups })

      await Promise.all([
        MatchPlayerModel.updateMany({ sKey: { $in: playerKey }, iMatchId: match._id }, { bShow: true }),
        MatchPlayerModel.updateMany({ sKey: { $nin: playerKey }, iMatchId: match._id }, { bShow: false })])

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cstarting5) })
    } catch (error) {
      catchError('MatchPlayer.fetchStarting5Basketball', error, req, res)
    }
  }

  async addV2(req, res) {
    try {
      const { sportsType, iTeamId, iMatchId, aPlayers } = req.body
      const eCategory = sportsType.toUpperCase()

      req.body = pick(req.body, ['iMatchId', 'iTeamId', 'nScoredPoints', 'bShow', 'nSeasonPoints'])

      const match = await MatchModel.findOne({ _id: ObjectId(iMatchId), $or: [{ 'oHomeTeam.iTeamId': ObjectId(iTeamId) }, { 'oAwayTeam.iTeamId': ObjectId(iTeamId) }] }).lean()
      if (!match) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cteam) })

      const sTeamKey = await TeamModel.findOne({ sKey: { $in: [match.oHomeTeam.sKey, match.oAwayTeam.sKey] }, eCategory: match.eCategory, eProvider: match.eProvider }).lean()
      req.body.sTeamKey = sTeamKey.sKey
      req.body.sTeamName = sTeamKey.sName

      const aPointBreakup = await ScorePointModel.find({ eCategory, eFormat: match.eFormat }, { sKey: 1, sName: 1, nPoint: 1 }).lean()
      const data = []
      for (const players of aPlayers) {
        const exist = await MatchPlayerModel.findOne({ iPlayerId: players.iPlayerId, iMatchId }, { _id: 1 }).lean()
        if (exist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].matchPlayer) })

        const player = await PlayerModel.findOne({ _id: players.iPlayerId, eCategory }, { _id: 0, sKey: 1, eRole: 1, sImage: 1 }).lean()
        if (!player) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cplayer) })

        const response = await MatchPlayerModel.create({ ...req.body, ...player, ...players, eCategory, aPointBreakup })
        data.push(response)
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnewMatchPlayer), data })
    } catch (error) {
      catchError('MatchPlayer.addV2', error, req, res)
    }
  }

  // To get details of single MatchPlayer
  async get(req, res) {
    try {
      const data = await MatchPlayerModel.findById(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].matchPlayer) })

      const match = await MatchModel.findById(data.iMatchId, { sName: 1 }).lean()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].matchPlayer), data: { ...data, sMatchName: match ? match.sName : '' } })
    } catch (error) {
      catchError('MatchPlayer.get', error, req, res)
    }
  }

  // To get signedUrl for MatchPlayer image
  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await s3.signedUrl(sFileName, sContentType, s3MatchPlayers)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('MatchPlayer.getSignedUrl', error, req, res)
    }
  }

  // To update single MatchPlayer by _id
  async update(req, res) {
    try {
      let { eRole, sportsType, sImage, iTeamId, iMatchId } = req.body

      const eCategory = sportsType.toUpperCase()
      eRole = eRole.toUpperCase()

      req.body = pick(req.body, ['sName', 'sImage', 'iMatchId', 'iTeamId', 'iPlayerId', 'sName', 'nScoredPoints', 'bShow', 'bSubstitute', 'nSeasonPoints', 'nFantasyCredit', 'eRole'])
      removenull(req.body)

      const query = iTeamId ? { _id: ObjectId(iMatchId), $or: [{ 'oHomeTeam.iTeamId': ObjectId(iTeamId) }, { 'oAwayTeam.iTeamId': ObjectId(iTeamId) }] } : { _id: ObjectId(iMatchId) }
      const match = await MatchModel.findOne(query).lean()
      if (!match) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cteam) })

      if (iTeamId) {
        if (match.oHomeTeam.iTeamId.toString() === iTeamId) {
          req.body.sTeamName = match.oHomeTeam.sName
        } else if (match.oAwayTeam.iTeamId.toString() === iTeamId) {
          req.body.sTeamName = match.oAwayTeam.sName
        }
        const sTeamKey = await TeamModel.findOne({ sName: req.body.sTeamName, sKey: { $in: [match.oHomeTeam.sKey, match.oAwayTeam.sKey] }, eCategory: match.eCategory }).lean()
        if (sTeamKey) req.body.sTeamKey = sTeamKey.sKey
      }

      const role = await PlayerRoleModel.findOne({ eCategory: eCategory }, { aRole: { $elemMatch: { eKey: eRole } } }).lean()
      if (eRole && !role) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cplayerRole) })

      // if match is not in pending status then we won't allow admin to chanege player role
      const oPlayerUpdate = { ...req.body, sImage, eCategory, eRole, dUpdatedAt: Date.now() }

      const existPlayer = await MatchPlayerModel.findById(req.params.id).lean()
      if (!existPlayer) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].matchPlayer) })

      if (!['P', 'U'].includes(match.eStatus) && eRole !== existPlayer.eRole) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].cannot_edit_player_role })

      const player = await MatchPlayerModel.findByIdAndUpdate(req.params.id, oPlayerUpdate, { new: true, runValidators: true }).lean()
      if (!player) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].matchPlayer) })

      const { sName, sImage: sImages, nFantasyCredit, iTeamId: teamId, eRole: playerRole } = player

      const oPlayer = { sName, sImage: sImages, nFantasyCredit, eRole: playerRole, iTeamId: teamId }
      const logData = { oOldFields: existPlayer, oNewFields: player, iAdminId: req.admin._id, eKey: 'MP', sIp: getIp(req) }

      await Promise.all([
        PlayerModel.updateOne({ _id: ObjectId(player.iPlayerId) }, oPlayer),
        adminLogQueue.publish(logData)
      ])

      const s3Params = {
        Bucket: config.S3_BUCKET_NAME,
        Key: player.sImage
      }

      let data
      if (s3Params && player.sImage !== sImage) {
        data = await s3.deleteObject(s3Params)
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].matchPlayer), data: data || player })
    } catch (error) {
      catchError('MatchPlayer.update', error, req, res)
    }
  }

  // To delete single MatchPlayer by _id - deprecate soon
  async remove(req, res) {
    try {
      const exist = await MatchTeamsModel.find({ 'aPlayers.iMatchPlayerId': ObjectId(req.params.id) }).lean()
      const existHashes = exist.map(({ sHash }) => sHash)

      const userTeams = await UserTeamModel.countDocuments({ sHash: { $in: existHashes } })
      if (userTeams && userTeams >= 1) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].machplayer_exist })

      const data = await MatchPlayerModel.findByIdAndDelete(req.params.id)
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].matchPlayer) })

      const logData = { oOldFields: data, oNewFields: {}, eKey: 'MP', iAdminId: req.admin._id, sIp: getIp(req) }
      adminLogQueue.publish(logData);

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].matchPlayer), data })
    } catch (error) {
      return catchError('MatchPlayer.remove', error, req, res)
    }
  }

  // To delete single MatchPlayer by _id
  async removeV2(req, res) {
    try {
      const exist = await MatchTeamsModel.find({ 'aPlayers.iMatchPlayerId': ObjectId(req.params.id), iMatchId: req.query.iMatchId }).lean()
      const existHashes = exist.map(({ sHash }) => sHash)

      const userTeams = await UserTeamModel.countDocuments({ sHash: { $in: existHashes } })
      if (userTeams && userTeams >= 1) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].machplayer_exist })

      const data = await MatchPlayerModel.findByIdAndDelete(req.params.id)
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].matchPlayer) })

      const logData = { oOldFields: data, oNewFields: {}, eKey: 'MP', iAdminId: req.admin._id, sIp: getIp(req) }
      adminLogQueue.publish(logData);

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].matchPlayer), data })
    } catch (error) {
      return catchError('MatchPlayer.removeV2', error, req, res)
    }
  }

  async scoredPointUpdate(req, res) {
    try {
      const { aPointBreakup } = req.body
      let scorePoint = 0
      // bShow === true
      const data = await MatchPlayerModel.findById(req.params.id).lean()
      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].matchPlayer) }) }

      for (const pointBreakup of aPointBreakup) {
        const { _id, nScoredPoints } = pointBreakup
        await MatchPlayerModel.updateOne({ _id: ObjectId(req.params.id), 'aPointBreakup._id': ObjectId(_id) },
          { 'aPointBreakup.$.nScoredPoints': nScoredPoints })
        scorePoint = scorePoint + nScoredPoints
      }

      await MatchPlayerModel.updateOne({ _id: ObjectId(req.params.id) }, { nScoredPoints: scorePoint })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].matchPlayer), data })
    } catch (error) {
      catchError('MatchPlayer.scoredPointUpdate', error, req, res)
    }
  }

  async scoredPointGet(req, res) {
    try {
      const data = await MatchPlayerModel.findById(req.params.id, { aPointBreakup: 1 }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].matchPlayer) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpointBreakup), data })
    } catch (error) {
      catchError('MatchPlayer.scoredPointGet', error, req, res)
    }
  }

  // To fetch and format cricket MatchPlayers for match from third party API by match_id
  async fetchMatchPlayerCricket(req, res) {
    try {
      const match = await MatchModel.findById(req.params.id).lean()
      if (!match) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) }) }

      const { sSeasonKey, oHomeTeam, oAwayTeam, _id, eCategory, eFormat, eProvider } = match

      let homeTeamRes
      let awayTeamRes
      let formatPlayers = []
      let bHomeTeamError = false

      if (eProvider === 'ENTITYSPORT') {
        const result = await fetchCricketPlayerFromEntitySport(match, req.userLanguage)
        if (result.isSuccess === false) {
          return res.status(result.status).jsonp({ status: result.status, message: result.message })
        }
        formatPlayers = result.data
      } else {
        try {
          homeTeamRes = await axios.get(`https://api.sportradar.com/cricket-p2/en/tournaments/${sSeasonKey}/teams/${oHomeTeam.sKey}/squads.json`, { params: { api_key: config.SPORTSRADAR_API_KEY } })
          bHomeTeamError = true
          awayTeamRes = await axios.get(`https://api.sportradar.com/cricket-p2/en/tournaments/${sSeasonKey}/teams/${oAwayTeam.sKey}/squads.json`, { params: { api_key: config.SPORTSRADAR_API_KEY } })
        } catch (error) {
          const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: !bHomeTeamError ? `https://api.sportradar.com/cricket-p2/en/tournaments/${sSeasonKey}/teams/${oHomeTeam.sKey}/squads.json` : `https://api.sportradar.com/cricket-p2/en/tournaments/${sSeasonKey}/teams/${oAwayTeam.sKey}/squads.json` }
          apiLogQueue.publish(logData)
          // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: !bHomeTeamError ? `https://api.sportradar.com/cricket-p2/en/tournaments/${sSeasonKey}/teams/${oHomeTeam.sKey}/squads.json` : `https://api.sportradar.com/cricket-p2/en/tournaments/${sSeasonKey}/teams/${oAwayTeam.sKey}/squads.json` })
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].no_matchplayer })
        }
        const arrayOfLogdata = [
          { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: homeTeamRes.data, sUrl: `https://api.sportradar.com/cricket-p2/en/tournaments/${sSeasonKey}/teams/${oHomeTeam.sKey}/squads.json` },
          { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: awayTeamRes.data, sUrl: `https://api.sportradar.com/cricket-p2/en/tournaments/${sSeasonKey}/teams/${oAwayTeam.sKey}/squads.json` }
        ]
        arrayOfLogdata.forEach((logData) => apiLogQueue.publish(logData))
        // await ApiLogModel.create(aLog)

        const homeTeamPlayers = homeTeamRes.data.players || []
        const awayTeamPlayers = awayTeamRes.data.players || []

        let setFormat = ''
        if ((eFormat === 'ODI') || (eFormat === 'LIST_A')) {
          setFormat = 'ODI'
        } else if ((eFormat === 'T20I') || (eFormat === 'T20') || (eFormat === 'VT20')) {
          setFormat = 'T20'
        } else if ((eFormat === 'T10I') || (eFormat === 'T10')) {
          setFormat = 'T10'
        } else if (eFormat === 'TEST') {
          setFormat = 'TEST'
        } else if (eFormat === '100BALL') {
          setFormat = '100BALL'
        } else if (eFormat === 'FIRSTCLASS') {
          setFormat = 'FIRSTCLASS'
        }

        const aPointBreakup = await ScorePointModel.find({ eCategory, eFormat: setFormat }, { sKey: 1, sName: 1, nPoint: 1 }).lean()

        formatPlayers = homeTeamPlayers.map((player) => {
          const { id, name, type } = player
          let eRole
          switch (type) {
            case 'batsman':
              eRole = 'BATS'
              break
            case 'bowler':
              eRole = 'BWL'
              break
            case 'all_rounder':
              eRole = 'ALLR'
              break
            case 'wicket_keeper':
              eRole = 'WK'
              break
            default:
              eRole = 'BATS'
          }

          const reg = /^.*?(?=,)/
          const reg2 = /[^,]+$/
          const s = name ? reg.exec(name) || [] : []
          const n = name ? reg2.exec(name) || [] : []
          n[0] = n[0] || []
          s[0] = s[0] || []
          const playerName = (n[0] + ' ' + s[0]).trim()
          return {
            iMatchId: _id,
            iTeamId: oHomeTeam.iTeamId,
            sName: playerName,
            sTeamName: oHomeTeam.sName,
            eRole: eRole,
            sKey: id,
            aPointBreakup
          }
        })
        awayTeamPlayers.map((player) => {
          const { id, name, type } = player
          let eRole
          switch (type) {
            case 'batsman':
              eRole = 'BATS'
              break
            case 'bowler':
              eRole = 'BWL'
              break
            case 'all_rounder':
              eRole = 'ALLR'
              break
            case 'wicket_keeper':
              eRole = 'WK'
              break
            default:
              eRole = 'BATS'
          }
          const reg = /^.*?(?=,)/
          const reg2 = /[^,]+$/

          const s = name ? reg.exec(name) || [] : []
          const n = name ? reg2.exec(name) || [] : []
          n[0] = n[0] || []
          s[0] = s[0] || []
          const playerName = (n[0] + ' ' + s[0]).trim()

          formatPlayers.push({
            iMatchId: _id,
            iTeamId: oAwayTeam.iTeamId,
            sName: playerName,
            sTeamName: oAwayTeam.sName,
            // sName: name.replace(/[^a-zA-Z ]/g, ''),
            eRole: eRole,
            sKey: id,
            aPointBreakup
          })
        })
      }

      if (!formatPlayers.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].no_matchplayer })
      await storeMatchPlayer(req, res, formatPlayers, eCategory, eProvider)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].newMatchPlayers) })
    } catch (error) {
      catchError('MatchPlayer.fetchMatchPlayer', error, req, res)
    }
  }

  // To fetch and format football MatchPlayers for match from third party API by match_id
  async fetchMatchPlayerFootball(req, res) {
    try {
      const match = await MatchModel.findById(req.params.id).lean()
      if (!match) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) }) }

      const { oHomeTeam, oAwayTeam, _id, eCategory, eFormat, eProvider } = match

      let homeTeamRes
      let awayTeamRes
      let formatPlayers = []
      let bHomeTeamError = false

      if (eProvider === 'ENTITYSPORT') {
        const result = await fetchSoccerPlayerFromEntitySport(match, req.userLanguage)
        if (result.isSuccess === false) {
          return res.status(result.status).jsonp({ status: result.status, message: result.message })
        }
        formatPlayers = result.data
      } else {
        try {
          homeTeamRes = await axios.get(`https://api.sportradar.us/soccer-x3/global/en/teams/${oHomeTeam.sKey}/profile.json`, { params: { api_key: config.FOOTBALL_API_KEY } })
          bHomeTeamError = true
          awayTeamRes = await axios.get(`https://api.sportradar.us/soccer-x3/global/en/teams/${oAwayTeam.sKey}/profile.json`, { params: { api_key: config.FOOTBALL_API_KEY } })
        } catch (error) {
          const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: !bHomeTeamError ? `https://api.sportradar.us/soccer-x3/global/en/teams/${oHomeTeam.sKey}/profile.json` : `https://api.sportradar.us/soccer-x3/global/en/teams/${oAwayTeam.sKey}/profile.json` }
          apiLogQueue.publish(logData)
          // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: !bHomeTeamError ? `https://api.sportradar.us/soccer-x3/global/en/teams/${oHomeTeam.sKey}/profile.json` : `https://api.sportradar.us/soccer-x3/global/en/teams/${oAwayTeam.sKey}/profile.json` })
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].no_matchplayer })
        }

        const arrayOfLogData = [
          { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: homeTeamRes.data, sUrl: `https://api.sportradar.us/soccer-x3/global/en/teams/${oHomeTeam.sKey}/profile.json` },
          { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: awayTeamRes.data, sUrl: `https://api.sportradar.us/soccer-x3/global/en/teams/${oAwayTeam.sKey}/profile.json` }
        ]
        arrayOfLogData.forEach((logData) => apiLogQueue.publish(logData))
        // await ApiLogModel.create(aLog)

        const homeTeamPlayers = homeTeamRes.data.players || []
        const awayTeamPlayers = awayTeamRes.data.players || []

        if (homeTeamPlayers.length < 1 || awayTeamPlayers.length < 1) { return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].no_matchplayer }) }
        const aPointBreakup = await ScorePointModel.find({ eCategory, eFormat }, { sKey: 1, sName: 1, nPoint: 1 }).lean()

        formatPlayers = homeTeamPlayers.map((player) => {
          const { id, name, type } = player
          let eRole
          switch (type) {
            case 'goalkeeper':
              eRole = 'GK'
              break

            case 'defender':
              eRole = 'DEF'
              break
            case 'midfielder':
              eRole = 'MID'
              break
            case 'forward':
              eRole = 'FWD'
              break

            default:
              eRole = 'MID'
          }

          const reg = /^.*?(?=,)/
          const reg2 = /[^,]+$/
          const s = name ? reg.exec(name) || [] : []
          const n = name ? reg2.exec(name) || [] : []
          n[0] = n[0] || []
          s[0] = s[0] || []
          const playerName = (n[0] + ' ' + s[0]).trim()

          return {
            iMatchId: _id,
            iTeamId: oHomeTeam.iTeamId,
            sName: playerName,
            sTeamName: oHomeTeam.sName,
            eRole: eRole,
            sKey: id,
            aPointBreakup
          }
        })
        awayTeamPlayers.map((player) => {
          const { id, name, type } = player
          let eRole
          switch (type) {
            case 'goalkeeper':
              eRole = 'GK'
              break

            case 'defender':
              eRole = 'DEF'
              break
            case 'midfielder':
              eRole = 'MID'
              break
            case 'forward':
              eRole = 'FWD'
              break

            default:
              eRole = 'MID'
          }
          const reg = /^.*?(?=,)/
          const reg2 = /[^,]+$/
          const s = name ? reg.exec(name) || [] : []
          const n = name ? reg2.exec(name) || [] : []
          n[0] = n[0] || []
          s[0] = s[0] || []
          const playerName = (n[0] + ' ' + s[0]).trim()
          formatPlayers.push({
            iMatchId: _id,
            iTeamId: oAwayTeam.iTeamId,
            sName: playerName,
            sTeamName: oAwayTeam.sName,
            eRole: eRole,
            sKey: id,
            aPointBreakup
          })
        })
      }
      if (!formatPlayers.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].no_matchplayer })

      await storeMatchPlayer(req, res, formatPlayers, eCategory, eProvider)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].newMatchPlayers) })
    } catch (error) {
      catchError('MatchPlayer.fetchMatchPlayerFootball', error, req, res)
    }
  }

  // To fetch and format basketball MatchPlayers for match from third party API by match_id
  async fetchMatchPlayerBasketball(req, res) {
    try {
      const match = await MatchModel.findById(req.params.id).lean()
      if (!match) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) }) }

      const { oHomeTeam, oAwayTeam, _id, eCategory, eFormat, eProvider } = match

      let homeTeamRes
      let awayTeamRes
      let formatPlayers = []
      let bHomeTeamError = false

      if (eProvider === 'ENTITYSPORT') {
        const result = await fetchBasketballPlayerFromEntitySport(match, req.userLanguage)
        if (result.isSuccess === false) {
          return res.status(result.status).jsonp({ status: result.status, message: result.message })
        }
        formatPlayers = result.data
      } else {
        try {
          homeTeamRes = await axios.get(`https://api.sportradar.com/nba/production/v5/en/teams/${oHomeTeam.sKey}/profile.json`, { params: { api_key: config.NBA_API_KEY } })
          bHomeTeamError = true
          awayTeamRes = await axios.get(`https://api.sportradar.com/nba/production/v5/en/teams/${oAwayTeam.sKey}/profile.json`, { params: { api_key: config.NBA_API_KEY } })
        } catch (error) {
          const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: !bHomeTeamError ? `https://api.sportradar.com/nba/production/v5/en/teams/${oHomeTeam.sKey}/profile.json` : `https://api.sportradar.com/nba/production/v5/en/teams/${oAwayTeam.sKey}/profile.json` }
          apiLogQueue.publish(logData)
          // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: !bHomeTeamError ? `https://api.sportradar.com/nba/production/v5/en/teams/${oHomeTeam.sKey}/profile.json` : `https://api.sportradar.com/nba/production/v5/en/teams/${oAwayTeam.sKey}/profile.json` })
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].no_matchplayer })
        }

        const arrayOfLogData = [
          { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: homeTeamRes.data, sUrl: `https://api.sportradar.com/nba/production/v5/en/teams/${oHomeTeam.sKey}/profile.json` },
          { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: awayTeamRes.data, sUrl: `https://api.sportradar.com/nba/production/v5/en/teams/${oAwayTeam.sKey}/profile.json` }
        ]
        arrayOfLogData.forEach((logData) => apiLogQueue.publish(logData))
        // await ApiLogModel.create(aLog)

        const homeTeamPlayers = homeTeamRes.data.players || []
        const awayTeamPlayers = awayTeamRes.data.players || []
        if (homeTeamPlayers.length < 1 || awayTeamPlayers.length < 1) { return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].no_matchplayer }) }
        const aPointBreakup = await ScorePointModel.find({ eCategory, eFormat }, { sKey: 1, sName: 1, nPoint: 1 }).lean()

        formatPlayers = homeTeamPlayers.map((player) => {
          const { sr_id: id, full_name: name, primary_position: eRole } = player
          const sName = name || ''
          return {
            iMatchId: _id,
            iTeamId: oHomeTeam.iTeamId,
            sName,
            sTeamName: oHomeTeam.sName,
            eRole,
            sKey: id,
            aPointBreakup
          }
        })
        awayTeamPlayers.map((player) => {
          const { sr_id: id, full_name: name, primary_position: eRole } = player
          const sName = name || ''

          formatPlayers.push({
            iMatchId: _id,
            iTeamId: oAwayTeam.iTeamId,
            sName,
            sTeamName: oAwayTeam.sName,
            eRole,
            sKey: id,
            aPointBreakup
          })
        })
      }

      await storeMatchPlayer(req, res, formatPlayers, eCategory, eProvider)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].newMatchPlayers) })
    } catch (error) {
      catchError('MatchPlayer.fetchMatchPlayerBasketball', error, req, res)
    }
  }

  // To fetch and format Baseball MatchPlayers for match from third party API by match_id
  async fetchMatchPlayerBaseball(req, res) {
    try {
      const match = await MatchModel.findById(req.params.id).lean()
      if (!match) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })

      const { oHomeTeam, oAwayTeam, _id, eCategory, sKey, eProvider } = match

      const response = await axios.get(`https://rest.entitysport.com/baseball/matches/${sKey}/fantasy`, { params: { token: config.ENTITYSPORT_BASEBALL_API_KEY } })

      const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data.items, sUrl: `https://rest.entitysport.com/baseball/matches/${sKey}/fantasy` }
      apiLogQueue.publish(logData)
      // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data.items, sUrl: `https://rest.entitysport.com/baseball/matches/${sKey}/fantasy` })

      const homeTeamPlayers = response.data.response.items.fantasy_squad.home || []
      const awayTeamPlayers = response.data.response.items.fantasy_squad.away || []

      const formatPlayers = homeTeamPlayers.map((player) => {
        const { pid, name, role, rating: nFantasyCredit } = player
        let eRole
        switch (role) {
          case 'outfielder':
            eRole = 'OF'
            break

          case 'infielder':
            eRole = 'IF'
            break
          case 'pitcher':
            eRole = 'P'
            break
          case 'catcher':
            eRole = 'CT'
            break

          default:
            eRole = 'P'
        }
        return {
          iMatchId: _id,
          iTeamId: oHomeTeam.iTeamId,
          sName: name.replace(/[^a-zA-Z ]/g, ''),
          eRole: eRole,
          nFantasyCredit: nFantasyCredit || undefined,
          sKey: pid
        }
      })
      awayTeamPlayers.forEach((player) => {
        const { pid, name, role, rating: nFantasyCredit } = player
        let eRole
        switch (role) {
          case 'outfielder':
            eRole = 'OF'
            break

          case 'infielder':
            eRole = 'IF'
            break
          case 'pitcher':
            eRole = 'P'
            break
          case 'catcher':
            eRole = 'CT'
            break

          default:
            eRole = 'P'
        }
        formatPlayers.push({
          iMatchId: _id,
          iTeamId: oAwayTeam.iTeamId,
          sName: name.replace(/[^a-zA-Z ]/g, ''),
          nFantasyCredit: nFantasyCredit || undefined,
          eRole: eRole,
          sKey: pid
        })
      })
      storeMatchPlayer(req, res, formatPlayers, eCategory, eProvider)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].newMatchPlayers), data: formatPlayers })
    } catch (error) {
      catchError('MatchPlayer.fetchMatchPlayerBaseball', error, req, res)
    }
  }

  // To fetch and format Kabaddi MatchPlayers for match from third party API by match_id
  async fetchMatchPlayerKabaddi(req, res) {
    try {
      const match = await MatchModel.findById(req.params.id).lean()
      if (!match) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) }) }

      const { eCategory, eProvider } = match

      let formatPlayers = []

      const result = await fetchKabaddiPlayerFromEntitySport(match, req.userLanguage)
      if (result.isSuccess === false) {
        return res.status(result.status).jsonp({ status: result.status, message: result.message })
      }
      formatPlayers = result.data
      if (!formatPlayers.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].no_matchplayer })

      await storeMatchPlayer(req, res, formatPlayers, eCategory, eProvider)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].newMatchPlayers) })
    } catch (error) {
      catchError('MatchPlayer.fetchMatchPlayerKabaddi', error, req, res)
    }
  }

  // To get List of MatchPlayers (match wise) with or without pagination, sorting and searching
  async list(req, res) {
    try {
      const { eRole, start, limit, iTeamId = '', bLineUps, bSubstitute, bCMBList, bCMBSub = false } = req.query
      const { sorting, search } = getPaginationValues2(req.query)

      const match = await MatchModel.findById(req.params.id, { bLineupsOut: 1, aPlayerRole: 1, eCategory: 1 }).lean()
      if (!match) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) }) }

      let query = eRole ? { eRole, iMatchId: ObjectId(req.params.id) } : { iMatchId: ObjectId(req.params.id) }
      query = search ? { ...query, sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : query
      query = ['true', true, 'false', false].includes(bLineUps) ? { ...query, bShow: bLineUps } : query
      query = ['true', true, 'false', false].includes(bSubstitute) ? { ...query, bSubstitute: bSubstitute } : query

      // Show Substitute player along with playing 11 players for CMB
      if (['true', true].includes(bCMBList) && ['true', true].includes(bCMBSub) && match.bLineupsOut) {
        delete query.bShow
        delete query.bSubstitute
        query = {
          ...query,
          $or: [
            { bShow: true },
            { bSubstitute: true }
          ]
        }
      }

      let results = []

      const projection = {
        iMatchId: 1,
        sTeamName: 1,
        iPlayerId: 1,
        sImage: 1,
        sName: 1,
        eRole: 1,
        nScoredPoints: 1,
        nSeasonPoints: 1,
        nFantasyCredit: 1,
        bShow: 1,
        bSubstitute: 1,
        dCreatedAt: 1
      }

      /* const teamIdFilter = []
      if (iTeamId) {
        teamIdFilter.push(ObjectId(iTeamId))
      } else {
        teamIdFilter.push(match.oHomeTeam.iTeamId)
        teamIdFilter.push(match.oAwayTeam.iTeamId)
      } */

      if (iTeamId) {
        query = {
          ...query,
          iTeamId: ObjectId(iTeamId)
        }
      }

      if (start && limit) {
        results = await MatchPlayerModel.find(query, projection).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()
      } else {
        results = await MatchPlayerModel.find(query, projection).sort(sorting).lean()
      }

      const total = await MatchPlayerModel.countDocuments({ ...query })

      // if (results.length && ['true', true].includes(bCMBList) && !match.bLineupsOut && match.eCategory && match.aPlayerRole) {
      //   const combinationPlayers = await CombinationPlayersModel.findOne({ iMatchId: req.params.id }, { aMatchPlayers: 1 }).lean()
      //   if (combinationPlayers) {
      //     const existPlayerIds = combinationPlayers.aMatchPlayers.map((id) => id.toString())
      //     results = results.filter((player) => existPlayerIds.includes(player._id.toString()))
      //   } else {
      //     const sportRules = await sportServices.findSport(match.eCategory)
      //     if (sportRules && sportRules.oRule && sportRules.oRule.nTotalPlayers) {
      //       const data = getRoleWiseMatchPlayers(results, { aPlayerRole: match.aPlayerRole, nTotalPlayers: sportRules.oRule.nTotalPlayers })
      //       if (data && data.length && data.length === (2 * sportRules.oRule.nTotalPlayers)) {
      //         results = data
      //         const aMatchPlayers = data.map(({ _id }) => ObjectId(_id))
      //         await CombinationPlayersModel.create({ iMatchId: req.params.id, aMatchPlayers })
      //       }
      //     }
      //   }
      // }

      const data = [{ total, results, bLineupsOut: match.bLineupsOut }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].matchPlayer), data: data })
    } catch (error) {
      return catchError('MatchPlayer.list', error, req, res)
    }
  }

  // To calculate matchPlayer's season point
  async calculateSeasonPoint(req, res) {
    try {
      const match = await MatchModel.findById(req.params.id).lean()
      if (!match) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })

      const team = [match.oHomeTeam.iTeamId, match.oAwayTeam.iTeamId]

      const matches = await MatchModel.find({ sSeasonKey: match.sSeasonKey, eFormat: match.eFormat, eCategory: match.eCategory, $or: [{ 'oHomeTeam.iTeamId': { $in: team } }, { 'oAwayTeam.iTeamId': { $in: team } }], eStatus: 'CMP' }).lean()
      if (!matches.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].matches_not_completed })

      const aMatchIds = matches.map(m => ObjectId(m._id))
      const data = await MatchPlayerModel.aggregate([
        {
          $match: {
            iMatchId: { $in: aMatchIds }
          }
        }, {
          $group: {
            _id: '$iPlayerId',
            sum: { $sum: '$nScoredPoints' },
            data: {
              $push: '$$ROOT'
            }
          }
        },
        {
          $project: {
            nSeasonPoints: '$sum',
            iPlayerId: '$_id'
          }
        }
      ]).allowDiskUse(bAllowDiskUse).exec()

      if (!data.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].matchPlayer) })

      const aBulkMatchPlayer = []

      for (const matchPlayer of data) {
        aBulkMatchPlayer.push({
          updateOne: {
            filter: { iPlayerId: ObjectId(matchPlayer.iPlayerId), iMatchId: ObjectId(match._id) },
            update: { $set: { nSeasonPoints: matchPlayer.nSeasonPoints, bPointCalculated: true } }
          }
        })
      }
      await MatchPlayerModel.bulkWrite(aBulkMatchPlayer, { writeConcern: { w: 'majority' }, ordered: false })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cseasonPoint) })
    } catch (error) {
      catchError('MatchPlayer.calculateSeasonPoint', error, req, res)
    }
  }

  // calculate season point of single and multiple matches.
  async calculateSeasonPointV2(req, res) {
    try {
      let matches = []
      if (req.body.iMatchId) {
        const match = await MatchModel.findById(req.body.iMatchId).lean()
        if (!match) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })
        matches.push(match)
      } else {
        matches = await MatchModel.find({ eStatus: 'U', bDisabled: false, dStartDate: { $gte: new Date() } }).select({ oHomeTeam: 1, oAwayTeam: 1, sSeasonKey: 1, eCategory: 1 }).lean()
      }
      for (const match of matches) {
        const team = [match.oHomeTeam.iTeamId, match.oAwayTeam.iTeamId]
        const seasonMatches = await MatchModel.find({ sSeasonKey: match.sSeasonKey, eFormat: match.eFormat, eCategory: match.eCategory, $or: [{ 'oHomeTeam.iTeamId': { $in: team } }, { 'oAwayTeam.iTeamId': { $in: team } }] }).select({ _id: 1 }).lean()
        const aMatchIds = seasonMatches.map(m => ObjectId(m._id))

        const data = await MatchPlayerModel.aggregate([
          {
            $match: {
              iMatchId: { $in: aMatchIds }
            }
          }, {
            $group: {
              _id: '$iPlayerId',
              sum: { $sum: '$nScoredPoints' },
              data: {
                $push: '$$ROOT'
              }
            }
          }, {
            $unwind: {
              path: '$data'
            }
          },
          {
            $match: {
              'data.iMatchId': match._id
            }
          },
          {
            $project: {
              nSeasonPoints: '$sum',
              _id: '$data._id'
            }
          }
        ]).allowDiskUse(bAllowDiskUse).exec()
        if (!data.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].matchPlayer) })

        const aBulkMatchPlayer = []
        for (const matchPlayer of data) {
          aBulkMatchPlayer.push({
            updateOne: {
              filter: { _id: ObjectId(matchPlayer._id) },
              update: { $set: { nSeasonPoints: matchPlayer.nSeasonPoints, bPointCalculated: true } }
            }
          })
        }
        await MatchPlayerModel.bulkWrite(aBulkMatchPlayer, { writeConcern: { w: 'majority' }, ordered: false })
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cseasonPoint) })
    } catch (error) {
      catchError('MatchPlayer.calculateSeasonPointV2', error, req, res)
    }
  }

  async matchPlayerInfo(req, res) {
    try {
      const matchPlayer = await MatchPlayerModel.findById(req.params.id, { sImage: 1, nSetBy: 1, nCaptainBy: 1, nViceCaptainBy: 1, bShow: 1, bSubstitute: 1, nScoredPoints: 1, eRole: 1, sName: 1, nFantasyCredit: 1 }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].matchPlayer), data: matchPlayer })
    } catch (error) {
      catchError('MatchPlayer.matchPlayerInfo', error, req, res)
    }
  }

  // To get MatchPlayer list of single match
  async matchPlayerListUserV2(req, res) {
    try {
      const match = await MatchModel.findById(req.params.id, { aPlayerRole: 1, bLineupsOut: 1 }).lean()
      if (!match) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })

      const data = await MatchPlayerModel.find({ iMatchId: req.params.id }, { aPointBreakup: 0 }).populate('iTeamId', ['sShortName', 'sName', 'sKey', 'sImage']).lean()
      if (!data.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].matchPlayer) })

      const teamExist = data.every((p) => p.iTeamId && p.iTeamId._id)
      if (!teamExist) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cteam) })

      const matchPlayerData = data.map(p => {
        p.nScoredPoints = Number(parseFloat(p.nScoredPoints).toFixed(2))
        p.bShow = match?.bLineupsOut ? p.bShow : false
        const player = { ...p, oTeam: { ...p.iTeamId, iTeamId: p.iTeamId._id } }
        delete player.iTeamId
        delete player.oTeam._id
        return player
      })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].matchPlayer), data: { matchPlayer: matchPlayerData, aPlayerRole: match.aPlayerRole } })
    } catch (error) {
      catchError('MatchPlayer.matchPlayerListUserV2', error, req, res)
    }
  }

  // To get MatchPlayer points season wise
  async matchPlayerSeasonPointV2(req, res) {
    try {
      const matchPlayer = await MatchPlayerModel.findById(req.params.id, { sName: 1, bShow: 1, bSubstitute: 1, iPlayerId: 1, nSetBy: 1, nCaptainBy: 1, nViceCaptainBy: 1, nFantasyCredit: 1, sImage: 1, eRole: 1, nSeasonPoints: 1 }).lean().populate('iMatchId')
      if (!matchPlayer) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })

      const seasonMatches = await MatchModel.find({ sSeasonKey: matchPlayer.iMatchId.sSeasonKey, eCategory: matchPlayer.iMatchId.eCategory, eFormat: matchPlayer.iMatchId.eFormat, eStatus: 'CMP' }, { _id: 1 }).lean()
      const aMatchIds = seasonMatches.map(m => ObjectId(m._id))

      const data = await MatchPlayerModel.find({ iMatchId: { $in: aMatchIds }, iPlayerId: matchPlayer.iPlayerId }, { sName: 1, bShow: 1, bSubstitute: 1, nSetBy: 1, nCaptainBy: 1, nViceCaptainBy: 1, nFantasyCredit: 1, nScoredPoints: 1, nSeasonPoints: 1 }).lean().populate('iMatchId', ['sName', 'eFormat', 'dStartDate'])

      const matchData = data.map(p => {
        const match = { ...p, oMatch: { ...p.iMatchId, iMatchId: p.iMatchId._id } }
        delete match.iMatchId
        delete match.oMatch._id
        return match
      })
      matchPlayer.iMatchId = undefined
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].matchPlayer), data: { player: matchPlayer, match: matchData } })
    } catch (error) {
      catchError('MatchPlayer.matchPlayerSeasonPointV2', error, req, res)
    }
  }

  // To get single matchPlayer's scorepoints
  async matchPlayerScorePointUser(req, res) {
    try {
      const data = await MatchPlayerModel.findById(req.params.id, { nScoredPoints: 1, aPointBreakup: 1 }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cscorePoints) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cscorePoints), data })
    } catch (error) {
      catchError('MatchPlayer.matchPlayerScorePointUser', error, req, res)
    }
  }

  async updateCombinationBotPlayers(req, res) {
    try {
      let { players, aMatchLeagueId, selSize, bCMBSub = false } = req.body

      const match = await MatchModel.findById(req.params.iMatchId, { eStatus: 1, bLineupsOut: 1, eCategory: 1 }).lean()
      if (!match) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })
      if (match && match.eStatus !== 'U') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_upcoming })
      // if (!match.bLineupsOut) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].no_lineups })

      // const sportRules = await sportServices.findSport(match.eCategory)
      // if (sportRules && sportRules.oRule && sportRules.oRule.nTotalPlayers && (2 * sportRules.oRule.nTotalPlayers) !== players.length) {
      //   return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].fixed_size_err.replace('##', messages[req.userLanguage].cplayers).replace('#', 2 * sportRules.oRule.nTotalPlayers) })
      // }

      let aMatchleaguesCMB = []
      if (aMatchLeagueId && aMatchLeagueId.length) {
        aMatchLeagueId = aMatchLeagueId.map(id => ObjectId(id))
        const nTotalMatchLeague = await MatchLeagueModel.countDocuments({ _id: { $in: aMatchLeagueId } })
        if (nTotalMatchLeague !== aMatchLeagueId.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].someMatchContest) })

        const cmbPlayersForLeagues = await CombinationPlayersModel.find({ iMatchLeagueId: { $in: aMatchLeagueId } }, { bBotCreated: 1, oRules: 1, aMatchPlayers: 1, dTeamEditedAt: 1, eTeamEdited: 1, iMatchLeagueId: 1 }).lean()
        aMatchleaguesCMB = cmbPlayersForLeagues.filter(l => l.bBotCreated === true)
      }
      const cmbPlayers = await CombinationPlayersModel.findOne({ iMatchId: match._id, bCMBSub }, { bBotCreated: 1, oRules: 1, aMatchPlayers: 1, dTeamEditedAt: 1, eTeamEdited: 1, bCMBSub: 1 }).lean()
      if (!cmbPlayers || !cmbPlayers.bBotCreated) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].bot) })

      if (aMatchleaguesCMB && aMatchleaguesCMB.length) {
        aMatchLeagueId.map(l => {
          queuePush('CombinationBotUpdate', { iMatchId: match._id, aPlayers: players, iMatchLeagueId: l, oCombinationPlayers: cmbPlayers, selSize, bCMBSub })
        })
      } else {
        await queuePush('CombinationBotUpdate', { iMatchId: match._id, aPlayers: players, oCombinationPlayers: cmbPlayers, selSize, bCMBSub })
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].combination_update })
    } catch (error) {
      catchError('MatchPlayer.updateCombinationBotPlayers', error, req, res)
    }
  }

  async getCombinationBotPlayers(req, res) {
    try {
      const query = { iMatchId: ObjectId(req.params.iMatchId) }
      if (req.query && req.query.iMatchLeagueId) query.iMatchLeagueId = ObjectId(req.query.iMatchLeagueId)

      const cmbPlayers = await CombinationPlayersModel.findOne(query,
        { iMatchLeagueId: 1, bLineUpsUpdated: 1, bBotCreated: 1, eTeamEdited: 1, aError: 1, aSuccess: 1, oRules: 1, nTotalTeamEdited: 1, nTotalTeam: 1, _id: 0 }).populate([{ path: 'oMatchLeague', select: 'sName' }]).lean()
      if (!cmbPlayers) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].combination_bot) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].combination_bot), data: cmbPlayers })
    } catch (error) {
      catchError('MatchPlayer.getCombinationBotPlayers', error, req, res)
    }
  }

  async createSortPlayers(req, res) {
    try {
      const oPlayers = req.body.players

      const match = await MatchModel.findById(req.params.iMatchId, { eStatus: 1, bLineupsOut: 1, eCategory: 1 }).lean()
      if (!match) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })
      if (match && match.eStatus !== 'U') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_upcoming })
      console.log('Match id. ', match._id)
      const getMatchPlayers = await MatchPlayerModel.find({ iMatchId: req.params.iMatchId })
      if (!getMatchPlayers || !getMatchPlayers.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: 'Match Players Not Found.' })
      console.log('Total match players. ', getMatchPlayers.length)
      let playerMissing = false
      console.log('Check for missing or mismatch players. ', Object.keys(oPlayers).length)
      for (const index in Object.keys(oPlayers)) {
        const playerData = getMatchPlayers.find(eachPlayer => eachPlayer._id.toString() === oPlayers[Number(index) + 1])

        if (!playerData) {
          playerMissing = true
          break
        }
      }
      if ((Object.keys(oPlayers).length < getMatchPlayers.length) || playerMissing) return res.status(status.NotAcceptable).jsonp({ status: jsonStatus.NotAcceptable, message: 'Player Missing or mismatch Please select correct players.' })
      console.log('Check pass for players. ', Object.keys(oPlayers).length)
      const sortedPlayers = await StatsPlayerSortModel.findOneAndUpdate({ iMatchId: req.params.iMatchId }, { $set: { players: oPlayers } }, { new: true, upsert: true, returnNewDocument: true })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: 'Players sort saved SuccessFully.', data: sortedPlayers })
    } catch (error) {
      catchError('createSortPlayers.sortingPlayers', error, req, res)
    }
  }
}

/**
 * It'll process particular cricket match player details from third part apis and according to our schema and store into our system.
 * @param {req} req request object
 * @param {res} match response object
 * @param {object} formatPlayers match players details
 * @param {eCategory} eCategory Sport Category
 * @param {eProvider} eProvider Sport api provider
 * @returns It'll process particular cricket match player details from third part apis and according to our schema and store into our system.
 */
async function storeMatchPlayer(req, res, formatPlayers, eCategory, eProvider) {
  const playerKeys = formatPlayers.map(({ sKey }) => sKey)

  const players = await PlayerModel.find({ sKey: { $in: playerKeys }, eCategory: eCategory }).lean()
  const existPlayers = players.map((player) => player.sKey)

  const newPlayers = []
  for (const formatPlayer of formatPlayers) {
    if (!existPlayers.includes(formatPlayer.sKey.toString())) {
      if (!newPlayers.some(({ sKey }) => sKey.toString() === formatPlayer.sKey.toString())) {
        let s3Res
        if (formatPlayer.sLogoUrl) s3Res = await s3.getS3ImageURL(formatPlayer.sLogoUrl, config.S3_BUCKET_PLAYER_THUMB_URL_PATH)
        formatPlayer.sImage = s3Res ? s3Res.sPath : ''
        newPlayers.push({
          sKey: formatPlayer.sKey,
          sName: formatPlayer.sName,
          sLogoUrl: formatPlayer.sLogoUrl || '',
          sImage: formatPlayer.sImage,
          eCategory: eCategory,
          eRole: formatPlayer.eRole,
          sTeamKey: formatPlayer.iTeamId,
          eProvider
        })
      }
    }
  }

  await playerServices.add(req, res, newPlayers)
  const newMatchPlayers = []

  for (const formatPlayer of formatPlayers) {
    const { sKey, iMatchId, iTeamId, sTeamName } = formatPlayer
    const playerInfo = await PlayerModel.findOne({ sKey: sKey, eCategory: eCategory }).lean()
    const existPlayer = await MatchPlayerModel.findOne({ iMatchId: iMatchId, iTeamId: iTeamId, iPlayerId: playerInfo._id }).lean()
    const teamKey = await MatchModel.findOne({ _id: iMatchId, eCategory }, { 'oHomeTeam.sKey': 1, 'oAwayTeam.sKey': 1 }).lean()
    const { oHomeTeam, oAwayTeam } = teamKey
    const sTeamKey = await TeamModel.findOne({ sName: sTeamName, sKey: { $in: [oHomeTeam.sKey, oAwayTeam.sKey] }, eCategory }).lean()
    if (!existPlayer && sTeamKey) {
      newMatchPlayers.push({
        ...formatPlayer,
        sKey: playerInfo.sKey,
        sTeamKey: sTeamKey.sKey,
        iPlayerId: playerInfo._id,
        sImage: playerInfo.sImage
      })
    }
  }
  await MatchPlayerModel.insertMany(newMatchPlayers)
}

/**
 * It'll dump particular cricket match player details from Entity sports api to our system.
 * @param {object} match details
 * @param {*} userLanguage English or Hindi(In future)
 * @returns It'll dump particular cricket match player details from Entity sports api to our system.
 */
async function fetchCricketPlayerFromEntitySport(match, userLanguage = 'English') {
  const { sSeasonKey, oHomeTeam, oAwayTeam, _id, eCategory, eFormat, sKey } = match

  let response
  const formatPlayers = []

  let setFormat = ''
  if (eFormat === 'ODI') {
    setFormat = 'ODI'
  } else if (eFormat === 'T20') {
    setFormat = 'T20'
  } else if (eFormat === 'T10') {
    setFormat = 'T10'
  } else if (eFormat === 'TEST') {
    setFormat = 'TEST'
  } else if (eFormat === 'FIRSTCLASS') {
    setFormat = 'FIRSTCLASS'
  }

  const aPointBreakup = await ScorePointModel.find({ eCategory, eFormat: setFormat }, { sKey: 1, sName: 1, nPoint: 1 }).lean()

  try {
    response = await axios.get(`https://rest.entitysport.com/v2/competitions/${sSeasonKey}/squads/${sKey}`,
      {
        params: {
          token: config.ENTITYSPORT_CRICKET_API_KEY
        }
      })
  } catch (error) {
    const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data?.response?.data, sUrl: `https://rest.entitysport.com/v2/competitions/${sSeasonKey}/squads/${sKey}` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data?.response?.data, sUrl: `https://rest.entitysport.com/v2/competitions/${sSeasonKey}/squads/${sKey}` })

    return {
      isSuccess: false,
      status: status.OK,
      message: messages[userLanguage].no_matchplayer,
      data: {}
    }
  }
  const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data.response, sUrl: `https://rest.entitysport.com/v2/competitions/${sSeasonKey}/squads/${sKey}` }
  apiLogQueue.publish(logData)
  // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data.response, sUrl: `https://rest.entitysport.com/v2/competitions/${sSeasonKey}/squads/${sKey}` })

  const squadResult = response.data.response.squads || []

  for (const squadRes of squadResult) {
    const squad = squadRes
    const playersData = squad.players
    let iTeamId
    let sTeamName

    if (oHomeTeam.sKey === squad.team_id) {
      iTeamId = oHomeTeam.iTeamId
      sTeamName = oHomeTeam.sName
    } else if (oAwayTeam.sKey === squad.team_id) {
      iTeamId = oAwayTeam.iTeamId
      sTeamName = oAwayTeam.sName
    }

    const playerData = playersData.map((player) => {
      const { pid, title, playing_role: role, fantasy_player_rating: nFantasyCredit, logo_url: sLogoUrl } = player
      let eRole
      switch (role) {
        case 'bat':
          eRole = 'BATS'
          break

        case 'bowl':
          eRole = 'BWL'
          break

        case 'all':
          eRole = 'ALLR'
          break

        case 'wk':
          eRole = 'WK'
          break

        case 'wkbat':
          eRole = 'WK'
          break

        default:
          eRole = 'BATS'
      }

      return {
        iMatchId: _id,
        iTeamId: iTeamId,
        sName: title,
        sLogoUrl,
        sTeamName: sTeamName,
        eRole: eRole,
        sKey: pid,
        nFantasyCredit: nFantasyCredit || undefined,
        aPointBreakup
      }
    })
    formatPlayers.push(...playerData)
  }

  return {
    isSuccess: true,
    status: status.OK,
    message: null,
    data: formatPlayers
  }
}

/**
 * It'll dump particular soccer match player details from Entity sports api to our system.
 * @param {object} match details
 * @param {*} userLanguage English or Hindi(In future)
 * @returns It'll dump particular soccer match player details from Entity sports api to our system.
 */
async function fetchSoccerPlayerFromEntitySport(match, userLanguage = 'English') {
  const { oHomeTeam, oAwayTeam, _id, eCategory, eFormat, sKey } = match
  let response
  try {
    // response = await axios.get(`https://soccer.entitysport.com/matches/${sKey}/fantasy`, { params: { token: config.ENTITYSPORT_SOCCER_API_KEY } })
    response = await axios.get(`https://soccer.entitysport.com/matches/${sKey}/newfantasy`, { params: { token: config.ENTITYSPORT_SOCCER_API_KEY, fantasy: 'new2point' } })
  } catch (error) {
    const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://soccer.entitysport.com/matches/${sKey}/fantasy` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://soccer.entitysport.com/matches/${sKey}/fantasy` })
    return {
      isSuccess: false,
      status: status.OK,
      message: messages[userLanguage].no_matchplayer,
      data: {}
    }
  }
  const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data.response.items, sUrl: `https://soccer.entitysport.com/matches/${sKey}/newfantasy` }
  apiLogQueue.publish(logData)
  // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data.response.items, sUrl: `https://soccer.entitysport.com/matches/${sKey}/newfantasy` })

  const homeTeamPlayers = response.data.response.items.teams.home || []
  const awayTeamPlayers = response.data.response.items.teams.away || []

  if (homeTeamPlayers.length < 1 || awayTeamPlayers.length < 1) {
    return {
      isSuccess: false,
      status: status.OK,
      message: messages[userLanguage].no_matchplayer,
      data: {}
    }
  }
  const aPointBreakup = await ScorePointModel.find({ eCategory, eFormat }, { sKey: 1, sName: 1, nPoint: 1 }).lean()

  const formatPlayers = homeTeamPlayers.map((player) => {
    // const { pid: id, name: sName, positionname: type, fantasy_player_rating: nFantasyCredit } = player
    const { pid: id, pname: sName, role: type, rating: nFantasyCredit } = player
    let eRole
    switch (type) {
      case 'Goalkeeper':
        eRole = 'GK'
        break

      case 'Defender':
        eRole = 'DEF'
        break
      case 'Midfielder':
        eRole = 'MID'
        break
      case 'Forward':
        eRole = 'FWD'
        break

      default:
        eRole = 'MID'
    }

    return {
      iMatchId: _id,
      iTeamId: oHomeTeam.iTeamId,
      sName,
      sTeamName: oHomeTeam.sName,
      eRole: eRole,
      sKey: id,
      nFantasyCredit: nFantasyCredit || undefined,
      aPointBreakup
    }
  })
  awayTeamPlayers.map((player) => {
    // const { pid: id, name: sName, positionname: type, fantasy_player_rating: nFantasyCredit = 9 } = player
    const { pid: id, pname: sName, role: type, rating: nFantasyCredit } = player
    let eRole
    switch (type) {
      case 'Goalkeeper':
        eRole = 'GK'
        break

      case 'Defender':
        eRole = 'DEF'
        break
      case 'Midfielder':
        eRole = 'MID'
        break
      case 'Forward':
        eRole = 'FWD'
        break

      default:
        eRole = 'MID'
    }
    formatPlayers.push({
      iMatchId: _id,
      iTeamId: oAwayTeam.iTeamId,
      sName,
      sTeamName: oAwayTeam.sName,
      eRole: eRole,
      sKey: id,
      nFantasyCredit,
      aPointBreakup
    })
  })

  return {
    isSuccess: true,
    status: status.OK,
    message: null,
    data: formatPlayers
  }
}

/**
 * It'll dump particular kabaddi match player details from Entity sports api to our system.
 * @param  {object} match details
 * @param  {*} userLanguage='English' or 'Hindi
 * @returns It'll return particular kabaddi match players
 */
async function fetchKabaddiPlayerFromEntitySport(match, userLanguage = 'English') {
  const { oHomeTeam, oAwayTeam, _id, eCategory, eFormat } = match
  let homeTeamResponse
  let awayTeamResponse
  let bHomeTeamError = false

  try {
    homeTeamResponse = await axios.get(`https://rest.entitysport.com/kabaddi/team/${oHomeTeam.sKey}/info`, { params: { token: config.ENTITYSPORT_KABADDI_API_KEY } })
    bHomeTeamError = true
    awayTeamResponse = await axios.get(`https://rest.entitysport.com/kabaddi/team/${oAwayTeam.sKey}/info`, { params: { token: config.ENTITYSPORT_KABADDI_API_KEY } })
  } catch (error) {
    const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://kabaddi.entitysport.com/matches/${sKey}/info` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://kabaddi.entitysport.com/matches/${sKey}/info` })
    return {
      isSuccess: false,
      status: status.OK,
      message: messages[userLanguage].no_matchplayer,
      data: {}
    }
  }
  const arrayOfLogData = [
    { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data.response.items, sUrl: `https://kabaddi.entitysport.com/matches/${sKey}/info` }
  ]
  arrayOfLogData.forEach((logData) => apiLogQueue.publish(logData))
  // await ApiLogModel.create(aLog)

  const [homeTeamData] = homeTeamResponse.data.response.items
  const [awayTeamData] = awayTeamResponse.data.response.items

  const homeTeamPlayers = homeTeamData.squads || []
  const awayTeamPlayers = awayTeamData.squads || []

  if (homeTeamPlayers.length < 1 || awayTeamPlayers.length < 1) {
    return {
      isSuccess: false,
      status: status.OK,
      message: messages[userLanguage].no_matchplayer,
      data: {}
    }
  }
  const aPointBreakup = await ScorePointModel.find({ eCategory, eFormat }, { sKey: 1, sName: 1, nPoint: 1 }).lean()

  const formatPlayers = homeTeamPlayers.map((player) => {
    const { pid: id, fullname: sName, positionname: type } = player
    let eRole
    switch (type) {
      case 'raider':
        eRole = 'RAID'
        break

      case 'defender':
        eRole = 'DEF'
        break

      case 'allrounder':
        eRole = 'ALLR'
        break

      default:
        eRole = 'DEF'
    }

    return {
      iMatchId: _id,
      iTeamId: oHomeTeam.iTeamId,
      sName,
      sTeamName: oHomeTeam.sName,
      eRole: eRole,
      sKey: id,
      aPointBreakup
    }
  })

  awayTeamPlayers.map((player) => {
    const { pid: id, fullname: sName, positionname: type } = player
    let eRole
    switch (type) {
      case 'raider':
        eRole = 'RAID'
        break

      case 'defender':
        eRole = 'DEF'
        break

      case 'allrounder':
        eRole = 'ALLR'
        break

      default:
        eRole = 'DEF'
    }

    formatPlayers.push({
      iMatchId: _id,
      iTeamId: oAwayTeam.iTeamId,
      sName,
      sTeamName: oAwayTeam.sName,
      eRole: eRole,
      sKey: id,
      aPointBreakup
    })
  })

  return {
    isSuccess: true,
    status: status.OK,
    message: null,
    data: formatPlayers
  }
}

/**
 * It'll dump particular kabaddi match player details from Entity sports api to our system.
 * @param  {object} match details
 * @param  {*} userLanguage='English' or 'Hindi
 * @returns It'll return particular kabaddi match players
 */
async function fetchBasketballPlayerFromEntitySport(match, userLanguage = 'English') {
  const { oHomeTeam, oAwayTeam, _id, eCategory, eFormat } = match
  let homeTeamResponse, awayTeamResponse
  let bHomeTeamError = false
  try {
    homeTeamResponse = await axios.get(`https://basketball.entitysport.com/team/${oHomeTeam.sKey}/info`, { params: { token: config.ENTITYSPORT_BASKETBALL_API_KEY } })
    bHomeTeamError = true
    awayTeamResponse = await axios.get(`https://basketball.entitysport.com/team/${oAwayTeam.sKey}/info`, { params: { token: config.ENTITYSPORT_BASKETBALL_API_KEY } })
  } catch (error) {
    const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: !bHomeTeamError ? `https://basketball.entitysport.com/team/${oHomeTeam.sKey}/info` : `https://basketball.entitysport.com/team/${oAwayTeam.sKey}/info` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: !bHomeTeamError ? `https://basketball.entitysport.com/team/${oHomeTeam.sKey}/info` : `https://basketball.entitysport.com/team/${oAwayTeam.sKey}/info` })
    return {
      isSuccess: false,
      status: status.OK,
      message: messages[userLanguage].no_matchplayer,
      data: {}
    }
  }
  const arrayOfLogData = [
    { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: homeTeamResponse.data.response.items, sUrl: `https://basketball.entitysport.com/team/${oHomeTeam.sKey}/info` },
    { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: awayTeamResponse.data.response.items, sUrl: `https://basketball.entitysport.com/team/${oAwayTeam.sKey}/info` }
  ]
  arrayOfLogData.forEach((logData) => apiLogQueue.publish(logData))
  // await ApiLogModel.create(aLog)

  const [homeTeamData] = homeTeamResponse.data.response.items
  const [awayTeamData] = awayTeamResponse.data.response.items

  const homeTeamPlayers = homeTeamData.squads || []
  const awayTeamPlayers = awayTeamData.squads || []

  if (homeTeamPlayers.length < 1 || awayTeamPlayers.length < 1) {
    return {
      isSuccess: false,
      status: status.OK,
      message: messages[userLanguage].no_matchplayer,
      data: {}
    }
  }

  const aPointBreakup = await ScorePointModel.find({ eCategory, eFormat }, { sKey: 1, sName: 1, nPoint: 1 }).lean()

  const formatPlayers = homeTeamPlayers.map((player) => {
    const { pid: id, fullname: sName, primaryposition: eRole, fantasyplayerrating: nFantasyCredit } = player
    return {
      iMatchId: _id,
      iTeamId: oHomeTeam.iTeamId,
      sName,
      sTeamName: oHomeTeam.sName,
      eRole,
      nFantasyCredit: nFantasyCredit || undefined,
      sKey: id,
      aPointBreakup
    }
  })

  awayTeamPlayers.map((player) => {
    const { pid: id, fullname: sName, primaryposition: eRole, fantasyplayerrating: nFantasyCredit } = player
    formatPlayers.push({
      iMatchId: _id,
      iTeamId: oAwayTeam.iTeamId,
      sName,
      sTeamName: oAwayTeam.sName,
      eRole,
      nFantasyCredit: nFantasyCredit || undefined,
      sKey: id,
      aPointBreakup
    })
  })

  return {
    isSuccess: true,
    status: status.OK,
    message: null,
    data: formatPlayers
  }
}

// eslint-disable-next-line no-unused-vars
function getRoleWiseMatchPlayers(aPlayers, oRules) {
  let aMatchPlayers = []
  try {
    const { aPlayerRole, nTotalPlayers } = oRules
    const oPlayerRoles = {}

    aPlayerRole.forEach(({ nMin, nMax, sName }) => {
      oPlayerRoles[sName] = { nMin, nMax }
    })

    const teamPlayers = {}
    const aUnselectedPlayers = []
    aPlayers.forEach((player) => {
      if (teamPlayers[player.sTeamName]) {
        if (teamPlayers[player.sTeamName].players.length < nTotalPlayers) {
          const nRoleCount = teamPlayers[player.sTeamName][player.eRole] || 0
          if (nRoleCount < oPlayerRoles[player.eRole].nMin) {
            const pObj = { players: [...teamPlayers[player.sTeamName].players, player] }
            pObj[player.eRole] = teamPlayers[player.sTeamName][player.eRole] ? teamPlayers[player.sTeamName][player.eRole] += 1 : 1
            teamPlayers[player.sTeamName] = { ...teamPlayers[player.sTeamName], ...pObj }
          } else {
            aUnselectedPlayers.push(player)
          }
        }
      } else {
        const pObj = { players: [player] }
        pObj[player.eRole] = 1
        teamPlayers[player.sTeamName] = pObj
      }
    })

    aUnselectedPlayers.forEach((player) => {
      if (teamPlayers[player.sTeamName]) {
        if (teamPlayers[player.sTeamName].players.length < nTotalPlayers) {
          const nRoleCount = teamPlayers[player.sTeamName][player.eRole] || 0
          if (nRoleCount < oPlayerRoles[player.eRole].nMax) {
            const pObj = { players: [...teamPlayers[player.sTeamName].players, player] }
            pObj[player.eRole] = teamPlayers[player.sTeamName][player.eRole] ? teamPlayers[player.sTeamName][player.eRole] += 1 : 1
            teamPlayers[player.sTeamName] = { ...teamPlayers[player.sTeamName], ...pObj }
          }
        }
      }
    })

    Object.keys(teamPlayers).forEach((sTeamName) => {
      aMatchPlayers = aMatchPlayers.concat(teamPlayers[sTeamName].players)
    })

    return aMatchPlayers
  } catch (error) {
    return aMatchPlayers
  }
}

module.exports = new MatchPlayer()
