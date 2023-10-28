/* eslint-disable eqeqeq */
const axios = require('axios')
const TeamModel = require('../team/model')
const ApiLogModel = require('../apiLog/ApiLog.model')
const MatchLeagueModel = require('../matchLeague/model')
const LeagueCategoryModel = require('../leagueCategory/model')
const { messages, status } = require('../../helper/api.responses')
const config = require('../../config/config')
const { getS3ImageURL } = require('../../helper/s3config')
const { handleCatchError } = require('../../helper/utilities.services')
const apiLogQueue = require('../../rabbitmq/queue/apiLogQueue')

/**
 * Used for fetch refresh data for particular cricket match
 * @param  {object} oMatch = {sKey, eProvider}
 * @param  {string} userLanguage='English'
 * @return {object} {isSuccess, status, message, data}
 */
async function getCricketRefreshMatchData(oMatch, userLanguage = 'English') {
  try {
    const { sKey, eProvider } = oMatch
    const data = {}

    switch (eProvider) {
      case 'ENTITYSPORT':
        try {
          let result = await axios.get(`https://rest.entitysport.com/v2/matches/${sKey}/info`,
            {
              params: {
                token: config.ENTITYSPORT_CRICKET_API_KEY
              }
            })
          if (!result.data || !result.data.response) {
            return {
              isSuccess: false,
              status: status.OK,
              message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
              data: {}
            }
          }
          result = result.data.response
          const logData = { sKey, iMatchId: oMatch._id, eCategory: 'CRICKET', eType: 'MATCHES', eProvider, oData: result, sUrl: `https://rest.entitysport.com/v2/matches/${sKey}/info` }

          apiLogQueue.publish(logData)
          // await ApiLogModel.create({ sKey, iMatchId: oMatch._id, eCategory: 'CRICKET', eType: 'MATCHES', eProvider, oData: result, sUrl: `https://rest.entitysport.com/v2/matches/${sKey}/info` })

          const { teama, teamb, format, venue } = result
          const sHomeTeamKey = teama.team_id
          const sAwayTeamKey = teamb.team_id
          if (!sHomeTeamKey || !sAwayTeamKey) {
            return {
              isSuccess: false,
              status: status.OK,
              message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
              data: {}
            }
          }

          let gender
          if (format && (format == 6 || format == 7)) {
            gender = 'Women'
          } else {
            gender = 'men'
          }
          teama.name = (gender === 'women') ? teama.name.toString().concat(' -Women') : teama.name
          teamb.name = (gender === 'women') ? teamb.name.toString().concat(' -Women') : teamb.name
          teama.short_name = (gender === 'women') ? teama.short_name.toString().concat(' -W') : teama.short_name
          teamb.short_name = (gender === 'women') ? teamb.short_name.toString().concat(' -W') : teamb.short_name

          const HomeTeamInfo = await TeamModel.findOne({ sKey: sHomeTeamKey, eCategory: 'CRICKET' }, { sKey: 1, _id: 1, sImage: 1, sName: 1, sShortName: 1 }).lean()
          if (HomeTeamInfo) {
            data.oHomeTeam = {}
            if (!HomeTeamInfo.sImage) {
              data.oHomeTeam.sImage = await updateTeamImage(HomeTeamInfo._id, teama.logo_url)
            }
            data.oHomeTeam = { ...HomeTeamInfo, iTeamId: HomeTeamInfo._id, sName: HomeTeamInfo.sName, sShortName: teama.short_name }
          } else {
            const oTeam = { sKey: sHomeTeamKey, sName: teama.name, sShortName: teama.short_name, sLogoUrl: teama.logo_url }
            const s3Res = await getS3ImageURL(oTeam.sLogoUrl, config.S3_BUCKET_TEAM_THUMB_URL_PATH)
            oTeam.sImage = s3Res.sPath
            const team = await TeamModel.create({ ...oTeam, eCategory: 'CRICKET', eProvider: 'ENTITYSPORT' })
            data.oHomeTeam = { ...oTeam, iTeamId: team._id }
          }

          const AwayTeamInfo = await TeamModel.findOne({ sKey: sAwayTeamKey, eCategory: 'CRICKET' }, { sKey: 1, _id: 1, sImage: 1, sName: 1, sShortName: 1 }).lean()
          if (AwayTeamInfo) {
            data.oAwayTeam = {}
            if (!AwayTeamInfo.sImage) {
              data.oAwayTeam.sImage = await updateTeamImage(AwayTeamInfo._id, teamb.logo_url)
            }
            data.oAwayTeam = { ...AwayTeamInfo, iTeamId: AwayTeamInfo._id, sName: AwayTeamInfo.sName, sShortName: teamb.short_name }
          } else {
            const oTeam = { sKey: sAwayTeamKey, sName: teamb.name, sShortName: teamb.short_name, sLogoUrl: teamb.logo_url }
            const s3Res = await getS3ImageURL(oTeam.sLogoUrl, config.S3_BUCKET_TEAM_THUMB_URL_PATH)
            oTeam.sImage = s3Res.sPath
            const team = await TeamModel.create({ ...oTeam, eCategory: 'CRICKET', eProvider: 'ENTITYSPORT' })
            data.oAwayTeam = { ...oTeam, iTeamId: team._id }
          }
          data.sVenue = venue ? venue.name.toString().concat(' ', venue.location) : ''
          data.sName = (gender === 'women') ? teama.short_name.concat('-W vs ', teamb.short_name.concat('-W')) : teama.short_name.concat(' vs ', teamb.short_name)

          data.sStatusNote = result.status_note || ''
        } catch (error) {
          handleCatchError(error)
          return {
            isSuccess: false,
            status: status.OK,
            message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
            data: {}
          }
        }
        break

      case 'SPORTSRADAR':
        try {
          let result = await axios.get(`https://api.sportradar.com/cricket-p2/en/matches/${sKey}/summary.json`,
            {
              params: {
                api_key: config.SPORTSRADAR_API_KEY
              }
            })
          if (!result.data || !result.data.sport_event) {
            return {
              isSuccess: false,
              status: status.OK,
              message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
              data: {}
            }
          }
          const logData = { sKey, iMatchId: oMatch._id, eCategory: 'CRICKET', eType: 'MATCHES', eProvider, oData: result.data, sUrl: `https://api.sportradar.com/cricket-p2/en/matches/${sKey}/summary.json` }
          apiLogQueue.publish(logData)
          // await ApiLogModel.create({ sKey, iMatchId: oMatch._id, eCategory: 'CRICKET', eType: 'MATCHES', eProvider, oData: result.data, sUrl: `https://api.sportradar.com/cricket-p2/en/matches/${sKey}/summary.json` })
          result = result.data.sport_event

          const { tournament, competitors, venue } = result
          const gender = tournament.gender ? tournament.gender.toString().toLowerCase() : ''
          const oHome = competitors.find(({ qualifier }) => qualifier === 'home')
          const oAway = competitors.find(({ qualifier }) => qualifier === 'away')
          const sHomeTeamKey = oHome.id
          const sAwayTeamKey = oAway.id
          if (!sHomeTeamKey || !sAwayTeamKey) {
            return {
              isSuccess: false,
              status: status.OK,
              message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
              data: {}
            }
          }

          let sTitle = competitors[0].abbreviation.concat(' vs ', competitors[1].abbreviation)

          if (gender === 'women') {
            sTitle = competitors[0].abbreviation.concat('-W vs ', competitors[1].abbreviation.concat('-W'))
            oHome.name = oHome.name.toString().concat(' -Women')
            oAway.name = oAway.name.toString().concat(' -Women')
            oHome.abbreviation = oHome.abbreviation.toString().concat(' -W')
            oAway.abbreviation = oAway.abbreviation.toString().concat(' -W')
          }

          const HomeTeamInfo = await TeamModel.findOne({ sKey: sHomeTeamKey, eCategory: 'CRICKET' }, { sKey: 1, _id: 1, sImage: 1, sName: 1, sShortName: 1 }).lean()
          if (HomeTeamInfo) {
            data.oHomeTeam = { ...HomeTeamInfo, iTeamId: HomeTeamInfo._id, sName: oHome.name, sShortName: oHome.abbreviation }
          } else {
            const oTeam = { sKey: sHomeTeamKey, sName: oHome.name, sShortName: oHome.abbreviation }
            const team = await TeamModel.create({ ...oTeam, eCategory: 'CRICKET', eProvider: 'SPORTSRADAR' })
            data.oHomeTeam = { ...oTeam, iTeamId: team._id }
          }

          const AwayTeamInfo = await TeamModel.findOne({ sKey: sAwayTeamKey, eCategory: 'CRICKET' }, { sKey: 1, _id: 1, sImage: 1, sName: 1, sShortName: 1 }).lean()
          if (AwayTeamInfo) {
            data.oAwayTeam = { ...AwayTeamInfo, iTeamId: AwayTeamInfo._id, sName: oAway.name, sShortName: oAway.abbreviation }
          } else {
            const oTeam = { sKey: sAwayTeamKey, sName: oAway.name, sShortName: oAway.abbreviation }
            const team = await TeamModel.create({ ...oTeam, eCategory: 'CRICKET', eProvider: 'SPORTSRADAR' })
            data.oAwayTeam = { ...oTeam, iTeamId: team._id }
          }
          data.sVenue = venue ? venue.name.toString().concat(' ', venue.city_name, ' ', venue.country_name) : ''

          data.sName = sTitle
        } catch (error) {
          handleCatchError(error)
          return {
            isSuccess: false,
            status: status.OK,
            message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
            data: {}
          }
        }
        break

      default:
        return {
          isSuccess: false,
          status: status.OK,
          message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
          data: {}
        }
    }

    return {
      isSuccess: true,
      status: status.OK,
      message: messages[userLanguage].success.replace('##', messages[userLanguage].match),
      data
    }
  } catch (err) {
    handleCatchError(err)
    return {
      isSuccess: false,
      status: status.InternalServerError,
      message: messages[userLanguage].error
    }
  }
}

/**
 * Used for fetch refresh data for particular football match
 * @param  {object} oMatch = {sKey, eProvider}
 * @param  {string} userLanguage='English'
 * @return {object} {isSuccess, status, message, data}
 */
async function getFootballRefreshMatchData(oMatch, userLanguage = 'English') {
  try {
    const { sKey, eProvider } = oMatch
    const data = {}

    switch (eProvider) {
      case 'ENTITYSPORT':
        try {
          let result = await axios.get(`https://soccer.entitysport.com/matches/${sKey}/info`,
            {
              params: {
                token: config.ENTITYSPORT_SOCCER_API_KEY
              }
            })
          if (!result.data || !result.data.response.items) {
            return {
              isSuccess: false,
              status: status.OK,
              message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
              data: {}
            }
          }
          result = result.data.response.items.match_info[0]

          const logData = { sKey, iMatchId: oMatch._id, eCategory: 'FOOTBALL', eType: 'MATCHES', eProvider, oData: result, sUrl: `https://soccer.entitysport.com/matches/${sKey}/info` }

          apiLogQueue.publish(logData)
          // await ApiLogModel.create({ sKey, iMatchId: oMatch._id, eCategory: 'FOOTBALL', eType: 'MATCHES', eProvider, oData: result, sUrl: `https://soccer.entitysport.com/matches/${sKey}/info` })
          const { venue } = result
          const { home, away } = result.teams
          const sHomeTeamKey = home.tid
          const sAwayTeamKey = away.tid
          if (!sHomeTeamKey || !sAwayTeamKey) {
            return {
              isSuccess: false,
              status: status.OK,
              message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
              data: {}
            }
          }

          const HomeTeamInfo = await TeamModel.findOne({ sKey: sHomeTeamKey, eCategory: 'FOOTBALL' }, { sKey: 1, _id: 1, sImage: 1, sName: 1, sShortName: 1 }).lean()
          if (HomeTeamInfo) {
            data.oHomeTeam = {}
            if (!HomeTeamInfo.sImage) {
              data.oHomeTeam.sImage = await updateTeamImage(HomeTeamInfo._id, home.logo)
            }
            data.oHomeTeam = { ...HomeTeamInfo, iTeamId: HomeTeamInfo._id }
          } else {
            const oTeam = { sKey: sHomeTeamKey, sName: home.tname, sShortName: home.abbr, sLogoUrl: home.logo }
            const s3Res = await getS3ImageURL(oTeam.sLogoUrl, config.S3_BUCKET_TEAM_THUMB_URL_PATH)
            oTeam.sImage = s3Res.sPath
            const team = await TeamModel.create({ ...oTeam, eCategory: 'FOOTBALL', eProvider: 'ENTITYSPORT' })
            data.oHomeTeam = { ...oTeam, iTeamId: team._id }
          }

          const AwayTeamInfo = await TeamModel.findOne({ sKey: sAwayTeamKey, eCategory: 'FOOTBALL' }, { sKey: 1, _id: 1, sImage: 1, sName: 1, sShortName: 1 }).lean()
          if (AwayTeamInfo) {
            data.oAwayTeam = {}
            if (!AwayTeamInfo.sImage) {
              data.oAwayTeam.sImage = await updateTeamImage(AwayTeamInfo._id, away.logo)
            }
            data.oAwayTeam = { ...AwayTeamInfo, iTeamId: AwayTeamInfo._id }
          } else {
            const oTeam = { sKey: sAwayTeamKey, sName: away.tname, sShortName: away.abbr, sLogoUrl: away.logo }
            const s3Res = await getS3ImageURL(oTeam.sLogoUrl, config.S3_BUCKET_TEAM_THUMB_URL_PATH)
            oTeam.sImage = s3Res.sPath
            const team = await TeamModel.create({ ...oTeam, eCategory: 'FOOTBALL', eProvider: 'ENTITYSPORT' })
            data.oAwayTeam = { ...oTeam, iTeamId: team._id }
          }

          data.sName = home.abbr.concat(' vs ', away.abbr)
          data.sVenue = venue ? venue.name.toString().concat(' ', venue.location) : ''
        } catch (error) {
          handleCatchError(error)
          return {
            isSuccess: false,
            status: status.OK,
            message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
            data: {}
          }
        }
        break

      default:
        return {
          isSuccess: false,
          status: status.OK,
          message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
          data: {}
        }
    }

    return {
      isSuccess: true,
      status: status.OK,
      message: messages[userLanguage].success.replace('##', messages[userLanguage].match),
      data
    }
  } catch (err) {
    handleCatchError(err)
    return {
      isSuccess: false,
      status: status.InternalServerError,
      message: messages[userLanguage].error
    }
  }
}

/**
   * Used for fetch refresh data for particular kabadii match
   * @param  {object} oMatch = {sKey, eProvider}
   * @param  {string} userLanguage='English'
   * @return {object} {isSuccess, status, message, data}
   */
async function getKabaddiRefreshMatchData(oMatch, userLanguage = 'English') {
  try {
    const { sKey, eProvider } = oMatch
    const data = {}

    switch (eProvider) {
      case 'ENTITYSPORT':
        try {
          let result = await axios.get(`https://rest.entitysport.com/kabaddi/matches/${sKey}/info`,
            {
              params: {
                token: config.ENTITYSPORT_KABADDI_API_KEY
              }
            })
          if (!result.data || !result.data.response) {
            return {
              isSuccess: false,
              status: status.OK,
              message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
              data: {}
            }
          }
          result = result.data.items.match_info

          const logData = { sKey, iMatchId: oMatch._id, eCategory: 'KABADDI', eType: 'MATCHES', eProvider, oData: result, sUrl: `https://rest.entitysport.com/kabaddi/matches/${sKey}/info` }
          apiLogQueue.publish(logData)
          // await ApiLogModel.create({ sKey, iMatchId: oMatch._id, eCategory: 'KABADDI', eType: 'MATCHES', eProvider, oData: result, sUrl: `https://rest.entitysport.com/kabaddi/matches/${sKey}/info` })
          const { venue } = result
          const { home, away } = result.teams
          const sHomeTeamKey = home.tid
          const sAwayTeamKey = away.tid
          if (!sHomeTeamKey || !sAwayTeamKey) {
            return {
              isSuccess: false,
              status: status.OK,
              message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
              data: {}
            }
          }

          const HomeTeamInfo = await TeamModel.findOne({ sKey: sHomeTeamKey, eCategory: 'KABADDI' }, { sKey: 1, _id: 1, sImage: 1, sName: 1, sShortName: 1 }).lean()
          if (HomeTeamInfo) {
            data.oHomeTeam = {}
            if (!HomeTeamInfo.sImage) {
              data.oHomeTeam.sImage = await updateTeamImage(HomeTeamInfo._id, home.logo)
            }
            data.oHomeTeam = { ...HomeTeamInfo, iTeamId: HomeTeamInfo._id }
          } else {
            const oTeam = { sKey: sHomeTeamKey, sName: home.tname, sShortName: home.abbr, sLogoUrl: home.logo }
            const s3Res = await getS3ImageURL(oTeam.sLogoUrl, config.S3_BUCKET_TEAM_THUMB_URL_PATH)
            oTeam.sImage = s3Res.sPath
            const team = await TeamModel.create({ ...oTeam, eCategory: 'KABADDI', eProvider: 'ENTITYSPORT' })
            data.oHomeTeam = { ...oTeam, iTeamId: team._id }
          }

          const AwayTeamInfo = await TeamModel.findOne({ sKey: sAwayTeamKey, eCategory: 'KABADDI' }, { sKey: 1, _id: 1, sImage: 1, sName: 1, sShortName: 1 }).lean()
          if (AwayTeamInfo) {
            data.oAwayTeam = {}
            if (!AwayTeamInfo.sImage) {
              data.oAwayTeam.sImage = await updateTeamImage(AwayTeamInfo._id, away.logo)
            }
            data.oAwayTeam = { ...AwayTeamInfo, iTeamId: AwayTeamInfo._id }
          } else {
            const oTeam = { sKey: sAwayTeamKey, sName: away.tname, sShortName: away.abbr, sLogoUrl: away.logo }
            const s3Res = await getS3ImageURL(oTeam.sLogoUrl, config.S3_BUCKET_TEAM_THUMB_URL_PATH)
            oTeam.sImage = s3Res.sPath
            const team = await TeamModel.create({ ...oTeam, eCategory: 'KABADDI', eProvider: 'ENTITYSPORT' })
            data.oAwayTeam = { ...oTeam, iTeamId: team._id }
          }
          data.sName = home.abbr && away.abbr ? home.abbr.concat(' vs ', away.abbr) : home.tname.concat(' vs ', away.tname)
          data.sVenue = venue ? venue.name.toString().concat(' ', venue.location) : ''
        } catch (error) {
          handleCatchError(error)
          return {
            isSuccess: false,
            status: status.OK,
            message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
            data: {}
          }
        }
        break

      default:
        return {
          isSuccess: false,
          status: status.OK,
          message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
          data: {}
        }
    }

    return {
      isSuccess: true,
      status: status.OK,
      message: messages[userLanguage].success.replace('##', messages[userLanguage].match),
      data
    }
  } catch (err) {
    handleCatchError(err)
    return {
      isSuccess: false,
      status: status.InternalServerError,
      message: messages[userLanguage].errors
    }
  }
}

/**
   * Used for fetch refresh data for particular baseball match
   * @param  {object} oMatch = {sKey, eProvider}
   * @param  {string} userLanguage='English'
   * @return {object} {isSuccess, status, message, data}
   */
async function getBaseballRefreshMatchData(oMatch, userLanguage = 'English') {
  try {
    const { sKey, eProvider } = oMatch
    const data = {}

    switch (eProvider) {
      case 'ENTITYSPORT':
        try {
          let result = await axios.get(`https://rest.entitysport.com/baseball/matches/${sKey}/info`,
            {
              params: {
                token: config.ENTITYSPORT_BASEBALL_API_KEY
              }
            })
          if (!result.data || !result.data.response) {
            return {
              isSuccess: false,
              status: status.OK,
              message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
              data: {}
            }
          }
          result = result.data.items.match_info

          const logData = { sKey, iMatchId: oMatch._id, eCategory: 'BASEBALL', eType: 'MATCHES', eProvider, oData: result, sUrl: `https://rest.entitysport.com/baseball/matches/${sKey}/info` }
          apiLogQueue.publish(logData)
          // await ApiLogModel.create({ sKey, iMatchId: oMatch._id, eCategory: 'BASEBALL', eType: 'MATCHES', eProvider, oData: result, sUrl: `https://rest.entitysport.com/baseball/matches/${sKey}/info` })

          const { home, away } = result.teams
          const sHomeTeamKey = home.tid
          const sAwayTeamKey = away.tid
          if (!sHomeTeamKey || !sAwayTeamKey) {
            return {
              isSuccess: false,
              status: status.OK,
              message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
              data: {}
            }
          }

          const HomeTeamInfo = await TeamModel.findOne({ sKey: sHomeTeamKey, eCategory: 'BASEBALL' }, { sKey: 1, _id: 1, sImage: 1, sName: 1, sShortName: 1 }).lean()
          if (HomeTeamInfo) {
            data.oHomeTeam = {}
            if (!HomeTeamInfo.sImage) {
              data.oHomeTeam.sImage = await updateTeamImage(HomeTeamInfo._id, home.logo)
            }
            data.oHomeTeam = { ...HomeTeamInfo, iTeamId: HomeTeamInfo._id }
          } else {
            const oTeam = { sKey: sHomeTeamKey, sName: home.tname, sShortName: home.abbr, sLogoUrl: home.logo }
            const s3Res = await getS3ImageURL(oTeam.sLogoUrl, config.S3_BUCKET_TEAM_THUMB_URL_PATH)
            oTeam.sImage = s3Res.sPath
            const team = await TeamModel.create({ ...oTeam, eCategory: 'BASEBALL', eProvider: 'ENTITYSPORT' })
            data.oHomeTeam = { ...oTeam, iTeamId: team._id }
          }

          const AwayTeamInfo = await TeamModel.findOne({ sKey: sAwayTeamKey, eCategory: 'BASEBALL' }, { sKey: 1, _id: 1, sImage: 1, sName: 1, sShortName: 1 }).lean()
          if (AwayTeamInfo) {
            data.oAwayTeam = {}
            if (!AwayTeamInfo.sImage) {
              data.oAwayTeam.sImage = await updateTeamImage(AwayTeamInfo._id, away.logo)
            }
            data.oAwayTeam = { ...AwayTeamInfo, iTeamId: AwayTeamInfo._id }
          } else {
            const oTeam = { sKey: sAwayTeamKey, sName: away.tname, sShortName: away.abbr, sLogoUrl: away.logo }
            const s3Res = await getS3ImageURL(oTeam.sLogoUrl, config.S3_BUCKET_TEAM_THUMB_URL_PATH)
            oTeam.sImage = s3Res.sPath
            const team = await TeamModel.create({ ...oTeam, eCategory: 'BASEBALL', eProvider: 'ENTITYSPORT' })
            data.oAwayTeam = { ...oTeam, iTeamId: team._id }
          }

          data.sName = home.abbr && away.abbr ? home.abbr.concat(' vs ', away.abbr) : home.tname.concat(' vs ', away.tname)
        } catch (error) {
          handleCatchError(error)
          return {
            isSuccess: false,
            status: status.OK,
            message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
            data: {}
          }
        }
        break

      default:
        return {
          isSuccess: false,
          status: status.OK,
          message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
          data: {}
        }
    }

    return {
      isSuccess: true,
      status: status.OK,
      message: messages[userLanguage].success.replace('##', messages[userLanguage].match),
      data
    }
  } catch (err) {
    handleCatchError(err)
    return {
      isSuccess: false,
      status: status.OK,
      message: messages[userLanguage].error
    }
  }
}

/**
   * Used for fetch refresh data for particular basketball match
   * @param  {object} oMatch = {sKey, eProvider}
   * @param  {string} userLanguage='English'
   * @return {object} {isSuccess, status, message, data}
   */
async function getBasketBallRefreshMatchData(oMatch, userLanguage = 'English') {
  try {
    const { sKey, eProvider } = oMatch
    const data = {}

    switch (eProvider) {
      case 'ENTITYSPORT':
        try {
          let result = await axios.get(`https://rest.entitysport.com/baseball/matches/${sKey}/info`,
            {
              params: {
                token: config.ENTITYSPORT_BASKETBALL_API_KEY
              }
            })
          if (!result.data || !result.data.response) {
            return {
              isSuccess: false,
              status: status.OK,
              message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
              data: {}
            }
          }
          result = result.data.items.match_info

          const logData = { sKey, iMatchId: oMatch._id, eCategory: 'BASKETBALL', eType: 'MATCHES', eProvider, oData: result, sUrl: `https://rest.entitysport.com/baseball/matches/${sKey}/info` }
          apiLogQueue.publish(logData)
          // await ApiLogModel.create({ sKey, iMatchId: oMatch._id, eCategory: 'BASKETBALL', eType: 'MATCHES', eProvider, oData: result, sUrl: `https://rest.entitysport.com/baseball/matches/${sKey}/info` })

          const { home, away } = result.teams
          const sHomeTeamKey = home.tid
          const sAwayTeamKey = away.tid
          if (!sHomeTeamKey || !sAwayTeamKey) {
            return {
              isSuccess: false,
              status: status.OK,
              message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
              data: {}
            }
          }

          const HomeTeamInfo = await TeamModel.findOne({ sKey: sHomeTeamKey, eCategory: 'BASKETBALL' }, { sKey: 1, _id: 1, sImage: 1, sName: 1, sShortName: 1 }).lean()
          if (HomeTeamInfo) {
            data.oHomeTeam = {}
            if (!HomeTeamInfo.sImage) {
              data.oHomeTeam.sImage = await updateTeamImage(HomeTeamInfo._id, home.logo)
            }
            data.oHomeTeam = { ...HomeTeamInfo, iTeamId: HomeTeamInfo._id }
          } else {
            const oTeam = { sKey: sHomeTeamKey, sName: home.tname, sShortName: home.abbr, sLogoUrl: home.logo }
            const s3Res = await getS3ImageURL(oTeam.sLogoUrl, config.S3_BUCKET_TEAM_THUMB_URL_PATH)
            oTeam.sImage = s3Res.sPath
            const team = await TeamModel.create({ ...oTeam, eCategory: 'BASKETBALL', eProvider: 'ENTITYSPORT' })
            data.oHomeTeam = { ...oTeam, iTeamId: team._id }
          }

          const AwayTeamInfo = await TeamModel.findOne({ sKey: sAwayTeamKey, eCategory: 'BASKETBALL' }, { sKey: 1, _id: 1, sImage: 1, sName: 1, sShortName: 1 }).lean()
          if (AwayTeamInfo) {
            data.oAwayTeam = {}
            if (!AwayTeamInfo.sImage) {
              data.oAwayTeam.sImage = await updateTeamImage(AwayTeamInfo._id, away.logo)
            }
            data.oAwayTeam = { ...AwayTeamInfo, iTeamId: AwayTeamInfo._id }
          } else {
            const oTeam = { sKey: sAwayTeamKey, sName: away.tname, sShortName: away.abbr, sLogoUrl: away.logo }
            const s3Res = await getS3ImageURL(oTeam.sLogoUrl, config.S3_BUCKET_TEAM_THUMB_URL_PATH)
            oTeam.sImage = s3Res.sPath
            const team = await TeamModel.create({ ...oTeam, eCategory: 'BASKETBALL', eProvider: 'ENTITYSPORT' })
            data.oAwayTeam = { ...oTeam, iTeamId: team._id }
          }

          data.sName = home.abbr && away.abbr ? home.abbr.concat(' vs ', away.abbr) : home.tname.concat(' vs ', away.tname)
        } catch (error) {
          handleCatchError(error)
          return {
            isSuccess: false,
            status: status.OK,
            message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
            data: {}
          }
        }
        break

      default:
        return {
          isSuccess: false,
          status: status.OK,
          message: messages[userLanguage].not_exist.replace('##', messages[userLanguage].match),
          data: {}
        }
    }

    return {
      isSuccess: true,
      status: status.OK,
      message: messages[userLanguage].success.replace('##', messages[userLanguage].match),
      data
    }
  } catch (err) {
    handleCatchError(err)
    return {
      isSuccess: false,
      status: status.InternalServerError,
      message: messages[userLanguage].error
    }
  }
}

async function updateTeamImage(_id, image) {
  try {
    const s3Res = await getS3ImageURL(image, config.S3_BUCKET_TEAM_THUMB_URL_PATH)
    await TeamModel.updateOne({ _id }, { sImage: s3Res.sPath })
    return s3Res.sPath
  } catch (error) {
    handleCatchError(error)
    return ''
  }
}

// async function checkMegaContest(matchList) {
//   try {
//     if (matchList && matchList.length) {
//       const leagueInfo = await LeagueCategoryModel.findOne({ sKey: 'hiddenLeague' }, { _id: 1 }).lean().cache(config.CACHE_6, 'hiddenLeague')
//       const matchIds = matchList.map(match => match._id)
//       const aMatchLeague = await MatchLeagueModel.find({ iMatchId: { $in: matchIds }, iLeagueCatId: { $ne: leagueInfo._id }, bWinningDone: false, bCancelled: false, bPrivateLeague: false, nTotalPayout: { $gte: config.MEGA_CONTEST_AMOUNT_LIMIT } }, { nTotalPayout: 1, iMatchId: 1 }).lean().cache(config.CACHE_2, 'megaContest')

//       for (const match of matchList) {
//         match.isMegaContest = false
//         match.nPrice = 0
//         if (aMatchLeague.length) {
//           const findMegaContest = aMatchLeague.find(league => match._id.toString() === league.iMatchId.toString() && league.nTotalPayout >= config.MEGA_CONTEST_AMOUNT_LIMIT)

//           if (findMegaContest) {
//             match.isMegaContest = !!findMegaContest
//             match.nPrice = findMegaContest ? findMegaContest.nTotalPayout : 0
//           }
//         }
//       }
//     }

//     return matchList
//   } catch (error) {
//     handleCatchError(error)
//     return matchList
//   }
// }
module.exports = {
  getCricketRefreshMatchData,
  getFootballRefreshMatchData,
  getBaseballRefreshMatchData,
  getBasketBallRefreshMatchData,
  getKabaddiRefreshMatchData
  // checkMegaContest
}
