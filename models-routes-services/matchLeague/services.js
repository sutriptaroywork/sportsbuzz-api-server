const MatchLeagueModel = require('./model')
const LeagueModel = require('../league/model')
const PromocodeStatisticsModel = require('../promocode/statistics/model')
const MatchModel = require('../match/model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, getPaginationValues, pick, getPaginationValues2, handleCatchError, getIp, convertToDecimal, getUpdatedPrizeBreakupData } = require('../../helper/utilities.services')
const mongoose = require('mongoose')
const userBalanceServices = require('../userBalance/services')
const ObjectId = mongoose.Types.ObjectId
const UserLeagueModel = require('../userLeague/model')
const { queuePush, bulkQueuePush, redisClient } = require('../../helper/redis')
const { fn, col } = require('sequelize')
const MyMatchesModel = require('../myMatches/model')
// const PrivateLeaguePrizeModel = require('../privateLeague/model')
// const { getTotalPayoutForLeague } = require('../league/common')
const { CACHE_1, MEGA_CONTEST_AMOUNT_LIMIT_CRICKET, MEGA_CONTEST_AMOUNT_LIMIT_FOOTBALL, CACHE_6 } = require('../../config/config')
const { GamesDBConnect } = require('../../database/mongoose')
const BotLogModel = require('../botLogs/model')
const PassbookModel = require('../passbook/model')
const LeagueCategoryModel = require('../leagueCategory/model')
const UserTdsModel = require('../userTds/model')
const PromocodeModel = require('../promocode/model')
const moment = require('moment')
const adminServices = require('../admin/subAdmin/services')
const UserModel = require('../user/model')
const { INTERNAL_USERS } = require('../../config/common')
const adminLogQueue = require('../../rabbitmq/queue/adminLogQueue')
class MatchLeague {
  // To add new MatchLeague
  /**
   * This is deprecated service, no longer in used.
   */
  async add(req, res) {
    try {
      const { iMatchId, iLeagueId } = req.body

      const match = await MatchModel.findById(iMatchId).lean()
      if (!match) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })

      const hiddenLeague = await LeagueCategoryModel.findOne({ sKey: 'hiddenLeague' }, { _id: 1 }).lean().cache(CACHE_6, 'hiddenLeague')

      let leagueAddCount = 0
      const matchUpdateObj = {}
      const iAdminId = req.admin._id
      const aError = []

      const { eCategory, eStatus } = match

      // Change MegaContest Amount Limit based on SPORT
      const nMegaAmountLimit = (eCategory === 'CRICKET') ? MEGA_CONTEST_AMOUNT_LIMIT_CRICKET : MEGA_CONTEST_AMOUNT_LIMIT_FOOTBALL

      for (const LeagueId of iLeagueId) {
        const league = await LeagueModel.findOne({ _id: ObjectId(LeagueId._id), eCategory, eStatus: 'Y' }, { _id: 0 }).lean()

        if (league) {
          const aLeaguePrize = league.aLeaguePrize && Array.isArray(league.aLeaguePrize) && league.aLeaguePrize.length ? league.aLeaguePrize.sort((a, b) => a.nRankTo - b.nRankTo) : []
          if (!aLeaguePrize.length) {
            aError.push({ sName: league.sName, sReason: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cpriceBreakup) })
            continue
          }

          const nLastLeagueRank = aLeaguePrize[aLeaguePrize.length - 1].nRankTo || 0
          if (nLastLeagueRank !== league.nWinnersCount) {
            aError.push({ sName: league.sName, sReason: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cpriceBreakup) })
            continue
          }

          const matchLeague = await MatchLeagueModel.create({ ...league, iMatchId, iLeagueId: LeagueId._id, eCategory, eMatchStatus: eStatus })

          const bCond = !match.nPrice || (match.nPrice && match.nPrice < league.nTotalPayout)
          if (bCond && league.nTotalPayout >= nMegaAmountLimit && matchLeague && matchLeague.iLeagueCatId && hiddenLeague && hiddenLeague._id && matchLeague.iLeagueCatId.toString() !== hiddenLeague._id.toString()) {
            matchUpdateObj.isMegaContest = true
            matchUpdateObj.nPrice = league.nTotalPayout
            await MatchModel.updateOne({ _id: ObjectId(iMatchId), nPrice: { $lt: league.nTotalPayout } }, matchUpdateObj)
          }
          const logData = {
            oOldFields: { iMatchId },
            oNewFields: matchLeague,
            iAdminId: iAdminId,
            iUserId: null,
            eKey: 'ML'
          }
          adminLogQueue.publish(logData);
          leagueAddCount++
        }
      }
      if (leagueAddCount === 0) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cleagues), data: { aError } })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', `${leagueAddCount} ${messages[req.userLanguage].cnewMatchLeague}`), data: { aError } })
    } catch (error) {
      catchError('MatchLeague.add', error, req, res)
    }
  }

  // To get LeagueId and MatchId
  async get(req, res) {
    try {
      const data = await MatchLeagueModel.find({ iMatchId: ObjectId(req.params.id) }, { iLeagueId: 1, iMatchId: 1 }).lean()
      if (!data.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmatchLeague), data })
    } catch (error) {
      catchError('MatchLeague.get', error, req, res)
    }
  }

  // Get details of league
  async getSingleLeague(req, res) {
    try {
      const data = await MatchLeagueModel.findById(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmatchLeague), data })
    } catch (error) {
      catchError('MatchLeague.getSingleLeague', error, req, res)
    }
  }

  async getUpcomingLeague(req, res) {
    try {
      const data = await MatchLeagueModel.find(
        {
          iMatchId: ObjectId(req.params.id),
          bPrivateLeague: false,
          bCancelled: false,
          bPrizeDone: false,
          $or: [
            { $expr: { $lt: ['$nJoined', '$nMax'] } },
            { bUnlimitedJoin: true }
          ]
        }, { sName: 1, _id: 1 }).lean()
      if (!data.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmatchLeague), data })
    } catch (error) {
      catchError('MatchLeague.getUpcomingLeague', error, req, res)
    }
  }

  async getFinalLeagueCount(req, res) {
    try {
      const { eStatus } = req.query

      let data = {}
      const LeagueData = await MatchLeagueModel.find({
        iMatchId: ObjectId(req.params.id),
        bCancelled: false
      }, { _id: 1 }).lean()

      const leagueId = LeagueData.map(({ _id }) => _id)
      data.nLeagueCount = LeagueData.length

      data.nJoinedUsers = await UserLeagueModel.countDocuments({
        iMatchId: ObjectId(req.params.id),
        iMatchLeagueId: { $in: leagueId },
        bCancelled: false
      }, { readPreference: 'primary' })

      if (['U', 'L', 'I', 'CMP'].includes(eStatus)) {
        const [nPrivateLeagueCount, nPublicLeagueCount] = await Promise.all([
          MatchLeagueModel.countDocuments({ iMatchId: ObjectId(req.params.id), bPrivateLeague: true, bCancelled: false }),
          MatchLeagueModel.countDocuments({ iMatchId: ObjectId(req.params.id), bPrivateLeague: false, bCancelled: false })
        ])
        data.nPrivateLeagueCount = nPrivateLeagueCount
        data.nPublicLeagueCount = nPublicLeagueCount
      }
      if (['CMP', 'I', 'L'].includes(eStatus)) {
        const [nCancelledPrivateLeagueCount, nCancelledPublicLeagueCount] = await Promise.all([
          MatchLeagueModel.countDocuments({ iMatchId: ObjectId(req.params.id), bPrivateLeague: true, bCancelled: true }),
          MatchLeagueModel.countDocuments({ iMatchId: ObjectId(req.params.id), bPrivateLeague: false, bCancelled: true })
        ])
        data.nCancelledPrivateLeagueCount = nCancelledPrivateLeagueCount
        data.nCancelledPublicLeagueCount = nCancelledPublicLeagueCount
      }
      if (['CMP', 'I'].includes(eStatus)) {
        const [nTotalPlayReturnUsers, nTotalWinner, nPointCalculated, nRankCalculated, nPrizeCalculated, nWinDistributed] = await Promise.all([
          PassbookModel.count({ where: { eTransactionType: 'Play-Return', iMatchId: req.params.id } }),
          PassbookModel.count({ where: { eTransactionType: 'Win', iMatchId: req.params.id } }),
          UserLeagueModel.countDocuments({ iMatchId: ObjectId(req.params.id), iMatchLeagueId: { $in: leagueId }, bCancelled: false, bPointCalculated: true }),
          UserLeagueModel.countDocuments({ iMatchId: ObjectId(req.params.id), iMatchLeagueId: { $in: leagueId }, bCancelled: false, bRankCalculated: true }),
          MatchLeagueModel.countDocuments({ iMatchId: ObjectId(req.params.id), bPrizeDone: true }),
          MatchLeagueModel.countDocuments({ iMatchId: ObjectId(req.params.id), bWinningDone: true })
        ])
        data = { ...data, nTotalPlayReturnUsers, nTotalWinner, nPointCalculated, nRankCalculated, nPrizeCalculated, nWinDistributed }
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmatchLeague), data })
    } catch (error) {
      catchError('MatchLeague.getFinalLeagueCount', error, req, res)
    }
  }

  async cashbackDetailsV2(req, res) {
    try {
      const { iUserId, iMatchId } = req.query
      let { start, limit } = getPaginationValues(req.query)
      start = parseInt(start)
      limit = parseInt(limit)

      const exist = await MatchLeagueModel.findById(req.params.id).lean()
      if (!exist) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })

      const query = {
        aMatchLeagueCashback: {
          $elemMatch: {
            iMatchLeagueId: ObjectId(req.params.id)
          }
        }
      }

      const projection = {
        aMatchLeagueCashback: {
          $elemMatch: {
            iMatchLeagueId: ObjectId(req.params.id)
          }
        },
        iUserId: 1
      }
      if (iUserId) query.iUserId = ObjectId(iUserId)
      if (iMatchId) query.iMatchId = ObjectId(iMatchId)

      const total = await MyMatchesModel.countDocuments(query)
      const matchMatchData = await MyMatchesModel.find(query, projection).populate('iUserId', ['_id', 'sUsername', 'sName', 'eType']).skip(start).limit(limit).lean()
      const data = { total, data: matchMatchData }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmatchLeague), data })
    } catch (error) {
      catchError('MatchLeague.cashbackDetails', error, req, res)
    }
  }

  async checkFairPlayDetails(req, res) {
    try {
      const { sType } = req.query
      let data
      if (sType === 'MATCH_LEAGUE') {
        data = await MatchLeagueModel.findOne({ _id: ObjectId(req.params.id), bCancelled: false }, { _id: 1, sName: 1, nTotalPayout: 1, nPrice: 1, nJoined: 1, sFairPlay: 1, iMatchId: 1 }).lean()
        if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })
        await queuePush('FairPlay', data)
      } else if (sType === 'MATCH') {
        data = await MatchModel.findById(req.params.id).lean()
        if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })
        if (!['L', 'CMP', 'I'].includes(data.eStatus)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_started })
        const matchLeagues = await MatchLeagueModel.find({ iMatchId: ObjectId(data._id), bCancelled: false }, { _id: 1, sName: 1, nTotalPayout: 1, nPrice: 1, nJoined: 1, sFairPlay: 1, iMatchId: 1 }).lean()
        await bulkQueuePush('FairPlay', matchLeagues, matchLeagues.length)
      } else {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].stype) })
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].processFairPlay) })
    } catch (error) {
      catchError('MatchLeague.checkFairPlayDetails', error, req, res)
    }
  }

  // To get List of Match league (SportsType wise) with pagination, sorting and searching
  async list(req, res) {
    try {
      const { leagueType, _id, isFullResponse, leagueCategory, bCancelled, eType, searchType, bCMBSub = null } = req.query
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      let query = search ? { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      query = {
        ...query,
        iMatchId: ObjectId(req.params.id)
      }
      if (leagueType) {
        query.bPrivateLeague = leagueType === 'PRIVATE' ? true : leagueType === 'PUBLIC' ? false : undefined
      }
      if (leagueCategory) {
        query.sLeagueCategory = leagueCategory
      }
      if (_id) {
        query._id = ObjectId(_id)
      }
      if (['true', true, false, 'false'].includes(bCancelled)) {
        query.bCancelled = bCancelled
      }
      if (eType) {
        const aCombinationBotLogs = await BotLogModel.find({ eType, iMatchId: ObjectId(req.params.id), nSuccess: { $gte: 1 }, bCMBSub: JSON.parse(bCMBSub) }, { iMatchLeagueId: 1, iMatchId: 1 }).lean()
        const aMatchLeagueId = aCombinationBotLogs.map(log => log?.iMatchLeagueId)
        query._id = { $in: aMatchLeagueId }
      }
      let results
      if ([true, 'true'].includes(isFullResponse)) {
        results = await MatchLeagueModel.find(query, {
          nJoined: 1,
          iMatchId: 1,
          iLeagueId: 1,
          iLeagueCatId: 1,
          sLeagueName: 1,
          iUserId: 1,
          sName: 1,
          sShareLink: 1,
          sShareCode: 1,
          aLeaguePrize: 1,
          nMax: 1,
          nMin: 1,
          nPrice: 1,
          nTotalPayout: 1,
          nDeductPercent: 1,
          nBonusUtil: 1,
          sPayoutBreakupDesign: 1,
          bConfirmLeague: 1,
          bMultipleEntry: 1,
          bAutoCreate: 1,
          bCancelled: 1,
          bCopyLeague: 1,
          nLeaguePrice: 1,
          bPrizeDone: 1,
          bWinningDone: 1,
          bPlayReturnProcess: 1,
          bPrivateLeague: 1,
          sLeagueCategory: 1,
          nLoyaltyPoint: 1,
          bCashbackEnabled: 1,
          nMinCashbackTeam: 1,
          nCashbackAmount: 1,
          eCashbackType: 1,
          sFairPlay: 1,
          bPoolPrize: 1,
          bUnlimitedJoin: 1,
          nPosition: 1,
          nMinTeamCount: 1,
          nBotsCount: 1,
          nCopyBotsPerTeam: 1,
          nSameCopyBotTeam: 1,
          bBotCreate: 1,
          nAdminCommission: 1,
          nCreatorCommission: 1,
          eCategory: 1,
          dCreatedAt: 1,
          nWinnersCount: 1
        }).sort(sorting).lean()
      } else {
        results = await MatchLeagueModel.find(query, {
          nJoined: 1,
          iMatchId: 1,
          iLeagueId: 1,
          iLeagueCatId: 1,
          sLeagueName: 1,
          iUserId: 1,
          sName: 1,
          sShareLink: 1,
          sShareCode: 1,
          aLeaguePrize: 1,
          nMax: 1,
          nMin: 1,
          nPrice: 1,
          nTotalPayout: 1,
          nDeductPercent: 1,
          nBonusUtil: 1,
          sPayoutBreakupDesign: 1,
          bConfirmLeague: 1,
          bMultipleEntry: 1,
          bAutoCreate: 1,
          bCancelled: 1,
          bCopyLeague: 1,
          nLeaguePrice: 1,
          bPrizeDone: 1,
          bWinningDone: 1,
          bPlayReturnProcess: 1,
          bPrivateLeague: 1,
          sLeagueCategory: 1,
          nLoyaltyPoint: 1,
          bCashbackEnabled: 1,
          nMinCashbackTeam: 1,
          nCashbackAmount: 1,
          eCashbackType: 1,
          sFairPlay: 1,
          bPoolPrize: 1,
          bUnlimitedJoin: 1,
          nPosition: 1,
          nMinTeamCount: 1,
          nBotsCount: 1,
          nCopyBotsPerTeam: 1,
          nSameCopyBotTeam: 1,
          bBotCreate: 1,
          nAdminCommission: 1,
          nCreatorCommission: 1,
          eCategory: 1,
          dCreatedAt: 1,
          nWinnersCount: 1
        }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()
      }

      const total = await MatchLeagueModel.countDocuments({ ...query })

      const aLeagueIds = results.map((league) => ObjectId(league.iLeagueId))
      const promoData = await PromocodeModel.find({ aLeagues: { $in: aLeagueIds }, aMatches: req.params.id, eType: 'MATCH' }, { aLeagues: 1, _id: 0 }).lean()
      const promoLeaguesData = promoData && promoData.length ? promoData.map(({ aLeagues }) => aLeagues).flat() : []

      results = results.map((league) => {
        if (league.iLeagueId) {
          const aPromo = promoLeaguesData.filter((leagueId) => league.iLeagueId.toString() === leagueId.toString())
          return { ...league, nPromoCount: aPromo.length }
        }
        return { ...league }
      })

      const data = [{ total, results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmatchLeague), data })
    } catch (error) {
      return catchError('MatchLeague.list', error, req, res)
    }
  }

  // To Update MatchLeague (MatchLeague Category, Position)
  async updateLeague(req, res) {
    try {
      const { iLeagueCatId } = req.body
      const { _id: iAdminId } = req.admin
      req.body = pick(req.body, ['iLeagueCatId', 'nPosition'])

      // Fetch Match League and To Update league category contest, there should be proper league category.
      const [oldMatchLeague, leagueCategory] = await Promise.all([
        MatchLeagueModel.findById(req.params.id).lean(),
        LeagueCategoryModel.findById(iLeagueCatId, { sTitle: 1 }).lean()
      ])
      if (!oldMatchLeague) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cleague) })
      if (oldMatchLeague.nJoined > 0 || oldMatchLeague.eMatchStatus !== 'U') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].upcoming_join_err.replace('##', messages[req.userLanguage].cmatchLeague) })
      if (!leagueCategory && iLeagueCatId) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].leagueCategory) })
      if (leagueCategory) req.body.sLeagueCategory = leagueCategory.sTitle

      // Update MatchLeague with updated values of league category and position
      const updateMatchLeague = await MatchLeagueModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true }).lean()
      if (!updateMatchLeague) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })

      // Add log of this operation in Admin
      const logData = { oOldFields: oldMatchLeague, oNewFields: updateMatchLeague, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'ML' }
      adminLogQueue.publish(logData)
      // await adminServices.adminLog(req, res, logData)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cmatchLeague), updateMatchLeague })
    } catch (error) {
      return catchError('MatchLeague.Update', error, req, res)
    }
  }

  // To get Match league report (SportsType wise)
  async leagueReport(req, res) {
    try {
      const query = {
        iMatchId: ObjectId(req.params.id)
      }

      const results = await MatchLeagueModel.find(query, {
        nJoined: 1,
        iMatchId: 1,
        sLeagueName: 1,
        iUserId: 1,
        sName: 1,
        sShareLink: 1,
        sShareCode: 1,
        aLeaguePrize: 1,
        nMax: 1,
        nMin: 1,
        nPrice: 1,
        nTotalPayout: 1,
        nDeductPercent: 1,
        nBonusUtil: 1,
        sPayoutBreakupDesign: 1,
        bConfirmLeague: 1,
        bMultipleEntry: 1,
        bAutoCreate: 1,
        bCancelled: 1,
        bCopyLeague: 1,
        nLeaguePrice: 1,
        bPrizeDone: 1,
        bWinningDone: 1,
        bPrivateLeague: 1,
        sLeagueCat: 1,
        nLoyaltyPoint: 1,
        bCashbackEnabled: 1,
        nMinCashbackTeam: 1,
        nCashbackAmount: 1,
        eCashbackType: 1,
        sFairPlay: 1,
        bPoolPrize: 1,
        bUnlimitedJoin: 1,
        nPosition: 1,
        nMinTeamCount: 1,
        nBotsCount: 1,
        nCopyBotsPerTeam: 1,
        nSameCopyBotTeam: 1,
        bBotCreate: 1,
        nAdminCommission: 1,
        nCreatorCommission: 1,
        eCategory: 1,
        dCreatedAt: 1,
        nWinnersCount: 1
      }).lean()

      const aResult = []
      for (const d of results) {
        // actual user joined

        let query = { iMatchLeagueId: d._id, bCancelled: false, eType: 'U' }
        if (d.bCancelled) query = { iMatchLeagueId: d._id, eType: 'U' }

        const nJoinedRealUsers = await UserLeagueModel.countDocuments(query, { readPreference: 'primary' })
        // bot user joined = nJoined - actual user joined

        const aRealUserWinningCash = await PassbookModel.findAll({ attributes: [['eUserType', 'eType'], [fn('sum', col('nCash')), 'nCash']], group: 'eUserType', where: { eTransactionType: 'Win', iMatchLeagueId: d._id.toString() }, raw: true })
        const aRealUserWinningBonus = await PassbookModel.findAll({ attributes: [['eUserType', 'eType'], [fn('sum', col('nBonus')), 'nBonus']], group: 'eUserType', where: { eTransactionType: 'Win', iMatchLeagueId: d._id.toString() }, raw: true })

        const oRealUserWinningCash = aRealUserWinningCash.length ? aRealUserWinningCash.find(data => data.eType === 'U') : 0 // actual user winning cash provided
        const oBotWinningCash = aRealUserWinningCash.length ? aRealUserWinningCash.find(data => data.eType === 'B') : 0 // bot user winning cash provided
        const oRealUserWinningBonus = aRealUserWinningBonus.length ? aRealUserWinningBonus.find(data => data.eType === 'U') : 0 // actual user winning bonus provided
        const oBotWinningBonus = aRealUserWinningBonus.length ? aRealUserWinningBonus.find(data => data.eType === 'B') : 0 // bot user winning bonus provided

        let nTotalPromoDiscount = 0
        const PromoDiscount = await PromocodeStatisticsModel.findOne({ iMatchLeagueId: d._id }, { nAmount: 1 }).lean()
        if (PromoDiscount) {
          nTotalPromoDiscount = await PromocodeStatisticsModel.countDocuments({ iMatchLeagueId: d._id })
          nTotalPromoDiscount *= PromoDiscount.nAmount
        }
        // total collection = (actual + bot) user winning (cash + bonus) provided

        const nRealCashCollection = await PassbookModel.sum('nCash', { where: { iMatchLeagueId: d._id.toString(), eTransactionType: 'Play' } })
        const nTotalBonusUsed = await PassbookModel.sum('nBonus', { where: { iMatchLeagueId: d._id.toString(), eTransactionType: 'Play' } })

        const nBotUsersMoney = await PassbookModel.sum('nCash', { where: { iMatchLeagueId: d._id.toString(), eTransactionType: 'Play', eUserType: 'B' } })
        const nBotUsersBonus = await PassbookModel.sum('nBonus', { where: { iMatchLeagueId: d._id.toString(), eTransactionType: 'Play', eUserType: 'B' } })

        const nTotalCashbackBonus = await PassbookModel.sum('nCash', { where: { iMatchLeagueId: d._id.toString(), eTransactionType: 'Cashback-Contest' } })
        const nTotalCashbackCash = await PassbookModel.sum('nBonus', { where: { iMatchLeagueId: d._id.toString(), eTransactionType: 'Cashback-Contest' } })

        const nTotalTdsAmount = await UserTdsModel.sum('nAmount', { where: { iMatchLeagueId: d._id.toString() } })

        aResult.push({ ...d, nRealUserWinningCash: oRealUserWinningCash ? convertToDecimal(oRealUserWinningCash.nCash, 2) : 0, nBotWinningCash: oBotWinningCash ? convertToDecimal(oBotWinningCash.nCash, 2) : 0, nRealUserWinningBonus: oRealUserWinningBonus ? convertToDecimal(oRealUserWinningBonus.nBonus, 2) : 0, nBotWinningBonus: oBotWinningBonus ? convertToDecimal(oBotWinningBonus.nBonus, 2) : 0, nJoinedRealUsers, nTotalPromoDiscount: convertToDecimal(nTotalPromoDiscount, 2) || 0, nRealCashCollection: convertToDecimal(nRealCashCollection, 2) || 0, nBotUsersMoney: convertToDecimal(nBotUsersMoney, 2) || 0, nTotalBonusUsed: convertToDecimal(nTotalBonusUsed, 2) || 0, nTotalCashbackBonus: convertToDecimal(nTotalCashbackBonus, 2) || 0, nTotalCashbackCash: convertToDecimal(nTotalCashbackCash, 2) || 0, nTotalTdsAmount: convertToDecimal(nTotalTdsAmount, 2) || 0, nBotUsersBonus })
      }
      const data = [{ results: aResult }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmatchLeague), data })
    } catch (error) {
      return catchError('MatchLeague.list', error, req, res)
    }
  }

  // To get Match league report (SportsType wise)
  async leagueReportV2(req, res) {
    try {
      const query = {
        iMatchId: ObjectId(req.params.id)
      }

      const results = await MatchLeagueModel.find(query, {
        nJoined: 1,
        iMatchId: 1,
        sLeagueName: 1,
        iUserId: 1,
        sName: 1,
        sShareLink: 1,
        sShareCode: 1,
        aLeaguePrize: 1,
        nMax: 1,
        nMin: 1,
        nPrice: 1,
        nTotalPayout: 1,
        nDeductPercent: 1,
        nBonusUtil: 1,
        sPayoutBreakupDesign: 1,
        bConfirmLeague: 1,
        bMultipleEntry: 1,
        bAutoCreate: 1,
        bCancelled: 1,
        bCopyLeague: 1,
        nLeaguePrice: 1,
        bPrizeDone: 1,
        bWinningDone: 1,
        bPrivateLeague: 1,
        sLeagueCat: 1,
        nLoyaltyPoint: 1,
        bCashbackEnabled: 1,
        nMinCashbackTeam: 1,
        nCashbackAmount: 1,
        eCashbackType: 1,
        sFairPlay: 1,
        bPoolPrize: 1,
        bUnlimitedJoin: 1,
        nPosition: 1,
        nMinTeamCount: 1,
        nBotsCount: 1,
        nCopyBotsPerTeam: 1,
        nSameCopyBotTeam: 1,
        bBotCreate: 1,
        nAdminCommission: 1,
        nCreatorCommission: 1,
        eCategory: 1,
        dCreatedAt: 1,
        nWinnersCount: 1
      }).lean()

      const aResult = []
      for (const d of results) {
        let query = { iMatchLeagueId: d._id, bCancelled: false, eType: 'U' }
        if (d.bCancelled) query = { iMatchLeagueId: d._id, eType: 'U' }

        const [
          nJoinedRealUsers, aRealUserWinningCash, aRealUserWinningBonus,
          aRealCashCollection, aRealBonusUsed,
          nTotalCashbackCash, nTotalCashbackBonus,
          aTotalTdsAmount,
          aRealCashReturned, aRealBonusUsedReturned
        ] = await Promise.all([
          UserLeagueModel.countDocuments(query, { readPreference: 'primary' }), // bot user joined = nJoined - actual user joined
          PassbookModel.findAll({ attributes: [['eUserType', 'eType'], [fn('sum', col('nCash')), 'nCash']], group: 'eUserType', where: { eTransactionType: 'Win', iMatchLeagueId: d._id.toString() }, raw: true }),
          PassbookModel.findAll({ attributes: [['eUserType', 'eType'], [fn('sum', col('nBonus')), 'nBonus']], group: 'eUserType', where: { eTransactionType: 'Win', iMatchLeagueId: d._id.toString() }, raw: true }),

          PassbookModel.findAll({ attributes: [['eUserType', 'eType'], [fn('sum', col('nCash')), 'nCash']], group: 'eUserType', where: { eTransactionType: 'Play', iMatchLeagueId: d._id.toString() }, raw: true }),
          PassbookModel.findAll({ attributes: [['eUserType', 'eType'], [fn('sum', col('nBonus')), 'nBonus']], group: 'eUserType', where: { eTransactionType: 'Play', iMatchLeagueId: d._id.toString() }, raw: true }),

          PassbookModel.sum('nCash', { where: { iMatchLeagueId: d._id.toString(), eTransactionType: 'Cashback-Contest' } }),
          PassbookModel.sum('nBonus', { where: { iMatchLeagueId: d._id.toString(), eTransactionType: 'Cashback-Contest' } }),

          UserTdsModel.findAll({ attributes: [['eUserType', 'eType'], [fn('sum', col('nAmount')), 'nCash']], group: 'eUserType', where: { iMatchLeagueId: d._id.toString() }, raw: true }),

          PassbookModel.findAll({ attributes: [['eUserType', 'eType'], [fn('sum', col('nCash')), 'nCash']], group: 'eUserType', where: { eTransactionType: 'Play-Return', iMatchLeagueId: d._id.toString() }, raw: true }),
          PassbookModel.findAll({ attributes: [['eUserType', 'eType'], [fn('sum', col('nBonus')), 'nBonus']], group: 'eUserType', where: { eTransactionType: 'Play-Return', iMatchLeagueId: d._id.toString() }, raw: true })
        ])

        let nTotalPromoDiscount = 0
        const PromoDiscount = await PromocodeStatisticsModel.findOne({ iMatchLeagueId: d._id }, { nAmount: 1 }).lean()
        if (PromoDiscount) {
          nTotalPromoDiscount = await PromocodeStatisticsModel.countDocuments({ iMatchLeagueId: d._id })
          nTotalPromoDiscount *= PromoDiscount.nAmount
        }

        const oRealUserWinningCash = aRealUserWinningCash.length ? aRealUserWinningCash.find(data => data.eType === 'U') : 0 // actual user winning cash provided
        const oBotWinningCash = aRealUserWinningCash.length ? aRealUserWinningCash.find(data => data.eType === 'B') : 0 // bot user winning cash provided
        const oRealUserWinningBonus = aRealUserWinningBonus.length ? aRealUserWinningBonus.find(data => data.eType === 'U') : 0 // actual user winning bonus provided
        const oBotWinningBonus = aRealUserWinningBonus.length ? aRealUserWinningBonus.find(data => data.eType === 'B') : 0 // bot user winning bonus provided

        const oRealUserCashCollection = aRealCashCollection.length ? aRealCashCollection.find(data => data.eType === 'U') : 0 // actual user played cash collection
        const oBotCashCollection = aRealCashCollection.length ? aRealCashCollection.find(data => data.eType === 'B') : 0 // bot user played cash collection
        const oRealUserBonusUsed = aRealBonusUsed.length ? aRealBonusUsed.find(data => data.eType === 'U') : 0 // actual user played bonus collection
        const oBotBonusUsed = aRealBonusUsed.length ? aRealBonusUsed.find(data => data.eType === 'B') : 0 // bot user played bonus collection

        const oRealUserCashReturned = aRealCashReturned.length ? aRealCashReturned.find(data => data.eType === 'U') : 0 // actual user played returned cash
        const oBotCashReturned = aRealCashReturned.length ? aRealCashReturned.find(data => data.eType === 'B') : 0 // bot user played returned cash
        const oRealUserBonusUsedReturned = aRealBonusUsedReturned.length ? aRealBonusUsedReturned.find(data => data.eType === 'U') : 0 // actual user played returned bonus
        const oBotBonusUsedReturned = aRealBonusUsedReturned.length ? aRealBonusUsedReturned.find(data => data.eType === 'B') : 0 // bot user played returned bonus

        const oRealUserTDS = aTotalTdsAmount.length ? aTotalTdsAmount.find(data => data.eType === 'U') : 0 // actual user tds deduction
        const oBotTDS = aTotalTdsAmount.length ? aTotalTdsAmount.find(data => data.eType === 'B') : 0 // bot user tds deduction

        aResult.push({
          ...d,
          nJoinedRealUsers,
          nRealUserWinningCash: oRealUserWinningCash ? convertToDecimal(oRealUserWinningCash.nCash, 2) : 0,
          nBotWinningCash: oBotWinningCash ? convertToDecimal(oBotWinningCash.nCash, 2) : 0,
          nRealUserWinningBonus: oRealUserWinningBonus ? convertToDecimal(oRealUserWinningBonus.nBonus, 2) : 0,
          nBotWinningBonus: oBotWinningBonus ? convertToDecimal(oBotWinningBonus.nBonus, 2) : 0,
          nTotalPromoDiscount: convertToDecimal(nTotalPromoDiscount, 2) || 0,

          nRealUserCashCollection: oRealUserCashCollection ? convertToDecimal(oRealUserCashCollection.nCash, 2) : 0,
          nBotCashCollection: oBotCashCollection ? convertToDecimal(oBotCashCollection.nCash, 2) : 0,
          nRealUserBonusUsed: oRealUserBonusUsed ? convertToDecimal(oRealUserBonusUsed.nBonus, 2) : 0,
          nBotBonusUsed: oBotBonusUsed ? convertToDecimal(oBotBonusUsed.nBonus, 2) : 0,

          nRealUserCashReturned: oRealUserCashReturned ? convertToDecimal(oRealUserCashReturned.nCash, 2) : 0,
          nBotCashReturned: oBotCashReturned ? convertToDecimal(oBotCashReturned.nCash, 2) : 0,
          nRealUserBonusUsedReturned: oRealUserBonusUsedReturned ? convertToDecimal(oRealUserBonusUsedReturned.nBonus, 2) : 0,
          nBotBonusUsedReturned: oBotBonusUsedReturned ? convertToDecimal(oBotBonusUsedReturned.nBonus, 2) : 0,

          nTotalCashbackBonus: convertToDecimal(nTotalCashbackBonus, 2) || 0,
          nTotalCashbackCash: convertToDecimal(nTotalCashbackCash, 2) || 0,

          nRealUserTDS: oRealUserTDS ? convertToDecimal(oRealUserTDS.nCash, 2) : 0,
          nBotTDS: oBotTDS ? convertToDecimal(oBotTDS.nCash, 2) : 0
        })
      }
      const data = [{ results: aResult }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmatchLeague), data })
    } catch (error) {
      return catchError('MatchLeague.listV2', error, req, res)
    }
  }

  // Get contest list for match
  async upComingLeagueListV2(req, res) {
    try {
      // Fetch Internal User
      const oUser = INTERNAL_USERS.includes(req.user._id.toString())
      const query = {
        iMatchId: ObjectId(req.params.id),
        bPrivateLeague: false,
        bCancelled: false,
        bPlayReturnProcess: false,
        bPrizeDone: false,
        $or: [
          { $expr: { $lt: ['$nJoined', '$nMax'] } },
          { bUnlimitedJoin: true }
        ]
      }

      const hiddenLeague = await LeagueCategoryModel.findOne({ sKey: 'hiddenLeague' }, { _id: 1 }).lean().cache(CACHE_1, 'hiddenLeague')
      if (hiddenLeague && !oUser) query.iLeagueCatId = { $ne: ObjectId(hiddenLeague._id) }

      const data = await MatchLeagueModel.find(query,
        { nAutoFillSpots: 0, bPlayReturnProcess: 0, sShareCode: 0, iUserId: 0, sLeagueCategory: 0, iFilterCatId: 0, nBotsCount: 0, nCopyBotsPerTeam: 0, nSameCopyBotTeam: 0, bBotCreate: 0, bCopyBotInit: 0 }).populate('oLeagueCategory').lean()

      const matchLeagueData = data.map(l => ({ ...l, oLeagueCategory: l.oLeagueCategory[0] }))

      const updatedData = getUpdatedPrizeBreakupData(matchLeagueData)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cupcomingLeague), data: updatedData })
    } catch (error) {
      return catchError('MatchLeague.upComingLeagueListV2', error, req, res)
    }
  }

  // To get details of matchLeague
  async leagueInfo(req, res) {
    try {
      const oUser = await UserModel.findById(req.user._id, { bIsInternalAccount: 1 }).lean()
      let data = await MatchLeagueModel.findById(req.params.id, { bPlayReturnProcess: 0, sLeagueCategory: 0, iFilterCatId: 0, bBotCreate: 0, nAutoFillSpots: 0, bCopyBotInit: 0, nCopyBotsPerTeam: 0, nSameCopyBotTeam: 0 }).populate('oLeagueCategory').lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })
      const hiddenLeague = await LeagueCategoryModel.findOne({ sKey: 'hiddenLeague' }, { _id: 1 }).lean().cache(CACHE_1, 'hiddenLeague')
      const hiddenLeagueId = (hiddenLeague && !oUser?.bIsInternalAccount) ? hiddenLeague._id.toString() : ''
      if (data.iLeagueCatId && data.iLeagueCatId.toString() === hiddenLeagueId) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })

      data = { ...data, oLeagueCategory: data.oLeagueCategory[0] }
      const [updatedData] = getUpdatedPrizeBreakupData([data])

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmatchLeague), data: updatedData })
    } catch (error) {
      catchError('MatchLeague.leagueInfo', error, req, res)
    }
  }

  // cancel contest
  async cancelMatchLeague(req, res) {
    try {
      const { _id: iAdminId } = req.admin

      const league = await MatchLeagueModel.findById({ _id: req.params.id })
      if (!league) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })

      if (league.bCancelled === true) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].league_already_cancel.replace('##', messages[req.userLanguage].cmatchLeague) })
      if (league.bPrizeDone === true) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].league_prize_done.replace(messages[req.userLanguage].cmatchLeague) })

      league.bPlayReturnProcess = true

      const matchLeague = await league.save()

      const type = 'MATCHLEAGUE'
      // await queuePush('ProcessPlayReturn', { matchLeague, type, iAdminId: ObjectId(iAdminId), sIP: getIp(req), sOperationBy: 'ADMIN' })
      this.processPlayReturn(matchLeague, type, ObjectId(iAdminId), getIp(req), 'ADMIN')

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].cancel_success.replace('##', messages[req.userLanguage].cmatchLeague) })
    } catch (error) {
      catchError('MatchLeague.cancelMatchLeague', error, req, res)
    }
  }

  async processPlayReturn(matchLeague, type, iAdminId = null, sIP = '', sOperationBy = 'CRON', nJoined, uniqueUserJoinCount) {
    try {
      let userLeagues = []

      const ulProjection = { iUserId: 1, sMatchName: 1, eType: 1, sUserName: 1 }
      if (type === 'MATCHLEAGUE' || type === 'MANUALLY') {
        userLeagues = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(matchLeague._id) }, ulProjection).lean()
      } else if (type === 'OVERFLOW') {
        userLeagues = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(matchLeague._id) }, ulProjection).sort({ dCreatedAt: -1 }).limit(Number(matchLeague.nJoined - matchLeague.nMax)).lean()
      }

      let bBonusUtil = false
      const nBonusUtil = Number(matchLeague.nBonusUtil)
      const nPrice = Number(matchLeague.nPrice)
      if (nBonusUtil && nBonusUtil > 0 && nPrice > 0) bBonusUtil = true
      const result = await userBalanceServices.userPlayReturn({ bBonusUtil, nActualBonus: 0, nPrice, eCategory: matchLeague.eCategory, userLeagues, iMatchLeagueId: matchLeague._id.toString(), iMatchId: matchLeague.iMatchId.toString() })
      if (result.isSuccess) {
        try {
          if (type === 'MATCHLEAGUE' || type === 'MANUALLY') {
            const logData = {
              oOldFields: { _id: matchLeague._id, sName: matchLeague.sName, iMatchId: matchLeague.iMatchId, bCancelled: false },
              oNewFields: { _id: matchLeague._id, sName: matchLeague.sName, iMatchId: matchLeague.iMatchId, bCancelled: true },
              oDetails: { sOperationBy, nJoined, uniqueUserJoinCount },
              sIP: sIP,
              iAdminId: iAdminId,
              iUserId: null,
              eKey: 'ML'
            }
            const userLeagueIds = userLeagues.map(({ _id }) => _id)
            const hiddenLeague = await LeagueCategoryModel.findOne({ sKey: 'hiddenLeague' }, { _id: 1 }).lean().cache(CACHE_6, 'hiddenLeague')

            const oMatch = await MatchModel.findOne({ _id: ObjectId(matchLeague.iMatchId) }, { isMegaContest: 1, nPrice: 1, eCategory: 1 }).lean()

            // Change MegaContest Amount Limit based on SPORT
            const nMegaAmountLimit = (oMatch.eCategory === 'CRICKET') ? MEGA_CONTEST_AMOUNT_LIMIT_CRICKET : MEGA_CONTEST_AMOUNT_LIMIT_FOOTBALL

            const [oMegaLeague] = await Promise.all([
              MatchLeagueModel.findOne({ _id: { $ne: ObjectId(matchLeague._id) }, iMatchId: ObjectId(matchLeague.iMatchId), iLeagueCatId: { $ne: ObjectId(hiddenLeague._id) }, nTotalPayout: { $gte: nMegaAmountLimit }, bCancelled: false, bPrivateLeague: false }, { nTotalPayout: 1 }).sort({ nTotalPayout: -1 }).lean(),
              MyMatchesModel.updateMany({ iMatchId: ObjectId(matchLeague.iMatchId), aMatchLeagueId: { $in: [ObjectId(matchLeague._id)] } }, { $pull: { aMatchLeagueId: ObjectId(matchLeague._id) }, $inc: { nJoinedLeague: -1 }, $push: { aCMatchLeagueId: ObjectId(matchLeague._id) } }),
              adminLogQueue.publish(logData),
              UserLeagueModel.updateMany({ _id: { $in: userLeagueIds } }, { bCancelled: true })
            ])
            const updateMatchObject = {}

            if (oMatch && oMegaLeague) {
              updateMatchObject.nPrice = oMegaLeague.nTotalPayout
            } else {
              updateMatchObject.nPrice = 0
              updateMatchObject.isMegaContest = false
            }
            await Promise.all([
              MatchLeagueModel.updateOne({ _id: ObjectId(matchLeague._id) }, { bCancelled: true, nJoined: userLeagues.length }),
              MatchModel.updateOne({ _id: ObjectId(matchLeague.iMatchId) }, updateMatchObject)
            ])
          } else if (type === 'OVERFLOW') {
            const aUserIds = userLeagues.map(({ iUserId }) => ObjectId(iUserId))
            const userLeagueIds = userLeagues.map(({ _id }) => _id)
            await Promise.all([
              MyMatchesModel.updateMany({ iMatchId: ObjectId(matchLeague.iMatchId), aMatchLeagueId: { $in: [ObjectId(matchLeague._id)] }, iUserId: { $in: aUserIds } }, { $pull: { aMatchLeagueId: ObjectId(matchLeague._id) }, $inc: { nJoinedLeague: -1 }, $push: { aCMatchLeagueId: ObjectId(matchLeague._id) } }),
              UserLeagueModel.updateMany({ _id: { $in: userLeagueIds } }, { bCancelled: true })
            ])

            await MatchLeagueModel.updateOne({ _id: ObjectId(matchLeague._id) }, { $inc: { nJoined: -(userLeagues.length) } })
          }

          const { bCashbackEnabled, bIsProcessed, nMinCashbackTeam } = matchLeague

          if (bCashbackEnabled && bIsProcessed && nMinCashbackTeam) {
            const userLeague = userLeagues.map(({ _id }) => { return { _id } })
            const { _id, iMatchId, nMinCashbackTeam: nMinTeam, nCashbackAmount, eCashbackType, eCategory } = matchLeague
            await queuePush('ProcessUsersCashbackReturn', { _id, iMatchId, nMinTeam, nCashbackAmount, eCashbackType, eCategory, userLeague })
          }
        } catch (error) {
          // await session.abortTransaction()
          handleCatchError(error)
          return { isSuccess: false }
        } finally {
          // session.endSession()
        }
      }
      return { isSuccess: true }
    } catch (error) {
      handleCatchError(error)
      return { isSuccess: false }
    }
  }

  async processCashback(data) {
    try {
      const transactionOptions = {
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' }
      }
      const session = await GamesDBConnect.startSession()
      session.startTransaction(transactionOptions)

      try {
        const { _id, iMatchId, nMinTeam, nCashbackAmount, eCashbackType, eCategory } = data
        const nAmount = parseFloat(nCashbackAmount)
        const userLeagues = await UserLeagueModel.aggregate([
          {
            $match: {
              iMatchLeagueId: ObjectId(_id)
            }
          }, {
            $addFields: {
              eType: { $cond: [{ $eq: ['$eType', 'U'] }, 'U', 'B'] }
            }
          }, {
            $group: {
              _id: '$iUserId',
              count: { $sum: 1 },
              sUserName: { $first: '$sUserName' },
              sLeagueName: { $first: '$sLeagueName' },
              eType: { $first: '$eType' }
            }
          }, {
            $match: {
              count: { $gte: nMinTeam }
            }
          }
        ]).exec()

        if (userLeagues.length) {
          const result = await userBalanceServices.userContestCashback({ nAmount, eCashbackType, nTeams: nMinTeam, userLeagues, iMatchId, iMatchLeagueId: _id, eCategory })
          if (result.isSuccess) {
            for (const ul of userLeagues) {
              const { _id: iUserId, count } = ul
              const isExist = await MyMatchesModel.findOne({ iMatchId, iUserId, aMatchLeagueCashback: { $elemMatch: { iMatchLeagueId: _id } } }).session(session).lean()
              if (!isExist) {
                const match = await MatchModel.findById(iMatchId).select({ dStartDate: 1 }).lean()
                const updateMyMatch = {
                  iMatchLeagueId: _id,
                  nAmount,
                  eType: eCashbackType,
                  nTeams: count
                }
                await MyMatchesModel.updateOne({ iMatchId, iUserId }, { $addToSet: { aMatchLeagueCashback: updateMyMatch }, $set: { dStartDate: match.dStartDate } }, { upsert: true }).session(session)
              }
            }
            await MatchLeagueModel.updateOne({ _id: ObjectId(_id) }, { bIsProcessed: true }).session(session)
          } else {
            await session.abortTransaction()
            return { isSuccess: false }
          }
        }

        await session.commitTransaction()
        return { isSuccess: true }
      } catch (error) {
        await session.abortTransaction()
        handleCatchError(error)
        return { isSuccess: false }
      } finally {
        session.endSession()
      }
    } catch (error) {
      handleCatchError(error)
      return { isSuccess: false }
    }
  }

  async botCreateUpdate(req, res) {
    try {
      const { bBotCreate } = req.body
      const data = await MatchLeagueModel.findByIdAndUpdate(req.params.id, { bBotCreate, dUpdatedAt: Date.now() }, { runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })

      const oNewFields = { ...data, bBotCreate, dUpdatedAt: Date.now() }
      const logData = { oOldFields: data, oNewFields, eKey: 'ML', iAdminId: req.admin._id, sIp: getIp(req) }
      adminLogQueue.publish(logData);

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cmatchLeague), data: oNewFields })
    } catch (error) {
      catchError('MatchLeague.botCreateUpdate', error, req, res)
    }
  }

  async getProcessedCount(req, res) {
    try {
      const processedBotData = await BotLogModel.aggregate([
        {
          $match: {
            iMatchLeagueId: ObjectId(req.params.id)
          }
        }, {
          $group: {
            _id: '$iMatchLeagueId',
            count: { $sum: '$nTeams' }
          }
        }
      ])

      const submittedNBot = (processedBotData.length) ? processedBotData[0].count : 0
      const data = await UserLeagueModel.aggregate([
        {
          $match: {
            iMatchLeagueId: ObjectId(req.params.id)
          }
        }, {
          $group: {
            _id: '$eType',
            count: { $sum: 1 },
            sType: { $first: '$eType' }
          }
        }
      ])

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmatchLeague), data: { botCount: data, submittedNBot } })
    } catch (error) {
      catchError('MatchLeague.getProcessedCount', error, req, res)
    }
  }

  /**
   * To get promocode usage details matchLeague wise
   * @return { total { number }, results { array } }
   */
  async getPromoUsage(req, res) {
    const { start, limit, sorting, search } = getPaginationValues2(req.query)

    let query = { iPromocodeId: { $ne: null }, iMatchLeagueId: req.params.id }
    if (search) {
      query = {
        ...query,
        sUserName: { $regex: new RegExp('^.*' + search + '.*', 'i') }
      }
    }
    const [total, userLeagues] = await Promise.all([UserLeagueModel.countDocuments(query),
      UserLeagueModel.find(query, { sUserName: 1, iPromocodeId: 1, dCreatedAt: 1, sTeamName: 1, nPromoDiscount: 1, iUserId: 1, eType: 1 }).sort(sorting).skip(Number(start)).limit(Number(limit)).populate({ path: 'iPromocodeId', select: 'sCode sName' }).lean()])

    return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmatchLeague), data: [{ total, results: userLeagues }] })
  }

  /**
   * It calculates the match league reports fields like nActualCashWinning and sends excel sheet in mail to the Client email
   * @param  {*} req
   * @param  {*} res
   */
  async leaguesReport(req, res) {
    try {
      const { dDateTo, dDateFrom, eCategory } = req.query
      if (!dDateFrom || !dDateTo) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].select_date_err })

      const matchQuery = {
        dStartDate: { $gte: (dDateFrom), $lte: (dDateTo) },
        eStatus: 'CMP',
        eCategory
      }

      const aMatch = await MatchModel.find(matchQuery, { _id: 1 }).lean()
      const aMatchIds = aMatch.map(ids => ids._id)

      const matchLeagueQuery = { iMatchId: { $in: aMatchIds }, eMatchStatus: 'CMP' }
      const aMatchLeague = await MatchLeagueModel.find(matchLeagueQuery, {
        nJoined: 1,
        sName: 1,
        nMax: 1,
        nMin: 1,
        nPrice: 1,
        nTotalPayout: 1,
        iMatchId: 1,
        bCancelled: 1,
        bPrivateLeague: 1,
        bPoolPrize: 1,
        nCreatorCommission: 1,
        nWinnersCount: 1,
        dCreatedAt: 1
      }).populate('oMatch', ['sName', 'sKey', 'dStartDate']).sort({ iMatchId: 1 }).lean()
      const aResult = []

      // All the below variables are used to have count or collection of the whole report of all leagues
      let count = 0
      let matchId
      let nMatchCount = 0
      let nLeaguesCancelledCount = 0
      let nLeaguesPlayedCount = 0
      let nRealUsersPlayed = 0
      let nBotUsersPlayed = 0
      let nTotalUsersPlayed = 0
      let nActualEntryFeeCollected = 0
      let nTotalActualCashCollected = 0
      let nTotalBonusCollected = 0
      let nTotalPromoCodeAmountCollected = 0
      let nTotalBotAmountCollected = 0
      let nTotalBotBonusCollected = 0
      let nTotalCollectionCollected = 0
      let nTotalUserCashWinningCollected = 0
      let nTotalUserBonusWinningCollected = 0
      let nTotalBotCashWinningCollected = 0
      let nTotalBotBonusWinningCollected = 0
      let nTotalWinnersCount = 0
      let nTotalWinningOfLeaguesProvided = 0
      let nTotalLeagueGrossMarginProvided = 0
      let nTotalLeagueGrossMarginPercentProvided = 0
      let nTotalCashbackGiven = 0
      let nTotalCashbackBonusGiven = 0
      let nTotalCreatorBonusGiven = 0
      let nTotalLeagueNetMarginCalculated = 0
      let nTotalLeagueNetMarginPercentCalculated = 0
      let nTotalTDSDeducted = 0
      const oTotal = {}

      for (const d of aMatchLeague) {
        let query = { iMatchLeagueId: d._id, bCancelled: false, eType: 'U' }
        if (d.bCancelled) query = { iMatchLeagueId: d._id, eType: 'U' }
        const [
          nJoinedRealUsers, aRealUserWinningCash, aRealUserWinningBonus,
          aRealCashCollection, aRealBonusUsed,
          nTotalCashbackCash, nTotalCashbackBonus,
          aTotalTdsAmount,
          aRealCashReturned, aRealBonusUsedReturned
        ] = await Promise.all([
          UserLeagueModel.countDocuments(query, { readPreference: 'primary' }), // bot user joined = nJoined - actual user joined
          PassbookModel.findAll({ attributes: [['eUserType', 'eType'], [fn('sum', col('nCash')), 'nCash']], group: 'eUserType', where: { eTransactionType: 'Win', iMatchLeagueId: d._id.toString() }, raw: true }),
          PassbookModel.findAll({ attributes: [['eUserType', 'eType'], [fn('sum', col('nBonus')), 'nBonus']], group: 'eUserType', where: { eTransactionType: 'Win', iMatchLeagueId: d._id.toString() }, raw: true }),

          PassbookModel.findAll({ attributes: [['eUserType', 'eType'], [fn('sum', col('nCash')), 'nCash']], group: 'eUserType', where: { eTransactionType: 'Play', iMatchLeagueId: d._id.toString() }, raw: true }),
          PassbookModel.findAll({ attributes: [['eUserType', 'eType'], [fn('sum', col('nBonus')), 'nBonus']], group: 'eUserType', where: { eTransactionType: 'Play', iMatchLeagueId: d._id.toString() }, raw: true }),

          PassbookModel.sum('nCash', { where: { iMatchLeagueId: d._id.toString(), eTransactionType: 'Cashback-Contest' } }),
          PassbookModel.sum('nBonus', { where: { iMatchLeagueId: d._id.toString(), eTransactionType: 'Cashback-Contest' } }),

          UserTdsModel.findAll({ attributes: [['eUserType', 'eType'], [fn('sum', col('nAmount')), 'nCash']], group: 'eUserType', where: { iMatchLeagueId: d._id.toString() }, raw: true }),

          PassbookModel.findAll({ attributes: [['eUserType', 'eType'], [fn('sum', col('nCash')), 'nCash']], group: 'eUserType', where: { eTransactionType: 'Play-Return', iMatchLeagueId: d._id.toString() }, raw: true }),
          PassbookModel.findAll({ attributes: [['eUserType', 'eType'], [fn('sum', col('nBonus')), 'nBonus']], group: 'eUserType', where: { eTransactionType: 'Play-Return', iMatchLeagueId: d._id.toString() }, raw: true })
        ])

        let nTotalPromoDiscount = 0
        const PromoDiscount = await PromocodeStatisticsModel.findOne({ iMatchLeagueId: d._id }, { nAmount: 1 }).lean()
        if (PromoDiscount) {
          nTotalPromoDiscount = await PromocodeStatisticsModel.countDocuments({ iMatchLeagueId: d._id })
          nTotalPromoDiscount *= PromoDiscount.nAmount
        }

        const oRealUserWinningCash = aRealUserWinningCash.length ? aRealUserWinningCash.find(data => data.eType === 'U') : 0 // actual user winning cash provided
        const oBotWinningCash = aRealUserWinningCash.length ? aRealUserWinningCash.find(data => data.eType === 'B') : 0 // bot user winning cash provided
        const oRealUserWinningBonus = aRealUserWinningBonus.length ? aRealUserWinningBonus.find(data => data.eType === 'U') : 0 // actual user winning bonus provided
        const oBotWinningBonus = aRealUserWinningBonus.length ? aRealUserWinningBonus.find(data => data.eType === 'B') : 0 // bot user winning bonus provided

        const oRealUserCashCollection = aRealCashCollection.length ? aRealCashCollection.find(data => data.eType === 'U') : 0 // actual user played cash collection
        const oBotCashCollection = aRealCashCollection.length ? aRealCashCollection.find(data => data.eType === 'B') : 0 // bot user played cash collection
        const oRealUserBonusUsed = aRealBonusUsed.length ? aRealBonusUsed.find(data => data.eType === 'U') : 0 // actual user played bonus collection
        const oBotBonusUsed = aRealBonusUsed.length ? aRealBonusUsed.find(data => data.eType === 'B') : 0 // bot user played bonus collection

        const oRealUserCashReturned = aRealCashReturned.length ? aRealCashReturned.find(data => data.eType === 'U') : 0 // actual user played returned cash
        const oBotCashReturned = aRealCashReturned.length ? aRealCashReturned.find(data => data.eType === 'B') : 0 // bot user played returned cash
        const oRealUserBonusUsedReturned = aRealBonusUsedReturned.length ? aRealBonusUsedReturned.find(data => data.eType === 'U') : 0 // actual user played returned bonus
        const oBotBonusUsedReturned = aRealBonusUsedReturned.length ? aRealBonusUsedReturned.find(data => data.eType === 'B') : 0 // bot user played returned bonus

        const oRealUserTDS = aTotalTdsAmount.length ? aTotalTdsAmount.find(data => data.eType === 'U') : 0 // actual user tds deduction
        const oBotTDS = aTotalTdsAmount.length ? aTotalTdsAmount.find(data => data.eType === 'B') : 0 // bot user tds deduction

        const sTotalSpot = d.nMin && d.nMax ? `${d.nMin}-${d.nMax}` : ''
        const nJoinedBotUsers = ((d.nJoined ? d.nJoined : 0) - (nJoinedRealUsers || 0)) || 0
        const nTotalUsers = (nJoinedRealUsers + nJoinedBotUsers) || 0
        const nTotalCollection = convertToDecimal(d.nPrice * d.nJoined) || 0
        const nBonusAmount = ((oRealUserBonusUsed ? convertToDecimal(oRealUserBonusUsed.nBonus, 2) : 0) + (oBotBonusUsed ? convertToDecimal(oBotBonusUsed.nBonus, 2) : 0)) || 0
        // const nActualCashCollection = nTotalCollection - (nBonusAmount + (convertToDecimal(nTotalPromoDiscount, 2) || 0) + (oBotCashCollection && oBotCashCollection.nCash ? convertToDecimal(oBotCashCollection.nCash, 2) : 0) + (oBotBonusUsed && oBotBonusUsed.nBonus ? convertToDecimal(oBotBonusUsed.nBonus, 2) : 0))
        const nActualCashCollection = oRealUserCashCollection && oRealUserCashCollection.nCash ? convertToDecimal(oRealUserCashCollection.nCash, 2) : 0
        const nTotalWinningProvided = ((oRealUserWinningCash && oRealUserWinningCash.nCash ? convertToDecimal(oRealUserWinningCash.nCash, 2) : 0) + (oBotWinningCash && oBotWinningCash.nCash ? convertToDecimal(oBotWinningCash.nCash, 2) : 0) + (oRealUserWinningBonus && oRealUserWinningBonus.nBonus ? convertToDecimal(oRealUserWinningBonus.nBonus, 2) : 0) + (oBotWinningBonus && oBotWinningBonus.nBonus ? convertToDecimal(oBotWinningBonus.nBonus, 2) : 0)) || 0
        const nRealUserWinningCash = (nTotalWinningProvided - ((oBotWinningCash && oBotWinningCash.nCash ? convertToDecimal(oBotWinningCash.nCash, 2) : 0) + (oRealUserWinningBonus && oRealUserWinningBonus.nBonus ? convertToDecimal(oRealUserWinningBonus.nBonus, 2) : 0) + (oBotWinningBonus && oBotWinningBonus.nBonus ? convertToDecimal(oBotWinningBonus.nBonus, 2) : 0)) - ((oRealUserTDS && oRealUserTDS.nCash ? convertToDecimal(oRealUserTDS.nCash, 2) : 0) + (oBotTDS && oBotTDS.nCash ? convertToDecimal(oBotTDS.nCash, 2) : 0))) || 0
        const nTotalTDS = ((oRealUserTDS && oRealUserTDS.nCash ? convertToDecimal(oRealUserTDS.nCash, 2) : 0) + (oBotTDS && oBotTDS.nCash ? convertToDecimal(oBotTDS.nCash, 2) : 0)) || 0
        const nBotUserWinning = (oBotWinningCash && oBotWinningCash.nCash ? convertToDecimal(oBotWinningCash.nCash, 2) : 0) + (oBotWinningBonus && oBotWinningBonus.nBonus ? convertToDecimal(oBotWinningBonus.nBonus, 2) : 0)
        const nLeagueGrossMargin = convertToDecimal(nActualCashCollection - nRealUserWinningCash) || 0
        const nLeagueMarginGrossPercent = nLeagueGrossMargin ? ((nLeagueGrossMargin / nActualCashCollection) * 100) : 0
        const nLeagueNetMargin = nLeagueGrossMargin ? convertToDecimal(nLeagueGrossMargin - (nTotalCashbackCash + nTotalCashbackBonus + (!isNaN(d.nCreatorCommission)))) : 0
        const nLeagueNetMarginPercent = nLeagueNetMargin ? convertToDecimal((nLeagueNetMargin / nActualCashCollection) * 100) : 0

        if ((matchId ? matchId.toString() : matchId) !== d.iMatchId.toString()) {
          count = 0
          nMatchCount = ++nMatchCount
        }
        if (['true', true].includes(d.bCancelled)) {
          nLeaguesCancelledCount = ++nLeaguesCancelledCount
        } else {
          nLeaguesPlayedCount = ++nLeaguesPlayedCount
          nRealUsersPlayed += nJoinedRealUsers || 0
          nBotUsersPlayed += nJoinedBotUsers || 0
          nTotalUsersPlayed = nRealUsersPlayed + nBotUsersPlayed

          nActualEntryFeeCollected += d.nPrice ? convertToDecimal(d.nPrice) : 0
          nActualEntryFeeCollected = convertToDecimal(nActualEntryFeeCollected)

          nTotalActualCashCollected += nActualCashCollection ? convertToDecimal(nActualCashCollection) : 0
          nTotalActualCashCollected = nTotalActualCashCollected ? convertToDecimal(nTotalActualCashCollected) : 0

          nTotalBonusCollected += nBonusAmount
          nTotalBonusCollected = nTotalBonusCollected ? convertToDecimal(nTotalBonusCollected) : 0

          nTotalPromoCodeAmountCollected += (convertToDecimal(nTotalPromoDiscount)) || 0
          nTotalPromoCodeAmountCollected = nTotalPromoCodeAmountCollected ? convertToDecimal(nTotalPromoCodeAmountCollected) : 0

          nTotalBotAmountCollected += oBotCashCollection && oBotCashCollection.nCash ? (convertToDecimal(oBotCashCollection.nCash, 2) || 0) : 0
          nTotalBotAmountCollected = nTotalBotAmountCollected ? convertToDecimal(nTotalBotAmountCollected) : 0

          nTotalBotBonusCollected += oBotBonusUsed && oBotBonusUsed.nBonus ? convertToDecimal(oBotBonusUsed.nBonus, 2) : 0
          nTotalBotBonusCollected = nTotalBotBonusCollected ? convertToDecimal(nTotalBotBonusCollected) : 0

          nTotalCollectionCollected += nTotalCollection ? convertToDecimal(nTotalCollection) : 0
          nTotalCollectionCollected = nTotalCollectionCollected ? convertToDecimal(nTotalCollectionCollected) : 0

          nTotalUserCashWinningCollected += nRealUserWinningCash ? convertToDecimal(nRealUserWinningCash) : 0
          nTotalUserCashWinningCollected = nTotalUserCashWinningCollected ? convertToDecimal(nTotalUserCashWinningCollected) : 0

          nTotalUserBonusWinningCollected += oRealUserWinningBonus ? convertToDecimal(oRealUserWinningBonus.nBonus, 2) : 0
          nTotalUserBonusWinningCollected = nTotalUserBonusWinningCollected ? convertToDecimal(nTotalUserBonusWinningCollected) : 0

          nTotalBotCashWinningCollected += nBotUserWinning ? convertToDecimal(nBotUserWinning) : 0
          nTotalBotCashWinningCollected = nTotalBotCashWinningCollected ? convertToDecimal(nTotalBotCashWinningCollected) : 0

          nTotalBotBonusWinningCollected += oBotWinningBonus && oBotWinningBonus.nBonus ? convertToDecimal(oBotWinningBonus.nBonus, 2) : 0
          nTotalBotBonusWinningCollected = nTotalBotBonusWinningCollected ? convertToDecimal(nTotalBotBonusWinningCollected) : 0

          nTotalWinnersCount += d.nWinnersCount ? d.nWinnersCount : 0

          nTotalWinningOfLeaguesProvided += nTotalWinningProvided ? convertToDecimal(nTotalWinningProvided) : 0
          nTotalWinningOfLeaguesProvided = nTotalWinningOfLeaguesProvided ? convertToDecimal(nTotalWinningOfLeaguesProvided) : 0

          nTotalLeagueGrossMarginProvided += nLeagueGrossMargin ? convertToDecimal(nLeagueGrossMargin) : 0
          nTotalLeagueGrossMarginProvided = nTotalLeagueGrossMarginProvided ? convertToDecimal(nTotalLeagueGrossMarginProvided) : 0

          nTotalLeagueGrossMarginPercentProvided += nLeagueMarginGrossPercent ? convertToDecimal(nLeagueMarginGrossPercent, 2) : 0
          nTotalLeagueGrossMarginPercentProvided = nTotalLeagueGrossMarginPercentProvided ? convertToDecimal(nTotalLeagueGrossMarginPercentProvided) : 0

          nTotalCashbackGiven += nTotalCashbackCash ? convertToDecimal(nTotalCashbackCash, 2) : 0
          nTotalCashbackGiven = nTotalCashbackGiven ? convertToDecimal(nTotalCashbackGiven)

            : nTotalCashbackBonusGiven += nTotalCashbackBonus ? convertToDecimal(nTotalCashbackBonus, 2) : 0
          nTotalCashbackBonusGiven = nTotalCashbackBonusGiven ? convertToDecimal(nTotalCashbackBonusGiven) : 0

          nTotalLeagueNetMarginCalculated += nLeagueNetMargin ? convertToDecimal(nLeagueNetMargin) : 0
          nTotalLeagueNetMarginCalculated = nTotalLeagueNetMarginCalculated ? convertToDecimal(nTotalLeagueNetMarginCalculated) : 0

          nTotalLeagueNetMarginPercentCalculated += nLeagueNetMarginPercent ? convertToDecimal(nLeagueMarginGrossPercent) : 0
          nTotalLeagueNetMarginPercentCalculated = nTotalLeagueNetMarginPercentCalculated ? convertToDecimal(nTotalLeagueNetMarginPercentCalculated) : 0

          nTotalCreatorBonusGiven += d.nCreatorCommission ? convertToDecimal(d.nCreatorCommission) : 0
          nTotalCreatorBonusGiven = nTotalCreatorBonusGiven ? convertToDecimal(nTotalCreatorBonusGiven) : 0

          nTotalTDSDeducted += nTotalTDS ? convertToDecimal(nTotalTDS) : 0
          nTotalTDSDeducted = nTotalTDSDeducted ? convertToDecimal(nTotalTDSDeducted) : 0
        }

        aResult.push({

          nSr_no: ++count,
          ...d,
          nJoinedRealUsers,
          // nRealUserWinningCash: oRealUserWinningCash ? convertToDecimal(oRealUserWinningCash.nCash, 2) : 0,
          nBotWinningCash: oBotWinningCash ? convertToDecimal(oBotWinningCash.nCash, 2) : 0,
          nRealUserWinningBonus: oRealUserWinningBonus ? convertToDecimal(oRealUserWinningBonus.nBonus, 2) : 0,
          nBotWinningBonus: oBotWinningBonus ? convertToDecimal(oBotWinningBonus.nBonus, 2) : 0,
          nTotalPromoDiscount: convertToDecimal(nTotalPromoDiscount, 2) || 0,
          bCancelled: ['true', true].includes(d.bCancelled) ? 'Yes' : 'No',
          bPrivateLeague: ['true', true].includes(d.bPrivateLeague) ? 'Private' : 'Public',
          bPoolPrize: ['true', true].includes(d.bPoolPrize) ? 'Yes' : 'No',

          nRealUserCashCollection: oRealUserCashCollection ? convertToDecimal(oRealUserCashCollection.nCash, 2) : 0,
          nBotCashCollection: oBotCashCollection ? convertToDecimal(oBotCashCollection.nCash, 2) : 0,
          nRealUserBonusUsed: oRealUserBonusUsed ? convertToDecimal(oRealUserBonusUsed.nBonus, 2) : 0,
          nBotBonusUsed: oBotBonusUsed ? convertToDecimal(oBotBonusUsed.nBonus, 2) : 0,

          nRealUserCashReturned: oRealUserCashReturned ? convertToDecimal(oRealUserCashReturned.nCash, 2) : 0,
          nBotCashReturned: oBotCashReturned ? convertToDecimal(oBotCashReturned.nCash, 2) : 0,
          nRealUserBonusUsedReturned: oRealUserBonusUsedReturned ? convertToDecimal(oRealUserBonusUsedReturned.nBonus, 2) : 0,
          nBotBonusUsedReturned: oBotBonusUsedReturned ? convertToDecimal(oBotBonusUsedReturned.nBonus, 2) : 0,

          nTotalCashbackBonus: convertToDecimal(nTotalCashbackBonus, 2) || 0,
          nTotalCashbackCash: convertToDecimal(nTotalCashbackCash, 2) || 0,

          nRealUserTDS: oRealUserTDS ? convertToDecimal(oRealUserTDS.nCash, 2) : 0,
          nBotTDS: oBotTDS ? convertToDecimal(oBotTDS.nCash, 2) : 0,

          sTotalSpot,
          nJoinedBotUsers,
          nTotalUsers,
          nTotalCollection: nTotalCollection ? convertToDecimal(nTotalCollection) : 0,
          nBonusAmount: nBonusAmount ? convertToDecimal(nBonusAmount) : 0,
          nActualCashCollection: nActualCashCollection ? convertToDecimal(nActualCashCollection) : 0,
          nTotalWinningProvided: nTotalWinningProvided ? convertToDecimal(nTotalWinningProvided) : 0,
          nRealUserWinningCash: nRealUserWinningCash ? convertToDecimal(nRealUserWinningCash) : 0,
          nTotalTDS: nTotalTDS ? convertToDecimal(nTotalTDS) : 0,
          nBotUserWinning: nBotUserWinning ? convertToDecimal(nBotUserWinning) : 0,
          nLeagueGrossMargin: nLeagueGrossMargin ? convertToDecimal(nLeagueGrossMargin) : 0,
          nLeagueMarginGrossPercent: nLeagueMarginGrossPercent ? convertToDecimal(nLeagueMarginGrossPercent) : 0,
          nLeagueNetMargin: nLeagueNetMargin ? convertToDecimal(nLeagueNetMargin) : 0,
          nLeagueMarginPercent: nLeagueNetMarginPercent ? convertToDecimal(nLeagueNetMarginPercent) : 0,
          dDate: moment(new Date(d.oMatch.dStartDate)).format('MMMM Do YYYY, h:mm:ss a')

        })
        matchId = d.iMatchId
      }

      oTotal.count = count
      oTotal.nMatchCount = nMatchCount
      oTotal.nLeaguesCancelledCount = nLeaguesCancelledCount
      oTotal.nLeaguesPlayedCount = nLeaguesPlayedCount
      oTotal.nRealUsersPlayed = nRealUsersPlayed
      oTotal.nBotUsersPlayed = nBotUsersPlayed
      oTotal.nTotalUsersPlayed = nTotalUsersPlayed
      oTotal.nActualEntryFeeCollected = nActualEntryFeeCollected
      oTotal.nTotalActualCashCollected = nTotalActualCashCollected
      oTotal.nTotalBonusCollected = nTotalBonusCollected
      oTotal.nTotalCollectionCollected = nTotalCollectionCollected
      oTotal.nTotalUserCashWinningCollected = nTotalUserCashWinningCollected
      oTotal.nTotalUserBonusWinningCollected = nTotalUserBonusWinningCollected
      oTotal.nTotalBotCashWinningCollected = nTotalBotCashWinningCollected
      oTotal.nTotalBotBonusWinningCollected = nTotalBotBonusWinningCollected
      oTotal.nTotalWinnersCount = nTotalWinnersCount
      oTotal.nTotalWinningOfLeaguesProvided = nTotalWinningOfLeaguesProvided
      oTotal.nTotalLeagueGrossMarginProvided = nTotalLeagueGrossMarginProvided
      oTotal.nTotalLeagueGrossMarginPercentProvided = nTotalLeagueGrossMarginPercentProvided
      oTotal.nTotalCashbackGiven = nTotalCashbackGiven
      oTotal.nTotalCashbackBonusGiven = nTotalCashbackBonusGiven
      oTotal.nTotalCreatorBonusGiven = nTotalCreatorBonusGiven
      oTotal.nTotalLeagueNetMarginCalculated = nTotalLeagueNetMarginCalculated
      oTotal.nTotalLeagueNetMarginPercentCalculated = nTotalLeagueNetMarginPercentCalculated
      oTotal.nTotalTDSDeducted = nTotalTDSDeducted

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmatchLeague), data: { oTotal, aResult } })
    } catch (error) {
      catchError('MatchLeagues.leaguesReport', error, req, res)
    }
  }

  // When Spot are empty and giving MatchLeague Full Error: Reset Redis Count

  async resetRedisJoinCount(req, res) {
    try {
      const nTotalUserLeague = await UserLeagueModel.countDocuments({ iMatchLeagueId: req.params.id, bCancelled: false }, { readPreference: 'primary' })
      await Promise.all([
        redisClient.set(`${req.params.id}`, nTotalUserLeague),
        MatchLeagueModel.updateOne({ _id: ObjectId(req.params.id) }, { nJoined: nTotalUserLeague })
      ])
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cmatchLeague), data: { nJoined: nTotalUserLeague } })
    } catch (error) {
      catchError('MatchLeagues.resetRedisJoinCount', error, req, res)
    }
  }
}

module.exports = new MatchLeague()
