const LeagueModel = require('./model')
const axios = require('axios')
const config = require('../../config/config')
const LeagueCategoryModel = require('../leagueCategory/model')
const FilterCategoryModel = require('../leagueCategory/filterCategory.model')
const { ruleType } = require('../../data')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, handleCatchError, removenull, getPaginationValues2, getIp, checkValidImageType, defaultSearch } = require('../../helper/utilities.services')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const s3 = require('../../helper/s3config')
const { s3Leagues, S3_BUCKET_NAME } = require('../../config/config')
const adminServices = require('../admin/subAdmin/services')
const adminLogQueue = require('../../rabbitmq/queue/adminLogQueue')
const AdminLogModel = require('../admin/logs.model');
class League {
  // To get List of league Name and _id SportsType wise and which has atLeast one prize breakup
  async leagueList(req, res) {
    try {
      const { sportsType } = req.query
      const data = await LeagueModel.find({ eCategory: sportsType.toUpperCase(), eStatus: 'Y' }, { sName: 1 }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cleague), data })
    } catch (error) {
      catchError('League.leagueList', error, req, res)
    }
  }

  async getLeagueList(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league/v1`, {
        params :{
          sportsType: req.query.sportsType,
          ...req.query
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp( response.data)
    } catch (error) {
      handleCatchError(error, 'LeagueService.getLeagueList', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  async fullLeagueListV2(req, res) {
    try {
      let { nStart, nLimit, search } = req.query
      nStart = parseInt(nStart) || 0
      nLimit = parseInt(nLimit) || 10

      if (search) search = defaultSearch(search)

      let query = search ? { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      query = { ...query, eStatus: 'Y', 'aLeaguePrize.nRankFrom': { $gt: 0 } }

      const results = await LeagueModel.find(query, { sName: 1, eCategory: 1 }).skip(nStart).limit(nLimit).lean()
      const total = await LeagueModel.countDocuments(query)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cleague), data: { total, results } })
    } catch (error) {
      catchError('League.leagueList', error, req, res)
    }
  }

  async getFullLeagueListV2(req, res) {
    try{
      const response = await axios.get(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league/full-list/v2`, {
        params :{
          ...req.query
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
    } catch (error) {
      handleCatchError(error, 'LeagueService.getFullLeagueListV2', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  // To add new league
  async add(req, res) {
    try {
      const { nMin, nMax, eCategory, iFilterCatId, bMultipleEntry, nTeamJoinLimit, iLeagueCatId, nPrice, nBonusUtil, bPoolPrize, bUnlimitedJoin, bCashbackEnabled, nMinCashbackTeam, nCashbackAmount, eCashbackType, nMinTeamCount, sName, bAutoCreate } = req.body
      const { _id: iAdminId } = req.admin

      req.body = pick(req.body, ['sName', 'nTotalWinners', 'nLoyaltyPoint', 'nTeamJoinLimit', 'nMax', 'nMin', 'nPrice', 'nTotalPayout', 'nDeductPercent', 'nBonusUtil', 'sPayoutBreakupDesign', 'bConfirmLeague', 'bMultipleEntry', 'bAutoCreate', 'bPoolPrize', 'nPosition', 'eStatus', 'eCategory', 'nWinnersCount', 'iLeagueCatId', 'iFilterCatId', 'bUnlimitedJoin', 'nMinCashbackTeam', 'nCashbackAmount', 'eCashbackType', 'nMinTeamCount', 'nBotsCount', 'bBotCreate', 'nCopyBotsPerTeam', 'nSameCopyBotTeam', 'bCashbackEnabled', 'nAutoFillSpots'])
      removenull(req.body)

      if (bPoolPrize === false && bUnlimitedJoin === true) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].unlimitedJoin) })
      if (nMin && nMax && parseInt(nMin) > parseInt(nMax)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].cminimumEntry).replace('#', messages[req.userLanguage].cmaximumEntry) })

      // For Auto create Contest, there is not allow unlimited user join feature.
      if (bAutoCreate === true && bUnlimitedJoin === true) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_allowed_with.replace('##', messages[req.userLanguage].autoCreate).replace('#', messages[req.userLanguage].unlimitedJoin) })

      // User can create Minimum team but it can't be greater than maximum size of contest.
      if (nMinTeamCount && nMax && parseInt(nMinTeamCount) >= parseInt(nMax)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].cteam).replace('#', messages[req.userLanguage].cmaximumEntry) })

      // contest whose multiple team join feature not enable, then team join limit can't be the greater than 1.
      if (bMultipleEntry === false && nTeamJoinLimit > 1) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cteamJoinLimit) })

      // To create any contest, there should be proper league category as well proper filter category also.
      const leagueCategory = await LeagueCategoryModel.findById(iLeagueCatId, { sTitle: 1 }).lean()
      if (!leagueCategory) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].leagueCategory) })

      const filterCategory = await FilterCategoryModel.findById(iFilterCatId, { sTitle: 1 }).lean()
      if (!filterCategory) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].filterCategory) })

      // For Free contest, there is not any bonus utilization feature.
      if (Number(nPrice) === 0 && nBonusUtil && Number(nBonusUtil) > 0) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].bonus) })

      // For cashback enable contest, Minimum team for cashback reward and cashback amount and it's type like cash or bonus data must be required.
      if (bCashbackEnabled && nMinCashbackTeam && nCashbackAmount <= 0) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cashbackamount) })
      if (bCashbackEnabled && nMinCashbackTeam && !ruleType.includes(eCashbackType)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cashbacktype) })

      // Given contest named if already exist then we'll throw validation message.
      const leagueExist = await LeagueModel.findOne({ eCategory: eCategory.toUpperCase(), sName }).lean()
      if (leagueExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].leagueName) })

      const data = await LeagueModel.create({ ...req.body, eCategory: eCategory.toUpperCase(), sLeagueCategory: leagueCategory.sTitle, sFilterCategory: filterCategory.sTitle })

      const oNewFields = data
      const logData = { oOldFields: {}, oNewFields, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'L' }
      adminLogQueue.publish(logData)
      // await adminServices.adminLog(req, res, logData)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].newLeague), data })
    } catch (error) {
      catchError('League.add', error, req, res)
    }
  }

  async addLeague(req, res) {
    try {
      const response = await axios.post(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league/v1`, {
        ...req.body,
        adminId: req.admin._id
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.addLeague', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  // To update leagues
  async update(req, res) {
    try {
      let { nMin, nMax, eCategory, iFilterCatId, bMultipleEntry, nTeamJoinLimit, iLeagueCatId, nPrice, nBonusUtil, bPoolPrize, bUnlimitedJoin, bCashbackEnabled, nMinCashbackTeam, nCashbackAmount, eCashbackType, nMinTeamCount, sName, bAutoCreate, nLoyaltyPoint } = req.body
      const { _id: iAdminId } = req.admin

      req.body = pick(req.body, ['sName', 'nWinnersCount', 'nLoyaltyPoint', 'nTotalWinners', 'bMultipleEntry', 'nTeamJoinLimit', 'nMax', 'nMin', 'nPrice', 'nTotalPayout', 'nDeductPercent', 'nBonusUtil', 'sPayoutBreakupDesign', 'bConfirmLeague', 'bAutoCreate', 'bPoolPrize', 'nPosition', 'eStatus', 'eCategory', 'iLeagueCatId', 'iFilterCatId', 'bUnlimitedJoin', 'nMinCashbackTeam', 'nCashbackAmount', 'eCashbackType', 'nMinTeamCount', 'nBotsCount', 'bBotCreate', 'nCopyBotsPerTeam', 'nSameCopyBotTeam', 'nAutoFillSpots'])

      nBonusUtil = nBonusUtil || 0
      nLoyaltyPoint = nLoyaltyPoint || 0

      if (bPoolPrize === false && bUnlimitedJoin === true) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].unlimitedJoin) })

      if (nMin && nMax && parseInt(nMin) > parseInt(nMax)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].cminimumEntry).replace('#', messages[req.userLanguage].cmaximumEntry) })

      // For Auto create Contest, there is not allow unlimited user join feature.
      if (bAutoCreate === true && bUnlimitedJoin === true) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_allowed_with.replace('##', messages[req.userLanguage].autoCreate).replace('#', messages[req.userLanguage].unlimitedJoin) })

      // User can create Minimum team but it can't be greater than maximum size of contest.
      if (nMinTeamCount && nMax && parseInt(nMinTeamCount) > parseInt(nMax)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].cteam).replace('#', messages[req.userLanguage].cmaximumEntry) })

      // contest whose multiple team join feature not enable, then team join limit can't be the greater than 1 and vice versa.
      if (bMultipleEntry === false && nTeamJoinLimit > 1) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cteamJoinLimit) })
      if (bMultipleEntry === true && nTeamJoinLimit <= 1) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cteamJoinLimit) })

      const oldLeague = await LeagueModel.findById(req.params.id).lean()
      if (!oldLeague) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cleague) })

      // For pool contest, we don't allow for prize breakup to extra reward type.
      if (bPoolPrize === true) {
        const { aLeaguePrize: leaguePrize } = oldLeague

        const totalPayInPercent = leaguePrize.reduce((acc, pb) => (acc + pb.nPrize), 0)
        if (totalPayInPercent > 100) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].pool_prize_breakup_err })

        const checkBreakup = await LeagueModel.countDocuments({ _id: ObjectId(req.params.id), 'aLeaguePrize.eRankType': 'E' })
        if (checkBreakup > 0) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].extra_not_allowed_in_poolprize_league })
      }

      // Given contest named if already exist then we'll throw validation message.
      const leagueExist = await LeagueModel.findOne({ eCategory: eCategory.toUpperCase(), sName, _id: { $ne: req.params.id } }).lean()
      if (leagueExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].leagueName) })

      // To create any contest, there should be proper league category as well proper filter category also.
      const leagueCategory = await LeagueCategoryModel.findById(iLeagueCatId, { sTitle: 1 }).lean()
      if (!leagueCategory && iLeagueCatId) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].leagueCategory) })

      if (leagueCategory) req.body.sLeagueCategory = leagueCategory.sTitle

      const filterCategory = await FilterCategoryModel.findById(iFilterCatId, { sTitle: 1 }).lean()
      if (!filterCategory && iFilterCatId) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].filterCategory) })

      // For Free contest, there is not any bonus utilization feature.
      if (Number(nPrice) === 0 && nBonusUtil && Number(nBonusUtil) > 0) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].bonus) })

      // For cashback enable contest, Minimum team for cashback reward and cashback amount and it's type like cash or bonus data must be required.
      if (bCashbackEnabled && nMinCashbackTeam && nCashbackAmount <= 0) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cashbackamount) })
      if (bCashbackEnabled && nMinCashbackTeam && !ruleType.includes(eCashbackType)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cashbacktype) })

      if (filterCategory) req.body.sFilterCategory = filterCategory.sTitle

      const data = await LeagueModel.findByIdAndUpdate(req.params.id, { ...req.body, eCategory: eCategory.toUpperCase(), bCashbackEnabled, nMinCashbackTeam, nCashbackAmount, nLoyaltyPoint, nBonusUtil, dUpdatedAt: Date.now() }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cleague) })

      const logData = { oOldFields: oldLeague, oNewFields: data, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'L' }
      adminLogQueue.publish(logData)
      // await adminServices.adminLog(req, res, logData)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cleague), data })
    } catch (error) {
      catchError('League.update', error, req, res)
    }
  }

  async updateLeague(req, res) {
    try {
      const updateId = req.params.id
      const response = await axios.put(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league/${updateId}/v1`, {
        ...req.body,
        adminId: req.admin._id
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.updateLeague', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  // To get all league sportsType wise
  async list(req, res) {
    try {
      const { sportsType, searchField, searchCategory, eStatus } = req.query

      const { start, limit, sorting, search } = getPaginationValues2(req.query)
      let query = {
        eCategory: sportsType.toUpperCase()
      }
      query = search ? { ...query, sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : query
      query = searchCategory ? { ...query, sLeagueCategory: { $regex: new RegExp('^.*' + searchCategory + '.*', 'i') } } : query
      query = eStatus ? { ...query, eStatus } : query

      if (searchField === 'nBonusUtil') {
        query = {
          ...query,
          [`${searchField}`]: { $gt: 0 }
        }
      } else if (['bConfirmLeague', 'bMultipleEntry', 'bAutoCreate', 'bPoolPrize', 'bUnlimitedJoin'].includes(searchField)) {
        query = {
          ...query,
          [`${searchField}`]: true
        }
      }

      const results = await LeagueModel.find(query, {
        sName: 1,
        nMax: 1,
        nMin: 1,
        nPrice: 1,
        nTotalPayout: 1,
        nDeductPercent: 1,
        nBonusUtil: 1,
        sPayoutBreakupDesign: 1,
        bConfirmLeague: 1,
        bMultipleEntry: 1,
        bUnlimitedJoin: 1,
        bAutoCreate: 1,
        bPoolPrize: 1,
        nPosition: 1,
        nTotalWinners: 1,
        eStatus: 1,
        eCategory: 1,
        nLoyaltyPoint: 1,
        bCashbackEnabled: 1,
        nMinCashbackTeam: 1,
        nCashbackAmount: 1,
        eCashbackType: 1,
        iLeagueCatId: 1,
        sLeagueCategory: 1,
        iFilterCatId: 1,
        sFilterCategory: 1,
        nMinTeamCount: 1,
        nBotsCount: 1,
        nCopyBotsPerTeam: 1,
        nSameCopyBotTeam: 1,
        bBotCreate: 1,
        dCreatedAt: 1,
        nWinnersCount: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const total = await LeagueModel.countDocuments({ ...query })

      const data = [{ total, results }]
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cleague), data })
    } catch (error) {
      return catchError('League.list', error, req, res)
    }
  }

  async getListV1(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league/list/v1`, {
        params :{
          ...req.query
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })
      console.log("response =======", response.data )
      return res.status(status.OK).jsonp(response.data)
    } catch (error) {
      handleCatchError(error, 'LeagueService.getListV1', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  // To delete league
  async remove(req, res) {
    try {
      const data = await LeagueModel.findByIdAndDelete(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cleague) })
      const { _id: iAdminId } = req.admin

      const logData = { oOldFields: data, oNewFields: {}, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'L' }
      adminLogQueue.publish(logData)
      // await adminServices.adminLog(req, res, logData)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].cleague), data })
    } catch (error) {
      return catchError('League.remove', error, req, res)
    }
  }

  async deleteLeague(req, res) {
    try {
      const leagueId = req.params.id
      const response = await axios.delete(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league/${leagueId}/v1`, {
        params: {
          ...req.params
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.deleteLeague', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  // To get details of single league by _id
  async get(req, res) {
    try {
      const data = await LeagueModel.findById(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cleague) })
      data.sNote = messages[req.userLanguage].min_entry_greater_than_pb

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cleague), data })
    } catch (error) {
      catchError('League.get', error, req, res)
    }
  }

  async getLeagueById(req, res) {
    try {
      const userId = req.params.id
      const response = await axios.get(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league/${userId}/v1`, {
        params :{
          ...req.params
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
    } catch (error) {
      handleCatchError(error, 'LeagueService.getLeagueById', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  // To add PriceBreakUp for single League
  async addPrizeBreakup(req, res) {
    try {
      let { nRankFrom, nRankTo, nPrize, eRankType, sInfo, sImage } = req.body
      req.body = pick(req.body, ['nRankFrom', 'nRankTo', 'nPrize', 'eRankType', 'sInfo', 'sImage'])
      const { _id: iAdminId } = req.admin

      nPrize = Number(nPrize)
      // For Extra reward prize breakup, we required information of extra reward like T-Shirt, Coupon, Etc. And it's prize always be zero.
      if ((eRankType === 'E') && !sInfo) { return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].ssinfo) }) }
      if ((eRankType === 'E') && (parseInt(nPrize) !== 0)) { return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].snprice) }) }

      // Rank from always less than Rank to
      if (nRankFrom && nRankTo && (parseInt(nRankFrom) > parseInt(nRankTo))) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].crankFrom).replace('#', messages[req.userLanguage].crankTo) }) }

      const league = await LeagueModel.findById(req.params.id).lean()
      if (!league) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cleague) }) }

      // Rank from can't be grater than contest max. size and winner counts of contest vice versa for RankTo also.
      if ((nRankFrom > league.nMax) || (nRankTo > league.nMax)) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].crankFrom).replace('#', messages[req.userLanguage].snMax) }) }
      if ((nRankFrom > league.nWinnersCount) || (nRankTo > league.nWinnersCount)) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].crankFrom).replace('#', messages[req.userLanguage].snWinnerCount) }) }

      if ((league.bPoolPrize) && eRankType === 'E') { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].extra_not_allowed_in_poolprize_league }) }

      let { aLeaguePrize: leaguePrize, nTotalPayout, bPoolPrize } = league

      if (bPoolPrize) {
        const totalPayInPercent = leaguePrize.reduce((acc, pb) => (acc + pb.nPrize), 0)
        if (totalPayInPercent + nPrize > 100) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].totalPer).replace('#', messages[req.userLanguage].hundred) })
      } else if (leaguePrize) {
        // if total prize breakup prize in given breakup range is grater than contest payouts then we'll throw validation message accordingly.
        const totalPay = leaguePrize.reduce((acc, pb) => (acc + (Number(pb.nPrize) * ((Number(pb.nRankTo) - Number(pb.nRankFrom)) + 1))), 0)
        if (totalPay + (nPrize * ((nRankTo - nRankFrom) + 1)) > nTotalPayout) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].stotalPay) }) }
      }

      if (leaguePrize.length) {
        // If Prize breakup already exist in contest, then we'll throw validation message accordingly.
        const priceExist = leaguePrize.find((pb) => {
          if ((pb.nRankFrom <= parseInt(nRankFrom)) && (pb.nRankTo >= parseInt(nRankFrom))) return true
          if ((pb.nRankFrom <= parseInt(nRankTo)) && (pb.nRankTo >= parseInt(nRankTo))) return true
        })
        if (priceExist) { return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cpriceBreakup) }) }
      }

      let aLeaguePrize = {}
      if (eRankType === 'E' && sImage) {
        aLeaguePrize = { nRankFrom, nRankTo, nPrize, eRankType, sInfo, sImage }
      } else {
        aLeaguePrize = { nRankFrom, nRankTo, nPrize, eRankType, sInfo }
      }

      if (Array.isArray(leaguePrize)) { leaguePrize.push(aLeaguePrize) } else { leaguePrize = [aLeaguePrize] }

      leaguePrize.sort((a, b) => a.nRankFrom - b.nRankFrom)

      const data = await LeagueModel.findByIdAndUpdate(req.params.id, { aLeaguePrize: leaguePrize, dUpdatedAt: Date.now() }, { new: true, runValidators: true }).lean()

      const logData = { oOldFields: { _id: league._id, sName: league.sName, aLeaguePrize: league.aLeaguePrize }, oNewFields: { _id: data._id, sName: data.sName, aLeaguePrize: data.aLeaguePrize }, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'PB' }
      adminLogQueue.publish(logData)
      // await adminServices.adminLog(req, res, logData)

      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cleague) }) }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnewPriceBreakup), data })
    } catch (error) {
      catchError('League.addPrizeBreakup', error, req, res)
    }
  }

  async createPrizeBreakup(req, res) {
    try {
      const leagueId = req.params.id
      const response = await axios.post(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league/${leagueId}/prize-breakup/v1`, {
        ...req.body,
       adminId: req.admin._id
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.createPrizeBreakup', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  // To update PriceBreakUp for single League
  async updatePrizeBreakup(req, res) {
    try {
      let { nRankFrom, nRankTo, nPrize, eRankType, sInfo, sImage } = req.body
      nPrize = Number(nPrize)
      const { _id: iAdminId } = req.admin

      // For Extra reward prize breakup, we required information of extra reward like T-Shirt, Coupon, Etc. And it's prize always be zero.
      if ((eRankType === 'E') && !sInfo) { return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.UnprocessableEntity, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].ssinfo) }) }
      if ((eRankType === 'E') && (parseInt(nPrize) !== 0)) { return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.UnprocessableEntity, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].snprice) }) }

      // Rank from always less than Rank to
      if (nRankFrom && nRankTo && (parseInt(nRankFrom) > parseInt(nRankTo))) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].crankFrom).replace('#', messages[req.userLanguage].crankTo) }) }

      const league = await LeagueModel.findById(req.params.id).lean()
      if (!league) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cleague) }) }

      // Rank from can't be grater than contest max. size and winner counts of contest vice versa for RankTo also.
      if ((nRankFrom > league.nMax) || (nRankTo > league.nMax)) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].crankFrom).replace('#', messages[req.userLanguage].snMax) }) }
      if ((nRankFrom > league.nWinnersCount) || (nRankTo > league.nWinnersCount)) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].crankFrom).replace('#', messages[req.userLanguage].snWinnerCount) }) }

      if ((league.bPoolPrize) && eRankType === 'E') { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].extra_not_allowed_in_poolprize_league }) }

      const { aLeaguePrize: leaguePrize, nTotalPayout, bPoolPrize } = league
      const old = leaguePrize.find(({ _id }) => req.params.pid === _id.toString())

      if (bPoolPrize) {
        let totalPayInPercent = leaguePrize.reduce((acc, pb) => (acc + pb.nPrize), 0)
        totalPayInPercent = totalPayInPercent - old.nPrize
        if (totalPayInPercent + nPrize > 100) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].totalPer).replace('#', messages[req.userLanguage].hundred) })
      } else if (leaguePrize.length) {
        // if total prize breakup prize in given new breakup range after removing already exist breakup range is grater than contest payouts then we'll throw validation message accordingly.
        const totalPay = leaguePrize.reduce((acc, pb) => (acc + (Number(pb.nPrize) * ((Number(pb.nRankTo) - Number(pb.nRankFrom)) + 1))), 0)
        const nOldPrize = old.nPrize * ((old.nRankTo - old.nRankFrom) + 1)
        if (totalPay + (nPrize * ((nRankTo - nRankFrom) + 1)) - nOldPrize > nTotalPayout) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].stotalPay) }) }
      }

      if (leaguePrize.length) {
        // If Prize breakup already exist in contest, then we'll throw validation message accordingly.
        const priceExist = leaguePrize.find((pb) => {
          if ((pb.nRankFrom <= parseInt(nRankFrom)) && (pb.nRankTo >= parseInt(nRankFrom)) && (pb._id.toString() !== req.params.pid.toString())) { return true }
          if ((pb.nRankFrom <= parseInt(nRankTo)) && (pb.nRankTo >= parseInt(nRankTo)) && (pb._id.toString() !== req.params.pid.toString())) { return true }
        })
        if (priceExist) { return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cpriceBreakup) }) }
      }

      let updateObj = {
        'aLeaguePrize.$.nRankFrom': nRankFrom,
        'aLeaguePrize.$.nRankTo': nRankTo,
        'aLeaguePrize.$.nPrize': nPrize,
        'aLeaguePrize.$.eRankType': eRankType,
        'aLeaguePrize.$.sInfo': sInfo
      }
      if (eRankType === 'E' && sImage) {
        updateObj = { ...updateObj, 'aLeaguePrize.$.sImage': sImage }
      } else {
        updateObj = { ...updateObj, 'aLeaguePrize.$.sImage': '' }
      }

      const data = await LeagueModel.findOneAndUpdate({ _id: ObjectId(req.params.id), 'aLeaguePrize._id': ObjectId(req.params.pid) }, updateObj, { new: true, runValidators: true }).lean()
      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cleague) }) }

      const logData = { oOldFields: { _id: league._id, sName: league.sName, aLeaguePrize: league.aLeaguePrize }, oNewFields: { _id: data._id, sName: data.sName, aLeaguePrize: data.aLeaguePrize }, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'PB' }
      adminLogQueue.publish(logData)
      // await adminServices.adminLog(req, res, logData)

      // if update extra prize to real money then remove old extra prize image
      // old && old.sImage
      if (old && old.sImage && (['R', 'B'].includes(eRankType) || old.sImage !== sImage)) {
        const s3Params = {
          Bucket: S3_BUCKET_NAME,
          Key: old.sImage
        }
        await s3.deleteObject(s3Params)
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cpriceBreakup), data })
    } catch (error) {
      catchError('League.updatePrizeBreakup', error, req, res)
    }
  }

  async editPrizeBreakup(req, res) {
    try {
      const leagueId = req.params.id
      const prizeId = req.params.pid
      const response = await axios.put(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league/${leagueId}/prize-breakup/${prizeId}/v1`, {
        ...req.body,
        adminId: req.admin._id
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.editPrizeBreakup', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  async removePrizeBreakup(req, res) {
    try {
      const { _id: iAdminId } = req.admin

      const data = await LeagueModel.findOneAndUpdate({ _id: ObjectId(req.params.id) }, { $pull: { aLeaguePrize: { _id: ObjectId(req.params.pid) } } }, { new: false, runValidators: true })
      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cleague) }) }

      const old = data.aLeaguePrize.find(p => p._id.toString() === req.params.pid)

      // if rank type is Extra then image also remove from s3
      if (old && old.eRankType === 'E' && old.sImage) {
        const s3Params = {
          Bucket: S3_BUCKET_NAME,
          Key: old.sImage
        }
        await s3.deleteObject(s3Params)
      }

      let aLeaguePrize = data.aLeaguePrize
      aLeaguePrize = aLeaguePrize.filter(({ _id }) => _id.toString() !== req.params.pid)

      const logData = { oOldFields: { _id: data._id, sName: data.sName, aLeaguePrize: data.aLeaguePrize }, oNewFields: { _id: data._id, sName: data.sName, aLeaguePrize: aLeaguePrize }, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'PB' }
      adminLogQueue.publish(logData)
      // await adminServices.adminLog(req, res, logData)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].cpriceBreakup), data })
    } catch (error) {
      catchError('League.removePrizeBreakup', error, req, res)
    }
  }

  async deletePrizeBreakup(req, res) {
    try {
      const leagueId = req.params.id
      const prizeId = req.params.pid
      const response = await axios.delete(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league/${leagueId}/prize-breakup/${prizeId}/v1`, {
        params : {
          ...req.params
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      let aLeaguePrize = response.data.data.aLeaguePrize
      aLeaguePrize = aLeaguePrize.filter(({ _id }) => _id.toString() !== req.params.pid)

      const logData = { oOldFields: { _id: response.data._id, sName: response.data.sName, aLeaguePrize: response.data.aLeaguePrize }, oNewFields: { _id: response.data._id, sName: response.data.sName, aLeaguePrize: aLeaguePrize }, sIP: getIp(req), iAdminId: req.admin._id, iUserId: null, eKey: 'PB' }
      adminLogQueue.publish(logData)

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.deletePrizeBreakup', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  // To get List of PriceBreakUp for single League
  async listPrizeBreakup(req, res) {
    try {
      const data = await LeagueModel.findById(req.params.id, { aLeaguePrize: 1, _id: 0 }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cleague) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpriceBreakup), data: data })
    } catch (error) {
      return catchError('League.listPrizeBreakup', error, req, res)
    }
  }

  async getListPrizeBreakup(req, res) {
    try {
      const prizeBreakupId = req.params.id
      const response = await axios.get(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league/${prizeBreakupId}/prize-breakup/v1`, {
        params :{
          ...req.params
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
    } catch (error) {
      handleCatchError(error, 'LeagueService.getListPrizeBreakup', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  // To get single PriceBreakUp for single League
  async getPrizeBreakup(req, res) {
    try {
      const data = await LeagueModel.findOne({
        _id: ObjectId(req.params.id),
        'aLeaguePrize._id': ObjectId(req.params.pid)
      }, { aLeaguePrize: { $elemMatch: { _id: ObjectId(req.params.pid) } } }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cleague) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpriceBreakup), data })
    } catch (error) {
      catchError('League.getPrizeBreakup', error, req, res)
    }
  }

  async getPrizeBreakupPid(req, res) {
    try {
      const prizeBreakupId = req.params.id
      const prizeBreakupPid = req.params.pid
      const response = await axios.get(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league/${prizeBreakupId}/prize-breakup/${prizeBreakupPid}/v1`, {
        params :{
          ...req.params
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.getPrizeBreakupPid', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  // To get signedUrl for PriceBreakUp extra image
  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await s3.signedUrl(sFileName, sContentType, s3Leagues)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('League.getSignedUrl', error, req, res)
    }
  }

  async getS3SignedUrl (req, res) {
    try {
      const response = await axios.post(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league/pre-signed-url/v1`, {
        ...req.body
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.getS3SignedUrl', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  // To copy league
  async copyLeague(req, res) {
    try {
      const { eCategory } = req.body
      const iLeagueId = req.params.id

      req.body = pick(req.body, ['eCategory'])
      removenull(req.body)

      // Given contest named if doesn't exist then we'll throw validation message.
      const leagueData = await LeagueModel.findOne({ _id: iLeagueId }).lean()
      if (!leagueData) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cleague) })

      const leagueObj = { ...leagueData }
      delete leagueObj.aLeaguePrize
      delete leagueObj.dCreatedAt
      delete leagueObj.dUpdatedAt
      delete leagueObj._id
      delete leagueObj.eCategory

      const prizeBreakUp = leagueData.aLeaguePrize.map((p) => {
        return { nRankFrom: p.nRankFrom, nRankTo: p.nRankTo, nPrize: p.nPrize, eRankType: p.eRankType, sInfo: p.sInfo }
      })

      // Collect sports which already have given league or same league name
      let gameCategoryList = []
      const leagueExist = await LeagueModel.find({ eCategory: { $in: eCategory }, sName: leagueData.sName, _id: { $ne: iLeagueId } }).lean()
      if (leagueExist) gameCategoryList = leagueExist.map((p) => p.eCategory)

      // Iterate requested sports and create league if given sport doesn't have this league
      const data = []
      for (let i = 0; i < eCategory.length; i++) {
        if (!gameCategoryList.includes(eCategory[i]) && leagueData.eCategory !== eCategory[i]) {
          const leagueCreate = await LeagueModel.create({ ...leagueObj, eCategory: eCategory[i], aLeaguePrize: prizeBreakUp })
          data.push({ _id: leagueCreate._id, eCategory: leagueCreate.eCategory })
        }
      }

      if (!data.length && eCategory.length === 1) {
        return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cleague) })
      } else if (!data.length) {
        return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].are_already_exist.replace('##', messages[req.userLanguage].cleagues) })
      }

      const leagueName = data.map((i) => i.eCategory).toString()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].league_copy_success.replace('##', leagueName), data })
    } catch (error) {
      catchError('League.copyLeague', error, req, res)
    }
  }

  async duplicateLeague(req, res) {
    try {
      const copyId = req.params.id
      const response = await axios.post(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league/copy/${copyId}/v1`, {
        ...req.body
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.duplicateLeague', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  async getAdminLeagueLogs(req, res) {//service method moved to LOGS_MS
    try {
      const { start, limit, sorting } = getPaginationValues2(req.query)
      // const { _id: iAdminId } = req.admin
      const { datefrom, dateto, iAdminId } = req.query

      let query = {
        eKey: { $in: ['L'] },
        $or: [
          {
            'oOldFields._id': ObjectId(req.params.id)
          }, {
            'oNewFields._id': ObjectId(req.params.id)
          }
        ]
      }
      query = iAdminId ? { ...query, iAdminId: ObjectId(iAdminId) } : query
      query = datefrom && dateto ? { ...query, dCreatedAt: { $gte: (datefrom), $lte: (dateto) } } : query

      const [logsData, total] = await Promise.all([
        AdminLogModel.find(query, {
          eKey: 1,
          iUserId: 1,
          oOldFields: 1,
          oNewFields: 1,
          oDetails: 1,
          sIP: 1,
          iAdminId: 1,
          dCreatedAt: 1
        })
          .sort(sorting)
          .skip(Number(start))
          .limit(Number(limit))
          .populate('iAdminId', ['sName', 'sUsername', 'sEmail', 'sProPic', 'eStatus', 'dLoginAt', 'eType'])
          .lean(),
        AdminLogModel.countDocuments(query)
      ])
      const aResults = logsData && Array.isArray(logsData) ? logsData : []
      const nTotal = total || 0

      const data = { nTotal, aResults }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cLeagueLogs), data })
    } catch (error) {
      catchError('League.getAdminLeagueLogs', error, req, res)
    }
  }
}

module.exports = new League()
