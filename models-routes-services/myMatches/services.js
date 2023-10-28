const MyMatchesModel = require('./model')
const UserLeagueModel = require('../userLeague/model')
const MatchLeagueModel = require('../matchLeague/model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError } = require('../../helper/utilities.services')
const { redisClient3 } = require('../../helper/redis')
const { getMyTeamsWithoutRankCalculation } = require('../leaderBoard/common')

class MyMatches {
  async myMatchesListV4(req, res) {
    try {
      const { sportsType, type, start = 0, limit = 50 } = req.query
      let eMatchStatus = type.toUpperCase()

      if (!['U', 'L', 'CMP'].includes(eMatchStatus)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].stype) })

      eMatchStatus = eMatchStatus === 'CMP' ? { $in: ['CMP', 'I', 'CNCL'] } : eMatchStatus

      let data = await MyMatchesModel.find({
        eMatchStatus,
        eCategory: sportsType.toUpperCase(),
        iUserId: req.user._id
        // $and: [{ aMatchLeagueId: { $exists: true } }, { 'aMatchLeagueId.0': { $exists: true } }]
      }, {
        nJoinedLeague: 1,
        nTeams: 1,
        nWinnings: 1,
        oMatch: 1,
        iMatchId: 1,
        aExtraWin: 1,
        nBonusWin: 1,
        _id: 0
      })
        .sort({ dUpdatedAt: -1 })
        .skip(Number(start))
        .limit(Number(limit))
        .populate('oMatch', [
          'sKey',
          'eFormat',
          'sName',
          'sSponsoredText',
          'sSeasonKey',
          'sVenue',
          'eStatus',
          'dStartDate',
          'oHomeTeam',
          'bScorecardShow',
          'sWinning',
          'oAwayTeam',
          'iTossWinnerId',
          'eTossWinnerAction',
          'bMatchOnTop',
          'eCategory',
          'sInfo',
          'sLeagueText',
          'sSeasonName',
          'nMaxTeamLimit',
          'iSeriesId',
          'bDisabled',
          'eProvider',
          'nPrizeCount',
          'bLineupsOut',
          'sFantasyPost',
          'sStreamUrl',
          'dUpdatedAt',
          'dCreatedAt'
        ]).lean()
      data = data.map((m) => {
        return { ...m, ...m.oMatch[0], oMatch: undefined }
      })
      if (eMatchStatus === 'L') {
        const aMatchIds = Array.isArray(data) && data.length ? data.map(({ _id }) => _id) : []
        const aMatchLeagues = await MatchLeagueModel.find({ iMatchId: { $in: aMatchIds }, bCancelled: false }, { nWinnersCount: 1, iMatchId: 1 }).lean()
        const aMatchLeaguePromises = []
        aMatchLeagues.forEach((league) => {
          aMatchLeaguePromises.push(redisClient3.hmget(`hml:${league.iMatchId}:${league._id}`, 'exists', 'putTime', 'expireTime', 'matchId'))
        })
        const redisMatchLeagueData = await Promise.all(aMatchLeaguePromises)

        const aMatchLeagueIds = aMatchLeagues.map(({ _id }) => _id)
        const allUserLeagues = await UserLeagueModel.find({ iMatchLeagueId: { $in: aMatchLeagueIds }, iUserId: req.user._id, bCancelled: false }, { bAfterMinJoin: 0 }).lean()

        try {
          for (let i = 0; i < aMatchLeagues.length; i++) {
            // const isCached = await redisClient3.hmget(`hml:${league.iMatchId}:${league._id}`, 'exists', 'putTime', 'expireTime', 'matchId')
            const isCached = redisMatchLeagueData[i]
            const matchIndex = data.findIndex(match => match._id.toString() === aMatchLeagues[i].iMatchId.toString())

            // To get all userLeagues of this matchLeague
            const userData = Array.isArray(allUserLeagues) && allUserLeagues.length
              ? allUserLeagues.filter(userLeague => userLeague.iMatchLeagueId.toString() === aMatchLeagues[i]._id.toString()) : []
            const teamIds = userData.map(s => s.iUserTeamId)

            if (Number(isCached[0])) {
              const redisData = teamIds.length ? await getMyTeamsWithoutRankCalculation(aMatchLeagues[i].iMatchId, aMatchLeagues[i]._id, teamIds) : []
              userData.forEach(s => {
                redisData.forEach(singleTeam => {
                  if (s.iUserTeamId.toString() === singleTeam[0].toString()) {
                    if (data.some(match => match._id.toString() === data[matchIndex]._id.toString() && match.bWinningZone)) {
                      data[matchIndex].bWinningZone = true
                    } else {
                      data[matchIndex].bWinningZone = aMatchLeagues[i].nWinnersCount >= singleTeam[2]
                    }
                  }
                })
              })
            } else {
              data[matchIndex].bWinningZone = false
            }
          }
        } catch (error) {
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmyMatch), data })
        }
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmyMatch), data })
    } catch (error) {
      return catchError('MyMatches.myMatchesListV4', error, req, res)
    }
  }
}

module.exports = new MyMatches()
