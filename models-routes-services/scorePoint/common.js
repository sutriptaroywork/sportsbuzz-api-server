const ScorePointModel = require('./model')
const MatchModel = require('../match/model')
const ApiLogModel = require('../apiLog/ApiLog.model')
const MyMatchesModel = require('../myMatches/model')
const MatchLeagueModel = require('../matchLeague/model')
const MatchPlayerModel = require('../matchPlayer/model')
const PlayerRoleModel = require('../playerRoles/model')
const MatchTeamsModel = require('../matchTeams/model')
const UserTeamModel = require('../userTeam/model')
const UserLeagueModel = require('../userLeague/model')
const { messages, status } = require('../../helper/api.responses')
const axios = require('axios')
const config = require('../../config/config')
const { bAllowDiskUse, CACHE_8 } = config
const { handleCatchError } = require('../../helper/utilities.services')
const { updateFullScorecard } = require('../scorecard/common')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const { redisClient, redisClient2 } = require('../../helper/redis')
const apiLogQueue = require('../../rabbitmq/queue/apiLogQueue')

/**
 * It'll fetch and calculate score points of soccer match according to our Fantasy point system from Entity Sports API.
 * @param {object} match match details object
 * @param {*} userLanguage English or Hindi(In future)
 * @returns It'll fetch and calculate score points of soccer match according to our Fantasy point system from Entity Sports API.
 */
async function soccerScorePointByEntitySport(match, userLanguage = 'English') {
  let response
  try {
  // Find Latest details of Match
    match = await MatchModel.findById(match._id).lean()
    try {
      response = await axios.get(`https://soccer.entitysport.com/matches/${match.sKey}/newfantasy`, { params: { token: config.ENTITYSPORT_SOCCER_API_KEY } })
    } catch (error) {
      const logData = { sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://soccer.entitysport.com/matches/${match.sKey}/newfantasy` }
      apiLogQueue.publish(logData)
      // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://soccer.entitysport.com/matches/${match.sKey}/newfantasy` })
      return { isSuccess: true, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }
    const logData = { sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: response.data.response.items, sUrl: `https://soccer.entitysport.com/matches/${match.sKey}/newfantasy` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: response.data.response.items, sUrl: `https://soccer.entitysport.com/matches/${match.sKey}/newfantasy` })
    const isScoresAvailable = response.data.response.items.match_info.status
    const bVerified = response.data.response.items.match_info.verified
    if (!['2', '3'].includes(isScoresAvailable.toString())) {
      return { isSuccess: false, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }

    const aScorePointsData = response.data.response.items.playerstats || {}
    const teamAScore = response.data.response.items.match_info.result.home || ''
    const teamBScore = response.data.response.items.match_info.result.away || ''
    const teamAScores = aScorePointsData.home || []
    const teamBScores = aScorePointsData.away || []
    const { eCategory, eFormat, oHomeTeam, oAwayTeam, _id } = match
    let allPlayers = await MatchPlayerModel.find({ iMatchId: match._id }).lean()
    allPlayers = allPlayers.map((player) => ({ ...player, nScoredPoints: 0 }))

    const matchFormat = await ScorePointModel.find({ eCategory, eFormat }).lean()
    const matchFormatData = {}
    matchFormat.forEach(({ sKey, nPoint }) => {
      matchFormatData[sKey] = { nPoint }
    })

    const liveData = [...teamAScores, ...teamBScores]
    const teamAName = oHomeTeam.sKey
    const teamBName = oAwayTeam.sKey

    if (liveData.length < 1 && Object.keys(matchFormatData).length < 1) {
      return { isSuccess: false, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }
    const playingElevenBonus = []
    const substituteBonus = []
    const pointBreakup = {}
    liveData.forEach(obj => {
      let totalPoint = 0
      if (!obj.pid) return
      obj.id = obj.pid.toString()
      const indx = allPlayers.findIndex(pl => pl.sKey === obj.id.toString())
      if (indx > -1) {
        const plr = allPlayers[indx]
        if (!pointBreakup[obj.id]) pointBreakup[obj.id] = {}
        // if (obj.minutesplayed) { // minutes played bonus
        // const pointsPlyingTime = obj.minutesplayed
        // let plyingTimePoints = 0

        // if (pointsPlyingTime >= 55 && matchFormatData.played_55_minutes_or_more_bonus) {
        //   plyingTimePoints = matchFormatData.played_55_minutes_or_more_bonus.nPoint
        //   pointBreakup[obj.id].played_55_minutes_or_more_bonus = plyingTimePoints
        // }
        // else if (pointsPlyingTime > 0 && pointsPlyingTime < 55 && matchFormatData.played_less_than_55_minutes_bonus) {
        //   plyingTimePoints = matchFormatData.played_less_than_55_minutes_bonus.nPoint
        //   pointBreakup[obj.id].played_less_than_55_minutes_bonus = plyingTimePoints
        // }

        // totalPoint += plyingTimePoints
        // }

        if (obj.goalscored) { // Goal scored bonus
          const g = obj.goalscored
          let goalPoints = 0
          switch (plr.eRole) {
            case 'FWD':
              goalPoints = matchFormatData.for_every_goal_scored_forward_bonus ? matchFormatData.for_every_goal_scored_forward_bonus.nPoint : goalPoints
              pointBreakup[obj.id].for_every_goal_scored_forward_bonus = goalPoints * g
              break
            case 'MID':
              goalPoints = matchFormatData.for_every_goal_scored_midfielder_bonus ? matchFormatData.for_every_goal_scored_midfielder_bonus.nPoint : goalPoints
              pointBreakup[obj.id].for_every_goal_scored_midfielder_bonus = goalPoints * g
              break
            case 'DEF':
              goalPoints = matchFormatData.for_every_goal_scored_defender_bonus ? matchFormatData.for_every_goal_scored_defender_bonus.nPoint : goalPoints
              pointBreakup[obj.id].for_every_goal_scored_defender_bonus = goalPoints * g
              break
            case 'GK':
              goalPoints = matchFormatData.for_every_goal_scored_gk_bonus ? matchFormatData.for_every_goal_scored_gk_bonus.nPoint : goalPoints
              pointBreakup[obj.id].for_every_goal_scored_gk_bonus = goalPoints * g
              break
          }
          totalPoint += goalPoints * g
        }

        if (obj.assist && matchFormatData.for_every_assist_bonus) { // assist bonus
          totalPoint += obj.assist * matchFormatData.for_every_assist_bonus.nPoint
          pointBreakup[obj.id].for_every_assist_bonus = obj.assist * matchFormatData.for_every_assist_bonus.nPoint
        }

        if (matchFormatData.for_every_5_passes_completed_bonus && obj.passes >= 5) { // for every 5 passes completed
          const points = Math.floor(obj.passes / 5) * matchFormatData.for_every_5_passes_completed_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].for_every_5_passes_completed_bonus = points
        }

        if (obj.shotsontarget && matchFormatData.for_every_1_shots_on_target_bonus) { // for every 1 shots on target
          const points = Math.floor(obj.shotsontarget / 1) * matchFormatData.for_every_1_shots_on_target_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].for_every_1_shots_on_target_bonus = points
        }

        if (obj.shotssaved && plr.eRole === 'GK' && matchFormatData.for_every_shots_saved_gk_bonus) {
          const points = obj.shotssaved * matchFormatData.for_every_shots_saved_gk_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].for_every_shots_saved_gk_bonus = points
        }

        if (obj.penaltysaved && plr.eRole === 'GK' && matchFormatData.for_every_penalty_saved_gk_bonus) {
          const points = obj.penaltysaved * matchFormatData.for_every_penalty_saved_gk_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].for_every_penalty_saved_gk_bonus = points
        }

        if (obj.penaltymissed && matchFormatData.for_every_penalty_saved_gk_bonus) {
          const points = obj.penaltymissed * matchFormatData.for_every_penalty_missed_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].for_every_penalty_missed_bonus = points
        }

        if (obj.tacklesuccessful && matchFormatData.for_every_1_successful_tackles_made_bonus) {
          const points = Math.floor(obj.tacklesuccessful / 1) * matchFormatData.for_every_1_successful_tackles_made_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].for_every_1_successful_tackles_made_bonus = points
        }

        if (obj.yellowcard && matchFormatData.yellow_card_bonus) {
          const points = matchFormatData.yellow_card_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].yellow_card_bonus = points
        }

        if (obj.redcard && matchFormatData.red_card_bonus) {
          const points = matchFormatData.red_card_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].red_card_bonus = points
        }

        if (obj.owngoal && matchFormatData.for_every_own_goal_bonus) {
          const points = obj.owngoal * matchFormatData.for_every_own_goal_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].for_every_own_goal_bonus = points
        }

        // Interception Won
        if (obj.interceptionwon && matchFormatData.interception_won_bonus) {
          const points = obj.interceptionwon * matchFormatData.interception_won_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].interception_won_bonus = points
        }

        // Chance Created
        if (obj.chancecreated && matchFormatData.chance_created_bonus) {
          const points = obj.chancecreated * matchFormatData.chance_created_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].chance_created_bonus = points
        }

        if (obj.goalsconceded) {
          let goalConcdPOints = 0

          if (plr.eRole === 'DEF' && matchFormatData.for_every_goal_conceded_defender_bonus) {
            const points = obj.goalsconceded * matchFormatData.for_every_goal_conceded_defender_bonus.nPoint
            goalConcdPOints = points
            pointBreakup[obj.id].for_every_goal_conceded_defender_bonus = points
          }

          if (plr.eRole === 'GK' && matchFormatData.for_every_goal_conceded_gk_bonus) {
            const points = obj.goalsconceded * matchFormatData.for_every_goal_conceded_gk_bonus.nPoint
            goalConcdPOints = points
            pointBreakup[obj.id].for_every_goal_conceded_gk_bonus = points
          }
          totalPoint += goalConcdPOints
        }
        // clean sheet pending

        // if ((teamAName === plr.sTeamKey && parseInt(teamBScore) === 0) || (teamBName === plr.sTeamKey && parseInt(teamAScore) === 0)) {
        if (obj.cleansheet && obj.minutesplayed && obj.minutesplayed > 54) {
          let cleanPoint = 0
          // Removed as per Ops team requirement
          // if (plr.eRole === 'MID' && matchFormatData.clean_sheet_midfielder_bonus) {
          //   const points = matchFormatData.clean_sheet_midfielder_bonus.nPoint
          //   cleanPoint = points
          //   pointBreakup[obj.id].clean_sheet_midfielder_bonus = points
          // } else
          if (plr.eRole === 'DEF' && matchFormatData.clean_sheet_defender_bonus) {
            const points = matchFormatData.clean_sheet_defender_bonus.nPoint
            cleanPoint = points
            pointBreakup[obj.id].clean_sheet_defender_bonus = points
          } else if (plr.eRole === 'GK' && matchFormatData.clean_sheet_gk_bonus) {
            const points = matchFormatData.clean_sheet_gk_bonus.nPoint
            cleanPoint = points
            pointBreakup[obj.id].clean_sheet_gk_bonus = points
          }
          totalPoint += cleanPoint
        }
        // }
        allPlayers.forEach(async playerObj => {
          if (playerObj.sKey.toString() === obj.id.toString()) {
            if (!playerObj.bShow && !playerObj.bSubstitute) {
              await MatchPlayerModel.updateOne({ _id: playerObj._id }, { bSubstitute: true })
              playerObj.bSubstitute = true
            }
            playerObj.nScoredPoints = playerObj.nScoredPoints + totalPoint
          }
        })
      }
    })

    allPlayers.forEach(playerObj => {
      if (matchFormatData.playing_eleven_bonus && playerObj.bShow === true && !playingElevenBonus.includes(playerObj._id)) {
        playingElevenBonus.push(playerObj._id)
        const key = playerObj.sKey
        if (!pointBreakup[key]) pointBreakup[key] = {}
        playerObj.nScoredPoints += matchFormatData.playing_eleven_bonus.nPoint
        pointBreakup[key].playing_eleven_bonus = matchFormatData.playing_eleven_bonus.nPoint
        // pointBreakup[key].nScoredPoints = playerObj.nScoredPoints
        pointBreakup[key].nScoredPoints = Object.values(pointBreakup[key]).reduce((a, b) => a + b)
        pointBreakup[key]._id = playerObj._id
      }

      // Substitute Player Point
      if (matchFormatData.substitute_bonus && playerObj.bSubstitute && !substituteBonus.includes(playerObj._id.toString())) {
        substituteBonus.push(playerObj._id.toString())
        const key = playerObj.sKey
        if (!pointBreakup[key]) pointBreakup[key] = {}
        playerObj.nScoredPoints += matchFormatData.substitute_bonus.nPoint
        pointBreakup[key].substitute_bonus = matchFormatData.substitute_bonus.nPoint
      }
    })

    for (const matchPlayer of allPlayers) {
      const { _id, nScoredPoints, aPointBreakup, sKey } = matchPlayer
      const point = aPointBreakup.map((p) => {
        if (pointBreakup[sKey] && (typeof pointBreakup[sKey][p.sKey]) === 'number') {
          return ({
            ...p,
            nScoredPoints: pointBreakup[sKey][p.sKey]
          })
        }

        return { ...p, nScoredPoints: 0 }
      })

      await MatchPlayerModel.updateOne({ _id: ObjectId(_id) }, { nScoredPoints, aPointBreakup: point, dUpdatedAt: Date.now() })
    }
    let winning = ''
    const eStatus = (isScoresAvailable.toString() === '2' && bVerified.toString() === 'true') ? 'I' : undefined
    if (eStatus && eStatus === 'I' && response.data.response.items.match_info.result.winner) {
      if (response.data.response.items.match_info.result.winner === 'home') {
        winning = `${oHomeTeam.sName} won the match!`
      } else if (response.data.response.items.match_info.result.winner === 'away') {
        winning = `${oAwayTeam.sName} won the match!`
      }
    }
    if (eStatus && eStatus === 'I') {
      await redisClient.del(`${_id.toString()}`)
      MyMatchesModel.updateMany({ iMatchId: ObjectId(_id) }, { $set: { eMatchStatus: 'I' } }).exec()
      MatchLeagueModel.updateMany({ iMatchId: ObjectId(_id) }, { $set: { eMatchStatus: 'I' } }).exec()
    }
    await MatchModel.updateOne({ _id: ObjectId(_id) }, { sWinning: winning, eStatus, 'oHomeTeam.nScore': teamAScore, 'oAwayTeam.nScore': teamBScore, dUpdatedAt: Date.now() })
    return { isSuccess: true }
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false, status: status.InternalServerError, message: messages[userLanguage].error, data: {} }
  }
}

/**
 * It'll fetch and calculate score points of soccer match according to our Fantasy point system from Sports Radar API.
 * @param {object} match match details object
 * @param {*} userLanguage English or Hindi(In future)
 * @returns It'll fetch and calculate score points of soccer match according to our Fantasy point system from Sports Radar API.
 */
async function soccerScorePointBySportsRadar(match, userLanguage = 'English') {
  try {
  // Find Latest details of Match
    match = await MatchModel.findById(match._id).lean()
    const { eCategory, eFormat } = match
    let response
    try {
      response = await axios.get(`https://api.sportradar.com/soccer-extended/production/v4/en/sport_events/${match.sKey}/timeline.json`, { params: { api_key: config.FOOTBALL_API_KEY } })
    } catch (error) {
      const logData = { sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://api.sportradar.com/soccer-extended/production/v4/en/sport_events/${match.sKey}/timeline.json` }
      apiLogQueue.publish(logData)
      // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://api.sportradar.com/soccer-extended/production/v4/en/sport_events/${match.sKey}/timeline.json` })
      return { isSuccess: false, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }
    if (response.data.sport_event_status.status === 'not_started') {
      return { isSuccess: false, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }
    const logData = { sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: response.data, sUrl: `https://api.sportradar.com/soccer-extended/production/v4/en/sport_events/${match.sKey}/timeline.json` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: response.data, sUrl: `https://api.sportradar.com/soccer-extended/production/v4/en/sport_events/${match.sKey}/timeline.json` })

    const allPlayers = await MatchPlayerModel.find({ iMatchId: match._id, bShow: true }).lean()

    const matchFormat = await ScorePointModel.find({ eCategory, eFormat }).lean()
    const matchFormatData = {}
    matchFormat.forEach(({ sKey, nPoint }) => {
      matchFormatData[sKey] = { nPoint }
    })

    if (!response.data.statistics) response.data.statistics = {}
    if (!response.data.statistics.totals.competitors[0].players) response.data.statistics.totals.competitors[0].players = []
    if (!response.data.statistics.totals.competitors[1].players) response.data.statistics.totals.competitors[1].players = []

    const liveData = [...response.data.statistics.totals.competitors[0].players, ...response.data.statistics.totals.competitors[1].players]

    const teamAName = match.oHomeTeam.sKey
    const teamBName = match.oAwayTeam.sKey

    if (!response.data.sport_event_status.period_scores[0]) response.data.sport_event_status.period_scores[0] = { home_score: 0, away_score: 0 }
    if (!response.data.sport_event_status.period_scores[1]) response.data.sport_event_status.period_scores[1] = { home_score: 0, away_score: 0 }

    const teamAScore = response.data.sport_event_status.home_score || 0
    const teamBScore = response.data.sport_event_status.away_score || 0

    if (liveData.length < 1 && Object.keys(matchFormatData).length < 1) {
      return { isSuccess: false, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }
    const playingElevenBonus = []
    const pointBreakup = {}
    liveData.forEach(obj => {
      let totalPoint = 0

      const indx = allPlayers.findIndex(pl => pl.sKey === obj.id)
      if (indx > -1) {
        const plr = allPlayers[indx]
        if (!pointBreakup[obj.id]) pointBreakup[obj.id] = {}
        if (obj.statistics.minutes_played) { // minutes played bonus
          let pointsPlyingTime = obj.statistics.minutes_played
          if (pointsPlyingTime >= 55 && matchFormatData.played_55_minutes_or_more_bonus) {
            pointsPlyingTime = matchFormatData.played_55_minutes_or_more_bonus.nPoint
            pointBreakup[obj.id].played_55_minutes_or_more_bonus = pointsPlyingTime
          } else if (pointsPlyingTime > 0 && pointsPlyingTime < 55 && matchFormatData.played_less_than_55_minutes_bonus) {
            pointsPlyingTime = matchFormatData.played_less_than_55_minutes_bonus.nPoint
            pointBreakup[obj.id].played_less_than_55_minutes_bonus = pointsPlyingTime
          }
          totalPoint += pointsPlyingTime
        }

        if (obj.statistics.goals_scored) { // Goal scored bonus
          const g = obj.statistics.goals_scored
          let goalPoints = 0
          switch (plr.eRole) {
            case 'FWD':
              goalPoints = matchFormatData.for_every_goal_scored_forward_bonus ? matchFormatData.for_every_goal_scored_forward_bonus.nPoint : goalPoints
              pointBreakup[obj.id].for_every_goal_scored_forward_bonus = goalPoints * g
              break
            case 'MID':
              goalPoints = matchFormatData.for_every_goal_scored_midfielder_bonus ? matchFormatData.for_every_goal_scored_midfielder_bonus.nPoint : goalPoints
              pointBreakup[obj.id].for_every_goal_scored_midfielder_bonus = goalPoints * g
              break
            case 'DEF':
              goalPoints = matchFormatData.for_every_goal_scored_defender_bonus ? matchFormatData.for_every_goal_scored_defender_bonus.nPoint : goalPoints
              pointBreakup[obj.id].for_every_goal_scored_defender_bonus = goalPoints * g
              break
            case 'GK':
              goalPoints = matchFormatData.for_every_goal_scored_gk_bonus ? matchFormatData.for_every_goal_scored_gk_bonus.nPoint : goalPoints
              pointBreakup[obj.id].for_every_goal_scored_gk_bonus = goalPoints * g
              break
          }
          totalPoint += goalPoints * g
        }

        if (obj.statistics.assists && matchFormatData.for_every_assist_bonus) { // assist bonus
          totalPoint += obj.statistics.assists * matchFormatData.for_every_assist_bonus.nPoint
          pointBreakup[obj.id].for_every_assist_bonus = obj.statistics.assists * matchFormatData.for_every_assist_bonus.nPoint
        }

        if (matchFormatData.for_every_5_passes_completed_bonus && obj.statistics.passes_successful >= 5) { // for every 5 passes completed
          const points = Math.floor(obj.statistics.passes_successful / 5) * matchFormatData.for_every_5_passes_completed_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].for_every_5_passes_completed_bonus = points
        }

        if (obj.statistics.shots_on_target && matchFormatData.for_every_1_shots_on_target_bonus) { // for every 1 shots on target
          const points = Math.floor(obj.statistics.shots_on_target / 1) * matchFormatData.for_every_1_shots_on_target_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].for_every_1_shots_on_target_bonus = points
        }

        if (obj.statistics.shots_faced_saved && plr.eRole === 'GK' && matchFormatData.for_every_3_shots_saved_gk_bonus) {
          const points = Math.floor(obj.statistics.shots_faced_saved / 3) * matchFormatData.for_every_3_shots_saved_gk_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].for_every_3_shots_saved_gk_bonus = points
        }

        if (obj.statistics.penalties_saved && plr.eRole === 'GK' && matchFormatData.for_every_penalty_saved_gk_bonus) {
          const points = obj.statistics.penalties_saved * matchFormatData.for_every_penalty_saved_gk_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].for_every_penalty_saved_gk_bonus = points
        }

        if (obj.statistics.penalties_missed && matchFormatData.for_every_penalty_saved_gk_bonus) {
          const points = obj.statistics.penalties_missed * matchFormatData.for_every_penalty_missed_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].for_every_penalty_missed_bonus = points
        }

        if (obj.statistics.tackles_successful && matchFormatData.for_every_1_successful_tackles_made_bonus) {
          const points = Math.floor(obj.statistics.tackles_successful / 1) * matchFormatData.for_every_1_successful_tackles_made_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].for_every_1_successful_tackles_made_bonus = points
        }

        // query ??
        if (obj.statistics.yellow_cards && matchFormatData.yellow_card_bonus) {
          const points = matchFormatData.yellow_card_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].yellow_card_bonus = points
        }

        if (obj.statistics.yellow_red_cards && matchFormatData.red_card_bonus) {
          const points = matchFormatData.red_card_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].yellow_card_bonus = points
        }

        if (obj.statistics.own_goals && matchFormatData.for_every_own_goal_bonus) {
          const points = obj.statistics.own_goals * matchFormatData.for_every_own_goal_bonus.nPoint
          totalPoint += points
          pointBreakup[obj.id].for_every_own_goal_bonus = points
        }

        if (obj.statistics.goals_conceded) {
          let goalConcdPOints = 0

          if (plr.eRole === 'DEF' && matchFormatData.for_every_2_goal_conceded_defender_bonus) {
            const points = Math.floor(obj.statistics.goals_conceded / 2) * matchFormatData.for_every_2_goal_conceded_defender_bonus.nPoint
            goalConcdPOints = points
            pointBreakup[obj.id].for_every_2_goal_conceded_defender_bonus = points
          }

          if (plr.eRole === 'GK' && matchFormatData.for_every_2_goal_conceded_gk_bonus) {
            const points = Math.floor(obj.statistics.goals_conceded / 2) * matchFormatData.for_every_2_goal_conceded_gk_bonus.nPoint
            goalConcdPOints = points
            pointBreakup[obj.id].for_every_2_goal_conceded_gk_bonus = points
          }
          totalPoint += goalConcdPOints
        }
        // clean sheet pending

        if ((teamAName === plr.sTeamKey && parseInt(teamBScore) === 0) || (teamBName === plr.sTeamKey && parseInt(teamAScore) === 0)) {
          if (obj.clean_sheets) {
            let cleanPoint = 0
            // Removed as per Ops team requirement
            // if (plr.eRole === 'MID' && matchFormatData.clean_sheet_midfielder_bonus) {
            //   const points = matchFormatData.clean_sheet_midfielder_bonus.nPoint
            //   cleanPoint = points
            //   pointBreakup[obj.id].clean_sheet_midfielder_bonus = points
            // } else
            if (plr.eRole === 'DEF' && matchFormatData.clean_sheet_defender_bonus) {
              const points = matchFormatData.clean_sheet_defender_bonus.nPoint
              cleanPoint = points
              pointBreakup[obj.id].clean_sheet_defender_bonus = points
            } else if (plr.eRole === 'GK' && matchFormatData.clean_sheet_gk_bonus) {
              const points = matchFormatData.clean_sheet_gk_bonus.nPoint
              cleanPoint = points
              pointBreakup[obj.id].clean_sheet_gk_bonus = points
            }
            totalPoint += cleanPoint
          }
        }
        allPlayers.forEach(playerObj => {
          if (playerObj.sKey === obj.id) {
            playerObj.nScoredPoints = totalPoint
          }
        })
      }
    }) // end for each for liveData

    allPlayers.forEach(playerObj => {
      if (matchFormatData.playing_eleven_bonus && playerObj.bShow === true && !playingElevenBonus.includes(playerObj._id)) {
        playingElevenBonus.push(playerObj._id)
        const key = playerObj.sKey
        if (!pointBreakup[key]) pointBreakup[key] = {}
        playerObj.nScoredPoints += matchFormatData.playing_eleven_bonus.nPoint
        pointBreakup[key].playing_eleven_bonus = matchFormatData.playing_eleven_bonus.nPoint
        pointBreakup[key].nScoredPoints = playerObj.nScoredPoints
        pointBreakup[key]._id = playerObj._id
      }
    })

    for (const matchPlayer of allPlayers) {
      const { _id, nScoredPoints, aPointBreakup, sKey } = matchPlayer
      const point = aPointBreakup.map((p) => {
        if (pointBreakup[sKey] && (typeof pointBreakup[sKey][p.sKey]) === 'number') {
          return ({
            ...p,
            nScoredPoints: pointBreakup[sKey][p.sKey]
          })
        }
        return { ...p, nScoredPoints: 0 }
      })
      await MatchPlayerModel.updateOne({ _id: ObjectId(_id) }, { nScoredPoints, aPointBreakup: point, dUpdatedAt: Date.now() })
    }
    let winning = ''
    const eStatus = response.data.sport_event_status.status === 'ended' ? 'I' : undefined

    if (eStatus && eStatus === 'I' && response.data.sport_event_status.winner_id) {
      response.data.sport_event.competitors.map(s => {
        if (s.id === response.data.sport_event_status.winner_id) {
          winning = `${s.name} won the match!`
        }
      })
    }
    if (eStatus && eStatus === 'I') {
      await redisClient.del(`${match._id.toString()}`)
      MyMatchesModel.updateMany({ iMatchId: ObjectId(match._id) }, { $set: { eMatchStatus: 'I' } }).exec()
      MatchLeagueModel.updateMany({ iMatchId: ObjectId(match._id) }, { $set: { eMatchStatus: 'I' } }).exec()
    }
    await MatchModel.updateOne({ _id: ObjectId(match._id) }, { sWinning: winning, eStatus, 'oHomeTeam.nScore': teamAScore, 'oAwayTeam.nScore': teamBScore, dUpdatedAt: Date.now() })
    return { isSuccess: true }
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false, status: status.InternalServerError, message: messages[userLanguage].error, data: {} }
  }
}

/**
 * It'll fetch and calculate score points of cricket match according to our Fantasy point system from Entity Sports API.
 * @param {object} match match details object
 * @param {*} userLanguage English or Hindi(In future)
 * @returns It'll fetch and calculate score points of cricket match according to our Fantasy point system from Entity Sports API.
 */
async function cricketScorePointByEntitySport(match, userLanguage = 'English') {
  try {
    // Find Latest details of Match
    match = await MatchModel.findById(match._id).lean()
    const { eCategory, eFormat, oHomeTeam, oAwayTeam, eStatus: eOldMatchStatus } = match
    let response
    try {
      response = await axios.get(`https://rest.entitysport.com/v2/matches/${match.sKey}/scorecard`,
        {
          params: {
            token: config.ENTITYSPORT_CRICKET_API_KEY
          }
        })
    } catch (error) {
      const logData = { sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://rest.entitysport.com/v2/matches/${match.sKey}/scorecard` }
      apiLogQueue.publish(logData)
      // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://rest.entitysport.com/v2/matches/${match.sKey}/scorecard` })
      return { isSuccess: true, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }
    const logData = { sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: response.data.response, sUrl: `https://rest.entitysport.com/v2/matches/${match.sKey}/scorecard` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: response.data.response, sUrl: `https://rest.entitysport.com/v2/matches/${match.sKey}/scorecard` })
    const data = response.data.response

    if (!data) return { isSuccess: false, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }

    const { teama, teamb, result: matchResult } = data

    if (data.status.toString() === '1') {
      return { isSuccess: false, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }
    const { innings = [], toss = {} } = data

    let eTossWinnerAction
    let tossWinnerTeam
    if (toss) {
      const { winner = '', decision = '' } = toss
      tossWinnerTeam = oHomeTeam.sKey === winner.toString() ? oHomeTeam : oAwayTeam.sKey === winner.toString() ? oAwayTeam : {}
      eTossWinnerAction = decision.toString() === '2' ? 'BOWLING' : 'BAT'
    }

    const { scores_full: fullScoreHome, scores: scoresHome, overs: oversHome } = teama
    const { scores_full: fullScoreAway, scores: scoresAway, overs: oversAway } = teamb
    const oHomeTeamScore = fullScoreHome ? fullScoreHome.replaceAll(' ov', '') : ((scoresHome && oversHome) ? `${scoresHome} (${oversHome})` : '')
    const oAwayTeamScore = fullScoreAway ? fullScoreAway.replaceAll(' ov', '') : (((scoresAway && oversAway) ? `${scoresAway} (${oversAway})` : ''))

    const playerDetails = []
    // Pushing latest details of player (Coming from Entity)
    innings.map((inning) => {
      if (inning.batsmen) {
        const players = inning.batsmen
        players.map((player) => playerDetails.push(player))
      }
      if (inning.bowlers) {
        const players = inning.bowlers
        players.map((player) => playerDetails.push(player))
      }
      if (inning.fielder) {
        const players = inning.fielder
        players.map((player) => playerDetails.push(player))
      }
    })

    // Fetching players from DB
    const players = await MatchPlayerModel.find({ iMatchId: match._id }).lean()

    const matchPlayers = players.map((player) => ({ ...player, nScoredPoints: 0 }))

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
    } else {
      return { isSuccess: false, status: status.NotFound, message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].cmatchFormat), data: {} }
    }

    // Fetching score points based on SPORT and FORMAT
    const matchFormat = await ScorePointModel.find({ eCategory, eFormat: setFormat }).lean()

    const breakupDesign = {}
    // const initBreakup = {}
    matchFormat.forEach(({ sKey, bMulti, aPoint, nPoint }) => {
      breakupDesign[sKey] = bMulti ? { aPoint } : { nPoint }
      // initBreakup[sKey] = 0
    })

    const pointBreakup = {}

    // Point calculation for players based on their action (playerDetails-Entity)
    const processedPlayer = []
    playerDetails.forEach((player) => {
      let totalPoint = 0
      let bStrikeRateBonus
      let bEconomyBonus

      const { batsman_id: batsmanId, bowler_id: bowlerId, fielder_id: fielderId, runs, strike_rate: strikeRate, balls_faced: ballsFaced, fours, sixes, wickets, maidens, econ: economyRate, overs: oversBowled, catches, stumping, runout_thrower: runoutThrower, runout_direct_hit: runoutDirect, runout_catcher: runoutCatcher, dismissal, bowledcount, lbwcount } = player
      const id = (batsmanId) || ((bowlerId) || (fielderId) || null)

      // if (!pointBreakup[id]) pointBreakup[id] = { ...initBreakup }
      if (!pointBreakup[id]) pointBreakup[id] = {}

      let fieldPoint = 0

      // catches, stump, runout and caughtOut
      if (catches) {
        if (catches > 0) {
          const { nPoint } = breakupDesign.catches_bonus
          const rp = breakupDesign.catches_bonus ? nPoint : 0
          fieldPoint += catches * rp
          if (pointBreakup[id].catches_bonus) {
            pointBreakup[id].catches_bonus += catches * rp
          } else {
            pointBreakup[id].catches_bonus = catches * rp
          }
        }
        if (catches >= 3 && breakupDesign['3_catches_bonus']) {
          const { nPoint } = breakupDesign['3_catches_bonus']
          const rp = breakupDesign['3_catches_bonus'] ? nPoint : 0
          fieldPoint += rp * Math.floor((catches / 3))
          if (pointBreakup[id]['3_catches_bonus']) {
            pointBreakup[id]['3_catches_bonus'] += rp * Math.floor((catches / 3))
          } else {
            pointBreakup[id]['3_catches_bonus'] = rp * Math.floor((catches / 3))
          }
        }
      }

      if (stumping) {
        if (stumping > 0) {
          const { nPoint } = breakupDesign.stump_bonus
          const rp = breakupDesign.stump_bonus ? nPoint : 0
          fieldPoint += stumping * rp
          if (pointBreakup[id].stump_bonus) {
            pointBreakup[id].stump_bonus += stumping * rp
          } else {
            pointBreakup[id].stump_bonus = stumping * rp
          }
        }
      }

      // direct hit runout
      if (runoutDirect) {
        if (runoutDirect > 0) {
          const { nPoint } = breakupDesign.runout_bonus
          const rp = breakupDesign.runout_bonus ? nPoint : 0
          fieldPoint += runoutDirect * rp
          if (pointBreakup[id].runout_bonus) {
            pointBreakup[id].runout_bonus += runoutDirect * rp
          } else {
            pointBreakup[id].runout_bonus = runoutDirect * rp
          }
        }
      }

      // if not direct hit than runoutCatcher and runoutThrower both get point
      if ((runoutThrower || runoutCatcher) && (runoutThrower > 0 || runoutCatcher > 0) && breakupDesign.runout_thrower_bonus) {
        const { nPoint } = breakupDesign.runout_thrower_bonus
        const rp = breakupDesign.runout_thrower_bonus ? nPoint : 0
        fieldPoint += (parseInt(runoutThrower) + parseInt(runoutCatcher)) * rp
        if (pointBreakup[id].runout_thrower_bonus) {
          pointBreakup[id].runout_thrower_bonus += (parseInt(runoutThrower) + parseInt(runoutCatcher)) * rp
        } else {
          pointBreakup[id].runout_thrower_bonus = (parseInt(runoutThrower) + parseInt(runoutCatcher)) * rp
        }
      }

      totalPoint += fieldPoint

      if (runs) {
        if (runs > 0) {
          // century, half century and thirty runs
          if ((runs >= 100) && breakupDesign.century_bonus) {
            const { nPoint } = breakupDesign.century_bonus
            totalPoint += nPoint
            if (pointBreakup[id].century_bonus) {
              pointBreakup[id].century_bonus += nPoint
            } else {
              pointBreakup[id].century_bonus = nPoint
            }
          } else if ((runs >= 50) && breakupDesign.half_century_bonus) {
            const { nPoint } = breakupDesign.half_century_bonus
            totalPoint += nPoint
            if (pointBreakup[id].half_century_bonus) {
              pointBreakup[id].half_century_bonus += nPoint
            } else {
              pointBreakup[id].half_century_bonus = nPoint
            }
          } else if ((runs >= 30) && breakupDesign['30_run_bonus']) {
            const { nPoint } = breakupDesign['30_run_bonus']
            totalPoint += nPoint
            if (pointBreakup[id]['30_run_bonus']) {
              pointBreakup[id]['30_run_bonus'] += nPoint
            } else {
              pointBreakup[id]['30_run_bonus'] = nPoint
            }
          }

          // per run point
          const { nPoint } = breakupDesign.run_score_bonus
          const rp = breakupDesign.run_score_bonus ? nPoint : 0
          totalPoint += runs * rp
          if (pointBreakup[id].run_score_bonus) {
            pointBreakup[id].run_score_bonus += runs * rp
          } else {
            pointBreakup[id].run_score_bonus = runs * rp
          }

          // boundary hit point
          if (fours) {
            const { nPoint } = breakupDesign.boundary_hit_bonus
            const bp = breakupDesign.boundary_hit_bonus ? nPoint : 0
            totalPoint += fours * bp
            if (pointBreakup[id].boundary_hit_bonus) {
              pointBreakup[id].boundary_hit_bonus += fours * bp
            } else {
              pointBreakup[id].boundary_hit_bonus = fours * bp
            }
          }

          // sixes hit point
          if (sixes) {
            const { nPoint } = breakupDesign.six_hit_bonus
            const sp = breakupDesign.six_hit_bonus ? nPoint : 0
            totalPoint += sixes * sp
            if (pointBreakup[id].six_hit_bonus) {
              pointBreakup[id].six_hit_bonus += sixes * sp
            } else {
              pointBreakup[id].six_hit_bonus = sixes * sp
            }
          }
        }
      }

      if (wickets) {
        if ((wickets >= 5) && breakupDesign['5_wicket_bonus']) { // five wicket bonus
          const { nPoint } = breakupDesign['5_wicket_bonus']
          totalPoint += nPoint
          if (pointBreakup[id]['5_wicket_bonus']) {
            pointBreakup[id]['5_wicket_bonus'] += nPoint
          } else {
            pointBreakup[id]['5_wicket_bonus'] = nPoint
          }
        } else if ((wickets >= 4) && breakupDesign['4_wicket_bonus']) { // four wicket bonus
          const { nPoint } = breakupDesign['4_wicket_bonus']
          totalPoint += nPoint
          if (pointBreakup[id]['4_wicket_bonus']) {
            pointBreakup[id]['4_wicket_bonus'] += nPoint
          } else {
            pointBreakup[id]['4_wicket_bonus'] = nPoint
          }
        } else if ((wickets >= 3) && breakupDesign['3_wicket_bonus']) { // three wicket bonus
          const { nPoint } = breakupDesign['3_wicket_bonus']
          totalPoint += nPoint
          if (pointBreakup[id]['3_wicket_bonus']) {
            pointBreakup[id]['3_wicket_bonus'] += nPoint
          } else {
            pointBreakup[id]['3_wicket_bonus'] = nPoint
          }
        } else if ((wickets >= 2) && breakupDesign['2_wicket_bonus']) { // two wicket bonus
          const { nPoint } = breakupDesign['2_wicket_bonus']
          totalPoint += nPoint
          if (pointBreakup[id]['2_wicket_bonus']) {
            pointBreakup[id]['2_wicket_bonus'] += nPoint
          } else {
            pointBreakup[id]['2_wicket_bonus'] = nPoint
          }
        }

        // per wicket point
        const { nPoint } = breakupDesign.wicket_bonus
        const wp = ((wickets > 0) && breakupDesign.wicket_bonus) ? nPoint : 0
        totalPoint += wickets * wp
        if (pointBreakup[id].wicket_bonus) {
          pointBreakup[id].wicket_bonus += wickets * wp
        } else {
          pointBreakup[id].wicket_bonus = wickets * wp
        }
      }

      if (maidens && breakupDesign.maiden_bonus) { // maiden-bonus
        const { nPoint } = breakupDesign.maiden_bonus
        totalPoint += maidens * nPoint
        if (pointBreakup[id].maiden_bonus) {
          pointBreakup[id].maiden_bonus += maidens * nPoint
        } else {
          pointBreakup[id].maiden_bonus = maidens * nPoint
        }
      }

      if (economyRate && oversBowled && breakupDesign.economy_bonus) { // economy-bonus
        let ep = 0
        const { aPoint } = breakupDesign.economy_bonus
        aPoint.map(({ nRangeFrom, nRangeTo, nMinValue, nBonus }) => {
          if ((nRangeFrom <= economyRate) && (nRangeTo >= economyRate) && (nMinValue <= oversBowled)) {
            ep = nBonus
          }
        })
        totalPoint += ep
        if (pointBreakup[id].economy_bonus) {
          pointBreakup[id].economy_bonus += ep
        } else {
          pointBreakup[id].economy_bonus = ep
        }
        bEconomyBonus = true
      }

      // bowled and lbw bonus
      if ((bowledcount || lbwcount) && (bowledcount > 0 || lbwcount > 0) && breakupDesign.bowled_lbw_bonus) {
        const { nPoint } = breakupDesign?.bowled_lbw_bonus
        const nTotalCount = Number(bowledcount) + Number(lbwcount)
        totalPoint += nPoint * nTotalCount
        if (pointBreakup[id].bowled_lbw_bonus) {
          pointBreakup[id].bowled_lbw_bonus += nPoint * nTotalCount
        } else {
          pointBreakup[id].bowled_lbw_bonus = nPoint * nTotalCount
        }
      }

      // Update substitute player and give playing11 Bonus // 1 -> 10,14,
      const { nPoint } = breakupDesign.playing_eleven_bonus
      matchPlayers.forEach(async (player) => {
        if (player.sKey === id) {
          if (eCategory === 'CRICKET' && !player.bShow && player.bSubstitute && !processedPlayer.includes(player.sKey)) {
            processedPlayer.push(id)
            await MatchPlayerModel.updateOne({ _id: ObjectId(player._id) }, { bShow: true })
            player.nScoredPoints = player.nScoredPoints + nPoint

            const key = player.sKey
            if (!pointBreakup[key]) pointBreakup[key] = {}
            pointBreakup[key].playing_eleven_bonus = nPoint
            pointBreakup[player.sKey].nScoredPoints = player.nScoredPoints
          }

          // Dismissal For a Duck (Except Bowler).
          if (player.eRole !== 'BWL') {
            if (dismissal && runs && runs <= 0 && breakupDesign.duck_bonus) {
              const { nPoint = 0 } = breakupDesign.duck_bonus
              totalPoint += nPoint

              if (pointBreakup[id].duck_bonus) {
                pointBreakup[id].duck_bonus += nPoint
              } else {
                pointBreakup[id].duck_bonus = nPoint
              }
            }

            // strike rate point
            if (strikeRate && parseInt(ballsFaced) > 0 && breakupDesign.strike_rate_bonus) {
              let srp = 0
              const { aPoint } = breakupDesign.strike_rate_bonus
              aPoint.map(({ nRangeFrom, nRangeTo, nMinValue, nBonus }) => {
                if ((nRangeFrom <= strikeRate) && (nRangeTo >= strikeRate) && (nMinValue <= ballsFaced)) {
                  srp = nBonus
                }
              })
              totalPoint += srp
              if (pointBreakup[id].strike_rate_bonus) {
                pointBreakup[id].strike_rate_bonus += srp
              } else {
                pointBreakup[id].strike_rate_bonus = srp
              }
              bStrikeRateBonus = true
            }
          }

          player.nScoredPoints = player.nScoredPoints + totalPoint
          player.bEconomyBonus = bEconomyBonus
          player.bStrikeRateBonus = bStrikeRateBonus
        }
      })
      processedPlayer.push(id)
    })
    const playingElevenBonus = []
    // Give MatchPlayers' playing bonus points
    matchPlayers.forEach((player) => {
      if (breakupDesign.playing_eleven_bonus && (player.bShow === true) && !playingElevenBonus.includes(player._id)) {
        playingElevenBonus.push(player._id)
        const { nPoint } = breakupDesign.playing_eleven_bonus

        const key = player.sKey
        if (!pointBreakup[key]) pointBreakup[key] = {}

        player.nScoredPoints = player.nScoredPoints + nPoint
        pointBreakup[key].playing_eleven_bonus = nPoint
        pointBreakup[player.sKey].nScoredPoints = player.nScoredPoints
        // pointBreakup[player.sKey].matchPlayerId = player._id
      }
    })

    for (const matchPlayer of matchPlayers) {
      const { _id, nScoredPoints, aPointBreakup, sKey, bEconomyBonus, bStrikeRateBonus } = matchPlayer
      const point = aPointBreakup.map((p) => {
        if (pointBreakup[sKey] && (typeof pointBreakup[sKey][p.sKey]) === 'number') {
          return ({
            ...p,
            nScoredPoints: pointBreakup[sKey][p.sKey]
          })
        }
        return { ...p, nScoredPoints: 0 }
      })
      await MatchPlayerModel.updateOne({ _id: ObjectId(_id) }, { nScoredPoints, aPointBreakup: point, bEconomyBonus, bStrikeRateBonus, dUpdatedAt: Date.now() })
    }

    data._id = match._id
    data.sKey = match.sKey
    data.iSeriesId = match.iSeriesId
    data.iVenueId = match.iVenueId
    data.eProvider = 'ENTITYSPORT'
    data.eCategory = match.eCategory
    updateFullScorecard(data)
    const eStatus = (eOldMatchStatus === 'L' && (data.status.toString() === '2' && data.verified.toString() === 'true')) ? 'I' : eOldMatchStatus

    if (eStatus && eStatus === 'I') {
      await redisClient.del(`${match._id.toString()}`)
      MyMatchesModel.updateMany({ iMatchId: ObjectId(match._id) }, { $set: { eMatchStatus: 'I' } }).exec()
      MatchLeagueModel.updateMany({ iMatchId: ObjectId(match._id) }, { $set: { eMatchStatus: 'I' } }).exec()
    }
    await MatchModel.updateOne({ _id: ObjectId(match._id) }, { eStatus, sWinning: matchResult, 'oHomeTeam.nScore': oHomeTeamScore, 'oAwayTeam.nScore': oAwayTeamScore, iTossWinnerId: tossWinnerTeam.iTeamId, eTossWinnerAction, dUpdatedAt: Date.now() })

    return { isSuccess: true, status: status.OK, message: messages[userLanguage].update_success.replace('##', messages[userLanguage].cscorePoint), data: {} }
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false, status: status.InternalServerError, message: messages[userLanguage].error, data: {} }
  }
}

/**
 * It'll fetch and calculate score points of cricket match according to our Fantasy point system from Sports Radar API.
 * @param {object} match match details object
 * @param {*} userLanguage English or Hindi(In future)
 * @returns It'll fetch and calculate score points of cricket match according to our Fantasy point system from Sports Radar API.
 */
async function cricketScorePointBySportsRadar(match, userLanguage = 'English') {
  try {
    let response
    // Find Latest details of Match
    match = await MatchModel.findById(match._id).lean()
    const { eCategory, eFormat, oHomeTeam, oAwayTeam } = match
    try {
      response = await axios.get(`https://api.sportradar.us/cricket-p2/en/matches/${match.sKey}/summary.json`, { params: { api_key: config.SPORTSRADAR_API_KEY } })
    } catch (error) {
      const logData = { sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://api.sportradar.us/cricket-p2/en/matches/${match.sKey}/summary.json` }
      apiLogQueue.publish(logData)
      // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://api.sportradar.us/cricket-p2/en/matches/${match.sKey}/summary.json` })
      return { isSuccess: false, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }
    const logData = { sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: response.data, sUrl: `https://api.sportradar.us/cricket-p2/en/matches/${match.sKey}/summary.json` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: response.data, sUrl: `https://api.sportradar.us/cricket-p2/en/matches/${match.sKey}/summary.json` })

    const data = response.data
    let { period_scores: periodScores = [], match_result: matchResult, match_status: matchStatus, toss_won_by: tossWonByKey = '', winner_id: wonTeamKey = '' } = data.sport_event_status

    if (!matchResult) {
      const winnerTeam = oHomeTeam.sKey === wonTeamKey ? oHomeTeam.sName : oAwayTeam.sKey === wonTeamKey ? oAwayTeam.sName : ''

      matchResult = winnerTeam.length ? `${winnerTeam} won the match` : matchResult
    }

    if (data.sport_event_status.match_status === 'not_started') {
      return { isSuccess: false, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }
    const { statistics } = data

    let oHomeTeamScore
    let oAwayTeamScore

    periodScores.forEach((score) => {
      const { home_score: homeScore, display_overs: overs = '', display_score: scores = '', away_score: awayScore } = score
      if (homeScore) {
        oHomeTeamScore = `${scores} (${overs})`
      } else if (awayScore) {
        oAwayTeamScore = `${scores} (${overs})`
      }
    })

    const tossWinnerTeam = oHomeTeam.sKey === tossWonByKey ? oHomeTeam : oAwayTeam.sKey === tossWonByKey ? oAwayTeam : {}

    const playerDetails = []

    if (Array.isArray(statistics)) {
      const eStatus = matchStatus === 'ended' ? 'I' : undefined
      await MatchModel.updateOne({ _id: ObjectId(match._id) }, { eStatus, sWinning: matchResult, 'oHomeTeam.nScore': oHomeTeamScore, 'oAwayTeam.nScore': oAwayTeamScore, dUpdatedAt: Date.now() })

      return { isSuccess: false, status: status.OK, message: messages[userLanguage].error_with.replace('##', messages[userLanguage].cscorePoint), data: {} }
    } else if (typeof statistics === 'object' && statistics !== null) {
      statistics.innings.map((inning) => {
        inning.teams.map(({ statistics }) => {
          if (statistics.batting) {
            const { players } = statistics.batting
            players.map((player) => playerDetails.push(player))
          } else if (statistics.bowling) {
            const { players } = statistics.bowling
            players.map((player) => playerDetails.push(player))
          }
        })
      })
    } else {
      return { isSuccess: false, status: status.OK, message: messages[userLanguage].error_with.replace('##', messages[userLanguage].cscorePoint), data: {} }
    }
    const eTossWinnerAction = tossWinnerTeam.sKey === statistics.innings[0].batting_team ? 'BAT' : 'BOWLING'

    const players = await MatchPlayerModel.find({ iMatchId: match._id }).lean()

    const matchPlayers = players.map((player) => ({ ...player, nScoredPoints: 0 }))
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
    } else {
      console.log('eFormat not found:::::::::::::::', eFormat)
      return { isSuccess: false, status: status.NotFound, message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].cmatchFormat), data: {} }
    }

    const matchFormat = await ScorePointModel.find({ eCategory, eFormat: setFormat }).lean()

    const breakupDesign = {}
    const initBreakup = {}
    matchFormat.forEach(({ sKey, bMulti, aPoint, nPoint }) => {
      breakupDesign[sKey] = bMulti ? { aPoint } : { nPoint }
      initBreakup[sKey] = 0
    })

    const pointBreakup = {}

    playerDetails.forEach((player) => {
      const { id, statistics } = player
      let totalPoint = 0
      let bEconomyBonus
      let bStrikeRateBonus

      if (statistics) {
        const { runs, strike_rate: strikeRate, balls_faced: ballsFaced, fours, sixes, dismissal, wickets, maidens, economy_rate: economyRate, overs_bowled: oversBowled } = statistics

        if (!pointBreakup[id]) pointBreakup[id] = { ...initBreakup }

        if (dismissal) {
          let fieldPoint = 0
          const { type, fieldsman_id: fieldManId } = dismissal

          if (fieldManId) {
            if (!pointBreakup[fieldManId]) pointBreakup[fieldManId] = { ...initBreakup }

            // catches, stump, runout and caughtOut
            if (type === 'caught' && breakupDesign.catches_bonus) {
              const { nPoint } = breakupDesign.catches_bonus
              fieldPoint += nPoint
              pointBreakup[fieldManId].catches_bonus += nPoint
            }
            if (type === 'stumped' && breakupDesign.stump_bonus) {
              const { nPoint } = breakupDesign.stump_bonus
              fieldPoint += nPoint
              pointBreakup[fieldManId].stump_bonus += nPoint
            }
            if (type === 'run_out' && breakupDesign.runout_bonus) {
              const { nPoint } = breakupDesign.runout_bonus
              fieldPoint += nPoint
              pointBreakup[fieldManId].runout_bonus += nPoint
            }
            if (type === 'caught_bowled' && breakupDesign.catches_bonus) {
              const { nPoint } = breakupDesign.catches_bonus
              fieldPoint += nPoint
              pointBreakup[fieldManId].catches_bonus += nPoint
            }

            matchPlayers.forEach((player) => {
              if (player.sKey === fieldManId) {
                player.nScoredPoints = player.nScoredPoints + fieldPoint
                // pointBreakup[fieldManId].totalScore = player.nScoredPoints + fieldPoint

                pointBreakup[fieldManId].totalScore = player.nScoredPoints
              }
            })
          }
        }

        if (runs) {
          if (runs > 0) {
            // century, half century and thirty runs
            if ((runs >= 100) && breakupDesign.century_bonus) {
              const { nPoint } = breakupDesign.century_bonus
              totalPoint += nPoint
              pointBreakup[id].century_bonus = nPoint
            } else if ((runs >= 50 && runs < 100) && breakupDesign.half_century_bonus) {
              const { nPoint } = breakupDesign.half_century_bonus
              totalPoint += nPoint
              pointBreakup[id].half_century_bonus = nPoint
            } else if ((runs >= 30 && runs < 50) && breakupDesign['30_run_bonus']) {
              const { nPoint } = breakupDesign['30_run_bonus']
              totalPoint += nPoint
              pointBreakup[id]['30_run_bonus'] = nPoint
            }

            // per run point
            const { nPoint } = breakupDesign.run_score_bonus
            const rp = breakupDesign.run_score_bonus ? nPoint : 0
            totalPoint += runs * rp
            pointBreakup[id].run_score_bonus = runs * rp

            // boundary hit point
            if (fours) {
              const { nPoint } = breakupDesign.boundary_hit_bonus
              const bp = breakupDesign.boundary_hit_bonus ? nPoint : 0
              totalPoint += fours * bp
              pointBreakup[id].boundary_hit_bonus = fours * bp
            }

            // sixes hit point
            if (sixes) {
              const { nPoint } = breakupDesign.six_hit_bonus
              const sp = breakupDesign.six_hit_bonus ? nPoint : 0
              totalPoint += sixes * sp
              pointBreakup[id].six_hit_bonus = sixes * sp
            }

            // strike rate point
            if (strikeRate && ballsFaced && breakupDesign.strike_rate_bonus) {
              let srp = 0
              const { aPoint } = breakupDesign.strike_rate_bonus
              aPoint.map(({ nRangeFrom, nRangeTo, nMinValue, nBonus }) => {
                if ((nRangeFrom <= strikeRate) && (nRangeTo >= strikeRate) && (nMinValue <= ballsFaced)) {
                  srp = nBonus
                }
              })
              totalPoint += srp
              pointBreakup[id].strike_rate_bonus = srp
              bStrikeRateBonus = true
            }
          }
        }

        if (wickets) {
          if ((wickets >= 5) && breakupDesign['5_wicket_bonus']) { // three wicket bonus
            const { nPoint } = breakupDesign['5_wicket_bonus']
            totalPoint += nPoint
            pointBreakup[id]['5_wicket_bonus'] = nPoint
          } else if ((wickets >= 3 && wickets < 5) && breakupDesign['3_wicket_bonus']) { // three wicket bonus
            const { nPoint } = breakupDesign['3_wicket_bonus']
            totalPoint += nPoint
            pointBreakup[id]['3_wicket_bonus'] = nPoint
          } else if ((wickets === 2) && breakupDesign['2_wicket_bonus']) { // two wicket bonus
            const { nPoint } = breakupDesign['2_wicket_bonus']
            totalPoint += nPoint
            pointBreakup[id]['2_wicket_bonus'] = nPoint
          }

          // per wicket point
          const { nPoint } = breakupDesign.wicket_bonus
          const wp = ((wickets > 0) && breakupDesign.wicket_bonus) ? nPoint : 0
          totalPoint += wickets * wp
          pointBreakup[id].wicket_bonus = wickets * wp
        }

        if (maidens && breakupDesign.maiden_bonus) { // maiden-bonus
          const { nPoint } = breakupDesign.maiden_bonus
          totalPoint += maidens * nPoint
          pointBreakup[id].maiden_bonus = maidens * nPoint
        }

        if (economyRate && oversBowled && breakupDesign.economy_bonus) { // economy-bonus
          let ep = 0
          const { aPoint } = breakupDesign.economy_bonus
          aPoint.map(({ nRangeFrom, nRangeTo, nMinValue, nBonus }) => {
            if ((nRangeFrom <= economyRate) && (nRangeTo >= economyRate) && (nMinValue <= oversBowled)) {
              ep = nBonus
            }
          })
          totalPoint += ep
          pointBreakup[id].economy_bonus = ep
          bEconomyBonus = true
        }
      }

      matchPlayers.forEach((player) => {
        if (player.sKey === id) {
          // if (breakupDesign.playing_eleven_bonus && (player.bShow === true) && !pointBreakup[id].playing_eleven_bonus) {
          //   const { nPoint } = breakupDesign.playing_eleven_bonus
          //   totalPoint += nPoint
          //   pointBreakup[id].playing_eleven_bonus += nPoint
          // }

          player.nScoredPoints = player.nScoredPoints + totalPoint
          player.bEconomyBonus = bEconomyBonus
          player.bStrikeRateBonus = bStrikeRateBonus
          // pointBreakup[id].totalScore = player.nScoredPoints
          // pointBreakup[id].matchPlayerId = player._id
        }
      })
    })

    const playingElevenBonus = []
    matchPlayers.forEach((player) => {
      if (breakupDesign.playing_eleven_bonus && (player.bShow === true) && !playingElevenBonus.includes(player._id)) {
        playingElevenBonus.push(player._id)
        const { nPoint } = breakupDesign.playing_eleven_bonus

        const key = player.sKey
        if (!pointBreakup[key]) pointBreakup[key] = {}

        player.nScoredPoints = player.nScoredPoints + nPoint
        pointBreakup[key].playing_eleven_bonus = nPoint
        pointBreakup[player.sKey].nScoredPoints = player.nScoredPoints
        pointBreakup[player.sKey].matchPlayerId = player._id
      }
    })

    for (const matchPlayer of matchPlayers) {
      const { _id, nScoredPoints, aPointBreakup, sKey, bEconomyBonus, bStrikeRateBonus } = matchPlayer
      const point = aPointBreakup.map((p) => {
        if (pointBreakup[sKey] && (typeof pointBreakup[sKey][p.sKey]) === 'number') {
          return ({
            ...p,
            nScoredPoints: pointBreakup[sKey][p.sKey]
          })
        }
        return { ...p, nScoredPoints: 0 }
      })

      await MatchPlayerModel.updateOne({ _id: ObjectId(_id) }, { nScoredPoints, aPointBreakup: point, bEconomyBonus, bStrikeRateBonus, dUpdatedAt: Date.now() })
    }

    const eStatus = matchResult ? 'I' : undefined
    if (eStatus && eStatus === 'I') {
      await redisClient.del(`${match._id.toString()}`)
      MyMatchesModel.updateMany({ iMatchId: ObjectId(match._id) }, { $set: { eMatchStatus: 'I' } }).exec()
      MatchLeagueModel.updateMany({ iMatchId: ObjectId(match._id) }, { $set: { eMatchStatus: 'I' } }).exec()
    }
    await MatchModel.updateOne({ _id: ObjectId(match._id) }, { eStatus, sWinning: matchResult, 'oHomeTeam.nScore': oHomeTeamScore, 'oAwayTeam.nScore': oAwayTeamScore, iTossWinnerId: tossWinnerTeam.iTeamId, eTossWinnerAction, dUpdatedAt: Date.now() })
    return { isSuccess: true, status: status.OK, message: messages[userLanguage].update_success.replace('##', messages[userLanguage].cscorePoint), data: {} }
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false, status: status.InternalServerError, message: messages[userLanguage].error, data: {} }
  }
}

/**
 * It'll fetch and calculate score points of kabaddi match according to our Fantasy point system from Entity Sports API.
 * @param  {object} match
 * @param  {*} userLanguage='English'
 */
async function kabaddiScorePointByEntitySport(match, userLanguage = 'English') {
  try {
    let response
    // Find Latest details of Match
    match = await MatchModel.findById(match._id).lean()
    try {
      response = await axios.get(`https://rest.entitysport.com/kabaddi/matches/${match.sKey}/stats`, { params: { token: config.ENTITYSPORT_KABADDI_API_KEY } })
    } catch (error) {
      const logData = { sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://kabaddi.entitysport.com/matches/${match.sKey}/stats` }
      apiLogQueue.publish(logData)
      // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://kabaddi.entitysport.com/matches/${match.sKey}/stats` })
      return { isSuccess: true, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }
    const logData = { sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: response.data.response.items, sUrl: `https://kabaddi.entitysport.com/matches/${match.sKey}/stats` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: response.data.response.items, sUrl: `https://kabaddi.entitysport.com/matches/${match.sKey}/stats` })

    const isScoresAvailable = response.data.response.items.match_info.status
    const bVerified = response.data.response.items.match_info.verified
    if (!['2', '3'].includes(isScoresAvailable.toString())) {
      return { isSuccess: false, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }
    const teamAStats = response.data.response.items.team_stats.home || {}
    const teamBStats = response.data.response.items.team_stats.away || {}
    const aScorePointsData = response.data.response.items.match_player_stats || {}
    const teamAScore = response.data.response.items.match_info.result.home || ''
    const teamBScore = response.data.response.items.match_info.result.away || ''
    const teamAScores = aScorePointsData.home || []
    const teamBScores = aScorePointsData.away || []

    const { eCategory, eFormat, oHomeTeam, oAwayTeam, _id } = match

    const players = await MatchPlayerModel.find({ iMatchId: match._id }).lean()
    const allMatchPlayers = players.map((player) => ({ ...player, nScoredPoints: 0 }))

    // preparing breakup design and an initial breakup
    const breakupDesign = {}
    const initBreakup = {}

    const matchPointsFormat = await ScorePointModel.find({ eCategory, eFormat }).lean()
    matchPointsFormat.forEach(({ sKey, nPoint }) => {
      breakupDesign[sKey] = { nPoint }
      initBreakup[sKey] = 0
    })

    const livePlayersData = [...teamAScores, ...teamBScores]

    if (livePlayersData.length < 1 && Object.keys(breakupDesign).length < 1) {
      return { isSuccess: false, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }

    // checking which team is eligible for gettingAllOut and pushingAllOut
    let gettingAllOutTeam
    let pushingAllOutTeam
    if (teamAStats && teamAStats.allouts > 0) {
      gettingAllOutTeam = oHomeTeam.iTeamId
      pushingAllOutTeam = oAwayTeam.iTeamId
    } else if (teamBStats && teamBStats.allouts > 0) {
      gettingAllOutTeam = oAwayTeam.iTeamId
      pushingAllOutTeam = oHomeTeam.iTeamId
    }

    // new point breakup of all players will be here
    const pointBreakup = {}

    livePlayersData.forEach((player) => {
      let totalPoints = 0

      const { pid: id, raidsuccessful, raidunsuccessful, raidempty, tacklesuccessful, supertackles, greencardcount, yellowcardcount, redcardcount } = player

      if (!pointBreakup[id]) pointBreakup[id] = { ...initBreakup }

      // on every successful raid
      if (raidsuccessful) {
        const { nPoint } = breakupDesign.each_successful_raid_touch_point
        const rp = breakupDesign.each_successful_raid_touch_point ? nPoint : 0
        totalPoints += raidsuccessful * rp
        pointBreakup[id].each_successful_raid_touch_point = raidunsuccessful * rp
      }

      // on every unsuccessful raid
      if (raidunsuccessful) {
        const { nPoint } = breakupDesign.each_unsuccessful_raid
        const rp = breakupDesign.each_unsuccessful_raid_touch_point ? nPoint : 0
        totalPoints += raidunsuccessful * rp
        pointBreakup[id].each_unsuccessful_raid_touch_point = raidunsuccessful * rp
      }

      // on every empty raid
      if (raidempty) {
        const { nPoint } = breakupDesign.raid_bonus
        const rp = breakupDesign.raid_bonus ? nPoint : 0
        totalPoints += raidempty * rp
        pointBreakup[id].raid_bonus = raidempty * rp
      }

      // on every successful tackle
      if (tacklesuccessful) {
        const { nPoint } = breakupDesign.each_successful_tackle
        const tp = breakupDesign.each_successful_tackle ? nPoint : 0
        totalPoints += tacklesuccessful * tp
        pointBreakup[id].each_successful_tackle = tacklesuccessful * tp
      }

      // on every supertackles
      if (supertackles) {
        const { nPoint } = breakupDesign.super_tackle
        const tp = breakupDesign.super_tackle ? nPoint : 0
        totalPoints += supertackles * tp
        pointBreakup[id].super_tackle = supertackles * tp
      }

      // on every greencard
      if (greencardcount) {
        const { nPoint } = breakupDesign.green_card
        const cp = breakupDesign.green_card ? nPoint : 0
        totalPoints += greencardcount * cp
        pointBreakup[id].green_card = greencardcount * cp
      }

      // on every yellowcard
      if (yellowcardcount) {
        const { nPoint } = breakupDesign.yellow_card
        const cp = breakupDesign.yellow_card ? nPoint : 0
        totalPoints += yellowcardcount * cp
        pointBreakup[id].yellow_card = yellowcardcount * cp
      }

      // on every redcard
      if (redcardcount) {
        const { nPoint } = breakupDesign.red_card
        const cp = breakupDesign.red_card ? nPoint : 0
        totalPoints += redcardcount * cp
        pointBreakup[id].red_card = redcardcount * cp
      }

      allMatchPlayers.forEach((player) => {
        if (player.sKey === id) {
          let playerFinalPoints = totalPoints

          // if player is part of starting 7 players
          if (player.bShow) {
            const { nPoint } = breakupDesign.being_part_of_the_starting_7
            const sp = breakupDesign.being_part_of_the_starting_7 ? nPoint : 0
            playerFinalPoints = playerFinalPoints + sp
          } else {
            // if player is part of substitute
            const { nPoint } = breakupDesign.making_a_substitute_appearance
            const sp = breakupDesign.making_a_substitute_appearance ? nPoint : 0
            playerFinalPoints = playerFinalPoints + sp
          }

          // if player is in gettingAllOutTeam
          if (gettingAllOutTeam && gettingAllOutTeam.toString() === player.iTeamId.toString()) {
            const { nPoint } = breakupDesign.getting_all_out
            const sp = breakupDesign.getting_all_out ? nPoint : 0
            playerFinalPoints = playerFinalPoints + sp
          }

          // if player is in pushingAllOutTeam
          if (pushingAllOutTeam && pushingAllOutTeam.toString() === player.iTeamId.toString()) {
            const { nPoint } = breakupDesign.pushing_all_out
            const sp = breakupDesign.pushing_all_out ? nPoint : 0
            playerFinalPoints = playerFinalPoints + sp
          }

          // updating point breakup with totalscore
          player.nScoredPoints = player.nScoredPoints + playerFinalPoints
          pointBreakup[id].totalScore = player.nScoredPoints
          pointBreakup[id].matchPlayerId = player._id
        }
      })
    })

    // updating all matchplayers with new scores
    for (const matchPlayer of allMatchPlayers) {
      const { _id, nScoredPoints, aPointBreakup, sKey } = matchPlayer
      const newPointBreakup = aPointBreakup.map((p) => {
        if (pointBreakup[sKey] && (typeof pointBreakup[sKey][p.sKey]) === 'number') {
          return ({
            ...p,
            nScoredPoints: pointBreakup[sKey][p.sKey]
          })
        }
        return { ...p, nScoredPoints: 0 }
      })
      await MatchPlayerModel.updateOne({ _id: ObjectId(_id) }, { nScoredPoints, aPointBreakup: newPointBreakup, dUpdatedAt: Date.now() })
    }

    let winner = ''
    const eStatus = (isScoresAvailable.toString() === '2' && bVerified.toString() === 'true') ? 'I' : undefined
    if (response.data.response.items.match_info.result.winner === 'home') {
      winner = `${oHomeTeam.sName} won the match`
    } else if (response.data.response.items.match_info.result.winner === 'away') {
      winner = `${oAwayTeam.sName} won the match`
    }

    if (eStatus && eStatus === 'I') {
      await redisClient.del(`${_id.toString()}`)
      MyMatchesModel.updateMany({ iMatchId: ObjectId(_id) }, { $set: { eMatchStatus: 'I' } }).exec()
      MatchLeagueModel.updateMany({ iMatchId: ObjectId(_id) }, { $set: { eMatchStatus: 'I' } }).exec()
    }
    // updating match with new scores
    await MatchModel.updateOne({ _id: ObjectId(_id) }, { eStatus, sWinning: winner, 'oHomeTeam.nScore': teamAScore, 'oAwayTeam.nScore': teamBScore, dUpdatedAt: Date.now() })

    return { isSuccess: true, status: status.OK, message: messages[userLanguage].update_success.replace('##', messages[userLanguage].cscorePoint), data: {} }
  } catch (error) {
    return { isSuccess: false, status: status.InternalServerError, message: messages[userLanguage].error, data: {} }
  }
}

/**
 * It'll fetch and calculate score points of basketball match according to our Fantasy point system from Entity Sports API.
 * @param  {object} match
 * @param  {*} userLanguage='English'
 */
async function basketballScorePointByEntitySport(match, userLanguage = 'English') {
  try {
    let response
    // Find Latest details of Match
    match = await MatchModel.findById(match._id).lean()
    try {
      response = await axios.get(`https://basketball.entitysport.com/matches/${match.sKey}/stats`, { params: { token: config.ENTITYSPORT_BASKETBALL_API_KEY } })
    } catch (error) {
      const logData = { sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://basketball.entitysport.com/matches/${match.sKey}/stats` }
      apiLogQueue.publish(logData)
      // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://basketball.entitysport.com/matches/${match.sKey}/stats` })

      return { isSuccess: true, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }
    const logData = { sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: response.data.response.items, sUrl: `https://basketball.entitysport.com/matches/${match.sKey}/stats` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: response.data.response.items, sUrl: `https://basketball.entitysport.com/matches/${match.sKey}/stats` })
    const isScoresAvailable = response.data.response.items.match_info.status
    const bVerified = response.data.response.items.match_info.verified
    if (!['2', '3'].includes(isScoresAvailable.toString())) {
      return { isSuccess: false, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }

    const aScorePointsData = response.data.response.items.match_player_stats || {}
    const teamAScore = response.data.response.items.match_info.result.home || ''
    const teamBScore = response.data.response.items.match_info.result.away || ''
    const teamAScores = aScorePointsData.home || []
    const teamBScores = aScorePointsData.away || []

    const { eCategory, eFormat, oHomeTeam, oAwayTeam, _id } = match

    const players = await MatchPlayerModel.find({ iMatchId: match._id }).lean()
    const allMatchPlayers = players.map((player) => ({ ...player, nScoredPoints: 0 }))

    // preparing breakup design and an initial breakup
    const breakupDesign = {}
    const initBreakup = {}

    const matchPointsFormat = await ScorePointModel.find({ eCategory, eFormat }).lean()
    matchPointsFormat.forEach(({ sKey, nPoint }) => {
      breakupDesign[sKey] = { nPoint }
      initBreakup[sKey] = 0
    })

    const livePlayersData = [...teamAScores, ...teamBScores]

    if (livePlayersData.length < 1 && Object.keys(breakupDesign).length < 1) {
      return { isSuccess: false, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }

    // new point breakup of all players will be here
    const pointBreakup = {}

    livePlayersData.forEach((player) => {
      let totalPoints = 0

      const { pid: id, rebound, points, turnovers, steals, assists, blocks } = player

      if (!pointBreakup[id]) pointBreakup[id] = { ...initBreakup }

      // on every rebound
      if (rebound) {
        const { nPoint } = breakupDesign.rebounds
        const rp = breakupDesign.rebounds ? nPoint : 0
        totalPoints += rebound * rp
        pointBreakup[id].rebounds = rebound * rp
      }

      // on every points
      if (points) {
        const { nPoint } = breakupDesign.point_scored
        const pp = breakupDesign.point_scored ? nPoint : 0
        totalPoints += points * pp
        pointBreakup[id].point_scored = points * pp
      }

      // on every turnover
      if (turnovers) {
        const { nPoint } = breakupDesign.turnover
        const tp = breakupDesign.turnover ? nPoint : 0
        totalPoints += turnovers * tp
        pointBreakup[id].turnovers = turnovers * tp
      }

      // on every steal
      if (steals) {
        const { nPoint } = breakupDesign.steals
        const sp = breakupDesign.steals ? nPoint : 0
        totalPoints += steals * sp
        pointBreakup[id].steals = steals * sp
      }

      // on every assist
      if (assists) {
        const { nPoint } = breakupDesign.assist
        const ap = breakupDesign.assist ? nPoint : 0
        totalPoints += assists * ap
        pointBreakup[id].assist = assists * ap
      }

      // on every block
      if (blocks) {
        const { nPoint } = breakupDesign.blocks
        const bp = breakupDesign.blocks ? nPoint : 0
        totalPoints += blocks * bp
        pointBreakup[id].blocks = blocks * bp
      }

      allMatchPlayers.forEach((player) => {
        if (player.sKey === id) {
          // updating point breakup with totalscore
          player.nScoredPoints = player.nScoredPoints + totalPoints
          pointBreakup[id].totalScore = player.nScoredPoints
          pointBreakup[id].matchPlayerId = player._id
        }
      })
    })

    // updating allMatchPlayers with new scores
    for (const matchPlayer of allMatchPlayers) {
      const { _id, nScoredPoints, aPointBreakup, sKey } = matchPlayer
      const newPointBreakup = aPointBreakup.map((p) => {
        if (pointBreakup[sKey] && (typeof pointBreakup[sKey][p.sKey]) === 'number') {
          return ({
            ...p,
            nScoredPoints: pointBreakup[sKey][p.sKey]
          })
        }
        return { ...p, nScoredPoints: 0 }
      })

      await MatchPlayerModel.updateOne({ _id: ObjectId(_id) }, { nScoredPoints, aPointBreakup: newPointBreakup, dUpdatedAt: Date.now() })
    }

    // updating match with new scores
    let winner = ''
    const eStatus = (isScoresAvailable.toString() === '2' && bVerified.toString() === 'true') ? 'I' : undefined
    if (eStatus && eStatus === 'I') {
      if (response.data.response.items.match_info.result.winner === 'home') {
        winner = `${oHomeTeam.sName} won the match`
      } else if (response.data.response.items.match_info.result.winner === 'away') {
        winner = `${oAwayTeam.sName} won the match`
      }
    }

    if (eStatus && eStatus === 'I') {
      await redisClient.del(`${_id.toString()}`)
      MyMatchesModel.updateMany({ iMatchId: ObjectId(_id) }, { $set: { eMatchStatus: 'I' } }).exec()
      MatchLeagueModel.updateMany({ iMatchId: ObjectId(_id) }, { $set: { eMatchStatus: 'I' } }).exec()
    }
    await MatchModel.updateOne({ _id: ObjectId(_id) }, { eStatus, sWinning: winner, 'oHomeTeam.nScore': teamAScore, 'oAwayTeam.nScore': teamBScore, dUpdatedAt: Date.now() })
    return { isSuccess: true, status: status.OK, message: messages[userLanguage].update_success.replace('##', messages[userLanguage].cscorePoint), data: {} }
  } catch (error) {
    return { isSuccess: false, status: status.InternalServerError, message: messages[userLanguage].error, data: {} }
  }
}

async function basketballScorePointBySportsRadar(match, userLanguage = 'English') {
  let response
  // Find Latest details of Match
  match = await MatchModel.findById(match._id).lean()
  try {
    response = await axios.get(`https://api.sportradar.us/nba/production/v5/en/games/${match.sKey}/summary.json`, { params: { api_key: config.NBA_API_KEY } })
  } catch (error) {
    const logData = { sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://api.sportradar.us/nba/production/v5/en/games/${match.sKey}/summary.json` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://api.sportradar.us/nba/production/v5/en/games/${match.sKey}/summary.json` })
    return { isSuccess: true, status: status.OK, message: messages[userLanguage].match_not_started }
  }
  if (response.data.status === 'schedule') {
    return { isSuccess: false, status: status.OK, message: messages[userLanguage].match_not_started }
  }
  const logData = { sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: response.data, sUrl: `https://api.sportradar.us/nba/production/v5/en/games/${match.sKey}/summary.json` }
  apiLogQueue.publish(logData)
  // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: response.data, sUrl: `https://api.sportradar.us/nba/production/v5/en/games/${match.sKey}/summary.json` })

  const allPlayers = await MatchPlayerModel.find({ iMatchId: match._id }).lean()

  const { eCategory, eFormat } = match

  const matchFormat = await ScorePointModel.find({ eCategory, eFormat }).lean()
  const matchFormatData = {}
  matchFormat.forEach(({ sKey, nPoint }) => {
    matchFormatData[sKey] = { nPoint }
  })
  const allPlayersObj = {}
  allPlayers.forEach(s => {
    allPlayersObj[s.sKey] = s
  })

  const liveData = []
  let teamAScore = 0
  let teamBScore = 0
  if (response.data.home) {
    let p = response.data.home.players
    if (!p) { p = [] }
    teamAScore = response.data.home.points
    for (const data of p) {
      liveData.push(data)
    }
  }
  if (response.data.away) {
    teamBScore = response.data.away.points
    let p = response.data.away.players
    if (!p) { p = [] }
    for (const data of p) {
      liveData.push(data)
    }
  }
  const pointBreakup = {}
  if (liveData.length && matchFormatData !== {}) {
    liveData.forEach(obj => {
      let totalPoint = 0
      if (obj.statistics) {
        if (obj.statistics.points) {
          let points = obj.statistics.points
          if (matchFormatData.point_scored) {
            points = matchFormatData.point_scored.nPoint * points
          }
          totalPoint += parseFloat(points) * 1
          pointBreakup.point_scored = parseFloat(points) * 1
        }

        if (obj.statistics.assists) {
          let assists = obj.statistics.assists
          if (matchFormatData.assist) {
            assists = matchFormatData.assist.nPoint * assists
          }
          totalPoint += parseFloat(assists) * 1
          pointBreakup.assist = parseFloat(assists) * 1
        }

        if (obj.statistics.rebounds) {
          let rebounds = obj.statistics.rebounds
          if (matchFormatData.rebounds) {
            rebounds = matchFormatData.rebounds.nPoint * rebounds
          }
          totalPoint += parseFloat(rebounds) * 1
          pointBreakup.rebounds = parseFloat(rebounds) * 1
        }

        if (obj.statistics.steals) {
          let steals = obj.statistics.steals
          if (matchFormatData.steals) {
            steals = matchFormatData.steals.nPoint * steals
          }
          totalPoint += parseFloat(steals) * 1
          pointBreakup.steals = parseFloat(steals) * 1
        }

        if (obj.statistics.blocks) {
          let blocks = obj.statistics.blocks
          if (matchFormatData.blocks) {
            blocks = matchFormatData.blocks.nPoint * blocks
          }
          totalPoint += parseFloat(blocks) * 1
          pointBreakup.blocks = parseFloat(blocks) * 1
        }

        if (obj.statistics.turnovers) {
          let turnovers = obj.statistics.turnovers
          if (matchFormatData.turnover) {
            turnovers = matchFormatData.turnover.nPoint * turnovers
          }
          totalPoint += parseFloat(turnovers) * 1
          pointBreakup.turnover = parseFloat(turnovers) * 1
        }
      }

      if (allPlayersObj[obj.sr_id] && allPlayersObj[obj.sr_id]._id) {
        allPlayersObj[obj.sr_id].nScoredPoints += totalPoint
      }
    }) // end for each for live_data

    const allPlayer = Object.keys(allPlayersObj)

    for (const playerObj of allPlayer) {
      const { _id, nScoredPoints } = allPlayersObj[playerObj]
      await MatchPlayerModel.updateOne({ _id: ObjectId(_id) }, { nScoredPoints, dUpdatedAt: Date.now() })
    }

    let winning = ''
    const eStatus = response.data.status === 'closed' ? 'I' : undefined
    if (response.data.status === 'closed') {
      if (response.data.home.points > response.data.away.points) {
        winning = `${response.data.home.alias} won the match!`
      } else if (response.data.home.points < response.data.away.points) {
        winning = `${response.data.away.alias} won the match!`
      }
    }

    if (eStatus && eStatus === 'I') {
      await redisClient.del(`${match._id.toString()}`)
      MyMatchesModel.updateMany({ iMatchId: ObjectId(match._id) }, { $set: { eMatchStatus: 'I' } }).exec()
      MatchLeagueModel.updateMany({ iMatchId: ObjectId(match._id) }, { $set: { eMatchStatus: 'I' } }).exec()
    }
    await MatchModel.updateOne({ _id: ObjectId(match._id) }, { eStatus, sWinning: winning, 'oHomeTeam.nScore': teamAScore, 'oAwayTeam.nScore': teamBScore, dUpdatedAt: Date.now() })
    return { isSuccess: true, status: status.OK, message: messages[userLanguage].update_success.replace('##', messages[userLanguage].cscorePoint) }
  } else {
    return { isSuccess: true, status: status.OK, message: messages[userLanguage].match_not_started }
  }
}

/**
 * This will caluculate the score points of cricket according to match provider.
 * @param {*} match match related data
 * @returns this will return success if successfully score point calculated otherwise return false.
 */
async function calculateScorePointCricket(match) {
  const { eProvider, _id, sName, eCategory, eStatus } = match
  let result
  if (eProvider === 'ENTITYSPORT') {
    result = await cricketScorePointByEntitySport(match, 'English')
  } else if (eProvider === 'SPORTSRADAR') {
    result = await cricketScorePointBySportsRadar(match, 'English')
  } else {
    result = { isSuccess: false }
  }
  if (!result.isSuccess) {
    return { isSuccess: false, _id, sName, eCategory, eStatus }
  } else {
    return { isSuccess: true, _id, sName, eCategory, eStatus }
  }
}

/**
 * This will caluculate the score points of soccer according to match provider.
 * @param {*} match match related data
 * @returns this will return success if successfully score point calculated otherwise return false.
 */
async function calculateScorePointFootball(match) {
  const { eProvider, _id, sName, eCategory, eStatus } = match
  let result
  if (eProvider === 'ENTITYSPORT') {
    result = await soccerScorePointByEntitySport(match, 'English')
  } else if (eProvider === 'SPORTSRADAR') {
    result = await soccerScorePointBySportsRadar(match, 'English')
  } else {
    result = { isSuccess: false }
  }
  if (!result.isSuccess) {
    return { isSuccess: false, _id, sName, eCategory, eStatus }
  } else {
    return { isSuccess: true, _id, sName, eCategory, eStatus }
  }
}

/**
 * This will caluculate the score points of kabaddi according to match provider.
 * @param {*} match match related data
 * @returns this will return success if successfully score point calculated otherwise return false.
 */
async function calculateScorePointKabaddi(match) {
  const { eProvider, _id, sName, eCategory, eStatus } = match
  let result
  if (eProvider === 'ENTITYSPORT') {
    result = await kabaddiScorePointByEntitySport(match)
  }
  if (!result.isSuccess) {
    return { isSuccess: false, _id, sName, eCategory, eStatus }
  } else {
    return { isSuccess: true, _id, sName, eCategory, eStatus }
  }
}

/**
 * This will caluculate the score points of basketball according to match provider.
 * @param {*} match match related data
 * @returns this will return success if successfully score point calculated otherwise return false.
 */
async function calculateScorePointBasketball(match) {
  const { eProvider, _id, sName, eCategory, eStatus } = match
  let result
  if (eProvider === 'ENTITYSPORT') {
    result = await basketballScorePointByEntitySport(match)
  } else if (eProvider === 'SPORTSRADAR') {
    result = { isSuccess: false }
  } else {
    result = { isSuccess: false }
  }

  if (!result.isSuccess) {
    return { isSuccess: false, _id, sName, eCategory, eStatus }
  } else {
    return { isSuccess: true, _id, sName, eCategory, eStatus }
  }
}

// Calculate total score point for each team
async function calculateTotalScorePoint(oMatchPoint) {
  try {
    if (!oMatchPoint?.isSuccess) {
      console.log('POINT NOT CALCULATED FOR THIS MATCH:', oMatchPoint.sName, oMatchPoint.eCategory)
    }

    const { _id: iMatchId, eCategory, eStatus: sMatchStatus } = oMatchPoint

    const [points, matchPlayers] = await Promise.all([
      PlayerRoleModel.findOne({ eCategory: eCategory }, { nCaptainPoint: 1, nViceCaptainPoint: 1 }).lean().cache(CACHE_8, `playerRole:${eCategory}`),
      MatchPlayerModel.find({ iMatchId: iMatchId }, { nScoredPoints: 1 }).lean()
    ])

    const oMatchPlayers = {}
    matchPlayers.forEach((player) => {
      oMatchPlayers[player._id.toString()] = player.nScoredPoints
    })
    const aMatchTeams = await MatchTeamsModel.aggregate([
      { $match: { iMatchId: ObjectId(iMatchId) } },
      { $group: { _id: '$sHash', aPlayers: { $first: '$aPlayers' } } },
      { $sort: { _id: 1 } }
    ]).allowDiskUse(bAllowDiskUse).cursor({ batchSize: 1000 })

    const aMatchTeamHash = []
    const aPromiseUpdatePoint = []
    for await (const matchTeam of aMatchTeams) {
      aMatchTeamHash.push(matchTeam)
      if (aMatchTeamHash.length > 2500) {
        const oData = { aMatchTeamHash: aMatchTeamHash.splice(0, 2500), iMatchId, oMatchPlayers, points, sMatchStatus }
        aPromiseUpdatePoint.push(updatePointInRedis(oData))
      }
    }

    if (aMatchTeamHash.length) {
      const oData = { aMatchTeamHash, iMatchId, oMatchPlayers, points, sMatchStatus }
      aPromiseUpdatePoint.push(updatePointInRedis(oData))
    }

    await Promise.all(aPromiseUpdatePoint)
    console.log('Calculated', iMatchId)

    if (sMatchStatus === 'L') {
      redisClient2.expire(`matchTeams:${iMatchId}`, 86400)
      await redisClient2.evalsha('7c9e5fe3ba55a282c6411828b146cfddba88d65f', 1, iMatchId).then().catch()
    }
  } catch (error) {
    handleCatchError(error)
  }
}

async function updatePointInRedis(data) {
  try {
    const { aMatchTeamHash, iMatchId, oMatchPlayers, points, sMatchStatus } = data
    const aHash = []
    const aBulkMatchTeamPlayer = []
    const aBulkUserTeam = []
    const aBulkUserLeague = []
    const oMatchTeamPoint = {}

    for (const oMatchTeam of aMatchTeamHash) {
      const sHash = oMatchTeam._id
      aHash.push(sHash)

      let totalPoint = 0
      const point = oMatchTeam.aPlayers.map((player) => {
        totalPoint = totalPoint + oMatchPlayers[player.iMatchPlayerId.toString()]
        return { ...player, nScoredPoints: oMatchPlayers[player.iMatchPlayerId.toString()] }
      })

      oMatchTeamPoint[sHash] = totalPoint

      aBulkMatchTeamPlayer.push({
        updateMany: {
          filter: { sHash: sHash },
          update: { $set: { nTotalPoint: totalPoint, aPlayers: point } }
        }
      })
    }

    const teams = await UserTeamModel.find({ iMatchId, sHash: { $in: aHash } }).lean().cache(CACHE_8, `userTeam:calculateTotalScorePoint:${aHash}`)

    const aRedisMatchTeams = []

    for (const team of teams) {
      let nTotalPoints = oMatchTeamPoint[team.sHash] - (oMatchPlayers[team.iViceCaptainId.toString()] + oMatchPlayers[team.iCaptainId.toString()])
      nTotalPoints = nTotalPoints + (oMatchPlayers[team.iViceCaptainId.toString()] * points.nViceCaptainPoint) + (oMatchPlayers[team.iCaptainId.toString()] * points.nCaptainPoint)

      if (sMatchStatus === 'L') {
        if (aRedisMatchTeams.length > 5000) {
          const arrChunk = aRedisMatchTeams.splice(0, 5000)
          await redisClient2.hset(`matchTeams:${iMatchId}`, ...arrChunk).then().catch()
        }
        aRedisMatchTeams.push(team._id, nTotalPoints)
      }
      // NOTE: Commenting this portion of code as this else scope will not run in live matches
      // else {
      //   aBulkUserTeam.push({
      //     updateOne: {
      //       filter: { _id: ObjectId(team._id) },
      //       update: { $set: { nTotalPoints } }
      //     }
      //   })
      //   aBulkUserLeague.push({
      //     updateMany: {
      //       filter: { iUserTeamId: ObjectId(team._id) },
      //       update: { $set: { nTotalPoints } }
      //     }
      //   })
      // }
    }

    if (aRedisMatchTeams.length) await redisClient2.hset(`matchTeams:${iMatchId}`, ...aRedisMatchTeams).then().catch()
    // Note: Here, we don't need bulk update for UserTeam, UserLeague
    // await Promise.all([
    //   UserTeamModel.bulkWrite(aBulkUserTeam, { writeConcern: { w: 'majority' }, ordered: false }),
    //   UserLeagueModel.bulkWrite(aBulkUserLeague, { writeConcern: { w: 'majority' }, ordered: false }),
    //   MatchTeamsModel.bulkWrite(aBulkMatchTeamPlayer, { writeConcern: { w: 'majority' }, ordered: false })
    // ])
    await MatchTeamsModel.bulkWrite(aBulkMatchTeamPlayer, { writeConcern: { w: 'majority' }, ordered: false })
  } catch (error) {
    handleCatchError(error)
  }
}

module.exports = {
  soccerScorePointByEntitySport,
  soccerScorePointBySportsRadar,
  cricketScorePointByEntitySport,
  cricketScorePointBySportsRadar,
  kabaddiScorePointByEntitySport,
  basketballScorePointByEntitySport,
  basketballScorePointBySportsRadar,
  calculateScorePointCricket,
  calculateScorePointFootball,
  calculateScorePointKabaddi,
  calculateScorePointBasketball,
  calculateTotalScorePoint
}
