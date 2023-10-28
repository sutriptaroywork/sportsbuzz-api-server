const fs = require('fs')
const ejs = require('ejs')
const MatchModel = require('../match/model')
const config = require('../../config/config')
const FullScorecardsModel = require('./model')
const ObjectId = require('mongoose').Types.ObjectId
const LiveInningsModel = require('./liveInnings/model')
const { cricketScoreCardByEntitySport } = require('../scorecard/common')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, handleCatchError } = require('../../helper/utilities.services')

class Scorecard {
  async fetchFullScorecardData(req, res) {
    try {
      const { iMatchId } = req.params

      const isExist = await MatchModel.findById(iMatchId).lean()
      if (!isExist) {
        return res
          .status(status.NotFound)
          .jsonp({
            status: jsonStatus.NotFound,
            message: messages[req.userLanguage].not_exist.replace(
              '##',
              messages[req.userLanguage].match
            )
          })
      }

      const data = await FullScorecardsModel.findOne({
        iMatchId: ObjectId(iMatchId)
      })
        .populate([
          { path: 'oMatch', select: 'sName sSponsoredText eFormat' },
          { path: 'oSeries', select: 'sName sInfo' },
          { path: 'oToss.oWinnerTeam', select: '_id sName sShortName sImage' },
          { path: 'oTeamScoreA.oTeam', select: '_id sName sShortName sImage' },
          { path: 'oTeamScoreB.oTeam', select: '_id sName sShortName sImage' },
          { path: 'oMom', select: 'sName sImage eRole' },
          { path: 'oMos', select: 'sName sImage eRole' }
        ])
        .lean()

      return res
        .status(status.OK)
        .jsonp({
          status: jsonStatus.OK,
          message: messages[req.userLanguage].success.replace(
            '##',
            messages[req.userLanguage].scorecard
          ),
          data
        })
    } catch (error) {
      return catchError('Scorecard.fetchFullScorecardData', error, req, res)
    }
  }

  async fetchLiveInningsData(req, res) {
    try {
      const { iMatchId } = req.params

      const innings = await getLiveInningsData({
        userLanguage: req.userLanguage,
        iMatchId,
        nInningNumber: req.query?.nInningNumber
      })
      if (!innings?.data) {
        return catchError(
          'Scorecard.fetchLiveInningsData',
          innings?.message,
          req,
          res
        )
      }

      return res
        .status(status.OK)
        .jsonp({
          status: jsonStatus.OK,
          message: messages[req.userLanguage].success.replace(
            '##',
            messages[req.userLanguage].innings
          ),
          data: innings.data
        })
    } catch (error) {
      return catchError('Scorecard.fetchLiveInningsData', error, req, res)
    }
  }

  async viewScorecard(req, res) {
    try {
      const { iMatchId } = req.params

      let data = []
      const innings = await getLiveInningsData({
        userLanguage: req.userLanguage,
        iMatchId,
        nInningNumber: req.query?.nInningNumber
      })
      if (innings?.isSuccess) data = innings?.data

      const template = fs.readFileSync(
        config.SCORECARD_TEMPLATE_PATH + 'scorecard.ejs',
        {
          encoding: 'utf-8' // Unicode Transformation Format (UTF).
        }
      )

      const scorecardResult = ejs.render(template, {
        aLiveData: data,
        sDownArrowUrl: config.S3_BUCKET_URL + 'down-arrow.svg'
      })

      return res
        .status(status.OK)
        .jsonp({
          status: jsonStatus.OK,
          message: messages[req.userLanguage].success.replace(
            '##',
            messages[req.userLanguage].innings
          ),
          data: scorecardResult
        })
      // return res.render('scorecard', { aLiveData: data, sDownArrowUrl: config.S3_BUCKET_URL + 'down-arrow.svg' })
    } catch (error) {
      return catchError('Scorecard.viewScorecard', error, req, res)
    }
  }

  async viewHTMLScorecard(req, res) {
    try {
      const { matchId } = req.params
      let data = []

      const innings = await getLiveInningsData({
        userLanguage: req.userLanguage,
        iMatchId: matchId,
        nInningNumber: req.query?.nInningNumber
      })
      if (innings?.isSuccess) data = innings?.data

      return res.render('scorecard', {
        aLiveData: data,
        sDownArrowUrl: config.S3_BUCKET_URL + 'down-arrow.svg'
      })
    } catch (error) {
      return catchError('Scorecard.viewHTMLScorecard', error, req, res)
    }
  }

  async updateCricketScorecard(req, res) {
    try {
      const { iMatchId } = req.params

      const match = await MatchModel.findById(iMatchId).lean()
      if (!match) {
        return res
          .status(status.NotFound)
          .jsonp({
            status: jsonStatus.NotFound,
            message: messages[req.userLanguage].not_exist.replace(
              '##',
              messages[req.userLanguage].match
            )
          })
      }

      const { eProvider } = match
      let result

      if (eProvider === 'ENTITYSPORT') {
        result = await cricketScoreCardByEntitySport(match, req.userLanguage)
      } else {
        result = {
          bSuccess: false,
          status: status.NotFound,
          message: messages[req.userLanguage].not_found_for
            .replace('##', messages[req.userLanguage].scorecard)
            .replace('#', eProvider)
        }
      }
      // scorecard is not integrated for sportsradar provider
      // else if (eProvider === 'SPORTSRADAR') {
      // result = await cricketScorePointBySportsRadar(match, req.userLanguage)
      // }

      if (result && result.bSuccess) {
        return res
          .status(status.OK)
          .jsonp({
            status: jsonStatus.OK,
            message: messages[req.userLanguage].update_success.replace(
              '##',
              messages[req.userLanguage].scorecard
            )
          })
      }
      return res
        .status(result.status)
        .jsonp({ status: result.status, message: result.message })
    } catch (error) {
      return catchError('Scorecard.updateCricketScorecard', error, req, res)
    }
  }
}

async function getLiveInningsData({ userLanguage = 'English', iMatchId, nInningNumber }) {
  try {
    const query = { iMatchId: ObjectId(iMatchId) }
    if (nInningNumber) query.nInningNumber = nInningNumber

    const isExist = await MatchModel.findById(iMatchId, {
      bScorecardShow: 1,
      oHomeTeam: 1,
      oAwayTeam: 1
    }).lean()
    if (!isExist || !isExist.bScorecardShow) {
      return {
        isSuccess: false,
        message: messages[userLanguage].not_exist.replace(
          '##',
          messages[userLanguage].scorecard
        ),
        data: []
      }
    }

    const data = await LiveInningsModel.find(query)
      .populate([
        { path: 'oMatch', select: 'sName sSponsoredText eFormat' },
        { path: 'oBattingTeam', select: '_id sName sShortName sImage' },
        { path: 'oFieldingTeam', select: '_id sName sShortName sImage' },
        { path: 'aBatters.oBatter', select: 'sName sImage eRole' },
        { path: 'aBatters.oBowler', select: 'sName sImage eRole' },
        { path: 'aBatters.oFirstFielder', select: 'sName sImage eRole' },
        { path: 'aBatters.oSecondFielder', select: 'sName sImage eRole' },
        { path: 'aBatters.oThirdFielder', select: 'sName sImage eRole' },
        { path: 'aBowlers.oBowler', select: 'sName sImage eRole' },
        { path: 'aFielders.oFielder', select: 'sName sImage eRole' },
        { path: 'oLastWicket.oBatter', select: 'sName sImage eRole' },
        { path: 'oLastWicket.oBowler', select: 'sName sImage eRole' },
        { path: 'aFOWs.oBatter', select: 'sName sImage eRole' },
        { path: 'aFOWs.oBowler', select: 'sName sImage eRole' },
        {
          path: 'oCurrentPartnership.aBatters.oBatter',
          select: 'sName sImage eRole'
        },
        { path: 'aActiveBatters.oBatter', select: 'sName sImage eRole' },
        { path: 'aActiveBowlers.oBowler', select: 'sName sImage eRole' }
      ])
      .sort({ nInningNumber: 1 })
      .lean()

    // #FSB-1312
    // [android] scorecard ---> single team name should be shown (due to copy right issue)
    // MatchModel has state name, searching state's name and saving as sState in each data's element
    const matchData = isExist
    for (let i = 0; i < data.length; i++) {
      const currentData = data[i]
      if (currentData?.iBattingTeamId) {
        if (
          matchData?.oHomeTeam?.iTeamId &&
          String(currentData.iBattingTeamId) ===
            String(matchData.oHomeTeam.iTeamId)
        ) {
          currentData.sState = matchData.oHomeTeam.sName
        } else if (
          matchData?.oAwayTeam?.iTeamId &&
          String(currentData.iBattingTeamId) ===
            String(matchData.oAwayTeam.iTeamId)
        ) {
          currentData.sState = matchData.oAwayTeam.sName
        }
      }
    }

    return { isSuccess: true, data }
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false, message: error }
  }
}

module.exports = new Scorecard()
