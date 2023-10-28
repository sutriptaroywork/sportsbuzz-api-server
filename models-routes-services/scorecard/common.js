const axios = require('axios')
const PlayerModel = require('../player/model')
const MatchModel = require('../match/model')
const TeamModel = require('../team/model')
const ApiLogModel = require('../apiLog/ApiLog.model')
const FullScorecardsModel = require('../scorecard/model')
const LiveInningsModel = require('./liveInnings/model')
const { handleCatchError } = require('../../helper/utilities.services')
const { messages, status } = require('../../helper/api.responses')
const config = require('../../config/config')
const apiLogQueue = require('../../rabbitmq/queue/apiLogQueue')

const getTeamIdFromKey = async (query) => {
  const team = await TeamModel.findOne(query, { _id: 1 }).lean()
  return !team ? null : team._id
}

const getTeamDataFromKey = async (query) => {
  return await TeamModel.findOne(query).lean()
}

const getPlayerIdFromKey = async (query) => {
  const player = await PlayerModel.findOne(query, { _id: 1 }).lean()
  return !player ? null : player._id
}

const updateLiveFullScorecardData = (idData, data) => {
  return new Promise((resolve, reject) => {
    FullScorecardsModel.findOneAndUpdate({ iMatchId: idData._id }, data, { upsert: true, new: true }).populate([
      { path: 'oMatch', select: 'sTitle sSubtitle sFormatStr' },
      { path: 'oSeries', select: 'sTitle sAbbr sSeason' },
      { path: 'oToss.oWinnerTeam', select: '_id sTitle sAbbr sThumbUrl' },
      { path: 'oTeamScoreA.oTeam', select: '_id sTitle sAbbr sThumbUrl' },
      { path: 'oTeamScoreB.oTeam', select: '_id sTitle sAbbr sThumbUrl' },
      { path: 'oMom', select: 'sTitle sShortName sFullName' },
      { path: 'oMos', select: 'sTitle sShortName sFullName' }
    ]).then(s => {
      resolve(s)
    }).catch(error => {
      handleCatchError(error)
      reject(error)
    })
  })
}

const updateLiveInningData = (idData, data) => {
  return new Promise(async(resolve, reject) => {
    try {
      const exist = await LiveInningsModel.countDocuments({ iMatchId: idData._id, nInningNumber: idData.nInningNumber }, { readPreference: 'primary' })
      if (exist) {
        const s = await LiveInningsModel.updateOne({ iMatchId: idData._id, nInningNumber: idData.nInningNumber }, data)
        return resolve(s)
      } else {
        if (data.sInningId && data.eProvider) {
          const s = await LiveInningsModel.create({ iMatchId: idData._id, nInningNumber: idData.nInningNumber, ...data })
          return resolve(s)
        }
        return resolve()
      }
    } catch (error) {
      handleCatchError(error)
      return reject(error)
    }
  })
}

const updateFullScorecard = async (data) => {
  try {
    const {
      latest_inning_number: nLatestInningNumber,
      man_of_the_match: oMom,
      man_of_the_series: oMos,
      is_followon: bIsFollowOn,
      win_margin: sWinMargin,
      current_over: sCurrentOver,
      previous_over: sPreviousOver,
      last_five_overs: sLastFiveOvers,
      teama,
      teamb,
      live: sLiveMatchNote,
      result: sResult,
      status
    } = data
    await updateMatch(data._id, nLatestInningNumber)
    const oTeamScoreA = {}
    const oTeamScoreB = {}
    let sMomKey = ''
    let sMosKey = ''
    const teamAdata = await getTeamDataFromKey({ sKey: teama.team_id, eCategory: data.eCategory, eProvider: data.eProvider })
    oTeamScoreA.iTeamId = teamAdata._id
    oTeamScoreA.sScoresFull = teama.scores_full
    oTeamScoreA.sScores = teama.scores
    oTeamScoreA.sOvers = teama.overs
    oTeamScoreA.oTeam = {
      _id: teamAdata._id,
      sTitle: teamAdata.sTitle,
      sAbbr: teamAdata.sAbbr
    }

    const teamBdata = await getTeamDataFromKey({ sKey: teamb.team_id, eCategory: data.eCategory, eProvider: data.eProvider })

    oTeamScoreB.iTeamId = teamBdata._id
    oTeamScoreB.sScoresFull = teamb.scores_full
    oTeamScoreB.sScores = teamb.scores
    oTeamScoreB.sOvers = teamb.overs
    oTeamScoreB.oTeam = {
      _id: teamBdata._id,
      sTitle: teamBdata.sTitle,
      sAbbr: teamBdata.sAbbr
    }

    sMomKey = oMom.pid || null
    sMosKey = oMos.pid || null
    const updatedData = {
      iMatchId: data._id,
      iSeriesId: data.iSeriesId,
      sVenue: data.sVenue,
      nLatestInningNumber,
      oTeamScoreA,
      oTeamScoreB,
      sLiveMatchNote,
      sResult,
      bIsFollowOn,
      sWinMargin,
      sCurrentOver,
      sPreviousOver,
      eProvider: data.eProvider
    }
    if (!nLatestInningNumber) delete updatedData.nLatestInningNumber
    if (sLastFiveOvers && typeof sLastFiveOvers === 'string') updatedData.sLastFiveOvers = sLastFiveOvers

    if (sMomKey) updatedData.iMomId = await getPlayerIdFromKey({ sKey: sMomKey, eCategory: data.eCategory, eProvider: data.eProvider })
    if (sMosKey) updatedData.iMosId = await getPlayerIdFromKey({ sKey: sMosKey, eCategory: data.eCategory, eProvider: data.eProvider })

    updateLiveFullScorecardData({ _id: data._id }, updatedData).then().catch(error => handleCatchError(error))

    if (data.innings && data.innings.length) {
      for (let i = 0; i < data.innings.length; i++) {
        const {
          iid: sInningId,
          number: nInningNumber,
          name: sName,
          short_name: sShortName,
          batting_team_id: sBattingTeamKey,
          fielding_team_id: sFieldingTeamKey,
          batsmen: aBatsman,
          bowlers: aBowler,
          fielder: aFielder,
          last_wicket: sLaskWicket,
          fows: aFow,
          extra_runs: oER,
          equations: oEq,
          current_partnership: oCP,
          status,
          result
        } = data.innings[i]

        const aBatters = []
        const aBowlers = []
        const aFielders = []
        const aFOWs = []

        for (const s of aBatsman) {
          const obj = {}

          if (s.batsman_id) obj.iBatterId = await getPlayerIdFromKey({ sKey: s.batsman_id, eCategory: data.eCategory, eProvider: data.eProvider })
          obj.isBatting = s.batting === 'true'
          if (s.position && s.batting === 'true') obj.ePosition = s.position === 'striker' ? 's' : 'ns'
          obj.nRuns = s.runs
          obj.nBallFaced = s.balls_faced
          obj.nFours = s.fours
          obj.nSixes = s.sixes
          obj.nDots = s.run0
          obj.nSingles = s.run1
          obj.nDoubles = s.run2
          obj.nThree = s.run3
          obj.nFives = s.run5
          obj.sHowOut = s.how_out
          if (s.dismissal) obj.eDismissal = s.dismissal
          obj.sStrikeRate = s.strike_rate
          if (s.bowler_id) obj.iBowlerId = await getPlayerIdFromKey({ sKey: s.bowler_id, eCategory: data.eCategory, eProvider: data.eProvider })
          if (s.first_fielder_id) obj.iFirstFielderId = await getPlayerIdFromKey({ sKey: s.first_fielder_id, eCategory: data.eCategory, eProvider: data.eProvider })
          if (s.second_fielder_id) obj.iSecondFielderId = await getPlayerIdFromKey({ sKey: s.second_fielder_id, eCategory: data.eCategory, eProvider: data.eProvider })
          if (s.third_fielder_id) obj.iThirdFielderId = await getPlayerIdFromKey({ sKey: s.third_fielder_id, eCategory: data.eCategory, eProvider: data.eProvider })

          if (obj.iBatterId) aBatters.push(obj)
        }
        for (const s of aBowler) {
          const obj = {}

          if (s.bowler_id) obj.iBowlerId = await getPlayerIdFromKey({ sKey: s.bowler_id, eCategory: data.eCategory, eProvider: data.eProvider })
          obj.bIsBowling = s.bowling === 'true'
          if (s.position) obj.ePosition = s.position === 'active bowler' ? 'ab' : 'lb'
          obj.sOvers = s.overs
          obj.nMaidens = s.maidens
          obj.nRunsConducted = s.runs_conceded
          obj.nWickets = s.wickets
          obj.nNoBalls = s.noballs
          obj.nWides = s.wides
          obj.nDotBalls = s.run0
          obj.sEcon = s.econ
          obj.nBowled = s.bowledcount
          obj.nLbw = s.lbwcount

          if (obj.iBowlerId) aBowlers.push(obj)
        }
        for (const s of aFielder) {
          const obj = {}
          if (s.fielder_id) obj.iFielderId = await getPlayerIdFromKey({ sKey: s.fielder_id, eCategory: data.eCategory, eProvider: data.eProvider })
          obj.sFielderName = s.fielder_name
          obj.nCatches = s.catches
          obj.nRunoutThrow = s.runout_thrower
          obj.nRunoutCatcher = s.runout_catcher
          obj.nRunoutDirect = s.runout_direct_hit
          obj.bIsSubstitute = s.is_substitute
          obj.nStumping = s.stumping

          if (obj.iFielderId) aFielders.push(obj)
        }
        for (const s of aFow) {
          const obj = {}
          if (s.batsman_id) obj.iBatterId = await getPlayerIdFromKey({ sKey: s.batsman_id, eCategory: data.eCategory, eProvider: data.eProvider })
          obj.nRuns = s.runs
          obj.nBallFaced = s.balls
          obj.sHowOut = s.how_out
          obj.nScoreDismissal = s.score_at_dismissal
          obj.sOverDismissal = s.overs_at_dismissal
          if (s.bowler_id) obj.iBowlerId = await getPlayerIdFromKey({ sKey: s.bowler_id, eCategory: data.eCategory, eProvider: data.eProvider })
          obj.eDismissal = s.dismissal
          obj.nWicketNumber = s.number

          aFOWs.push(obj)
        }

        const oLastWicket = {
          // iBatterId: await getPlayerIdFromKey({ sKey: sLaskWicket.batsman_id, eCategory: data.eCategory, eProvider: data.eProvider }),
          nRuns: sLaskWicket.runs,
          nBallFaced: sLaskWicket.balls,
          sHowOut: sLaskWicket.how_out,
          nScoreDismissal: sLaskWicket.score_dismissal,
          sOverDismissal: sLaskWicket.over_dismissal,
          // iBowlerId: await getPlayerIdFromKey({ sKey: sLaskWicket.bowler_i, eCategory: data.eCategory, eProvider: data.eProvider }),
          eDismissal: sLaskWicket.dismissal,
          nWicketNumber: sLaskWicket.number
        }
        if (sLaskWicket.batsman_id) oLastWicket.iBatterId = await getPlayerIdFromKey({ sKey: sLaskWicket.batsman_id, eCategory: data.eCategory, eProvider: data.eProvider })
        if (sLaskWicket.bowler_i) oLastWicket.iBowlerId = await getPlayerIdFromKey({ sKey: sLaskWicket.bowler_i, eCategory: data.eCategory, eProvider: data.eProvider })

        const oExtraRuns = {
          nByes: oER.byes,
          nLegByes: oER.legbyes,
          nWides: oER.wides,
          nNoBalls: oER.noballs,
          nPenalty: oER.penalty,
          nTotal: oER.total
        }
        const oEquations = {
          nRuns: oEq.runs,
          nWickets: oEq.wickets,
          sOvers: oEq.overs,
          nBowlersUsed: oEq.bowlers_used,
          sRunRate: oEq.runrate
        }

        let oCurrentPartnership = {}
        if (oCP && 'runs' in oCP) {
          oCurrentPartnership = {
            nRuns: oCP.runs,
            nBalls: oCP.balls,
            sOvers: oCP.overs,
            aBatters: []
          }
          for (const s of oCP.batsmen) {
            const obj = {}
            if (s.batsman_id) obj.iBatterId = await getPlayerIdFromKey({ sKey: s.batsman_id, eCategory: data.eCategory, eProvider: data.eProvider })
            obj.nRuns = s.runs
            obj.nBalls = s.balls

            if (obj.iBatterId) oCurrentPartnership.aBatters.push(obj)
          }
        }

        const liveInningUpdatedData = {
          iMatchId: data._id,
          sInningId,
          nInningNumber,
          sName,
          sShortName,
          iBattingTeamId: await getTeamIdFromKey({ sKey: sBattingTeamKey, eCategory: data.eCategory, eProvider: data.eProvider }),
          iFieldingTeamId: await getTeamIdFromKey({ sKey: sFieldingTeamKey, eCategory: data.eCategory, eProvider: data.eProvider }),
          aBatters,
          aBowlers,
          aFielders,
          aFOWs,
          oLastWicket,
          oExtraRuns,
          oEquations,
          eProvider: data.eProvider
        }

        liveInningUpdatedData.sStatusStr = status
        liveInningUpdatedData.sResultStr = result
        if (Object.keys(oCurrentPartnership).length) liveInningUpdatedData.oCurrentPartnership = oCurrentPartnership
        updateLiveInningData({ _id: data._id, nInningNumber }, liveInningUpdatedData).then().catch(error => handleCatchError(error))
      }
    }

    let liveUpdatedData = {}
    Object.assign(liveUpdatedData, { iMomId: updatedData.iMomId, iMosId: updatedData.iMosId })
    liveUpdatedData.sStatusStr = status

    const matchLiveData = await axios.get(`https://rest.entitysport.com/v2/matches/${data.sKey}/live`, { params: { token: config.ENTITYSPORT_CRICKET_API_KEY } })

    const logData = { sKey: data.sKey, iMatchId: data._id, eCategory: data.eCategory, eType: 'SCORECARD', eProvider: data.eProvider, oData: matchLiveData.data.response, sUrl: `https://rest.entitysport.com/v2/matches/${data.sKey}/live` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: data.sKey, iMatchId: data._id, eCategory: data.eCategory, eType: 'SCORECARD', eProvider: data.eProvider, oData: matchLiveData.data.response, sUrl: `https://rest.entitysport.com/v2/matches/${data.sKey}/live` })
    if (typeof matchLiveData.data.response !== 'string') {
      const { status: sStatus, game_state: sGameStatus, status_note: sStatusNote, live_inning_number: nLatestInningNumber, batsmen, bowlers, commentary: bIsCommentary, wagon: bIsWagon, live_score: oLiveScore, live_inning: oLiveInning } = matchLiveData.data.response

      const aActiveBatters = []
      const aActiveBowlers = []
      if (batsmen && batsmen.length) {
        for (const s of batsmen) {
          const obj = {}

          if (s.batsman_id) obj.iBatterId = await getPlayerIdFromKey({ sKey: s.batsman_id, eCategory: data.eCategory, eProvider: data.eProvider })
          obj.nRuns = s.runs
          obj.nBallFaced = s.balls_faced
          obj.nFours = s.fours
          obj.nSixes = s.sixes
          obj.sStrikeRate = s.strike_rate
          if (obj.iBatterId) aActiveBatters.push(obj)
        }
      }
      if (bowlers && bowlers.length) {
        for (const s of bowlers) {
          const obj = {}
          if (s.bowler_id) obj.iBowlerId = await getPlayerIdFromKey({ sKey: s.bowler_id, eCategory: data.eCategory, eProvider: data.eProvider })
          obj.sOvers = s.overs
          obj.nRunsConceded = s.runs_conceded
          obj.nWickets = s.wickets
          obj.nMaidens = s.maidens
          obj.sEcon = s.econ
          if (obj.iBowlerId) aActiveBowlers.push(obj)
        }
      }

      liveUpdatedData = {
        aActiveBatters,
        aActiveBowlers,
        sStatusNote,
        nLatestInningNumber,
        bIsCommentary: bIsCommentary === 1,
        bIsWagon: bIsWagon === 1
      }

      if (oLiveInning && oLiveInning.last_five_overs && typeof oLiveInning.last_five_overs === 'string') liveUpdatedData.sLastFiveOvers = oLiveInning.last_five_overs

      if (oLiveInning && oLiveInning.last_ten_overs && typeof oLiveInning.last_ten_overs === 'string') liveUpdatedData.sLastTenOvers = oLiveInning.last_ten_overs
      // add live score
      if (Object.keys(oLiveScore).length) {
        const {
          runs: nRuns, overs: sOvers, wickets: nWickets, target: nTarget, runrate: nRunrate,
          required_runrate: sRequiredRunrate
        } = oLiveScore

        liveUpdatedData.oLiveScore = {
          nRuns,
          sOvers: sOvers.toString(),
          nWickets,
          nTarget,
          nRunrate,
          sRequiredRunrate: sRequiredRunrate.toString()
        }
      }

      liveUpdatedData.sStatusStr = sStatus
      liveUpdatedData.sLiveGameStatusStr = sGameStatus

      updateLiveInningData({ _id: data._id, nInningNumber: nLatestInningNumber }, liveUpdatedData).then().catch(error => handleCatchError(error))
      updateLiveFullScorecardData({ _id: data._id }, liveUpdatedData).then().catch(error => handleCatchError(error))
    }
  } catch (error) {
    return handleCatchError(error)
  }
}

const updateMatch = async (_id, nLatestInningNumber) => {
  await MatchModel.updateOne({ _id }, { nLatestInningNumber, bScorecardShow: true })
}

const cricketScoreCardByEntitySport = async (match, userLanguage = 'English') => {
  try {
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
      return { bSuccess: false, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }
    }
    const logData = { sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: response.data.response, sUrl: `https://rest.entitysport.com/v2/matches/${match.sKey}/scorecard` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eType: 'SCOREPOINT', eCategory: match.eCategory, eProvider: match.eProvider, oData: response.data.response, sUrl: `https://rest.entitysport.com/v2/matches/${match.sKey}/scorecard` })
    const data = response.data.response

    if (!data) return { bSuccess: false, status: status.OK, message: messages[userLanguage].match_not_started, data: {} }

    data._id = match._id
    data.sKey = match.sKey
    data.iSeriesId = match.iSeriesId
    data.iVenueId = match.iVenueId
    data.eProvider = 'ENTITYSPORT'
    data.eCategory = match.eCategory
    await updateFullScorecard(data)
    return { bSuccess: true, status: status.OK, message: messages[userLanguage].update_success.replace('##', messages[userLanguage].cscorePoint), data: {} }
  } catch (error) {
    handleCatchError(error)
    return { bSuccess: false, status: status.InternalServerError, message: messages[userLanguage].error, data: {} }
  }
}

module.exports = { updateFullScorecard, cricketScoreCardByEntitySport }
