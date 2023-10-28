const StatisticsModel = require('./model')
const LeaderShipBoardModel = require('./leadershipboard.model')
const UserLeagueModel = require('../../userLeague/model')
const SeasondModel = require('../../season/model')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { catchError, handleCatchError } = require('../../../helper/utilities.services')
const MatchModel = require('../../match/model')
const ObjectId = require('mongoose').Types.ObjectId
const { bAllowDiskUse } = require('../../../config/config')
class Statistic {
  async get(req, res) {
    try {
      const data = await StatisticsModel.findOne({ iUserId: req.params.id }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].user) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cusers), data })
    } catch (error) {
      return catchError('Statistic.get', error, req, res)
    }
  }

  async getLeaderShipboardV2(req, res) {
    try {
      const populateFields = req.admin ? ['sName', 'sProPic', 'sUsername', 'eType'] : ['sName', 'sProPic', 'sUsername']
      let dataRes = await LeaderShipBoardModel.findOne({ }, { aSeasons: 0, 'aSeasonData.aData._id': 0, 'oMonthData.aData._id': 0, 'oAllTimeData.aData._id': 0 })
        .populate('oMonthData.aData.iUserId', populateFields)
        .populate('oAllTimeData.aData.iUserId', populateFields)
        .populate('aSeasonData.aData.iUserId', populateFields)
        .lean()

      if (dataRes) {
        if (dataRes.oMonthData && dataRes.oMonthData.aData && dataRes.oMonthData.aData.length) {
          dataRes.oMonthData.aData.forEach((d) => {
            d.oUser = d.iUserId
            delete d.iUserId
          })
        }

        if (dataRes.oAllTimeData && dataRes.oAllTimeData.aData && dataRes.oAllTimeData.aData.length) {
          dataRes.oAllTimeData.aData.forEach((d) => {
            d.oUser = d.iUserId
            delete d.iUserId
          })
        }

        if (dataRes.aSeasonData && dataRes.aSeasonData.length) {
          dataRes.aSeasonData.forEach((oSeasonData) => {
            oSeasonData.aData.forEach((d) => {
              d.oUser = d.iUserId
              delete d.iUserId
            })
          })
        }
      } else {
        dataRes = {
          oMonthData: {
            sTitle: 'Top 10',
            aData: []
          },
          oAllTimeData: {
            sTitle: 'Top 10',
            aData: []
          },
          aSeasonData: []
        }
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cusers), data: dataRes })
    } catch (error) {
      return catchError('Statistic.getLeaderShipboardV2', error, req, res)
    }
  }

  async calculateLeaderShipboardV2(req, res) {
    try {
      const monthData = await StatisticsModel.find({ dCreatedAt: { $gte: new Date((new Date().getTime() - (15 * 24 * 60 * 60 * 1000))) } }, { nTotalJoinLeague: 1, iUserId: 1, _id: 0 })
        .sort({ nTotalJoinLeague: -1 })
        .limit(10)
        .lean()

      const allTimeData = await StatisticsModel.find({}, { nTotalJoinLeague: 1, iUserId: 1, _id: 0 })
        .sort({ nTotalJoinLeague: -1 })
        .limit(10)
        .lean()

      const seasonData = []

      const seasonsToDisplay = await LeaderShipBoardModel.findOne().lean()
      const seasonIds = seasonsToDisplay ? seasonsToDisplay.aSeasons || [] : []

      let seasons = await SeasondModel.find({ _id: { $in: seasonIds } }).lean()
      if (!seasons.length) {
        seasons = [{ sKey: 'sr:season:86908' }, { sKey: 'sr:season:82122' }]
      }

      for (let i = 0; i < seasons.length; i++) {
        const season = seasons[i]
        const matches = await MatchModel.find({ sSeasonKey: season.sKey }, { _id: 1, sSeasonName: 1 }).lean()
        const matchIds = matches.map(({ _id }) => ObjectId(_id))

        const userLeagues = await UserLeagueModel.aggregate([
          {
            $match: {
              iMatchId: { $in: matchIds }
            }
          }, {
            $lookup: {
              from: 'matchleagues',
              localField: 'iMatchLeagueId',
              foreignField: '_id',
              as: 'matchleagues'
            }
          }, {
            $match: {
              'matchleagues.0.bCancelled': false
            }
          }, {
            $group: {
              _id: '$iUserId',
              nTotalJoinLeague: { $sum: 1 },
              iUserId: { $first: '$iUserId' }
            }
          }, {
            $sort: { nTotalJoinLeague: -1 }
          }, {
            $limit: 10
          }
        ]).allowDiskUse(bAllowDiskUse).exec()

        if (userLeagues.length) {
          const data = generateSeasonRank(userLeagues)

          seasonData.push({
            sTitle: matches[0] ? matches[0].sSeasonName : '',
            aData: data
          })
        }
      }

      await LeaderShipBoardModel.deleteMany()

      await LeaderShipBoardModel.create({
        oMonthData: {
          sTitle: 'Top 10',
          aData: generateSeasonRank(monthData)
        },
        oAllTimeData: {
          sTitle: 'Top 10',
          aData: generateSeasonRank(allTimeData)
        },
        aSeasonData: seasonData,
        aSeasons: seasonIds
      })
      const populateFields = ['sName', 'sProPic', 'sUsername', 'eType']
      const dataRes = await LeaderShipBoardModel.findOne({ }, { aSeasons: 0, 'aSeasonData.aData._id': 0, 'oMonthData.aData._id': 0, 'oAllTimeData.aData._id': 0 })
        .populate('oMonthData.aData.iUserId', populateFields)
        .populate('oAllTimeData.aData.iUserId', populateFields)
        .populate('aSeasonData.aData.iUserId', populateFields)
        .lean()

      dataRes.oMonthData.aData.forEach((d) => {
        d.oUser = d.iUserId
        delete d.iUserId
      })
      dataRes.oAllTimeData.aData.forEach((d) => {
        d.oUser = d.iUserId
        delete d.iUserId
      })
      dataRes.aSeasonData.forEach((oSeasonData) => {
        oSeasonData.aData.forEach((d) => {
          d.oUser = d.iUserId
          delete d.iUserId
        })
      })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cusers), data: dataRes })
    } catch (error) {
      return catchError('Statistic.calculateLeaderShipboardV2', error, req, res)
    }
  }

  async addSeasonInLeadership(req, res) {
    try {
      const { aSeasons } = req.body
      const dataRes = await LeaderShipBoardModel.findOneAndUpdate({ }, { aSeasons }, { new: true, runValidators: true }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cusers), data: dataRes })
    } catch (error) {
      return catchError('Statistic.addSeasonInLeadership', error, req, res)
    }
  }
}

function generateSeasonRank(data) {
  try {
    if (data.length === 1) {
      data[0].nUserRank = 1
      return data
    } else if (data.length === 2) {
      if (data[0].nTotalJoinLeague === data[1].nTotalJoinLeague) {
        data[0].nUserRank = 1
        data[1].nUserRank = 1
      } else if (data[0].nTotalJoinLeague > data[1].nTotalJoinLeague) {
        data[0].nUserRank = 1
        data[1].nUserRank = 2
      } else {
        data[0].nUserRank = 2
        data[1].nUserRank = 1
      }
    } else {
      let r = 1
      return data.filter((team, i) => {
        team.nUserRank = r
        if (i + 1 >= data.length) {
          data[data.length - 1].nUserRank = data[data.length - 1].nTotalJoinLeague === data[data.length - 2].nTotalJoinLeague ? data[data.length - 1].nUserRank : r++
        } else if (data[i + 1].nTotalJoinLeague !== team.nTotalJoinLeague) {
          r = i + 2
        }
        return team
      })
    }
  } catch (error) {
    handleCatchError(error)
  }
}

module.exports = new Statistic()
