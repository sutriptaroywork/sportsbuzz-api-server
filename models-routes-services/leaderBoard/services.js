const UserLeagueModel = require('../userLeague/model')
const MatchLeagueModel = require('../matchLeague/model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, handleCatchError } = require('../../helper/utilities.services')
const { redisClient3 } = require('../../helper/redis')
const ObjectId = require('mongoose').Types.ObjectId
const config = require('../../config/config')
const { getMyTeamsWithRankCalculationV2 } = require('./common')
class LeaderBoard {
  async userTeamListV2(req, res) {
    try {
      const iMatchLeagueId = req.params.id

      const matchLeague = await MatchLeagueModel.findOne({ _id: iMatchLeagueId }, { aPlayerRole: 0 }, { readPreference: 'primary' }).lean().cache(config.CACHE_1, `matchLeague:${iMatchLeagueId}`)
      if (!matchLeague) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })

      const iMatchId = matchLeague.iMatchId

      const isCached = await redisClient3.hmget(`hml:${iMatchId}:${iMatchLeagueId}`, 'exists', 'putTime', 'expireTime', 'matchId')
      let data = []

      if (Number(isCached[0]) && matchLeague?.eMatchStatus !== 'CMP') {
        const userData = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(req.params.id), iUserId: req.user._id }, { sType: 0, eType: 0, bSwapped: 0, bAfterMinJoin: 0 }).lean()

        const teamIds = []
        userData.forEach(s => {
          teamIds.push(s.iUserTeamId)
        })
        try {
          // const redisData = await redisClient3.evalsha('25cbc9222328bd9b741f0008caa48e6117cf215e', 1, `ml:${iMatchId}:${iMatchLeagueId}`, ...teamIds)
          const redisData = teamIds.length ? await getMyTeamsWithRankCalculationV2(matchLeague.iMatchId, req.params.id, teamIds) : []
          userData.forEach(s => {
            redisData.forEach(singleTeam => {
              if (s.iUserTeamId.toString() === singleTeam[0].toString()) {
                const obj = { ...s }
                obj.nTotalPoints = parseFloat(singleTeam[1])
                obj.nRank = singleTeam[2]
                data.push(obj)
              }
            })
          })
        } catch (error) {
          data = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(req.params.id), iUserId: req.user._id }, { sType: 0, eType: 0, bSwapped: 0, bAfterMinJoin: 0 }).sort({ nRank: 1 }).lean()
        }
      } else {
        data = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(req.params.id), iUserId: req.user._id }, { sType: 0, eType: 0, bSwapped: 0, bAfterMinJoin: 0 }).sort({ nRank: 1 }).lean()
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].leaderboard), data, nJoined: matchLeague.nJoined })
    } catch (error) {
      return catchError('LeaderBoard.userTeamList', error, req, res)
    }
  }

  async allTeamListV2(req, res) {
    try {
      const { nPutTime } = req.query
      const iMatchLeagueId = req.params.id
      let { nLimit, nOffset } = req.query

      const matchLeague = await MatchLeagueModel.findOne({ _id: iMatchLeagueId }, { aPlayerRole: 0 }).lean().cache(config.CACHE_2, `matchLeague:${iMatchLeagueId}`)
      if (!matchLeague) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })

      const iMatchId = matchLeague.iMatchId

      const isCached = await redisClient3.hmget(`hml:${iMatchId}:${iMatchLeagueId}`, 'exists', 'putTime', 'expireTime', 'matchId')

      let teams
      let bFullResponse = false
      let bCached = false

      if (Number(isCached[0]) && matchLeague?.eMatchStatus !== 'CMP') {
        bCached = !!Number(isCached[0])
        if (nPutTime && parseInt(isCached[1]) > parseInt(nPutTime)) {
          nLimit = parseInt(nOffset) + parseInt(nLimit)
          nOffset = 0
          bFullResponse = true
        }
        teams = await redisLeaderBoard(iMatchId, parseInt(nOffset), parseInt(nLimit), iMatchLeagueId)
        if (!teams.length) {
          nLimit = parseInt(nLimit) || 100
          nOffset = parseInt(nOffset) || 0
          teams = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(iMatchLeagueId), bCancelled: false }, { sType: 0, eType: 0, bSwapped: 0, bAfterMinJoin: 0 }).sort({ nRank: 1 }).skip(nOffset).limit(nLimit).lean()
        }
        teams.sort((a, b) => (a.nRank > b.nRank ? 1 : -1))
        teams = teams.map(team => { return { ...team, eType: undefined, sType: undefined } })
      } else {
        nLimit = parseInt(nLimit) || 100
        nOffset = parseInt(nOffset) || 0
        teams = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(iMatchLeagueId), bCancelled: false }, { sType: 0, eType: 0, bSwapped: 0, bAfterMinJoin: 0 }).sort({ nRank: 1 }).skip(nOffset).limit(nLimit).lean()
      }

      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].leaderboard),
        data: teams,
        bCached: bCached,
        nPutTime: isCached[1],
        bFullResponse: bFullResponse
      })
    } catch (error) {
      return catchError('LeaderBoard.allTeamList', error, req, res)
    }
  }

  async adminTeamList(req, res) {
    try {
      const { nPutTime } = req.query
      const iMatchLeagueId = req.params.id
      let { nLimit, nOffset } = req.query

      const matchLeague = await MatchLeagueModel.findOne({ _id: iMatchLeagueId }, { aPlayerRole: 0 }).lean().cache(config.CACHE_2, `matchLeague:${iMatchLeagueId}`)
      if (!matchLeague) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })

      const iMatchId = matchLeague.iMatchId

      const isCached = await redisClient3.hmget(`hml:${iMatchId}:${iMatchLeagueId}`, 'exists', 'putTime', 'expireTime', 'matchId')

      let teams
      let bFullResponse = false
      let bCached = false

      if (Number(isCached[0])) {
        bCached = !!Number(isCached[0])
        if (nPutTime && parseInt(isCached[1]) > parseInt(nPutTime)) {
          nLimit = parseInt(nOffset) + parseInt(nLimit)
          nOffset = 0
          bFullResponse = true
        }
        teams = await redisLeaderBoard(iMatchId, parseInt(nOffset), parseInt(nLimit), iMatchLeagueId)
        teams.sort((a, b) => (a.nRank > b.nRank ? 1 : -1))
        teams = teams.map(team => { return { ...team, eType: undefined, sType: undefined } })
      } else {
        nLimit = parseInt(nLimit) || 100
        nOffset = parseInt(nOffset) || 0
        teams = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(iMatchLeagueId) }, { sType: 0, eType: 0, bSwapped: 0, bAfterMinJoin: 0 }).sort({ nRank: 1 }).skip(nOffset).limit(nLimit).lean()
      }

      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].leaderboard),
        data: teams,
        bCached: bCached,
        nPutTime: isCached[1],
        bFullResponse: bFullResponse
      })
    } catch (error) {
      return catchError('LeaderBoard.adminTeamList', error, req, res)
    }
  }
}

async function redisLeaderBoard(iMatchId, start = 0, end = 10, iMatchLeagueId = null) {
  try {
    const data = await redisClient3.evalsha('5b9a4657e92b7ce3a7abe5cbb7441730454eda5e', 1, `ml:${iMatchId}:${iMatchLeagueId}`, start, start + end - 1)
    const userTeams = {}
    const finalData = []
    if (data.length > 0) {
      data.forEach(s => { userTeams[s[0]] = { nTotalPoints: parseFloat(s[1]), nRank: s[2] } })
      let ids = Object.keys(userTeams)
      ids = ids.map(s => ObjectId(s))

      const userData = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(iMatchLeagueId), iUserTeamId: { $in: ids }, bCancelled: false }, { __v: 0, bAfterMinJoin: 0 }, { readPreference: 'primary' }).lean()

      userData.forEach(s => {
        const obj = { ...s }
        obj.nTotalPoints = userTeams[s.iUserTeamId].nTotalPoints
        obj.nRank = userTeams[s.iUserTeamId].nRank
        finalData.push(obj)
      })
    }

    return finalData
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false }
  }
}

module.exports = new LeaderBoard()
