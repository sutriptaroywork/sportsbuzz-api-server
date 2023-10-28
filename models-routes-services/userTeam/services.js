const UserTeamModel = require('./model')
const UserModel = require('../user/model')
const MatchModel = require('../match/model')
const PlayerRoleModel = require('../playerRoles/model')
const UserLeagueModel = require('../userLeague/model')
const MyMatchesModel = require('../myMatches/model')
const MatchTeamsModel = require('../matchTeams/model')
const MatchLeagueModel = require('../matchLeague/model')
const StatisticsModel = require('../user/statistics/model')
const sportServices = require('../sports/services')
const matchPlayerServices = require('../matchPlayer/services')
const crypto = require('crypto')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, getPaginationValues2, handleCatchError, getStatisticsSportsKey, getMatchLeagueStatus } = require('../../helper/utilities.services')
const { CACHE_2, CACHE_1, bAllowDiskUse, SUPERUSER_ID } = require('../../config/config')
const { queuePush, queuePop } = require('../../helper/redis')
const userBalanceServices = require('../userBalance/services')
const { processAuthLogs, matchLive, pushPlayReturnNotify, autoCreateLeague, referCodeBonusNotify, registerBonusNotify, registerReferNotifify, sendSms, sendMails, notificationScheduler, processUserCashbackReturnV2, processMatchLeague, checkRedisJoinedCount } = require('../../queue')
const matchServices = require('../match/services')
const { GamesDBConnect } = require('../../database/mongoose')
const { ADMIN_TYPE } = require('../../enums/adminEnums/adminTypesEnum')
const PrizeDistributionLogModel = require('../apiLog/PrizeDistributionLog.model')
const { redisClient } = require('../../helper/redis')
const matchLeagueServices = require('../matchLeague/services')
const BotLogModel = require('../botLogs/model')
const CopyTeamLogModel = require('../userLeague/CopyTeamLogModel')
const { CopyTeamUpdate } = require('../userLeague/common')
const matchTeamsQueue = require('../../rabbitmq/queue/matchTeams')
const matchLeagueQueue = require('../../rabbitmq/queue/matchLeague')
const matchLeagueRankQueue = require('../../rabbitmq/queue/matchLeagueRank')
const matchLeagueWinQueue = require('../../rabbitmq/queue/matchLeagueWin')
class UserTeam {
  async prizeDistribution(req, res) {
    try {
      const LeagueData = await MatchLeagueModel.find({
        iMatchId: ObjectId(req.params.id),
        bCancelled: false
      }, { _id: 1 }).lean()

      await checkCancellableContest(ObjectId(req.params.id))

      const leagueId = LeagueData.map(({ _id }) => _id)

      const [nJoinedUsers, nRankCalculated] = await Promise.all([
        UserLeagueModel.countDocuments({
          iMatchId: ObjectId(req.params.id),
          iMatchLeagueId: { $in: leagueId },
          bCancelled: false
        }, { readPreference: 'primary' }),
        UserLeagueModel.countDocuments({ iMatchId: ObjectId(req.params.id), iMatchLeagueId: { $in: leagueId }, bCancelled: false, bRankCalculated: true })
      ])

      if (nJoinedUsers !== nRankCalculated) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].rank_calculate_error })

      const matchLeague = await MatchLeagueModel.find({ iMatchId: req.params.id, bCancelled: false, bPrizeDone: false, bWinningDone: false }, { aLeaguePrize: 1, iMatchId: 1, _id: 1, nJoined: 1, nMax: 1, bPoolPrize: 1, nPrice: 1, nDeductPercent: 1, bPrivateLeague: 1, nTotalPayout: 1, nWinnersCount: 1, nAdminCommission: 1, nCreatorCommission: 1 }).lean()
      // matchLeague.map((league) => queuePush('MatchLeagueRank', league))
      pushMatchLeagueRankQueue(matchLeague)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].cBackgroundProcess.replace('##', messages[req.userLanguage].cprizeDistribution) })
    } catch (error) {
      catchError('UserTeam.prizeDistribution', error, req, res)
    }
  }

  // Generate team rank in matchleague
  async generateUserTeamRank(req, res) {
    try {
      const LeagueData = await MatchLeagueModel.find({
        iMatchId: ObjectId(req.params.id),
        bCancelled: false
      }, { _id: 1 }).lean()

      const leagueId = LeagueData.map(({ _id }) => _id)

      const [nJoinedUsers, nPointCalculated] = await Promise.all([
        UserLeagueModel.countDocuments({
          iMatchId: ObjectId(req.params.id),
          iMatchLeagueId: { $in: leagueId },
          bCancelled: false
        }, { readPreference: 'primary' }),
        UserLeagueModel.countDocuments({ iMatchId: ObjectId(req.params.id), iMatchLeagueId: { $in: leagueId }, bCancelled: false, bPointCalculated: true })
      ])
      if (nJoinedUsers !== nPointCalculated) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].point_calculate_error })

      const matchLeague = await MatchLeagueModel.find({ iMatchId: req.params.id, bCancelled: false, bPrizeDone: false }, { iMatchId: 1 }).lean()
      // matchLeague.map(league => queuePush('MatchLeague', { ...league, bRankCalculateFlag: true }))
      pushMatchLeagueQueue(matchLeague.map(league => ({ ...league, bRankCalculateFlag: true })))

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].cBackgroundProcess.replace('##', messages[req.userLanguage].cteamRankCalculate) })
    } catch (error) {
      catchError('UserTeam.generateUserTeamRank', error, req, res)
    }
  }

  // Generate team score for match
  async generateUserTeamScore(req, res) {
    try {
      console.time(`generateUserTeamScore-${req.params.id}`)
      const match = await MatchModel.findOne({ _id: req.params.id, dStartDate: { $lte: new Date() }, eStatus: { $in: ['CMP', 'I'] } }, { eCategory: 1 }).lean()
      if (!match) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_complete })

      const points = await PlayerRoleModel.findOne({ eCategory: match.eCategory }, { nCaptainPoint: 1, nViceCaptainPoint: 1 }).lean()
      if (!points) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].error_with.replace('##', messages[req.userLanguage].cpoints) })
      await checkCancellableContest(match._id)
      let skip = 0
      const limit = 20000
      let data = await MatchTeamsModel.aggregate([
        { $match: { iMatchId: ObjectId(req.params.id) } },
        { $group: { _id: '$sHash' } },
        { $skip: skip },
        { $limit: limit }
      ])
      while (data.length > 0) {
        // console.log(data)
        pushMatchTeamsQueue(data, match.eCategory, req.params.id)
        skip = skip + limit
        // data = await MatchTeamsModel.find({ iMatchId: req.params.id }, { iMatchId: 1, sHash: 1, eCategory: 1 }).skip(skip).limit(limit).lean()
        data = await MatchTeamsModel.aggregate([
          { $match: { iMatchId: ObjectId(req.params.id) } },
          { $group: { _id: '$sHash' } },
          { $skip: skip },
          { $limit: limit }
        ])
        // const data = await MatchTeamsModel.aggregate([
        //   { $match: { iMatchId: ObjectId(req.params.id) } },
        //   { $group: { _id: { sHash: '$sHash', iMatchId: '$iMatchId', eCategory: '$eCategory' } } },
        //   { $project: { sHash: '$_id.sHash', iMatchId: '$_id.iMatchId', eCategory: '$_id.eCategory', _id: 0 } }
        // ]).allowDiskUse(bAllowDiskUse)
        // console.log('MatchTeams Data ::', data.length)
        // await bulkQueuePush('MatchTeams', data, 5000)
      }
      console.timeEnd(`generateUserTeamScore-${req.params.id}`)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].cBackgroundProcess.replace('##', messages[req.userLanguage].cteamScoreCalculate) })
    } catch (error) {
      catchError('UserTeam.generateUserTeamScore', error, req, res)
    }
  }

  // Distribute win amount for contest
  async winDistributionByLeague(req, res) {
    try {
      const [nTotalLeague, nPrizeCalculated] = await Promise.all([
        MatchLeagueModel.countDocuments({ iMatchId: ObjectId(req.params.id), bCancelled: false }),
        MatchLeagueModel.countDocuments({ iMatchId: ObjectId(req.params.id), bPrizeDone: true })
      ])

      if (nTotalLeague !== nPrizeCalculated) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].prize_calculate_error })

      const matchLeague = await MatchLeagueModel.find({ iMatchId: req.params.id, bCancelled: false, bPrizeDone: true, bWinningDone: false }, { aLeaguePrize: 1, iMatchId: 1, eCategory: 1, _id: 1, bPrivateLeague: 1, nCreatorCommission: 1, iUserId: 1, sName: 1, nLoyaltyPoint: 1, nDistributedPayout: 1 }).lean()
      if (!matchLeague.length) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].win_dist_exist })
      }

      // matchLeague.forEach(league => queuePush('MatchLeagueWin', league))
      pushMatchLeagueWinQueue(matchLeague)

      await MatchModel.updateOne({ _id: ObjectId(req.params.id) }, { dWinDistAt: new Date() })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].cBackgroundProcess.replace('##', messages[req.userLanguage].winPrizeDistribution) })
    } catch (error) {
      catchError('UserTeam.winDistributionByLeague', error, req, res)
    }
  }

  // To get List of UserTeams (MatchLeague wise) with pagination, sorting and searching
  async list(req, res) {
    try {
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      let query = search ? { sUserName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}
      query = { ...query, iMatchLeagueId: ObjectId(req.params.id) }
      const results = await UserLeagueModel.find(query, {
        iUserTeamId: 1,
        sUserName: 1,
        sTeamName: 1,
        sMatchName: 1,
        dCreatedAt: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()
      const total = await UserLeagueModel.countDocuments({ ...query })

      const data = [{ total, results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].userTeam), data: data })
    } catch (error) {
      return catchError('UserTeam.list', error, req, res)
    }
  }

  // To get match wise user teams
  async matchWiseUserTeamList(req, res) {
    try {
      const { iMatchId, iUserId } = req.body

      const data = await UserTeamModel.find({ iMatchId: ObjectId(iMatchId), iUserId: ObjectId(iUserId) }).populate('iMatchId', 'sName').populate('iUserId', ['sName', 'sUsername', 'eType'])

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].userTeam), data: data })
    } catch (error) {
      return catchError('matchWiseUserTeamList.list', error, req, res)
    }
  }

  // To get super user's team list

  async baseTeamList(req, res) {
    try {
      const { nSkip, nLimit } = req.query
      const { id: iMatchId } = req.params

      const [aUserTeams, nTotal, oMatch, oUser] = await Promise.all([
        UserTeamModel.find({ iMatchId: ObjectId(iMatchId), iUserId: ObjectId(SUPERUSER_ID) }).skip(Number(nSkip)).limit(Number(nLimit)).lean(),
        UserTeamModel.countDocuments({ iMatchId: ObjectId(iMatchId), iUserId: ObjectId(SUPERUSER_ID) }),
        MatchModel.findOne({ _id: iMatchId }, { sName: 1 }),
        UserModel.findOne({ _id: SUPERUSER_ID }, { sUsername: 1 })
      ])
      const aHashes = aUserTeams.map(data => data.sHash)

      const aTeamData = await MatchTeamsModel.find({ iMatchId: ObjectId(iMatchId), sHash: { $in: aHashes } }, { aPlayers: 1, sHash: 1, _id: 0 }).populate([{ path: 'aPlayers.oMatchPlayer', select: ['sName', 'nFantasyCredit', 'eRole'] }, { path: 'aPlayers.oTeams', select: 'sName' }]).lean()

      const aResult = aUserTeams.map(userTeam => {
        const matchTeam = aTeamData.find(oTeamHash => oTeamHash.sHash === userTeam.sHash)
        if (matchTeam) {
          userTeam.aPlayers = matchTeam.aPlayers
        }
        userTeam.sHash = undefined
        userTeam.dCreatedAt = undefined
        userTeam.dUpdatedAt = undefined
        userTeam.__v = undefined
        userTeam.eType = undefined
        userTeam.bPointCalculated = undefined
        return userTeam
      })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].baseTeam), data: { nTotal, oMatch, oUser, aResult } })
    } catch (error) {
      return catchError('matchWiseUserTeamList.baseTeamList', error, req, res)
    }
  }

  async userTeamPlayersAdminV2(req, res) {
    try {
      const hashData = await UserTeamModel.findOne({ _id: req.params.id }, { _id: 1, sName: 1, iMatchId: 1, iCaptainId: 1, iViceCaptainId: 1, sHash: 1, eCategory: 1 }).lean()

      if (!hashData) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].userTeam) })

      // Admin can't able to view userteam while match is pending or upcoming
      if (req?.admin?.eType !== ADMIN_TYPE.SUPER) {
        const oMatch = await MatchModel.findById(hashData.iMatchId, { eStatus: 1 }).lean()
        if (['U', 'P'].includes(oMatch.eStatus)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_started })
      }

      const points = await PlayerRoleModel.findOne({ eCategory: hashData.eCategory }).lean().cache(CACHE_2, `playerPoints:${hashData.eCategory}`)

      const oTeamData = await MatchTeamsModel.findOne({ sHash: hashData.sHash }, { aPlayers: 1, _id: 0 }).populate([{ path: 'aPlayers.iMatchPlayerId', select: ['sName', 'nFantasyCredit', 'eRole'] }, { path: 'aPlayers.iTeamId', select: ['sName'] }]).lean()

      const aPlayers = oTeamData.aPlayers.map((player) => {
        const { _id } = player.iMatchPlayerId
        if (_id.toString() === hashData.iCaptainId.toString()) {
          player.nScoredPoints = player.nScoredPoints * points.nCaptainPoint
        } else if (_id.toString() === hashData.iViceCaptainId.toString()) {
          player.nScoredPoints = player.nScoredPoints * points.nViceCaptainPoint
        }
        return player
      })
      const data = { ...hashData, aPlayers }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].teamPlayers), data })
    } catch (error) {
      catchError('UserTeam.userTeamPlayersAdminV2', error, req, res)
    }
  }

  async copyBotTeamPlayers(req, res) {
    try {
      const { id, iMatchLeagueId } = req.params
      const hashData = await UserTeamModel.findOne({ _id: id, $or: [{ eType: 'B' }, { eType: 'CB' }] }, { _id: 1, sName: 1, iMatchId: 1, iCaptainId: 1, iViceCaptainId: 1, sHash: 1, eCategory: 1 }).lean()
      const findUserTeamLog = await CopyTeamLogModel.findOne({ iSystemUserTeamId: id, iMatchLeagueId }, { iUserId: 1, iUserTeamId: 1 }).lean()
      let userTeam

      if (!hashData) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].userTeam) })

      const points = await PlayerRoleModel.findOne({ eCategory: hashData.eCategory }).lean().cache(CACHE_2, `playerPoints:${hashData.eCategory}`)

      const oTeamData = await MatchTeamsModel.findOne({ sHash: hashData.sHash }, { aPlayers: 1, _id: 0 }).populate([{ path: 'aPlayers.iMatchPlayerId', select: ['sName', 'nFantasyCredit', 'eRole'] }, { path: 'aPlayers.iTeamId', select: ['sName'] }]).lean()

      const aPlayers = oTeamData.aPlayers.map((player) => {
        const { _id } = player.iMatchPlayerId
        if (_id.toString() === hashData.iCaptainId.toString()) {
          player.nScoredPoints = player.nScoredPoints * points.nCaptainPoint
        } else if (_id.toString() === hashData.iViceCaptainId.toString()) {
          player.nScoredPoints = player.nScoredPoints * points.nViceCaptainPoint
        }
        return player
      })
      hashData.sHash = undefined
      const data = { ...hashData, aPlayers }

      if (findUserTeamLog && findUserTeamLog.iUserTeamId) {
        userTeam = await UserTeamModel.findOne({ _id: findUserTeamLog.iUserTeamId, eType: 'U' }, { sName: 1 }).populate('iUserId', ['sUsername']).lean()
        data.sBaseUserTeamName = userTeam.sName
        data.sBaseUserName = userTeam.iUserId.sUsername
        data.iBaseUserId = userTeam.iUserId._id
        data.iBaseUserTeamId = userTeam._id
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].teamPlayers), data })
    } catch (error) {
      catchError('UserTeam.userTeamPlayersAdminV2', error, req, res)
    }
  }

  async winReturn(req, res) {
    try {
      const matchLeague = await MatchLeagueModel.find({ iMatchId: req.params.id, bCancelled: false, bWinningDone: true }, { _id: 1, sName: 1, bPrivateLeague: 1, iUserId: 1, aLeaguePrize: 1, iMatchId: 1, eCategory: 1, nCreatorCommission: 1 }).lean()
      matchLeague.map(async (league) => queuePush('winReturn', league))

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].cBackgroundProcess.replace('##', messages[req.userLanguage].cwinReturn) })
    } catch (error) {
      catchError('UserTeam.winReturn', error, req, res)
    }
  }

  // ********** User **********

  // Create new team
  async addV3(req, res) {
    try {
      const { iMatchId, aPlayers, sName, iCaptainId, iViceCaptainId, iBotLogId } = req.body
      const iUserId = req.user._id

      req.body = pick(req.body, ['iMatchId', 'sName', 'aPlayers', 'iCaptainId', 'iViceCaptainId', 'iBotLogId'])

      const result = await validateMatch(req.body, iUserId, req.userLanguage)

      if (result.isSuccess === false) return res.status(result.status).jsonp({ status: result.status, message: result.message, type: result.type || '' })
      const matchPlayerMap = result.matchPlayerMap
      const nTotalCredit = result.nTotalCredit
      const match = result.match

      // generate team name
      let teamName
      if (sName) {
        teamName = sName
      } else {
        const userTeams = await UserTeamModel.countDocuments({ iMatchId: ObjectId(iMatchId), iUserId }, { readPreference: 'primary' })
        teamName = `T${userTeams + 1}`
      }

      const user = await UserModel.findById(iUserId, { eType: 1 }).lean()
      if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

      // check team is exist
      const UserTeamPlayer = aPlayers.sort((a, b) => a > b ? 1 : -1)
      const TeamHash = crypto.createHash('sha1').update(JSON.stringify(UserTeamPlayer).toString()).digest('hex')

      const matchingTeam = await UserTeamModel.findOne({
        iMatchId: ObjectId(iMatchId),
        iUserId,
        $or: [{
          sHash: TeamHash,
          iCaptainId: ObjectId(iCaptainId),
          iViceCaptainId: ObjectId(iViceCaptainId)
        }, {
          sName
        }]
      }, { sName: 1 }, { readPreference: 'primary' }).lean()

      if (matchingTeam) {
        if (matchingTeam.sName === sName) {
          return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cteamName) })
        }
        return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cteam), data: { _id: matchingTeam._id } })
      }

      const nSameTeamCount = await redisClient.incrby(`${iUserId}:${iMatchId}:${TeamHash}:${iCaptainId}:${iViceCaptainId}`, 1)
      await redisClient.expire(`${iUserId}:${iMatchId}:${TeamHash}:${iCaptainId}:${iViceCaptainId}`, 10)
      if (nSameTeamCount > 1) { return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnewUserTeam), type: 'concurrent_same_team' }) }

      const data = await UserTeamModel.create({ iMatchId, sName: teamName, sHash: TeamHash, iCaptainId, iViceCaptainId, iUserId, eCategory: match.eCategory, eType: user.eType })
      if (!data) {
        return res.status(status.InternalServerError).jsonp({
          status: jsonStatus.InternalServerError,
          message: messages[req.userLanguage].error,
          type: 'userteam_create_nodata'
        })
      }

      await MyMatchesModel.updateOne({ iMatchId: ObjectId(iMatchId), iUserId }, { $inc: { nTeams: 1 }, nWinnings: 0, eMatchStatus: match.eStatus, eCategory: match.eCategory, dStartDate: match.dStartDate, eType: user.eType }, { upsert: true })

      const matchTeam = await MatchTeamsModel.findOne({ iMatchId: ObjectId(iMatchId), sHash: TeamHash }, null, { readPreference: 'primary' }).lean() // in redis

      if (!matchTeam) {
        await MatchTeamsModel.create({ aPlayers: matchPlayerMap, iMatchId, sHash: TeamHash, nTotalCredit })
      }

      const aPromises = [StatisticsModel.updateOne({ iUserId }, { $inc: { nTeams: 1 } }, { upsert: true })]
      if (iBotLogId) aPromises.push(BotLogModel.updateOne({ _id: ObjectId(iBotLogId) }, { $inc: { nTeamCreated: 1 } }))
      await Promise.all(aPromises)

      data.eType = undefined
      data.bSwapped = undefined
      data.bIsDuplicated = undefined

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnewUserTeam), data })
    } catch (error) {
      catchError('UserTeam.addV3', error, req, res)
    }
  }

  // To update userTeam without validation
  async updateV3(req, res) {
    try {
      const { iMatchId, aPlayers, sName, iCaptainId, iViceCaptainId } = req.body
      const iUserId = req.user._id
      req.body = pick(req.body, ['iMatchId', 'sName', 'aPlayers', 'iCaptainId', 'iViceCaptainId'])
      req.body.bIsUpdate = true

      const result = await validateMatch(req.body, iUserId, req.userLanguage)

      if (result.isSuccess === false) return res.status(result.status).jsonp({ status: result.status, message: result.message })
      const matchPlayerMap = result.matchPlayerMap
      const nTotalCredit = result.nTotalCredit
      // check team is exist
      const UserTeamPlayer = aPlayers.sort((a, b) => a > b ? 1 : -1)
      const TeamHash = crypto.createHash('sha1').update(JSON.stringify(UserTeamPlayer).toString()).digest('hex')

      const matchingTeam = await UserTeamModel.findOne({
        iMatchId: ObjectId(iMatchId),
        iUserId,
        _id: { $ne: ObjectId(req.params.id) },
        $or: [{
          sHash: TeamHash,
          iCaptainId: ObjectId(iCaptainId),
          iViceCaptainId: ObjectId(iViceCaptainId)
        }, {
          sName
        }]
      }, { sName: 1 }, { readPreference: 'primary' }).lean()

      if (matchingTeam) {
        if (matchingTeam.sName === sName) {
          return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cteamName) })
        }
        return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cteam) })
      }

      const userTeam = await UserTeamModel.findByIdAndUpdate(req.params.id, { dUpdatedAt: Date.now(), sName, iCaptainId, iViceCaptainId, sHash: TeamHash }, { new: true, runValidators: true, readPreference: 'primary' }).lean()
      if (!userTeam) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].userTeam) })

      await UserLeagueModel.updateMany({ iUserTeamId: userTeam._id, iUserId: userTeam.iUserId, iMatchId }, { $set: { dUpdatedAt: Date.now(), sTeamName: sName } }).w('majority')

      if (!userTeam) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].userTeam) })

      const matchTeam = await MatchTeamsModel.findOne({ iMatchId: ObjectId(iMatchId), sHash: TeamHash }, { _id: 1 }, { readPreference: 'primary' }).lean() // in redis
      if (!matchTeam) {
        await MatchTeamsModel.create({ aPlayers: matchPlayerMap, iMatchId, sHash: TeamHash, nTotalCredit })
      }

      if (userTeam) { // For update copy system user team
        const match = await matchServices.findUpcomingMatch(iMatchId)
        updateCopyUserTeam(userTeam, iMatchId, userTeam.iUserId, match.dStartDate)
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cuserTeamDetails), data: { ...userTeam, eType: undefined, bSwapped: undefined } })
    } catch (error) {
      catchError('UserTeam.updateV3', error, req, res)
    }
  }

  // Get count of total team in match
  async userTeamCount(req, res) {
    try {
      const userTeams = await UserTeamModel.countDocuments({ iMatchId: ObjectId(req.params.id), iUserId: req.user._id }, { readPreference: 'primaryPreferred' })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].userTeamCount), data: { nCount: userTeams } })
    } catch (error) {
      catchError('UserTeam.userTeamCount', error, req, res)
    }
  }

  async userTeamsV3(req, res) {
    try {
      const iUserId = req.user._id
      const teamData = await UserTeamModel.find({ iUserId, iMatchId: ObjectId(req.params.id) }, { _id: 1, sName: 1, iMatchId: 1, iUserId: 1, iCaptainId: 1, iViceCaptainId: 1, nTotalPoints: 1, sHash: 1 }).sort({ dCreatedAt: 1 }).lean()

      const teams = teamData.map(t => t.sHash)
      const oTeamData = await MatchTeamsModel.find({ sHash: { $in: teams } }, { 'aPlayers.iMatchPlayerId': 1, _id: 0, sHash: 1 }).lean()

      const oTeam = {}
      oTeamData.forEach((pl, i) => { oTeam[pl.sHash] = i })

      const data = []
      for (const hash of teamData) {
        // const exist = oTeamData.find((d) => d.sHash === hash.sHash)
        const exist = typeof oTeam[hash.sHash] === 'number' ? oTeamData[oTeam[hash.sHash]] : false

        if (exist) {
          data.push({ ...hash, aPlayers: exist.aPlayers.map(p => p.iMatchPlayerId), sHash: undefined })
        }
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cuserTeams), data })
    } catch (error) {
      catchError('UserTeam.userTeamsV3', error, req, res)
    }
  }

  async userTeamPlayersForLeaderBoardV2(req, res) {
    try {
      const hashData = await UserTeamModel.findById(req.params.iUserTeamId, { _id: 1, sName: 1, iMatchId: 1, iUserId: 1, iCaptainId: 1, iViceCaptainId: 1, nTotalPoints: 1, sHash: 1 }).lean()
      if (!hashData) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].userTeam) })

      const match = await MatchModel.findOne({ _id: hashData.iMatchId }).cache(CACHE_1, `match:live:${hashData.iMatchId}`).lean()
      if (hashData.iUserId.toString() !== req.user._id.toString() && !['L', 'CMP', 'I'].includes(match?.eStatus)) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_started })
      }

      const oTeamData = await MatchTeamsModel.findOne({ sHash: hashData.sHash }, {
        nTotalPoint: 0,
        nTotalCredit: 0,
        sHash: 0,
        eCategory: 0,
        dUpdatedAt: 0,
        dCreatedAt: 0,
        sExternalId: 0,
        'aPlayers._id': 0,
        'aPlayers.nScoredPoints': 0,
        _id: 0
      })
        .populate('aPlayers.iMatchPlayerId', ['sName', 'sImage', 'eRole', 'nFantasyCredit', 'nScoredPoints', 'bShow', 'sKey'])
        .populate('aPlayers.iTeamId', ['sName', 'sImage', 'sShortName'])
        .lean()

      const player = oTeamData ? oTeamData.aPlayers || [] : []
      const data = { ...hashData, sHash: undefined, aPlayers: player.map(p => ({ ...p.iMatchPlayerId, iMatchPlayerId: p.iMatchPlayerId._id, bShow: match?.bLineupsOut ? p.iMatchPlayerId.bShow : false, _id: undefined, oTeam: { ...p.iTeamId, iTeamId: p.iTeamId._id, _id: undefined } })) }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cuserTeams), data })
    } catch (error) {
      catchError('UserTeam.userTeamPlayersForLeaderBoardV2', error, req, res)
    }
  }

  async userTeamPlayersForLeaderBoardV3(req, res) {
    try {
      const hashData = await UserLeagueModel.findById(req.params.iUserLeagueId).populate({ path: 'iUserTeamId', select: ['_id', 'sName', 'iMatchId', 'iUserId', 'iCaptainId', 'iViceCaptainId', 'nTotalPoints', 'sHash'] }).lean()

      if (!hashData || !hashData.iUserTeamId) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].userTeam) })

      const { iUserTeamId, nRank, sProPic, sUserName, _id } = hashData
      const team = { ...iUserTeamId, nRank, sProPic, sUserName, iUserLeagueId: _id }

      if (team.iUserId.toString() !== req.user._id.toString()) {
        const match = await MatchModel.findOne({ _id: team.iMatchId, eStatus: { $in: ['L', 'CMP', 'I'] } }).cache(CACHE_2, `match:live:${team.iMatchId}`).lean()
        if (!match) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_started })
      }

      const oTeamData = await MatchTeamsModel.findOne({ sHash: team.sHash }, {
        nTotalPoint: 0,
        nTotalCredit: 0,
        sHash: 0,
        eCategory: 0,
        dUpdatedAt: 0,
        dCreatedAt: 0,
        sExternalId: 0,
        'aPlayers._id': 0,
        'aPlayers.nScoredPoints': 0,
        _id: 0
      })
        .populate('aPlayers.iMatchPlayerId', ['sName', 'sImage', 'eRole', 'nFantasyCredit', 'nScoredPoints', 'bShow', 'sKey'])
        .populate('aPlayers.iTeamId', ['sName', 'sImage', 'sShortName'])
        .lean()

      const player = oTeamData ? oTeamData.aPlayers || [] : []
      const data = { ...team, sHash: undefined, aPlayers: player.map(p => ({ ...p.iMatchPlayerId, iMatchPlayerId: p.iMatchPlayerId._id, _id: undefined, oTeam: { ...p.iTeamId, iTeamId: p.iTeamId._id, _id: undefined } })) }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cuserTeams), data })
    } catch (error) {
      catchError('UserTeam.userTeamPlayersForLeaderBoardV3', error, req, res)
    }
  }

  async userUniqueTeamPlayers(req, res) {
    try {
      const iUserId = req.user._id
      let data = await UserTeamModel.aggregate([
        {
          $match: {
            iMatchId: ObjectId(req.params.id),
            iUserId
          }
        }, {
          $lookup: {
            from: 'matchteams',
            localField: 'sHash',
            foreignField: 'sHash',
            as: 'players'
          }
        }, {
          $addFields: {
            aPlayers: {
              $arrayElemAt: ['$players.aPlayers', 0]
            }
          }
        }, {
          $unwind: {
            path: '$aPlayers'
          }
        }, {
          $group: {
            _id: '$aPlayers.iMatchPlayerId'
          }
        }
      ]).allowDiskUse(bAllowDiskUse).exec()

      data = data.map(matchPlayer => matchPlayer._id)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].teamPlayers), data: data })
    } catch (error) {
      catchError('UserTeam.userUniqueTeamPlayers', error, req, res)
    }
  }

  async userUniqueTeamPlayersLeagueV2(req, res) {
    try {
      const iUserId = req.user._id
      const hashData = await UserLeagueModel.find({ iUserId, iMatchLeagueId: ObjectId(req.params.id) }).populate({ path: 'iUserTeamId', select: 'sHash' }).lean()
      const hash = hashData.map(hash => hash.iUserTeamId.sHash)

      let data = []
      const oTeamData = await MatchTeamsModel.find({ sHash: { $in: hash } }, { aPlayers: 1, _id: 0 }).lean()
      for (const player of oTeamData) {
        const { aPlayers } = player
        const playerIds = aPlayers.map(player => player.iMatchPlayerId)
        const ids = new Set(playerIds)
        data.push(...ids)
      }
      data = [...new Set(data)]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].teamPlayers), data })
    } catch (error) {
      catchError('UserTeam.userUniqueTeamPlayersLeague', error, req, res)
    }
  }

  // temp create team api's service without any validation for load test purpose
  async createTeam(req, res) {
    try {
      const { iMatchId, aPlayers, sName, iCaptainId, iViceCaptainId, iBotLogId } = req.body
      const iUserId = req.user._id

      req.body = pick(req.body, ['iMatchId', 'sName', 'aPlayers', 'iCaptainId', 'iViceCaptainId', 'iBotLogId'])

      const match = await matchServices.findUpcomingMatch(iMatchId)
      if (!match) return { isSuccess: false, status: status.OK, message: messages[req.userLanguage].match_started, type: 'match_started' }

      const sportsValidation = await sportServices.findSport(match.eCategory)
      if (!sportsValidation) return { isSuccess: false, status: status.BadRequest, message: messages[req.userLanguage].sports_err }

      // check team have only nTotalPlayers players
      const matchPlayers = await matchPlayerServices.getMatchPlayers(iMatchId)
      const playerRoles = matchPlayers.filter(({ _id }) => aPlayers.includes(_id.toString()))

      const matchPlayerMap = []
      for (const playerRole of playerRoles) {
        const { _id: iMatchPlayerId, iTeamId } = playerRole
        matchPlayerMap.push({ iMatchPlayerId, iTeamId })
      }

      // check maxTeam limit of team in match
      // eslint-disable-next-line no-unused-vars
      const nTotalTeam = await MyMatchesModel.findOne({ iMatchId: ObjectId(iMatchId), iUserId }, { nTeams: 1 }, { readPreference: 'primary' }).lean()

      // { isSuccess: true, nTotalCredit, matchPlayerMap, match }

      const nTotalCredit = 100

      // generate team name
      let teamName
      if (sName) {
        teamName = sName
      } else {
        const userTeams = await UserTeamModel.countDocuments({ iMatchId: ObjectId(iMatchId), iUserId }, { readPreference: 'primary' })
        teamName = `T${userTeams + 1}`
      }

      const user = await UserModel.findById(iUserId, { eType: 1 }).lean()
      if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

      // check team is exist
      const UserTeamPlayer = aPlayers.sort((a, b) => a > b ? 1 : -1)
      const TeamHash = crypto.createHash('sha1').update(JSON.stringify(UserTeamPlayer).toString()).digest('hex')

      // eslint-disable-next-line no-unused-vars
      const matchingTeam = await UserTeamModel.findOne({
        iMatchId: ObjectId(iMatchId),
        iUserId,
        $or: [{
          sHash: TeamHash,
          iCaptainId: ObjectId(iCaptainId),
          iViceCaptainId: ObjectId(iViceCaptainId)
        }, {
          sName
        }]
      }, { sName: 1 }, { readPreference: 'primary' }).lean()
      // eslint-disable-next-line no-unused-vars
      const nSameTeamCount = await redisClient.incrby(`${iUserId}:${iMatchId}:${TeamHash}:${iCaptainId}:${iViceCaptainId}`, 1)
      await redisClient.expire(`${iUserId}:${iMatchId}:${TeamHash}:${iCaptainId}:${iViceCaptainId}`, 10)

      const data = await UserTeamModel.create({ iMatchId, sName: teamName, sHash: TeamHash, iCaptainId, iViceCaptainId, iUserId, eCategory: match.eCategory, eType: user.eType })

      if (!data) {
        return res.status(status.InternalServerError).jsonp({
          status: jsonStatus.InternalServerError,
          message: messages[req.userLanguage].error,
          type: 'userteam_create_nodata'
        })
      }
      await MyMatchesModel.updateOne({ iMatchId: ObjectId(iMatchId), iUserId }, { $inc: { nTeams: 1 }, nWinnings: 0, eMatchStatus: match.eStatus, eCategory: match.eCategory, dStartDate: match.dStartDate }, { upsert: true })

      const matchTeam = await MatchTeamsModel.findOne({ iMatchId: ObjectId(iMatchId), sHash: TeamHash }, null, { readPreference: 'primary' }).lean() // in redis

      if (!matchTeam) {
        await MatchTeamsModel.create({ aPlayers: matchPlayerMap, iMatchId, sHash: TeamHash, nTotalCredit })
      }

      const aPromises = [StatisticsModel.updateOne({ iUserId }, { $inc: { nTeams: 1 } }, { upsert: true })]
      if (iBotLogId) aPromises.push(BotLogModel.updateOne({ _id: ObjectId(iBotLogId) }, { $inc: { nTeamCreated: 1 } }))
      await Promise.all(aPromises)

      data.eType = undefined
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnewUserTeam), data })
    } catch (error) {
      catchError('UserTeam.createTeam', error, req, res)
    }
  }

  async userCopyTeams(req, res) {
    try {
      const { id, iMatchLeagueId } = req.params
      const oUserTeam = await UserTeamModel.findById(id, { sHash: 1, iCaptainId: 1, iViceCaptainId: 1 }).lean()
      if (!oUserTeam) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cteam) })
      const [aCopyTeams, oUserMatchTeamData] = await Promise.all([
        CopyTeamLogModel.find({ iUserTeamId: oUserTeam._id, iMatchLeagueId }, { iUserId: 1, iSystemUserId: 1, iSystemUserTeamId: 1, eTeamType: 1 }).populate({ path: 'oSystemUserTeam', select: ['iCaptainId', 'iViceCaptainId', 'nTotalPoints', 'sName', 'sHash'], populate: { path: 'oMatchTeamHash', select: ['aPlayers.iMatchPlayerId'] } }).populate({ path: 'oSystemUser', select: 'sName sUsername' }).lean(),
        MatchTeamsModel.findOne({ sHash: oUserTeam.sHash }, { aPlayers: 1, _id: 0 }).populate([{ path: 'aPlayers.oMatchPlayer', select: ['sName'] }]).lean()
      ])

      // const aSystemUserTeamHash = new Set()
      // for (const team of aCopyTeams) {
      //   aSystemUserTeamHash.add(team?.oSystemUserTeam?.sHash)
      // }

      // const a = [...aSystemUserTeamHash]
      // const aCopyUserTeamPlayers = await MatchTeamsModel.find({ sHash: 'acef52fded5221f9b6fc7280990b31f0aa232c4e'}, { 'aPlayers.iMatchPlayerId': 1, sHash: 1 }).lean()

      const aCopyBotTeamData = aCopyTeams.map(dataObj => {
        const aPlayersOfCopyTeam = dataObj?.oSystemUserTeam?.oMatchTeamHash?.aPlayers
        const aPlayerIds = aPlayersOfCopyTeam.map(idObj => {
          return idObj.iMatchPlayerId
        })
        dataObj.oSystemUserTeam.oMatchTeamHash = undefined
        return { ...dataObj, oSystemUserTeam: { ...dataObj.oSystemUserTeam, aPlayers: aPlayerIds } }
      })
      // const aCopyBotTeamData = []
      // for (const copyteam of aCopyTeams) {
      //   const aPlayers = []
      //   const aPlayersOfCopyTeam = aCopyUserTeamPlayers[aCopyUserTeamPlayers.findIndex(player => copyteam?.oSystemUserTeam?.sHash === player.sHash)]
      // }
      const data = { ...oUserTeam, aPlayers: oUserMatchTeamData.aPlayers, nTotalCopyBotTeams: aCopyTeams.length, aCopyBotTeams: aCopyBotTeamData }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].teamPlayers), data })
    } catch (error) {
      catchError('UserTeam.useruserCopyTeams', error, req, res)
    }
  }
}

async function checkCancellableContest(iMatchId) {
  try {
    const matchLeagues = await MatchLeagueModel.find({ iMatchId, bCancelled: false, bPrizeDone: false }).sort({ nJoined: 1 }).lean()
    for (const league of matchLeagues) {
      const nJoined = await UserLeagueModel.countDocuments({ iMatchLeagueId: league._id }, { readPreference: 'primary' })
      league.nJoined = nJoined

      const uniqueUserJoin = await UserLeagueModel.aggregate([
        {
          $match: { iMatchLeagueId: ObjectId(league._id) }
        },
        {
          $group: {
            _id: '$iUserId'
          }
        },
        {
          $group: {
            _id: null,
            nJoinedCount: { $sum: 1 }
          }
        }
      ]).allowDiskUse(bAllowDiskUse).read('primary').exec()
      const uniqueUserJoinCount = (uniqueUserJoin.length) ? uniqueUserJoin[0].nJoinedCount : 0

      const leagueStatus = await getMatchLeagueStatus(league, uniqueUserJoinCount)
      if (leagueStatus === 'PLAY_RETURN') {
        await MatchLeagueModel.updateOne({ _id: ObjectId(league._id) }, { bPlayReturnProcess: true })
        // await queuePush('ProcessPlayReturn', { matchLeague: league, type: 'MATCHLEAGUE', iAdminId: null, sIP: '', sOperationBy: 'MATCH PD CHECK', nJoined: league.nJoined, uniqueUserJoinCount })
        await matchLeagueServices.processPlayReturn(league, 'MATCHLEAGUE', null, '', 'MATCH PD CHECK', league.nJoined, uniqueUserJoinCount)
      }
    }
  } catch (error) {
    handleCatchError(error)
  }
}

/**
 * For update copy system user team
 * @param {object} userTeam
 * @param {ObjectId} iMatchId
 * @param {ObjectId} iUserId
 */
async function updateCopyUserTeam(userTeam, iMatchId, iUserId, dStartDate) {
  try {
    if (userTeam) { // For update copy system user team
      const joinedContestWithTeam = await UserLeagueModel.find({ iUserTeamId: userTeam._id, iMatchId: ObjectId(iMatchId), iUserId: ObjectId(iUserId) }, { iMatchLeagueId: 1, _id: 1 })
        .populate('iMatchLeagueId', ['bCopyBotInit', 'bBotCreate', 'bCancelled'])
        .lean()

      const leagues = joinedContestWithTeam.filter((ul) => ul.iMatchLeagueId.bCopyBotInit && ul.iMatchLeagueId.bBotCreate && ul.iMatchLeagueId.bCancelled === false)
      const matchLeagueIds = leagues.map((l) => l.iMatchLeagueId._id)
      if (matchLeagueIds.length) {
        const oUpdateCopyBotTeamData = { matchLeagueIds, iMatchId, iUserId, iUserTeamId: userTeam._id, dStartDate }
        await CopyTeamUpdate(oUpdateCopyBotTeamData)
        // await queuePush('CopyTeamUpdate', { matchLeagueIds, iMatchId, iUserId, iUserTeamId: userTeam._id, dStartDate })
      }
    }
  } catch (error) {
    handleCatchError(error)
  }
}

async function winReturnByLeagueV2() {
  let data
  try {
    data = await queuePop('winReturn')
    if (!data) {
      setTimeout(() => { winReturnByLeagueV2() }, 2000)
      return
    }
    data = JSON.parse(data)
    const { _id, sName, bPrivateLeague, iUserId, eCategory, iMatchId, nLoyaltyPoint, nCreatorCommission } = data

    const matchCategory = getStatisticsSportsKey(eCategory)

    const transactionOptions = {
      readPreference: 'primary',
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority' }
    }

    let bShouldProcessFull = true
    const projection = { _id: 1, nPrice: 1, nBonusWin: 1, iUserId: 1, sMatchName: 1, sUserName: 1, iMatchLeagueId: 1, iMatchId: 1, eType: 1, eCategory: 1 }

    UserLeagueModel.find({ $or: [{ nPrice: { $gt: 0 } }, { nBonusWin: { $gt: 0 } }, { 'aExtraWin.0': { $exists: true } }], iMatchLeagueId: ObjectId(_id) }).select(projection).lean().cursor()
      .on('data', async (userLeague) => {
        if (bShouldProcessFull) {
          const leagueSession = await GamesDBConnect.startSession()
          leagueSession.startTransaction(transactionOptions)

          try {
            if (userLeague.nPrice > 0 || userLeague.nBonusWin > 0) {
              await userBalanceServices.winReturn(userLeague)
            }
            await UserLeagueModel.updateOne({ _id: ObjectId(userLeague._id) }, { nPrice: 0, aExtraWin: [], nBonusWin: 0, bPrizeCalculated: false, bWinDistributed: false }).session(leagueSession)
            await StatisticsModel.updateOne({ iUserId: ObjectId(userLeague.iUserId) }, {
              $inc: {
                [`${matchCategory}.nWinCount`]: -1,
                [`${matchCategory}.nWinAmount`]: -(Number(parseFloat(userLeague.nPrice).toFixed(2))),
                nWinnings: -(Number(parseFloat(userLeague.nPrice).toFixed(2))),
                nTotalWinReturn: Number(parseFloat(userLeague.nPrice).toFixed(2))
              }
            }, { upsert: true }).session(leagueSession)

            await MyMatchesModel.updateOne({ iMatchId: ObjectId(iMatchId), iUserId: userLeague.iUserId }, { $inc: { nWinnings: -(Number(parseFloat(userLeague.nPrice).toFixed(2))) } }).session(leagueSession)

            await leagueSession.commitTransaction()
          } catch (error) {
            handleCatchError(error)
            await leagueSession.abortTransaction()
            bShouldProcessFull = false
          } finally {
            await leagueSession.endSession()
          }
        }
      }).on('end', async () => {
        const session = await GamesDBConnect.startSession()
        session.startTransaction(transactionOptions)

        try {
          if (bShouldProcessFull) {
            if (nLoyaltyPoint > 0) {
              //* Temporarily removed transaction from these queries
              const userLeagues = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(_id), bCancelled: false }, { iUserId: 1 }).lean()
              const userIds = userLeagues.map((ul) => ObjectId(ul.iUserId))
              await UserModel.updateMany({ _id: { $in: userIds } }, { $inc: { nLoyaltyPoints: -(nLoyaltyPoint) } })
            }
            if (bPrivateLeague) {
              await userBalanceServices.creatorBonusReturn({ iUserId, _id, sLeagueName: sName, iMatchId, eCategory })

              await StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, {
                $inc: {
                  [`${matchCategory}.nCreatePLeagueSpend`]: -nCreatorCommission,
                  nCash: -nCreatorCommission,
                  nWinnings: -nCreatorCommission,
                  nTotalWinnings: -nCreatorCommission,
                  nActualDepositBalance: -nCreatorCommission,
                  nActualWinningBalance: -(Number(parseFloat(nCreatorCommission).toFixed(2))),
                  nActualBonus: -(Number(parseFloat(nCreatorCommission).toFixed(2)))
                }
              }, { upsert: true }).session(session)
            }
            await MatchLeagueModel.updateOne({ _id: ObjectId(_id) }, { bPrizeDone: false, bWinningDone: false }).session(session)
          }

          await session.commitTransaction()
        } catch (error) {
          handleCatchError(error)
          await session.abortTransaction()
        } finally {
          await session.endSession()
        }
      })

    winReturnByLeagueV2()
  } catch (error) {
    await queuePush('dead:winReturn', data)
    handleCatchError(error)
    winReturnByLeagueV2()
  }
}

/**
 * It'll do pops logs from queue and upload into s3 bucket
 */
// eslint-disable-next-line no-unused-vars
async function putLogsQueue() {
  let data
  try {
    data = await queuePop('ProcessBucketLogs')
    if (!data) {
      setTimeout(() => { putLogsQueue() }, 2000)
      return
    }
    data = JSON.parse(data)

    const { fileName, putData } = data
    await storePrizeDistributionLogs(fileName, putData)

    putLogsQueue()
  } catch (error) {
    await queuePush('dead:ProcessBucketLogs', data)
    handleCatchError(error)
    setTimeout(() => { putLogsQueue() }, 2000)
  }
}

async function storePrizeDistributionLogs(sKey, oLogData) {
  try {
    const data = await PrizeDistributionLogModel.countDocuments({ sKey })
    if (!data) {
      await PrizeDistributionLogModel.create({ sKey, aData: [oLogData] })
    } else {
      await PrizeDistributionLogModel.updateOne({ sKey }, { $push: { aData: oLogData } })
    }
  } catch (error) {
    handleCatchError(error)
  }
}

/**
 * It validates match, its matchplayers and team so that appropriate team can be added
 * @param   {object}    data
 * @param   {ObjectId}  iUserId
 * @param   {string}    userLanguage English
 * @returns {object}    { isSuccess:false, status, message }if any validation is failed
 * @returns {object}    { isSuccess:true, nTotalCredit, matchPlayerMap, match } for further use
 */
async function validateMatch(data, iUserId, userLanguage = 'English') {
  try {
    const { iMatchId, aPlayers, iCaptainId, iViceCaptainId, sName, bIsUpdate = false } = data
    const match = await matchServices.findUpcomingMatch(iMatchId)
    if (!match) return { isSuccess: false, status: status.OK, message: messages[userLanguage].match_started, type: 'match_started' }

    const roles = match.aPlayerRole || []
    if (!roles.length) return { isSuccess: false, status: status.NotFound, message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].croles) }

    // check all players are unique
    const playerId = []
    let hasCaptain
    let hasViceCaptain
    for (let iMatchPlayerId of aPlayers) {
      if (typeof iMatchPlayerId === 'object' && iMatchPlayerId.iMatchPlayerId) {
        iMatchPlayerId = iMatchPlayerId.iMatchPlayerId
      }

      if (!playerId.includes(iMatchPlayerId)) {
        playerId.push(iMatchPlayerId)
      }
      if (iMatchPlayerId === iCaptainId) {
        hasCaptain = true
      } else if (iMatchPlayerId === iViceCaptainId) {
        hasViceCaptain = true
      }
    }

    if (playerId.length !== aPlayers.length) return { isSuccess: false, status: status.BadRequest, message: messages[userLanguage].unique_team_player_err }

    // check captain and vice captain are only 1 and both are not same
    if (!hasCaptain) return { isSuccess: false, status: status.BadRequest, message: messages[userLanguage].required.replace('##', messages[userLanguage].ccaptain) }

    if (!hasViceCaptain) return { isSuccess: false, status: status.BadRequest, message: messages[userLanguage].required.replace('##', messages[userLanguage].cviceCaptain) }

    if (iCaptainId === iViceCaptainId) return { isSuccess: false, status: status.BadRequest, message: messages[userLanguage].same_value_err.replace('##', messages[userLanguage].ccaptain).replace('#', messages[userLanguage].cviceCaptain) }
    // finding sport rules
    const sportsValidation = await sportServices.findSport(match.eCategory)
    if (!sportsValidation) return { isSuccess: false, status: status.BadRequest, message: messages[userLanguage].sports_err }

    const { nMaxPlayerOneTeam, nTotalPlayers } = sportsValidation.oRule

    // check team have only nTotalPlayers players
    const matchPlayers = await matchPlayerServices.getMatchPlayers(iMatchId)
    const playerRoles = matchPlayers.filter(({ _id }) => playerId.includes(_id.toString()))

    if (playerRoles.length !== nTotalPlayers) return { isSuccess: false, status: status.BadRequest, message: messages[userLanguage].fixed_size_err.replace('##', messages[userLanguage].cplayers).replace('#', nTotalPlayers.toString()) }

    // check teams
    const [homeTeamPlayer, awayTeamPlayer, nTotalCredit] = playerRoles.reduce((acc, p) => {
      if (match.oHomeTeam.iTeamId.toString() === p.iTeamId.toString()) acc[0]++
      else if (match.oAwayTeam.iTeamId.toString() === p.iTeamId.toString()) acc[1]++

      acc[2] = acc[2] + p.nFantasyCredit // find total credit point of team
      return acc
    }, [0, 0, 0])

    if ((homeTeamPlayer > nMaxPlayerOneTeam) || (awayTeamPlayer > nMaxPlayerOneTeam) || (homeTeamPlayer + awayTeamPlayer) !== nTotalPlayers) {
      return { isSuccess: false, status: status.BadRequest, message: messages[userLanguage].max_team_player_err.replace('##', nMaxPlayerOneTeam.toString()) }
    }

    if (nTotalCredit > 100) {
      return { isSuccess: false, status: status.BadRequest, message: messages[userLanguage].invalid.replace('##', messages[userLanguage].cCredit) }
    }

    const teamName = await UserTeamModel.countDocuments({ iMatchId: ObjectId(iMatchId), iUserId: ObjectId(iUserId), sName })
    // check maxTeam limit of team in match
    let nTotalTeam = await MyMatchesModel.findOne({ iMatchId: ObjectId(iMatchId), iUserId }, { nTeams: 1 }, { readPreference: 'primary' }).lean()
    if (!nTotalTeam) {
      nTotalTeam = { nTeams: 0 }
    } else if (nTotalTeam && !nTotalTeam.nTeams) {
      nTotalTeam.nTeams = 0
    }

    if (!match.nMaxTeamLimit) {
      match.nMaxTeamLimit = 0
    }

    // Superuser can create unlimited team
    if (iUserId.toString() === SUPERUSER_ID) {
      match.nMaxTeamLimit = 0
    }
    if (match.nMaxTeamLimit && nTotalTeam && ((nTotalTeam.nTeams + 1) > match.nMaxTeamLimit) && !(teamName) && !bIsUpdate) {
      return { isSuccess: false, status: status.BadRequest, message: messages[userLanguage].team_join_limit_err }
    }

    // role wise count and check player role is valid
    const playerRoleValid = {}
    const matchPlayerMap = []
    for (const playerRole of playerRoles) {
      const { eRole, _id: iMatchPlayerId, iTeamId } = playerRole
      playerRoleValid[eRole] ? playerRoleValid[eRole]++ : playerRoleValid[eRole] = 1
      matchPlayerMap.push({ iMatchPlayerId, iTeamId })
    }

    const err = roles.find(({ sName, nMax, nMin }) => {
      return (!playerRoleValid[sName] || (playerRoleValid[sName] < nMin) || (playerRoleValid[sName] > nMax))
    })
    if (err) return { isSuccess: false, status: status.BadRequest, message: messages[userLanguage].invalid.replace('##', `${err.sName}`) }
    return { isSuccess: true, nTotalCredit, matchPlayerMap, match }
  } catch (error) {
    handleCatchError(error)
  }
}

/**
   * pushing each match teams into rabbitmq for generating user team score
   * @param {Array} teams
   */
async function pushMatchTeamsQueue(teams, eCategory, matchId) {
  console.log(`pushMatchTeamsQueue - ${teams.length}`)
  for (let i = 0; i < teams.length; i++) {
    await matchTeamsQueue.publish({ sHash: teams[i]._id, eCategory, iMatchId: matchId })
  }
}
/**
   * pushing each match league into rabbitmq
   * @param {Array} leagues
   */
async function pushMatchLeagueQueue(leagues) {
  for (let i = 0; i < leagues.length; i++) {
    await matchLeagueQueue.publish(leagues[i])
  }
}

/**
   * pushing each match league rank into rabbitmq
   * @param {Array} leagues
   */
async function pushMatchLeagueRankQueue(leagues) {
  for (let i = 0; i < leagues.length; i++) {
    await matchLeagueRankQueue.publish(leagues[i])
  }
}

/**
   * pushing each match league win into rabbitmq
   * @param {Array} leagues
   */
async function pushMatchLeagueWinQueue(leagues) {
  for (let i = 0; i < leagues.length; i++) {
    await matchLeagueWinQueue.publish(leagues[i])
  }
}
setTimeout(() => {
  winReturnByLeagueV2()
  matchLive()
  pushPlayReturnNotify()
  autoCreateLeague()
  referCodeBonusNotify()
  registerBonusNotify()
  registerReferNotifify()
  sendSms()
  sendMails()
  notificationScheduler()
  processUserCashbackReturnV2()
  processAuthLogs()
  processMatchLeague()
  checkRedisJoinedCount()
  // putLogsQueue()
}, 2000)

module.exports = new UserTeam()
