const SeasonModel = require('./model')
const UserLeagueModel = require('../userLeague/model')
const MatchModel = require('../match/model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, getPaginationValues2, removenull, pick } = require('../../helper/utilities.services')
const { bAllowDiskUse } = require('../../config/config')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId

class Season {
  async list(req, res) {
    try {
      const { datefrom = '', dateto = '', sort, order } = req.query
      const { start, limit, search = '' } = getPaginationValues2(req.query)

      const dateFilter = datefrom.length && dateto.length ? { dStartDate: { $gte: (datefrom), $lte: (dateto) } } : {}
      const sorting = sort && order ? { [sort]: order === 'asc' ? 1 : -1 } : { dStartDate: -1 }

      let query = { ...dateFilter, eCategory: req.query.sportsType.toUpperCase() }
      query = search && search.length ? { ...query, sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : query

      const results = await SeasonModel.find(query, {
        sName: 1,
        sKey: 1,
        eCategory: 1,
        dStartDate: 1,
        dEndDate: 1,
        eProvider: 1,
        dCreatedAt: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const total = await SeasonModel.countDocuments({ ...query })

      const data = [{ total, results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].season), data: data })
    } catch (error) {
      return catchError('Season.list', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const data = await SeasonModel.findById(req.params.id).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].season) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].season), data })
    } catch (error) {
      catchError('Season.get', error, req, res)
    }
  }

  async SeasonNameList(req, res) {
    try {
      const { start, limit, search = '' } = getPaginationValues2(req.query)

      const query = search && search.length ? { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      const [aResult, nTotal] = await Promise.all([
        SeasonModel.find(query, { sName: 1, eCategory: 1 }).sort({ dStartDate: -1 }).skip(Number(start)).limit(Number(limit)).lean(),
        SeasonModel.countDocuments(query)

      ])

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].season), data: { aResult, nTotal } })
    } catch (error) {
      return catchError('Season.SeasonNameList', error, req, res)
    }
  }

  async usersListInSeason(req, res) {
    try {
      const { start, limit, sorting } = getPaginationValues2(req.query)

      const season = await SeasonModel.findById(req.params.id).lean()
      if (!season) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].season) })

      const match = await MatchModel.find({ sSeasonKey: season.sKey }).lean()
      const matchIds = match.map((m) => ObjectId(m._id))

      const results = await UserLeagueModel.aggregate([
        {
          $match: {
            iMatchId: { $in: matchIds },
            bCancelled: false
          }
        },
        {
          $group: {
            _id: '$iUserId',
            iUserId: { $first: '$iUserId' },
            sUserName: { $first: '$sUserName' },
            eType: { $first: '$eType' }, // eType change
            sProPic: { $first: '$sProPic' },
            dCreatedAt: { $first: '$dCreatedAt' }
          }
        },
        {
          $sort: sorting
        },
        { $limit: parseInt(start) + parseInt(limit) },
        { $skip: parseInt(start) },
        {
          $project: {
            iUserId: 1,
            sUserName: 1,
            eType: 1,
            sProPic: 1,
            dCreatedAt: 1
          }
        }
      ]).allowDiskUse(bAllowDiskUse).exec()

      const total = await UserLeagueModel.aggregate([
        {
          $match: {
            iMatchId: { $in: matchIds },
            bCancelled: false
          }
        },
        {
          $group: {
            _id: '$iUserId'
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 }
          }
        }
      ]).allowDiskUse(bAllowDiskUse).exec()

      const data = [{ total: total[0] ? total[0].count : 0, results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].season), data: data })
    } catch (error) {
      return catchError('Season.usersListInSeason', error, req, res)
    }
  }

  async exportUsersInSeason(req, res) {
    try {
      const { sorting } = getPaginationValues2(req.query)

      const season = await SeasonModel.findById(req.params.id).lean()
      if (!season) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].season) })

      const match = await MatchModel.find({ sSeasonKey: season.sKey }).lean()
      const matchIds = match.map((m) => ObjectId(m._id))

      const results = await UserLeagueModel.aggregate([
        {
          $match: {
            iMatchId: { $in: matchIds },
            bCancelled: false
          }
        },
        {
          $group: {
            _id: '$iUserId',
            iUserId: { $first: '$iUserId' },
            sUserName: { $first: '$sUserName' },
            eType: { $first: '$eType' }, // eType change
            sProPic: { $first: '$sProPic' },
            dCreatedAt: { $first: '$dCreatedAt' }
          }
        },
        {
          $sort: sorting
        },
        {
          $project: {
            iUserId: 1,
            sUserName: 1,
            eType: 1,
            sProPic: 1,
            dCreatedAt: 1
          }
        }
      ]).allowDiskUse(bAllowDiskUse).exec()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].season), data: results })
    } catch (error) {
      return catchError('Season.exportUsersInSeason', error, req, res)
    }
  }

  async update(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'dStartDate', 'dEndDate'])
      removenull(req.body)

      const data = await SeasonModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].season) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].season), data })
    } catch (error) {
      catchError('Season.update', error, req, res)
    }
  }
}

module.exports = new Season()
