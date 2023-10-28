const ScorePointModel = require('./model')
const MatchModel = require('../match/model')
const MatchPlayerModel = require('../matchPlayer/model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, defaultSearch } = require('../../helper/utilities.services')
const { format, category, cricketFormat } = require('../../data')
const ObjectId = require('mongoose').Types.ObjectId
const { soccerScorePointByEntitySport, soccerScorePointBySportsRadar, cricketScorePointByEntitySport, cricketScorePointBySportsRadar, kabaddiScorePointByEntitySport, basketballScorePointByEntitySport, basketballScorePointBySportsRadar } = require('./common')

class ScorePoint {
  // get point system by format for APP and admin
  async get(req, res) {
    try {
      let { search = '', eFormat } = req.query
      let query = {
        eFormat: eFormat.toUpperCase()
      }

      if (search) search = defaultSearch(search)
      if (search && search.length && req.admin) {
        query = { ...query, sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
      }

      const data = await ScorePointModel.find(query).lean()

      if (!data.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpoints) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpoints), data })
    } catch (error) {
      return catchError('ScorePoint.get', error, req, res)
    }
  }

  // Get match format by sportsType
  async getPointSystem(req, res) {
    try {
      const { eCategory } = req.query
      if (eCategory && !category.includes(eCategory.toUpperCase())) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchFormat) })
      const data = !eCategory ? format : ((eCategory.toUpperCase() === 'CRICKET') ? cricketFormat : [eCategory.toUpperCase()])

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpointSystem), data })
    } catch (error) {
      return catchError('ScorePoint.getPointSystem', error, req, res)
    }
  }

  // get single point system details
  async getSingle(req, res) {
    try {
      const data = await ScorePointModel.findById(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpoints) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpoints), data })
    } catch (error) {
      return catchError('ScorePoint.get', error, req, res)
    }
  }

  // update single point system details
  async update(req, res) {
    try {
      const point = await ScorePointModel.findById(req.params.id).lean()
      if (!point) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpoints) })

      const { eCategory, eFormat } = point
      let data
      if (point.bMulti) {
        let { nRangeFrom, nRangeTo, nMinValue, nBonus, id, sName } = req.body

        nRangeFrom = Number(nRangeFrom)
        nRangeTo = Number(nRangeTo)

        if (!nRangeFrom && nRangeFrom !== 0) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].required.replace('##', messages[req.userLanguage].crangeFrom) })
        if (!nRangeTo && nRangeTo !== 0) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].required.replace('##', messages[req.userLanguage].crangeTo) })
        if (!nMinValue && nMinValue !== 0) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].required.replace('##', messages[req.userLanguage].cminimumValue) })
        if (!id) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].required.replace('##', messages[req.userLanguage].cpointId) })

        if (nRangeFrom && nRangeTo && nRangeFrom > nRangeTo) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].crangeFrom).replace('#', messages[req.userLanguage].crangeTo) })

        const pointExist = point.aPoint.some((p) => {
          if (p.nRangeFrom <= nRangeFrom && p.nRangeTo >= nRangeFrom && p._id.toString() !== id.toString()) return true
          if (p.nRangeFrom <= nRangeTo && p.nRangeTo >= nRangeTo && p._id.toString() !== id.toString()) return true
        })
        if (pointExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cpointRnage) })

        const updateObj = {
          'aPoint.$.nRangeFrom': nRangeFrom,
          'aPoint.$.nRangeTo': nRangeTo,
          'aPoint.$.nMinValue': nMinValue,
          'aPoint.$.nBonus': nBonus
        }
        if (sName) updateObj.sName = sName
        data = await ScorePointModel.findOneAndUpdate({ _id: ObjectId(req.params.id), 'aPoint._id': ObjectId(id) }, updateObj, { new: true, runValidators: true }).lean()
      } else {
        let { nPoint, sName } = req.body
        nPoint = Number(nPoint)

        if (!nPoint && nPoint !== 0) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].required.replace('##', messages[req.userLanguage].cpoints) })

        const updateObj = { nPoint }
        if (sName) updateObj.sName = sName

        data = await ScorePointModel.findByIdAndUpdate(req.params.id, updateObj, { new: true, runValidators: true }).lean()
      }

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpoints) })

      const [aMatches, aPointBreakup] = await Promise.all([
        MatchModel.find({ eStatus: { $in: ['P', 'U'] }, eCategory, eFormat }, { _id: 1 }).lean(),
        ScorePointModel.find({ eCategory, eFormat }, { sKey: 1, sName: 1, nPoint: 1 }, { readPreference: 'primaryPreferred' }).lean()
      ])
      const aMatchId = aMatches.map(({ _id }) => _id)
      MatchPlayerModel.updateMany({ iMatchId: { $in: aMatchId } }, { aPointBreakup }).exec()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cpoints), data })
    } catch (error) {
      return catchError('ScorePoint.get', error, req, res)
    }
  }

  // Generate score points for cricket
  async scorePointGenerate(req, res) {
    try {
      const match = await MatchModel.findById(req.params.id).lean()
      if (!match) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) }) }

      const { eProvider } = match
      let result

      if (eProvider === 'ENTITYSPORT') {
        result = await cricketScorePointByEntitySport(match, req.userLanguage)
      } else if (eProvider === 'SPORTSRADAR') {
        result = await cricketScorePointBySportsRadar(match, req.userLanguage)
      } else {
        result = { isSuccess: false }
      }

      if (result.isSuccess === false) {
        return res.status(result.status).jsonp({ status: result.status, message: result.message })
      } else {
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cscorePoint) })
      }
    } catch (error) {
      catchError('ScorePoint.scorePointGenerate', error, req, res)
    }
  }

  // Generate score points for football
  async footballScorePointGenerate(req, res) {
    try {
      const match = await MatchModel.findById(req.params.id).lean()
      if (!match) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) }) }
      const { eProvider } = match

      let result
      if (eProvider === 'ENTITYSPORT') {
        result = await soccerScorePointByEntitySport(match, req.userLanguage)
      } else if (eProvider === 'SPORTSRADAR') {
        result = await soccerScorePointBySportsRadar(match, req.userLanguage)
      } else {
        result = { isSuccess: false }
      }
      if (!result.isSuccess) {
        return res.status(result.status).jsonp({ status: result.status, message: result.message })
      } else {
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cscorePoint) })
      }
    } catch (error) {
      catchError('ScorePoint.scorePointGenerate', error, req, res)
    }
  }

  // Generate score points for Kabaddi
  async kabaddiScorePointGenerate(req, res) {
    try {
      const match = await MatchModel.findById(req.params.id).lean()
      if (!match) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) }) }

      const { eProvider } = match
      let result

      if (eProvider === 'ENTITYSPORT') result = await kabaddiScorePointByEntitySport(match, req.userLanguage)
      if (!result.isSuccess) return res.status(result.status).jsonp({ status: result.status, message: result.message })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cscorePoint) })
    } catch (error) {
      catchError('Scorepoint.kabaddiScorePointGenerate', error, req, res)
    }
  }

  // Generate score points for basketball
  async basketballScorePointGenerate(req, res) {
    try {
      const match = await MatchModel.findById(req.params.id).lean()
      if (!match) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) }) }
      const { eProvider } = match

      let result
      if (eProvider === 'ENTITYSPORT') {
        result = await basketballScorePointByEntitySport(match, req.userLanguage)
      } else if (eProvider === 'SPORTSRADAR') {
        result = await basketballScorePointBySportsRadar(match, req.userLanguage)
      } else {
        result = { isSuccess: false }
      }
      if (!result.isSuccess) {
        return res.status(result.status).jsonp({ status: result.status, message: result.message })
      } else {
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cscorePoint) })
      }
    } catch (error) {
      catchError('ScorePoint.scorePointGenerate', error, req, res)
    }
  }
}

module.exports = new ScorePoint()
