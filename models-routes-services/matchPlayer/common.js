const ApiLogModel = require('../apiLog/ApiLog.model')
const { messages, status } = require('../../helper/api.responses')
const { handleCatchError } = require('../../helper/utilities.services')
const config = require('../../config/config')
const axios = require('axios')
const apiLogQueue = require('../../rabbitmq/queue/apiLogQueue')

/**
 * It'll dump particular cricket match's lineUpsOut match player details from Entity sports api to our system.
 * @param {object} match details
 * @param {*} userLanguage English or Hindi(In future)
 * @returns It'll dump particular cricket match's lineUpsOut match player details from Entity sports api to our system.
 */
async function fetchPlaying11FromEntitySport(match, userLanguage = 'English') {
  try {
    const { sKey } = match
    let response
    try {
      response = await axios.get(`https://rest.entitysport.com/v2/matches/${sKey}/squads`,
        {
          params: {
            token: config.ENTITYSPORT_CRICKET_API_KEY
          }
        })
    } catch (error) {
      const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://rest.entitysport.com/v2/matches/${sKey}/squads` }
      apiLogQueue.publish(logData)
      // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://rest.entitysport.com/v2/matches/${sKey}/squads` })
      return {
        isSuccess: false,
        status: status.OK,
        message: messages[userLanguage].no_lineups,
        data: {}
      }
    }
    const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data.response, sUrl: `https://rest.entitysport.com/v2/matches/${sKey}/squads` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data.response, sUrl: `https://rest.entitysport.com/v2/matches/${sKey}/squads` })
    const data = response.data ? response.data.response : null
    const teamA = (data && data.teama) ? data.teama.squads : ''
    const teamB = (data && data.teamb) ? data.teamb.squads : ''
    const teamData = [...teamA, ...teamB]

    const playerKey = []
    const substitutePlayerKey = []
    for (const data of teamData) {
      const team = data
      // need to push if substitute is true
      // NOTE: This change made because of new IPL rules, before only we are considering playing11
      if ((team.playing11 !== undefined && team.playing11 === 'true')) {
        playerKey.push(team.player_id)
      }
      if (team?.substitute !== undefined && team?.substitute === 'true') {
        substitutePlayerKey.push(team.player_id)
      }
    }

    return {
      isSuccess: true,
      status: status.OK,
      message: null,
      data: playerKey,
      sData: substitutePlayerKey,
      match
    }
  } catch (err) {
    handleCatchError(err)
    return {
      isSuccess: false,
      status: status.OK,
      message: messages[userLanguage].no_lineups,
      data: {}
    }
  }
}

/**
 * It'll dump particular soccer match's lineUpsOut match player details from Entity sports api to our system.
 * @param {object} match details
 * @param {*} userLanguage English or Hindi(In future)
 * @returns It'll dump particular soccer match's lineUpsOut match player details from Entity sports api to our system.
 */
async function fetchPlaying11FromSoccerEntitySport(match, userLanguage = 'English') {
  const { sKey } = match
  let response
  try {
    response = await axios.get(`https://soccer.entitysport.com/matches/${sKey}/info`, { params: { token: config.ENTITYSPORT_SOCCER_API_KEY } })
  } catch (error) {
    const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://soccer.entitysport.com/matches/${sKey}/info` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://soccer.entitysport.com/matches/${sKey}/info` })
    return {
      isSuccess: false,
      status: status.OK,
      message: messages[userLanguage].no_lineups,
      data: []
    }
  }
  const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data.response.items, sUrl: `https://soccer.entitysport.com/matches/${sKey}/info` }
  apiLogQueue.publish(logData)
  // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data.response.items, sUrl: `https://soccer.entitysport.com/matches/${sKey}/info` })
  // const isLineupAvailable = response.data.response.items.match_info[0].lineupavailable
  // if (isLineupAvailable === 'false') return { isSuccess: false, status: status.OK, message: messages[userLanguage].no_lineups, data: [] }
  // console.log({isLineupAvailable})
  const data = response.data ? response.data.response.items : null
  const teamA = (data && data.lineup) ? data.lineup.home : null
  const teamB = (data && data.lineup) ? data.lineup.away : null
  const teamALineUpsPlayers = (teamA && teamA.lineup) ? teamA.lineup.player : ''
  const teamBLineUpsPlayers = (teamB && teamB.lineup) ? teamB.lineup.player : ''
  const finalPlayersData = [...teamALineUpsPlayers, ...teamBLineUpsPlayers]
  const playerKey = []
  for (const data of finalPlayersData) {
    playerKey.push(data.pid)
  }
  let substitutePlayerKey = (teamA?.substitutes && teamB?.substitutes) ? [...teamA.substitutes, ...teamB.substitutes] : []
  substitutePlayerKey = substitutePlayerKey.length ? substitutePlayerKey.map(e => e.pid) : []
  return {
    isSuccess: true,
    status: status.OK,
    message: null,
    data: playerKey,
    sData: substitutePlayerKey,
    match
  }
}

/**
 * It'll dump particular kabaddi match's starting7 match player details from Entity sports api to our system.
 * @param {object} match details
 * @param {*} userLanguage English or Hindi(In future)
 * @returns It'll dump particular kabaddi match's starting7 match player details from Entity sports api to our system.
 */
async function fetchStarting7FromKabaddiEntitySport(match, userLanguage = 'English') {
  const { sKey } = match
  let response
  try {
    response = await axios.get(`https://rest.entitysport.com/kabaddi/matches/${sKey}/info`, { params: { token: config.ENTITYSPORT_KABADDI_API_KEY } })
  } catch (error) {
    const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://kabaddi.entitysport.com/matches/${sKey}/info` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://kabaddi.entitysport.com/matches/${sKey}/info` })
    return {
      isSuccess: false,
      status: status.OK,
      message: messages[userLanguage].no_kabaddi_lineups,
      data: []
    }
  }
  const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data.response.items, sUrl: `https://kabaddi.entitysport.com/matches/${sKey}/info` }
  apiLogQueue.publish(logData)
  // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data.response.items, sUrl: `https://kabaddi.entitysport.com/matches/${sKey}/info` })
  const { home, away } = response.data.response.items.lineup
  const teamA = home ? home.starting7 : []
  const teamB = away ? away.starting7 : []
  const finalPlayersData = [...teamA, ...teamB]

  const playerKey = []
  // NOTE: We are not getting substitute player detail in basketball. that's why below is empty array
  const substitutePlayerKey = []
  for (const data of finalPlayersData) {
    playerKey.push(data.pid)
  }
  return {
    isSuccess: true,
    status: status.OK,
    message: null,
    data: playerKey,
    sData: substitutePlayerKey,
    match
  }
}

/**
 * It'll dump particular basketball match's starting5 match player details from Entity sports api to our system.
 * @param {object} match details
 * @param {*} userLanguage English or Hindi(In future)
 * @returns It'll dump particular basketball match's starting5 match player details from Entity sports api to our system.
 */
async function fetchStarting5FromBasketballEntitySport(match, userLanguage = 'English') {
  const { sKey } = match
  let response
  try {
    response = await axios.get(`https://basketball.entitysport.com/matches/${sKey}/info`, { params: { token: config.ENTITYSPORT_BASKETBALL_API_KEY } })
  } catch (error) {
    const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://basketball.entitysport.com/matches/${sKey}/info` }
    apiLogQueue.publish(logData)
    // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: error?.response?.data, sUrl: `https://basketball.entitysport.com/matches/${sKey}/info` })
    return {
      isSuccess: false,
      status: status.OK,
      message: messages[userLanguage].no_basketball_lineups,
      data: []
    }
  }
  const logData = { sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data.response.items, sUrl: `https://basketball.entitysport.com/matches/${sKey}/info` }
  apiLogQueue.publish(logData)
  // await ApiLogModel.create({ sKey: match.sKey, iMatchId: match._id, eCategory: match.eCategory, eType: 'LINEUP', eProvider: match.eProvider, oData: response.data.response.items, sUrl: `https://basketball.entitysport.com/matches/${sKey}/info` })
  const { home, away } = response.data.response.items.lineup.players
  const teamA = home || []
  const teamB = away || []
  const finalPlayersData = [...teamA, ...teamB]

  const playerKey = []
  // NOTE: We are not getting substitute player detail in basketball. that's why below is empty array
  const substitutePlayerKey = []
  for (const data of finalPlayersData) {
    playerKey.push(data.pid)
  }
  return {
    isSuccess: true,
    status: status.OK,
    message: null,
    data: playerKey,
    sData: substitutePlayerKey,
    match
  }
}

module.exports = {
  fetchPlaying11FromEntitySport,
  fetchPlaying11FromSoccerEntitySport,
  fetchStarting7FromKabaddiEntitySport,
  fetchStarting5FromBasketballEntitySport
}
