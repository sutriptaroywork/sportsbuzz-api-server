const SportModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, removenull } = require('../../helper/utilities.services')
const { CACHE_2 } = require('../../config/config')

class Sport {
  findSport(key) {
    return SportModel.findOne({ sKey: key, eStatus: 'Y' }, { oRule: 1 }).lean().cache(CACHE_2, `sport:${key}`)
  }

  async add(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'sKey', 'nPosition', 'sScoreInfoLink', 'sScoreInfoTabName', 'nMaxPlayerOneTeam', 'nTotalPlayers'])
      const { sKey, nMaxPlayerOneTeam, nTotalPlayers } = req.body
      req.body.sKey = sKey.toUpperCase()

      const exist = await SportModel.findOne({ sKey: sKey.toUpperCase() }).lean()
      if (exist && exist.sKey === sKey.toUpperCase()) { return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].csport) }) }

      // nMaxPlayerOneTeam = maximum player in a team, nTotalPlayers = total players
      if (nMaxPlayerOneTeam || nTotalPlayers) {
        req.body.oRule = { nMaxPlayerOneTeam, nTotalPlayers }
      }
      const data = await SportModel.create({ ...req.body })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnewSport), data })
    } catch (error) {
      catchError('Sport.add', error, req, res)
    }
  }

  async update(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'sKey', 'nPosition', 'eStatus', 'sScoreInfoLink', 'sScoreInfoTabName', 'nMaxPlayerOneTeam', 'nTotalPlayers'])
      removenull(req.body)
      const { sKey, nMaxPlayerOneTeam, nTotalPlayers } = req.body
      req.body.sKey = sKey.toUpperCase()

      const sportExist = await SportModel.findOne({ sKey: sKey.toUpperCase(), _id: { $ne: req.params.id } }).lean()
      if (sportExist && sportExist.sKey === sKey.toUpperCase()) { return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].csport) }) }

      // nMaxPlayerOneTeam = maximum player in a team, nTotalPlayers = total players
      if (nMaxPlayerOneTeam || nTotalPlayers) {
        req.body.oRule = { nMaxPlayerOneTeam, nTotalPlayers }
      }

      const data = await SportModel.findByIdAndUpdate(req.params.id, { ...req.body, dUpdatedAt: Date.now() }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].csport) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].csport), data })
    } catch (error) {
      catchError('Sport.update', error, req, res)
    }
  }

  async list(req, res) {
    try {
      const data = await SportModel.find({}, { __v: 0 }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csport), data: data })
    } catch (error) {
      return catchError('Sport.list', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const data = await SportModel.findById(req.params.id, { __v: 0 }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].csport) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csport), data })
    } catch (error) {
      catchError('Sport.get', error, req, res)
    }
  }

  async activeSports(req, res) {
    try {
      let data = await SportModel.find({ eStatus: 'Y' }, { sName: 1, _id: 0 }).lean()
      data = data.map(({ sName }) => sName)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cactiveSports), data })
    } catch (error) {
      return catchError('Sport.activeSports', error, req, res)
    }
  }

  async activeSportsV2(req, res) {
    try {
      const data = await SportModel.find({ eStatus: 'Y' }, { __v: 0, dCreatedAt: 0, dUpdatedAt: 0, eStatus: 0, _id: 0, sExternalId: 0 }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cactiveSports), data })
    } catch (error) {
      return catchError('Sport.activeSportsV2', error, req, res)
    }
  }

  async activeSportsV3(req, res) {
    try {
      const data = await SportModel.find({ sKey: { $in: ['CRICKET', 'FOOTBALL'] } }, { __v: 0, dCreatedAt: 0, dUpdatedAt: 0, eStatus: 0, _id: 0, sExternalId: 0 }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cactiveSports), data })
    } catch (error) {
      return catchError('Sport.activeSportsV3', error, req, res)
    }
  }
}

module.exports = new Sport()
