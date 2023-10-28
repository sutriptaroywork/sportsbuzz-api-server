const async = require('async')
const MatchPlayerModel = require('../matchPlayer/model')
const UserTeamModel = require('../userTeam/model')
const MatchModel = require('../match/model')
const MatchLeagueModel = require('../matchLeague/model')
const UserLeagueModel = require('../userLeague/model')
const MatchTeamsModel = require('../matchTeams/model')
const MyMatchesModel = require('../myMatches/model')
const UsersModel = require('../user/model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, handleCatchError, convertToDecimal } = require('../../helper/utilities.services')
const { queuePush, queuePop, redisClient2, bulkQueuePop, queueLen, checkTeamJoined, redisClient, checkProcessed, bulkQueuePush } = require('../../helper/redis')
const ObjectId = require('mongoose').Types.ObjectId
const config = require('../../config/config')
const UserDepositModel = require('../userDeposit/model')
const UserWithdrawModel = require('../userWithdraw/model')
const PassbookModel = require('../passbook/model')
const UserBalanceModel = require('../userBalance/model')
const UserLeagueSqlModel = require('../userLeague/userLeagueSqlModel')
const { Op, literal, fn, col, Transaction } = require('sequelize')
const db = require('../../database/sequelize')
const StatisticsModel = require('../user/statistics/model')
const { bAllowDiskUse, CACHE_2, CACHE_1 } = config
// const { checkCashfreeStatus, processPayment } = require('./common')
const pendingMatchModel = require('../match/pendingMatch.model')
const moment = require('moment')
const { MatchDBConnect } = require('../../database/mongoose')
const { checkCashfreePayoutStatus, processPayout, createXlsxFile, userDepositInformation } = require('./common')
const UserModel = require('../user/model')
const SeriesLeaderBoardModel = require('../seriesLeaderBoard/model')
const FullScorecardsModel = require('../scorecard/model')
const { getMatchLeagueStatus, getStatisticsSportsKey } = require('../../helper/utilities.services')
const matchLeagueServices = require('../matchLeague/services')
const PromocodeStatisticsModel = require('../promocode/statistics/model')
const sequelize = require('sequelize')
const {
  getCricketRefreshMatchData,
  getFootballRefreshMatchData,
  getBaseballRefreshMatchData,
  getBasketBallRefreshMatchData,
  getKabaddiRefreshMatchData
} = require('../match/common')
const AdminLogModel = require('../admin/logs.model')
const ApiLogModel = require('../apiLog/ApiLog.model')
const UserTdsModel = require('../userTds/model')
const SettingModel = require('../setting/model')
const userBalanceSerices = require('../userBalance/services')
const BotLogModel = require('../botLogs/model')
const { GamesDBConnect } = require('../../database/mongoose')
const { getEventReport, getAggregateReport } = require('../../helper/appsFlyer')
const { sendMailTo } = require('../../helper/email.service')
const { APPSFLYER_REPORT_EMAIL, USER_REPORT_RECIEVER_EMAIL, MATCH_REPORT_EMAIL } = require('../../config/common')
const settingServices = require('../setting/services')
const { pushTopicNotification } = require('../../helper/firebase.services')
const { fetchPlaying11FromEntitySport, fetchPlaying11FromSoccerEntitySport, fetchStarting7FromKabaddiEntitySport, fetchStarting5FromBasketballEntitySport } = require('../matchPlayer/common')
const NotificationMessagesModel = require('../notification/notificationMessages.model')
const CitiesModel = require('../user/cities')
const StatesModel = require('../user/states')
const KycModel = require('../kyc/model')
const axios = require('axios')
const BackupAdminLogsModel = require('../admin/backuplogs.model')
const USER_ENUM = require('../../enums/userEnums/userTypes')
const REPLICA_ENUM = require('../../enums/replicaEnums/replicaTypes')

const BotCombinationLogModel = require('../botCombinationLog/model')
const BackupBotCombinationLogModel = require('../botCombinationLog/backup.botcombinationlog.model')
const CopyTeamLogModel = require('../userLeague/CopyTeamLogModel')
const BackupCopyTeamLogModel = require('../userLeague/backupCopyTeamLogModel')
const BackupBotLogModel = require('../botLogs/backup.botlog.model')
const adminLogQueue = require('../../rabbitmq/queue/adminLogQueue')
class Cron {
  async calculateMatchPlayerSetBy(req, res) {
    try {
      console.log(':======== Set By % CRON Triggered ========:')
      const dStartDate = new Date().setTime(new Date().getTime() + (1000 * 60 * 10)) // +10 min from current time

      const data = await MatchModel.find({
        eStatus: 'U',
        bDisabled: false,
        dStartDate: { $gt: dStartDate }
      }).lean()
      if (data.length) {
        // await matchWiseSetBy(req, res, data)
        await matchWiseSetByV2(data)
      }
      console.log(':======== CRON Processed ========:')

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].matchPlayer) })
    } catch (error) {
      catchError('Cron.calculateMatchPlayerSetBy', error, req, res)
    }
  }

  /**
   * This service will want system to check expired bonus 24 hours.
   * @param {*} req request object
   * @param {*} res response object
   * @returns this will process all user's bonus that is if it's in expired state from current date then will process expiration bonus of that users.
   */
  // This function is Deprecated as we have created its SP.
  async bonusExpireV2(req, res) {
    try {
      const dDate = new Date()
      const aExpiredBonus = await PassbookModel.findAll({
        where: {
          [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { [Op.and]: [{ eTransactionType: 'Deposit' }, { nBonus: { [Op.gt]: 0 } }] }, { [Op.and]: [{ eTransactionType: 'Contest-Cashback' }, { nBonus: { [Op.gt]: 0 } }] }],
          eType: 'Cr',
          bIsBonusExpired: false,
          dBonusExpiryDate: {
            [Op.lte]: dDate
          }
        },
        group: 'iUserId',
        order: [['dBonusExpiryDate', 'DESC']] // 'ASC' : 'DESC'
      })
      if (!aExpiredBonus.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].cBackgroundProcess.replace('##', messages[req.userLanguage].cExpireBonus) })

      aExpiredBonus.forEach((d) => queuePush('BonusExpire', d))

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].cBackgroundProcess.replace('##', messages[req.userLanguage].cExpireBonus) })
    } catch (error) {
      catchError('Cron.bonusExpire', error, req, res)
    }
  }

  /**
   * This service will want system to check expired bonus 24 hours.
   * @param {*} req request object
   * @param {*} res response object
   * @returns this will process all user's bonus that is if it's in expired state from current date then will process expiration bonus of that users.
   */
  async bonusExpire(req, res) {
    try {
      // const dDate = new Date()
      // const aExpiredBonus = await PassbookModel.findAll({
      //   where: {
      //     [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { [Op.and]: [{ eTransactionType: 'Deposit' }, { nBonus: { [Op.gt]: 0 } }] }, { [Op.and]: [{ eTransactionType: 'Contest-Cashback' }, { nBonus: { [Op.gt]: 0 } }] }],
      //     eType: 'Cr',
      //     bIsBonusExpired: false,
      //     dBonusExpiryDate: {
      //       [Op.lte]: dDate
      //     }
      //   },
      //   group: 'iUserId',
      //   order: [['dBonusExpiryDate', 'DESC']] // 'ASC' : 'DESC'
      // })
      // if (!aExpiredBonus.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].cBackgroundProcess.replace('##', messages[req.userLanguage].cExpireBonus) })

      // aExpiredBonus.forEach((d) => queuePush('BonusExpire', d))

      // All the bonus expiry operation will handled in SP
      let _dExpiryDate = new Date()
      _dExpiryDate = _dExpiryDate.toISOString().replace('T', ' ').replace('Z', '')
      const symbol = await settingServices.getCurrencySymbol()
      const sRemark = messages[req.userLanguage].bonus_debited
      const procedureArgument = { replacements: { _dExpiryDate, _sRemark: sRemark, _symbol: symbol } }
      await db.sequelize.query('CALL bulkBonusExpire(:_dExpiryDate, :_sRemark, :_symbol)', procedureArgument)
      // => Need to handle SP response, Also Below Table is SQL temp table UserLeague
      const oUserBonusExpireData = await UserLeagueSqlModel.findAll({ where: { eTransactionType: 'Bonus-Expire' }, attributes: ['id', 'iUserId', 'eTransactionType', 'nFinalAmount'], raw: true })
      const aStatisticsData = []
      const aProceedUsers = []

      for (const userLeague of oUserBonusExpireData) {
        // will push statistic object for specific user
        aStatisticsData.push({
          updateOne: {
            filter: { iUserId: ObjectId(userLeague.iUserId) },
            update: {
              $set: { $inc: { nActualBonus: -(Number(parseFloat(userLeague.nFinalAmount).toFixed(2))), nTotalBonusExpired: Number(parseFloat(userLeague.nFinalAmount).toFixed(2)) } }
            }
          }
        })
        // will push proceeded iUserId entry
        aProceedUsers.push(userLeague.id)
      }

      // Need to update statistics after fetching from userLeague
      await StatisticsModel.bulkWrite(aStatisticsData)
      await UserLeagueSqlModel.destroy({ where: { id: { [Op.in]: aProceedUsers } } })

      // await StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, { $inc: { nActualBonus: -(Number(parseFloat(nTotalUnusedBonus).toFixed(2))), nTotalBonusExpired: Number(parseFloat(nTotalUnusedBonus).toFixed(2)) } }, { upsert: true })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].cBackgroundProcess.replace('##', messages[req.userLanguage].cExpireBonus) })
    } catch (error) {
      catchError('Cron.bonusExpireV2', error, req, res)
    }
  }

  /**
   * This service will want system to check Pending Deposits every hour,
   * so that if any webhook missed still that payment will be proceed and transaction will be either success or failed rather then being pending in admin panel.
   * @param {*} req request object
   * @param {*} res response object
   * @returns This will process all pending deposit which webhooks are missed to be execute for certain reason.
   */
  async processDepositPayment(req, res) {
    try {
      const dCurrentTime = new Date()
      dCurrentTime.setTime(dCurrentTime.getTime() - (24 * 60 * 60 * 1000)) // last 24 hours

      let aPendingDeposit
      await db.sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
      }, async (t) => {
        aPendingDeposit = await UserDepositModel.findAll({
          where: {
            ePaymentStatus: 'P',
            [Op.and]: [{
              dUpdatedAt: { [Op.gte]: dCurrentTime }
            }, {
              dUpdatedAt: { [Op.lte]: new Date(new Date().getTime() - (5 * 60 * 1000)) } // 5 minutes before from current time.
            }]
          },
          raw: true,
          attributes: ['id', 'ePaymentGateway', 'iOrderId', 'iUserId'],
          order: [['dUpdatedAt', 'DESC']],
          transaction: t,
          lock: true
        })
      })
      // for (const deposit of data) {
      //   const { id, ePaymentGateway } = deposit
      //   if (ePaymentGateway === 'CASHFREE') {
      //     const { isSuccess, payload, error } = await checkCashfreeStatus(id)
      //     if (!isSuccess) {
      //       throw new Error(error)
      //     }
      //     await processPayment(deposit, payload)
      //   }
      // }
      if (aPendingDeposit.length) {
        await bulkQueuePush('ProcessPayment', aPendingDeposit, aPendingDeposit.length)
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].processDepositPayment) })
    } catch (error) {
      catchError('Cron.processDepositPayment', error, req, res)
    }
  }

  /**
   * This service is cron therefore this will run for every 2 minutes or according to the time that we set while cron service added on server.
   * @param {*} req request object
   * @param {*} res response object
   * @returns this service will be update all upcoming matches to live state and and processes on all it's match contest either cancelled or running state.
   */
  async matchLive(req, res) {
    try {
      let dProceedDate = new Date()
      dProceedDate = new Date(dProceedDate.getTime() - 40000)
      const matches = await MatchModel.find({ eStatus: 'U', dStartDate: { $lte: dProceedDate } }).lean() // find upcoming matches
      await MatchModel.updateMany({ eStatus: 'U', dStartDate: { $lte: dProceedDate } }, { $set: { eStatus: 'L' } }) // update to live

      const aPromise = []
      if (matches.length) {
        const matchLogsData = matches.map((match) => {
          const iMatchId = match._id.toString()
          aPromise.push(checkProcessed(`matchStarted:${iMatchId.toString()}`, 24 * 60 * 60))
          return ({ oOldFields: { ...match, _id: iMatchId }, oNewFields: { ...match, _id: iMatchId, eStatus: 'L' }, eKey: 'M' })
        })
        if (matchLogsData && matchLogsData.length) {
          matchLogsData.forEach((logData) => adminLogQueue.publish(logData))
        }
        // await AdminLogModel.insertMany(matchLogsData)
      }
      await Promise.all(aPromise)

      matches.forEach((m) => {
        const imatchId = m._id.toString()
        this.loadMatchToRedisV2(imatchId)
      })

      const matchIds = matches.map((match) => ObjectId(match._id))

      await Promise.all([
        MyMatchesModel.updateMany({ iMatchId: { $in: matchIds } }, { $set: { eMatchStatus: 'L' } }),
        MatchLeagueModel.updateMany({ iMatchId: { $in: matchIds } }, { $set: { eMatchStatus: 'L' } })
      ])

      const matchLeagues = await MatchLeagueModel.find({ iMatchId: { $in: matchIds }, bCancelled: false }, { _id: 1, iMatchId: 1, bPoolPrize: 1, bPrivateLeague: 1, nPrice: 1, nJoined: 1, nMax: 1, bConfirmLeague: 1, nMin: 1, eCategory: 1, iUserId: 1, bCancelled: 1, bCashbackEnabled: 1, nMinCashbackTeam: 1, nCashbackAmount: 1, eCashbackType: 1, bIsProcessed: 1, bPlayReturnProcess: 1, sName: 1, nTotalPayout: 1, sFairPlay: 1, bUnlimitedJoin: 1 }, { readPreference: 'primary' }).sort({ nJoined: 1 }).lean()

      matchLeagues.map((matchLeague) => queuePush('MatchLive', matchLeague))

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].matchStatus) })
    } catch (error) {
      catchError('Cron.matchLive', error, req, res)
    }
  }

  /**
   * This service is cron therefore this will run for every 2 minutes or according to the time that we set while cron service added on server.
   * This service will calculate score points of live match for users total scored points to show in live leader board section.
   * @param {*} req request object
   * @param {*} res response object
   * @returns This will fetch live score point from third party API according Match API Provider and update the leader board accordingly.
   */
  async liveLeaderboard(req, res) {
    try {
      const match = await MatchModel.find({ eStatus: 'L', bDisabled: false }).lean()

      match.forEach((element) => {
        queuePush('LiveLeaderBoard', element)
      })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].leaderboard) })
    } catch (error) {
      return catchError('Cron.liveLeaderboard', error, req, res)
    }
  }

  /**
   * This service will be called manually while match going live and in case our server will restart in between till completed of the match.
   * @param {*} req request object
   * @param {*} res response object
   * @returns this will add live match data to redis for live leader board user point calculation process.
   */
  async loadLeaderboard(req, res) {
    try {
      const { matchId } = req.query
      await this.loadMatchToRedisV2(matchId)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].leaderboard), data: {} })
    } catch (error) {
      return catchError('Cron.loadLeaderboard', error, req, res)
    }
  }

  /**
   * It'll add the match details into redis for 24 hours and also update the redis leader board according to user rank and point wise.
   * @param {iMatchId}  matchId Match Id
   * @returns It'll add the match details into redis and also update the redis leader board according to user rank and point wise.
   */
  async loadMatchToRedis(matchId) {
    try {
      const matchLeagues = await MatchLeagueModel.find({ iMatchId: matchId, bCancelled: false }, {}, { readPreference: 'primary' }).lean()

      async.eachSeries(matchLeagues, async (s, cb) => {
        try {
          const matchLeagueId = s._id
          const leagues = await UserLeagueModel.find({ iMatchLeagueId: matchLeagueId }, { iUserTeamId: 1, iUserId: 1, nTotalPoints: 1 }, { readPreference: 'primary' }).lean()
          const addToSortedSet = []
          leagues.forEach(singleLeague => {
            addToSortedSet.push(singleLeague.nTotalPoints || 0)
            addToSortedSet.push(singleLeague.iUserTeamId)
          })

          redisClient2
            .multi()
            .hset(`hml:${matchId}:${matchLeagueId}`, 'exists', 1, 'putTime', Date.now(), 'expireTime', Date.now() + 84600, 'matchId', matchId)
            .zadd([`ml:${matchId}:${matchLeagueId}`, ...addToSortedSet])
            .expire(`hml:${matchId}:${matchLeagueId}`, 86400)
            .expire(`ml:${matchId}:${matchLeagueId}`, 86400)
            .exec(() => { Promise.resolve() })
        } catch (error) {
          handleCatchError(error)
          return { isSuccess: false }
        }
      }, (err, data) => {
        if (err) {
          handleCatchError(err)
        }
      })
    } catch (error) {
      handleCatchError(error)
      return { isSuccess: false }
    }
  }

  /**
   * It'll add the match details into redis for 24 hours and also update the redis leader board according to user rank and point wise.
   * @param {iMatchId}  matchId Match Id
   * @returns It'll add the match details into redis and also update the redis leader board according to user rank and point wise.
   */
  async loadMatchToRedisV2(matchId) {
    try {
      const matchLeagues = await MatchLeagueModel.find({ iMatchId: matchId, bCancelled: false }, {}, { readPreference: 'primary' }).lean()

      async.eachSeries(matchLeagues, async (s, cb) => {
        try {
          const matchLeagueId = s._id
          const aUserLeagues = []
          await UserLeagueModel.find({ iMatchLeagueId: matchLeagueId }, { iUserTeamId: 1, iUserId: 1, nTotalPoints: 1 }, { readPreference: 'primary' }).lean().cursor({ batchSize: 100 })
            .on('data', async (userLeague) => {
              aUserLeagues.push(userLeague)

              if (aUserLeagues.length > 25000) {
                const addToSortedSet = []
                const aData = aUserLeagues.splice(0, 25000)
                aData.forEach(singleLeague => {
                  addToSortedSet.push(singleLeague.nTotalPoints || 0)
                  addToSortedSet.push(singleLeague.iUserTeamId)
                })
                await redisClient2.zadd([`ml:${matchId}:${matchLeagueId}`, ...addToSortedSet])
              }
            })
            .on('end', async () => {
              const addToSortedSet = []
              aUserLeagues.forEach(singleLeague => {
                addToSortedSet.push(singleLeague.nTotalPoints || 0)
                addToSortedSet.push(singleLeague.iUserTeamId)
              })

              redisClient2
                .multi()
                .hset(`hml:${matchId}:${matchLeagueId}`, 'exists', 1, 'putTime', Date.now(), 'expireTime', Date.now() + 84600, 'matchId', matchId)
                .zadd([`ml:${matchId}:${matchLeagueId}`, ...addToSortedSet])
                .expire(`hml:${matchId}:${matchLeagueId}`, 86400)
                .expire(`ml:${matchId}:${matchLeagueId}`, 86400)
                .exec(() => { Promise.resolve() })
            })
        } catch (error) {
          handleCatchError(error)
          return { isSuccess: false }
        }
      }, (err, data) => {
        if (err) {
          handleCatchError(err)
          return { isSuccess: false }
        }
      })
    } catch (error) {
      handleCatchError(error)
      return { isSuccess: false }
    }
  }

  async calculateSeasonPoint(req, res) {
    try {
      const matches = await MatchModel.find({ eStatus: 'U', bDisabled: false, dStartDate: { $gte: new Date() } }).select({ oHomeTeam: 1, oAwayTeam: 1, sSeasonKey: 1, eCategory: 1, eFormat: 1 }).lean()

      for (const match of matches) {
        const team = [match.oHomeTeam.iTeamId, match.oAwayTeam.iTeamId]

        const seasonMatches = await MatchModel.find({ sSeasonKey: match.sSeasonKey, eFormat: match.eFormat, eCategory: match.eCategory, $or: [{ 'oHomeTeam.iTeamId': { $in: team } }, { 'oAwayTeam.iTeamId': { $in: team } }], eStatus: 'CMP' }).select({ _id: 1 }).lean()

        const aMatchIds = seasonMatches.map(m => ObjectId(m._id))
        const data = await MatchPlayerModel.aggregate([
          {
            $match: {
              iMatchId: { $in: aMatchIds }
            }
          }, {
            $group: {
              _id: '$iPlayerId',
              sum: { $sum: '$nScoredPoints' },
              data: {
                $push: '$$ROOT'
              }
            }
          },
          {
            $project: {
              nSeasonPoints: '$sum',
              iPlayerId: '$_id'
            }
          }
        ]).allowDiskUse(bAllowDiskUse).exec()
        if (!data.length) continue
        const aBulkMatchPlayer = []
        for (const matchPlayer of data) {
          aBulkMatchPlayer.push({
            updateOne: {
              filter: { iPlayerId: ObjectId(matchPlayer.iPlayerId), iMatchId: ObjectId(match._id) },
              update: { $set: { nSeasonPoints: matchPlayer.nSeasonPoints, bPointCalculated: true } }
            }
          })
          // MatchPlayerModel.findByIdAndUpdate(matchPlayer._id, { nSeasonPoints: matchPlayer.nSeasonPoints }, { runValidators: true }).lean()
        }
        MatchPlayerModel.bulkWrite(aBulkMatchPlayer, { writeConcern: { w: 'majority' }, ordered: false })
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].matchStatus) })
    } catch (error) {
      catchError('Cron.calculateSeasonPoint', error, req, res)
    }
  }

  // to remove all pending matches and insert into pending match collection
  async removePendingMatches(req, res) {
    const monthOlderDate = moment().utc().subtract(30, 'days').startOf('day')
    try {
      // fetch all pending matches
      const pendingMatchs = await MatchModel.distinct('_id', {
        eStatus: 'P',
        dCreatedAt: {
          $lte: monthOlderDate
        }
      })
      // if any pending match found
      if (pendingMatchs.length) {
        // find all teams
        const teams = await MatchTeamsModel.distinct('iMatchId', {
          iMatchId: {
            $in: pendingMatchs
          }
        })
        const teamsWithToString = teams.map(function (x) {
          return x.toString()
        })
        const matchWithOutTeam = pendingMatchs.filter(function (x) {
          return !teamsWithToString.includes(x.toString())
        })
        if (!matchWithOutTeam.length) {
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].pending_match_remove })
        }
        // fetch all matches for which team is not formed and insert in the new collection
        const matchsToRemove = await MatchModel.find({
          _id: {
            $in: matchWithOutTeam
          }
        })
        const transactionOptions = {
          readPreference: 'primary',
          readConcern: { level: 'majority' },
          writeConcern: { w: 'majority' }
        }
        const session = await MatchDBConnect.startSession()
        session.startTransaction(transactionOptions)
        try {
          await pendingMatchModel.insertMany(matchsToRemove, { session })
          await MatchModel.deleteMany({ _id: { $in: matchWithOutTeam } }).session(session)
          await session.commitTransaction()
        } catch (error) {
          await session.abortTransaction()
          return catchError('Cron.removePendingMatches', error, req, res)
        } finally {
          session.endSession()
        }
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].pending_match_remove })
      } else {
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].no_pending_match_remove })
      }
    } catch (error) {
      catchError('Cron.removePendingMatches', error, req, res)
    }
  }

  /**
   * It'll process the match league which are overflow for every 10 minutes and also update the match league accordingly and process play return for last joined user.
   * @param {*} req request object
   * @param {*} res response object
   * @returns It'll update overflow match contest accordingly and process play return for last joined user.
   */
  async processPlayReturn(req, res) {
    try {
      const matches = await MatchModel.find({ eStatus: 'U', dStartDate: { $gte: new Date() } }, { _id: 1 }).lean() // find upcoming matches
      const matchIds = matches.map((match) => ObjectId(match._id))

      const matchLeagues = await MatchLeagueModel.aggregate([
        {
          $match: {
            iMatchId: { $in: matchIds }, bCancelled: false
          }
        }, {
          $project: {
            _id: 1,
            bIsOverflow: { $gt: ['$nJoined', '$nMax'] },
            iMatchId: 1,
            bPoolPrize: 1,
            bPrivateLeague: 1,
            nPrice: 1,
            nJoined: 1,
            nMax: 1,
            bConfirmLeague: 1,
            nMin: 1,
            eCategory: 1,
            iUserId: 1,
            bCancelled: 1,
            bCashbackEnabled: 1,
            nMinCashbackTeam: 1,
            nCashbackAmount: 1,
            eCashbackType: 1,
            bIsProcessed: 1,
            bPlayReturnProcess: 1,
            sName: 1,
            nTotalPayout: 1,
            sFairPlay: 1,
            bUnlimitedJoin: 1
          }
        }
      ]).allowDiskUse(bAllowDiskUse)

      for (const league of matchLeagues) {
        if (league.bIsOverflow && !league.bUnlimitedJoin) {
          queuePush('ProcessMatchLeague', league)
        }
        queuePush('checkRedisJoinedCount', league)
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].queued_success.replace('##', messages[req.userLanguage].cmatchLeague) })
    } catch (error) {
      catchError('Cron.processPlayReturn', error, req, res)
    }
  }

  /**
   * This service will want system to check Initiated payout for every hour,
   * so that if any withdraw that is approved by admin and Transfer request triggered but No response from bank in that case will check payout status and will be update either success or failed.
   * @param {*} req request object
   * @param {*} res response object
   * @returns This will process all initiated withdraw which are having no response from bank or any certain reason to be executed in this service.
   */
  async processInitiatedPayouts(req, res) {
    try {
      const dCurrentTime = new Date()
      dCurrentTime.setTime(dCurrentTime.getTime() - (60 * 60 * 1000))

      const data = await UserWithdrawModel.findAll({
        where: {
          ePaymentStatus: 'I',
          [Op.and]: [{
            dUpdatedAt: { [Op.gte]: dCurrentTime }
          }, {
            dUpdatedAt: { [Op.lte]: new Date() }
          }]
        },
        raw: true,
        order: [['dUpdatedAt', 'DESC']]
      })

      for (const withdraw of data) {
        const { id, ePaymentGateway } = withdraw
        if (ePaymentGateway === 'CASHFREE') {
          const { isSuccess, payload, error } = await checkCashfreePayoutStatus(id)
          if (!isSuccess) {
            throw new Error(error)
          }
          await processPayout(withdraw, payload)
        }
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].processInitiatePayout) })
    } catch (error) {
      catchError('Cron.processInitiatedPayouts', error, req, res)
    }
  }

  /**
   * It'll process the match league which are overflow for every 10 minutes and also update the match league accordingly and process play return for last joined user.
   * @param {*} req request object
   * @param {*} res response object
   * @returns It'll update overflow match contest accordingly and process play return for last joined user.
   */
  async fixStatistics(req, res) {
    try {
      const query = req.query && req.query.iUserId ? { _id: ObjectId(req.query.iUserId), eType: 'U' } : { eType: 'U' }

      // const query = req.query && req.query.iUserId ? { where: { iUserId: req.query.iUserId } } : {}
      // const users = await UserBalanceModel.findAll({
      //   attributes: ['iUserId'],
      //   ...query
      // })

      // for (const user of users) {
      //   const data = await fixUserStatistics(user.iUserId.toString())
      //   // const { nActualDepositBalance, nActualWinningBalance, nActualBonus } = data
      //   await StatisticsModel.updateOne({ iUserId: ObjectId(user.iUserId) }, data)
      // }
      await fixRealUserDebugger(query)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].queued_success.replace('##', messages[req.userLanguage].cmatchLeague) })
    } catch (error) {
      catchError('Cron.fixStatistics', error, req, res)
    }
  }

  async checkLiveLeagues(req, res) {
    try {
      const aMatchLeague = await MatchLeagueModel.find({ eMatchStatus: 'L', bCancelled: false }, null, { readPreference: 'primary' }).sort({ nJoined: 1 }).lean()

      for (const matchLeague of aMatchLeague) {
        matchLeague.nJoined = await UserLeagueModel.countDocuments({ iMatchLeagueId: ObjectId(matchLeague._id) }, { readPreference: 'primary' })
        const uniqueUserJoin = await UserLeagueModel.aggregate([
          {
            $match: { iMatchLeagueId: ObjectId(matchLeague._id) }
          },
          {
            $group: {
              _id: '$iUserId'
            }
          },
          {
            $group: {
              _id: null,
              nJoinedCount: { $sum: 1 }
            }
          }
        ]).allowDiskUse(bAllowDiskUse).read('primary').exec()
        const uniqueUserJoinCount = (uniqueUserJoin.length) ? uniqueUserJoin[0].nJoinedCount : 0

        const leagueStatus = await getMatchLeagueStatus(matchLeague, uniqueUserJoinCount)

        if (leagueStatus === 'PLAY_RETURN') {
          await MatchLeagueModel.updateOne({ _id: ObjectId(matchLeague._id) }, { bPlayReturnProcess: true })
          // await queuePush('ProcessPlayReturn', { matchLeague, type: 'MATCHLEAGUE', iAdminId: null, sIP: '', sOperationBy: 'MATCHLEAGUE LIVE CRON', nJoined: matchLeague.nJoined, uniqueUserJoinCount })

          await matchLeagueServices.processPlayReturn(matchLeague, 'MATCHLEAGUE', null, '', 'MATCHLEAGUE LIVE CRON', matchLeague.nJoined, uniqueUserJoinCount)
        }
        queuePush('checkRedisJoinedCount', matchLeague)
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].check_live_leagues })
    } catch (error) {
      handleCatchError(error)
    }
  }

  async updateMatchData(req, res) {
    try {
      const matches = await MatchModel.find({ eStatus: 'U', dStartDate: { $gte: new Date() } }).lean()
      if (!matches.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })

      const aBulkMatch = []
      for (const match of matches) {
        const { eCategory, sKey, eProvider, _id, bIsNameUpdated, oHomeTeam, oAwayTeam } = match

        let refreshData

        switch (eCategory) {
          case 'CRICKET':
            refreshData = await getCricketRefreshMatchData({ sKey, eProvider, _id })
            break
          case 'FOOTBALL':
            refreshData = await getFootballRefreshMatchData({ sKey, eProvider, _id })
            break
          case 'KABADDI':
            refreshData = await getKabaddiRefreshMatchData({ sKey, eProvider, _id })
            break
          case 'BASEBALL':
            refreshData = await getBaseballRefreshMatchData({ sKey, eProvider, _id })
            break
          case 'BASKETBALL':
            refreshData = await getBasketBallRefreshMatchData({ sKey, eProvider, _id })
            break
        }

        if (refreshData && refreshData.isSuccess) {
          if (bIsNameUpdated) delete refreshData.data.sName
          if (oHomeTeam && oHomeTeam?.bIsNameUpdated) {
            refreshData.data.oHomeTeam.sShortName = oHomeTeam.sShortName
            refreshData.data.oHomeTeam.bIsNameUpdated = oHomeTeam.bIsNameUpdated
          }
          if (oAwayTeam && oAwayTeam?.bIsNameUpdated) {
            refreshData.data.oAwayTeam.sShortName = oAwayTeam.sShortName
            refreshData.data.oAwayTeam.bIsNameUpdated = oAwayTeam.bIsNameUpdated
          }

          aBulkMatch.push({
            updateOne: {
              filter: { _id },
              update: { $set: refreshData.data }
            }
          })
        }
      }
      await MatchModel.bulkWrite(aBulkMatch, { ordered: false })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].refresh_success.replace('##', messages[req.userLanguage].match) })
    } catch (error) {
      return catchError('Cron.updateMatchData', error, req, res)
    }
  }

  /**
   * It'll remove api logs for old win distributed matches
   * @param  {*} req
   * @param  {*} res
   */
  async removeOldApiLogs(req, res) {
    try {
      const dRemoveDate = new Date()
      dRemoveDate.setDate(dRemoveDate.getDate() - 30)

      const aOldMatches = await MatchModel.find({ dWinDistAt: { $lt: dRemoveDate } }, { _id: 1 }).lean()
      const aMatchIds = aOldMatches.map(({ _id }) => _id)
      ApiLogModel.deleteMany({ iMatchId: { $in: aMatchIds } })
        .then((data) => console.log('removeOldApiLogs cron ran successfully:', { data }))

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].old_api_logs_remove })
    } catch (error) {
      return catchError('Cron.removeOldApiLogs', error, req, res)
    }
  }

  /**
   * It calculates the match league reports fields like nActualCashWinning and sends excel sheet in mail to the Client email
   * @param  {*} req
   * @param  {*} res
   */
  async leaguesReport(req, res) {
    try {
      let dDateTo = moment(new Date()).format('YYYY-MM-DD')
      let dDateFrom = moment(new Date(dDateTo)).add(-1, 'd').format('YYYY-MM-DD')
      const sDates = `${dDateFrom}`

      dDateFrom = new Date(moment(dDateFrom).startOf('day').format())
      dDateTo = moment(new Date(dDateFrom)).endOf('day').toISOString()
      const matchQuery = {
        dStartDate: { $gte: (dDateFrom), $lte: (dDateTo) },
        eStatus: 'CMP'
      }

      const sTdsSetting = await SettingModel.findOne({ sKey: 'TDS' }, { nMax: 1, _id: 0 }).lean()
      const aMatch = await MatchModel.find(matchQuery, { _id: 1 }).lean()
      const aMatchIds = aMatch.map(ids => ids._id)

      const matchLeagueQuery = { iMatchId: { $in: aMatchIds }, eMatchStatus: 'CMP' }
      const schema = []
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
      }).populate('oMatch', ['sName', 'sKey', 'dStartDate', 'eCategory']).sort({ iMatchId: 1 }).lean()
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
      const aMatchLeagueId = []

      for (const d of aMatchLeague) {
        aMatchLeagueId.push(d._id.toString())
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
        const nActualCashCollection = nTotalCollection - (nBonusAmount + (convertToDecimal(nTotalPromoDiscount, 2) || 0) + (oBotCashCollection && oBotCashCollection.nCash ? convertToDecimal(oBotCashCollection.nCash, 2) : 0) + (oBotBonusUsed && oBotBonusUsed.nBonus ? convertToDecimal(oBotBonusUsed.nBonus, 2) : 0))
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
      schema.push(
        {
          column: `Match Name \n(${nMatchCount})`,
          type: String,
          value: object => object.oMatch.sName,
          width: '25pt',
          align: 'center'
        },
        {
          column: 'Match Key',
          type: String,
          value: object => object.oMatch.sKey,
          width: '16.5pt',
          align: 'center'
        },
        {
          column: `Sr No. \n(${nLeaguesPlayedCount})`,
          type: Number,
          value: object => object.nSr_no,
          align: 'center'
        },
        {
          column: 'League Name',
          type: String,
          width: '16.5pt',
          value: object => object.sName,
          align: 'center'
        },
        {
          column: 'League Type',
          type: String,
          value: object => object.bPrivateLeague,
          width: '22.5pt',
          align: 'center'
        },
        {
          column: `Cancelled \nLeague \n(${nLeaguesCancelledCount})`,
          type: String,
          value: object => object.bCancelled,
          align: 'center',
          height: '12pt',
          span: 2
        },
        {
          column: 'Total Spot \n(Min-Max)',
          type: String,
          value: object => object.sTotalSpot,
          align: 'center',
          width: '14.5pt'
        },
        {
          column: `Real \nUsers \n(${nRealUsersPlayed})`,
          type: Number,
          value: object => object.nJoinedRealUsers,
          align: 'center'
        },
        {
          column: `Bot \nUsers \n(${nBotUsersPlayed})`,
          type: Number,
          value: object => object.nJoinedBotUsers,
          align: 'center'
        },
        {
          column: `Total \nUsers \n(${nTotalUsersPlayed})`,
          type: Number,
          value: object => object.nTotalUsers,
          align: 'center'
        },
        {
          column: `Entry \nFees \n(${nActualEntryFeeCollected})`,
          type: Number,
          value: object => object.nPrice,
          align: 'center'
        },
        {
          column: `Actual Cash \nCollection \n(${nTotalActualCashCollected})`,
          type: Number,
          value: object => object.nActualCashCollection || 0,
          align: 'center',
          width: '21.5pt'
        },
        {
          column: `Bonus \nAmount \n(${nTotalBonusCollected})`,
          type: Number,
          value: object => object.nBonusAmount || 0,
          align: 'center'
        },
        {
          column: `Promo Code \namount used\n(Discount)\n(${nTotalPromoCodeAmountCollected})`,
          type: Number,
          value: object => object.nTotalPromoDiscount || 0,
          align: 'center',
          width: '21.5pt'
        },
        {
          column: `Bot \nAmount \n(${nTotalBotAmountCollected})`,
          type: Number,
          value: object => object.nBotCashCollection || 0,
          align: 'center'
        },
        {
          column: `Bot \nBonus \n(${nTotalBotBonusCollected})`,
          type: Number,
          value: object => object.nBotBonusUsed || 0,
          align: 'center'
        },
        {
          column: `Total \nCollection \n(${nTotalCollectionCollected})`,
          type: Number,
          value: object => object.nTotalCollection,
          align: 'center'
        },
        {
          column: `User Cash \nWinning \n(${nTotalUserCashWinningCollected})`,
          type: Number,
          value: object => object.nRealUserWinningCash,
          align: 'center',
          width: '14.5pt'
        },
        {
          column: `User Bonus \nWinning \n(${nTotalUserBonusWinningCollected})`,
          type: Number,
          value: object => object.nRealUserWinningBonus || 0,
          align: 'center',
          width: '14.5pt'
        },
        {
          column: `Bot User \nWinning \n(${nTotalBotCashWinningCollected})`,
          type: Number,
          value: object => object.nBotUserWinning || 0,
          align: 'center',
          width: '14.5pt'
        },
        {
          column: `Bot Bonus \nWinning \n(${nTotalBotBonusWinningCollected})`,
          type: Number,
          value: object => object.nBotWinningBonus,
          align: 'center',
          width: '14.5pt'
        },
        {
          column: `Winner's \nCount \n(${nTotalWinnersCount})`,
          type: Number,
          value: object => object.nWinnersCount,
          align: 'center'
        },
        {
          column: `Total Winning \nProvided \n(${nTotalWinningOfLeaguesProvided})`,
          type: Number,
          value: object => object.nTotalWinningProvided,
          align: 'center',
          width: '15.5pt'
        },
        {
          column: `League \nGross Margin \n(${nTotalLeagueGrossMarginProvided})`,
          type: Number,
          value: object => object.nLeagueGrossMargin,
          align: 'center',
          width: '15.5pt'
        },
        {
          column: `League \nGross Margin(%) \n(${nTotalLeagueGrossMarginPercentProvided})`,
          type: Number,
          value: object => object.nLeagueMarginGrossPercent,
          align: 'center',
          width: '15.5pt'
        },
        {
          column: `Cashback \n(Cash) \n(${nTotalCashbackGiven})`,
          type: Number,
          value: object => object.nTotalCashbackCash || 0,
          align: 'center'
        },
        {
          column: `Cashback \n(Bonus)\n(${nTotalCashbackBonusGiven})`,
          type: Number,
          value: object => object.nTotalCashbackBonus || 0,
          align: 'center'
        },
        {
          column: `Private League \nCreator Bonus \n(${nTotalCreatorBonusGiven})`,
          type: Number,
          value: object => object.nCreatorCommission || 0,
          align: 'center',
          width: '18.5pt'
        },
        {
          column: `League \nNet Margin \n(${nTotalLeagueNetMarginCalculated})`,
          type: Number,
          value: object => object.nLeagueNetMargin || 0,
          align: 'center',
          width: '15.5pt'
        },
        {
          column: `League \nNet Margin(%) \n(${nTotalLeagueNetMarginPercentCalculated})`,
          type: Number,
          value: object => object.nLeagueNetMarginPercent || 0,
          align: 'center',
          width: '15.5pt'
        },
        {
          column: `TDS (@ ${sTdsSetting.nMax}% Applicable \non above Rs.10000 \nWinning Prize)\n(${nTotalTDSDeducted})`,
          type: Number,
          value: object => object.nTotalTDS || 0,
          align: 'center',
          width: '50pt'
        },
        {
          column: 'Pool \nLeague',
          type: String,
          value: object => object.bPoolPrize,
          align: 'center',
          width: '15.5pt'
        },
        {
          column: 'Match \nCategory',
          type: String,
          value: object => object.oMatch.eCategory,
          align: 'center',
          width: '15.5pt'
        },
        {
          column: 'Date',
          type: String,
          value: object => object.dDate,
          width: '47pt',
          align: 'center'
        }
      )

      const { aTopSpendUser, aTopEarnedUser, aTopLossUser } = await generateMatchReport(aMatchIds, aMatchLeagueId)

      const matchReportSchema = [{
        column: 'Sr.No.',
        type: Number,
        value: object => object.nSr_no,
        width: '12pt',
        align: 'center'
      },
      {
        column: 'Username',
        type: String,
        value: object => object.sUsername,
        width: '16.5pt',
        align: 'center'
      },
      {
        column: 'Email',
        type: String,
        value: object => object.sEmail,
        align: 'center',
        width: '22.5pt'
      },
      {
        column: 'Mobile Number',
        type: String,
        width: '16.5pt',
        value: object => object.sMobNum,
        align: 'center'
      },
      {
        column: 'League Join Amount',
        type: Number,
        value: object => object.nLeagueJoinAmount,
        width: '22.5pt',
        align: 'center'
      },
      {
        column: 'Bonus Utilized',
        type: Number,
        value: object => object.nBonusUtil,
        width: '22.5pt',
        align: 'center'
      },
      {
        column: 'Total Earned \n (With TDS)',
        type: Number,
        value: object => object.nTotalEarned,
        align: 'center',
        width: '16.5pt'

      },
      {
        column: 'TDS (@30% \n Applicable on \n above Rs.10000 \n winning price)',
        type: String,
        value: object => object.nTdsAmount,
        align: 'center',
        width: '16.5pt'

      },
      {
        column: 'Total Earned \n After Tax',
        type: String,
        value: object => object.nTotalActualEarned,
        align: 'center',
        width: '16.5pt'

      },
      {
        column: 'Total Loss',
        type: Number,
        value: object => object.nTotalLoss,
        align: 'center',
        width: '16.5pt'

      },
      {
        column: 'Teams',
        type: Number,
        value: object => object.nTeam,
        align: 'center',
        width: '14.5pt'
      },
      {
        column: 'Match Name',
        type: String,
        value: object => object.sMatchName,
        align: 'center',
        width: '16.5pt'
      },
      {
        column: 'User Type',
        type: String,
        value: object => object?.eType === 'B' ? 'Bot' : 'Real',
        align: 'center',
        width: '16.5pt'
      }
      ]

      // await writeFileData(schema, aResult, sDates)

      const aFile = await Promise.all([
        createXlsxFile(schema, aResult, `MatchReports_${sDates}`),
        createXlsxFile(matchReportSchema, aTopSpendUser, `Top10_SpendUser_${sDates}`),
        createXlsxFile(matchReportSchema, aTopEarnedUser, `Top10_EarnedUser_${sDates}`),
        createXlsxFile(matchReportSchema, aTopLossUser, `Top10_LossUser_${sDates}`)
      ])

      const oOptions = {
        from: `SportsBuzz11 ${config.SMTP_FROM}`,
        to: config.RECEIVER_EMAIL,
        subject: `${config.EMAIL_SUBJECT} of ${sDates}`
      }

      await sendMailTo({ oAttachments: aFile, oOptions })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cmatchLeague), data: { aResult } })
    } catch (error) {
      catchError('Cron.leaguesReport', error, req, res)
    }
  }

  async prepareAutoFillMatchLeagues(req, res) {
    try {
      const dAfter30min = new Date()
      dAfter30min.setMinutes(dAfter30min.getMinutes() + 30)

      let aUpcomingMatches = await MatchModel.find({ dStartDate: { $gte: new Date(), $lt: new Date(dAfter30min) }, eStatus: 'U' }, { _id: 1 }).lean()
      if (aUpcomingMatches.length) aUpcomingMatches = aUpcomingMatches.map(({ _id }) => _id)

      const matchLeagues = await MatchLeagueModel.find({ iMatchId: { $in: aUpcomingMatches }, eMatchStatus: 'U', bCancelled: false, nAutoFillSpots: { $gt: 0 } }, { _id: 1, nMax: 1, nJoined: 1, iMatchId: 1, bConfirmLeague: 1, nMin: 1, bPoolPrize: 1, nAutoFillSpots: 1 }).lean()
      if (matchLeagues.length) {
        for (const league of matchLeagues) {
          const { _id, nMax, nJoined, iMatchId, bConfirmLeague, nMin, bPoolPrize, nAutoFillSpots = 0 } = league
          const spots = (bConfirmLeague || bPoolPrize) ? (Number(nMin) - Number(nJoined)) : (Number(nMax) - Number(nJoined))
          if (spots > 0 && nAutoFillSpots >= spots) {
            const margin = (spots * 5) / 100
            await queuePush('PREPARE_AUTOFILL_MATCHLEAGUE', { _id, nTeams: Math.ceil(spots + margin), iMatchId })
          }
        }
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK })
    } catch (error) {
      return catchError('Cron.prepareAutoFillMatchLeagues', error, req, res)
    }
  }

  async autoFillMatchleagues(req, res) {
    try {
      const dAfter2min = new Date()
      dAfter2min.setMinutes(dAfter2min.getMinutes() + 2)

      let aUpcomingMatches = await MatchModel.find({ dStartDate: { $gte: new Date(), $lt: new Date(dAfter2min) }, eStatus: 'U' }, { _id: 1 }).lean()
      if (aUpcomingMatches.length) aUpcomingMatches = aUpcomingMatches.map(({ _id }) => _id)

      const matchLeagues = await MatchLeagueModel.find({ iMatchId: { $in: aUpcomingMatches }, eMatchStatus: 'U', bCancelled: false, nAutoFillSpots: { $gt: 0 } }, { _id: 1 }).lean()
      if (matchLeagues.length) {
        const matchLeagueQueues = matchLeagues.map(({ _id }) => `AUTOFILL_${_id.toString()}`)
        await invokeAutoFillQueue(matchLeagueQueues)
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK })
    } catch (error) {
      return catchError('Cron.autoFillMatchleagues', error, req, res)
    }
  }

  async appsFlyerReport(req, res) {
    try {
      const dDateTo = moment(new Date()).add(-1, 'd').endOf('day').format('YYYY-MM-DD HH:mm:ss')
      const dDateFrom = moment(new Date()).add(-1, 'd').startOf('day').format('YYYY-MM-DD HH:mm:ss')

      const dDate = moment(new Date()).add(-1, 'd').startOf('day').format('YYYY-MM-DD')

      const [aEventData, aAggregateData] = await Promise.all([
        getEventReport(dDateFrom, dDateTo),
        getAggregateReport(dDate, dDate)
      ])

      const oMediaSource = {}
      if (aEventData && aEventData.length) {
        aEventData.forEach(report => {
          if (report['Customer User ID']) {
            if (!report['Media Source']) report['Media Source'] = report.Partner
            if (!oMediaSource[report['Media Source']]) {
              oMediaSource[report['Media Source']] = {}
              if (ObjectId.isValid(report['Customer User ID'])) oMediaSource[report['Media Source']][report.Campaign] = [report['Customer User ID']]
            } else if (oMediaSource[report['Media Source']] && !oMediaSource[report['Media Source']][report.Campaign]) {
              if (ObjectId.isValid(report['Customer User ID'])) oMediaSource[report['Media Source']][report.Campaign] = [report['Customer User ID']]
            } else if (oMediaSource[report['Media Source']] && oMediaSource[report['Media Source']][report.Campaign]) {
              if (ObjectId.isValid(report['Customer User ID'])) oMediaSource[report['Media Source']][report.Campaign].push(report['Customer User ID'])
            }
          }
        })
      }

      // const oUserId = JSON.parse(JSON.stringify(oMediaSource))
      const aMediaSource = Object.keys(oMediaSource)
      const oDepositData = {}
      for (const mediaSource of aMediaSource) {
        const aCampaign = Object.keys(oMediaSource[mediaSource])
        oDepositData[mediaSource] = {}
        if (aCampaign.length) {
          for (const campaign of aCampaign) {
            oDepositData[mediaSource][campaign] = { nFirstTotalDeposit: 0, nTotalDeposit: 0, nFirstTotalDepositCount: 0, nTotalDepositCount: 0, aDepositUserId: [], aRegisterUserId: [] }
            while (oMediaSource[mediaSource][campaign].length) {
              const { nUserFirstDeposit, nUserTotalDeposit, nUserFirstDepositCount, nUserTotalDepositCount, aDepositUserId, aRegisterUserId } = await userDepositInformation(oMediaSource[mediaSource][campaign].splice(0, 500))
              oDepositData[mediaSource][campaign].nFirstTotalDeposit += nUserFirstDeposit
              oDepositData[mediaSource][campaign].nTotalDeposit += nUserTotalDeposit
              oDepositData[mediaSource][campaign].nFirstTotalDepositCount += nUserFirstDepositCount
              oDepositData[mediaSource][campaign].nTotalDepositCount += nUserTotalDepositCount
              oDepositData[mediaSource][campaign].aDepositUserId = [...oDepositData[mediaSource][campaign].aDepositUserId, ...aDepositUserId]
              oDepositData[mediaSource][campaign].aRegisterUserId = [...oDepositData[mediaSource][campaign].aRegisterUserId, ...aRegisterUserId]
            }
          }
        }
      }

      let aAndroidData = []
      const aIOSData = []
      const aIndex = []
      aAggregateData.forEach(a => a.PlateForm === 'Android' ? aAndroidData.push(a) : aIOSData.push(a))
      aAndroidData.forEach(a => {
        // a.aUserId = oUserId[a['Media Source (pid)']] && oUserId[a['Media Source (pid)']][a['Campaign (c)']] ? oUserId[a['Media Source (pid)']] && oUserId[a['Media Source (pid)']][a['Campaign (c)']] : []
        const index = aIOSData.findIndex(i => i['Media Source (pid)'] === a['Media Source (pid)'] && i['Campaign (c)'] === a['Campaign (c)'])
        const iosData = aIOSData[index]
        if (iosData) {
          aIndex.push(index)
          setData(a, oDepositData, iosData)
        } else {
          setData(a, oDepositData)
        }
      })

      aIOSData.forEach((data, i) => {
        if (!aIndex.includes(i)) {
          // data.aUserId = oUserId[data['Media Source (pid)']] && oUserId[data['Media Source (pid)']][data['Campaign (c)']] ? oUserId[data['Media Source (pid)']] && oUserId[data['Media Source (pid)']][data['Campaign (c)']] : []
          setData(data, oDepositData)
          aAndroidData.push(data)
        }
      })

      aAndroidData = aAndroidData.sort((a, b) => {
        if (a['Media Source (pid)']) {
          if (a['Media Source (pid)'] === b['Media Source (pid)'] && a['Campaign (c)']) {
            return a['Campaign (c)'].localeCompare(b['Campaign (c)'])
          } else {
            return a['Media Source (pid)'].localeCompare(b['Media Source (pid)'])
          }
        }
      })

      const aAggregateSchema = [{
        column: 'Media Source',
        type: String,
        value: object => object['Media Source (pid)'],
        align: 'center',
        width: 30
      },
      {
        column: 'Partner',
        type: String,
        value: object => object['Agency/PMD (af_prt)'] !== 'None' ? object['Agency/PMD (af_prt)'] : '',
        align: 'center',
        width: 30
      },
      {
        column: 'Campaign',
        type: String,
        value: object => object['Campaign (c)'],
        align: 'center',
        width: 40
      },
      {
        column: 'Total Clicks',
        type: Number,
        value: object => object.Clicks,
        align: 'center',
        width: 20
      },
      {
        column: 'Total Installs',
        type: Number,
        value: object => object.Installs,
        align: 'center',
        width: 20
      },
      {
        column: 'Total Registrations',
        type: Number,
        value: object => object['af_complete_registration (Unique users)'],
        align: 'center',
        width: 30
      },
      {
        column: 'Total Kyc',
        type: Number,
        value: object => object['custom_kyc_update (Unique users)'],
        align: 'center',
        width: 30
      },
      {
        column: 'Total First Deposits',
        type: Number,
        value: object => object.nFirstTotalDeposit,
        align: 'center',
        width: 20
      },
      {
        column: 'First Deposits Count',
        type: Number,
        value: object => object.nFirstTotalDepositCount,
        align: 'center',
        width: 20
      },
      {
        column: 'Total Deposits',
        type: Number,
        value: object => object.nTotalDepositAmount,
        align: 'center',
        width: 20
      },
      {
        column: 'Total Deposits Count',
        type: Number,
        value: object => object.nTotalDepositCount,
        align: 'center',
        width: 20
      },
      {
        column: 'User Id',
        type: String,
        value: object => object.aRegisterUserId.toString(),
        align: 'left',
        width: 20
      },
      {
        column: 'User Id Count',
        type: Number,
        value: object => object.aRegisterUserId.length,
        align: 'center',
        width: 20
      },
      {
        column: 'First Deposit User Id',
        type: String,
        value: object => object.aDepositUserId.toString(),
        align: 'left',
        width: 20
      }
      ]

      const file = await createXlsxFile(aAggregateSchema, aAndroidData, `AppsFlyerReport_${dDate}`)

      const oOptions = {
        from: `SportsBuzz11 ${config.SMTP_FROM}`,
        to: APPSFLYER_REPORT_EMAIL,
        subject: `AppsFlyer Report of ${dDate}`
      }
      await sendMailTo({ oAttachments: file, oOptions })

      const aData = []
      aAndroidData.forEach(data => {
        if (!data['Media Source (pid)']) return
        const oData = {
          mediaSource: data['Media Source (pid)'],
          partner: data['Agency/PMD (af_prt)'] !== 'None' ? data['Agency/PMD (af_prt)'] : '',
          campaign: data['Campaign (c)'],
          totalClick: data.Clicks,
          totalInstall: data.Installs,
          totalRegistration: data['af_complete_registration (Unique users)'],
          totalFirstDeposit: data.nFirstTotalDeposit,
          totalFirstCount: data.nFirstTotalDepositCount,
          totalDeposits: data.nTotalDepositAmount,
          totalDepositsCount: data.nTotalDepositCount,
          userIds: data.aRegisterUserId.toString(),
          extraData: JSON.stringify({ ...data }),
          reportDate: dDate
        }
        aData.push(oData)
      })

      try {
        await axios.post(`${config.AFFILIATE_DASHBOARD_URL}/affiliate-dashboard/api/saveReports`, aData, { headers: { 'Content-Type': 'application/json' } })
      } catch (err) {
        handleCatchError(err)
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK })
    } catch (error) {
      return catchError('Cron.appsFlyerReport', error, req, res)
    }
  }

  /**
   * This service will be called automatically to fetch Lineups out of last 1 hour's from start time of upcoming Match's Match player automatically through cron which is set for every 5 minutes.
   * @param {*} req request object
   * @param {*} res response object
   * @returns this will update match and matchPlayers details when lineups out for every 5 mins.
   */
  async fetchEntitySportLineUpsPlayer(req, res) {
    try {
      /*
      {
        "sTitle": "Fetch Entity Sports LineUps MatchPlayers Data Dynamically",
        "sDescription": "This setting will fetch Lineups out of last 1 hour's from start time of upcoming Entity Sports Match's Match player automatically through cron which is set for every 5 minutes",
        "sKey": "FETCH_ENTITYSPORT_LINEUP",
        "eStatus": "Y"
      }
      */
      const bFeatureEnabled = await settingServices.findSetting('FETCH_ENTITYSPORT_LINEUP')
      if (!bFeatureEnabled) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].csetting) })

      let playerKey = []
      let substitutePlayerKey = []
      const aPromise = []
      const aBulkPushNotify = []
      const aUpdateMatchPlayer = []
      const aUpdateMatches = []

      const matches = await MatchModel.find({
        eProvider: 'ENTITYSPORT',
        eStatus: 'U',
        bLineupsOut: false,
        $and: [
          {
            dStartDate: { $lte: new Date(new Date().getTime() + 1000 * 60 * 60) }
          },
          {
            dStartDate: { $gte: new Date(new Date().getTime()) }
          }
        ]
      }).lean()
      if (!matches.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })

      const notification = await NotificationMessagesModel.findOne({ eKey: 'MATCH_TIPS' }).lean()

      matches.map(match => {
        switch (match.eCategory) {
          case 'CRICKET':
            aPromise.push(fetchPlaying11FromEntitySport(match, req.userLanguage))
            break

          case 'FOOTBALL':
            aPromise.push(fetchPlaying11FromSoccerEntitySport(match, req.userLanguage))
            break

          case 'BASKETBALL':
            aPromise.push(fetchStarting5FromBasketballEntitySport(match, req.userLanguage))
            break

          case 'KABADDI':
            aPromise.push(fetchStarting7FromKabaddiEntitySport(match, req.userLanguage))
            break

          default:
            break
        }
      })

      const data = await Promise.all(aPromise)

      for (const result of data) {
        if (result.isSuccess === false) continue
        let bFlag = false
        playerKey = result.data
        substitutePlayerKey = result?.sData ? result?.sData : []

        switch (result.match.eCategory) {
          case 'CRICKET':
            bFlag = playerKey.length >= 22 // cricket match both team players 11 lineups out
            break

          case 'FOOTBALL':
            bFlag = playerKey.length >= 22 // soccer match both team players 11 lineups out
            break

          case 'BASKETBALL':
            bFlag = playerKey.length === 10 // basketball match both team players 5 lineups out
            break

          case 'KABADDI':
            bFlag = playerKey.length === 14 // kabaddi match both team players 7 lineups out
            break

          default:
            break
        }

        // For Update MatchPlayer Show Status
        aUpdateMatchPlayer.push({
          updateMany: {
            filter: { sKey: { $in: playerKey }, iMatchId: result.match._id },
            update: { $set: { bShow: true } }
          }
        },
        {
          updateMany: {
            filter: { sKey: { $nin: playerKey }, iMatchId: result.match._id },
            update: { $set: { bShow: false } }
          }
        })

        // For Update Substitute Players Status
        if (substitutePlayerKey.length) {
          aUpdateMatchPlayer.push({
            updateMany: {
              filter: { sKey: { $in: substitutePlayerKey }, iMatchId: result.match._id },
              update: { $set: { bSubstitute: true } }
            }
          })
        }
        // For Update Lineups status
        if (bFlag) {
          aUpdateMatches.push({
            updateOne: {
              filter: { _id: ObjectId(result.match._id) },
              update: { $set: { bLineupsOut: true } }
            }
          })
          if (notification && notification.bEnableNotifications) {
            const { sHeading, sDescription, ePlatform } = notification

            const msg = sDescription.replace('##', result.match.sName)
            aBulkPushNotify.push(pushTopicNotification(ePlatform, sHeading, msg))
          }
        }
      }

      await Promise.all([
        MatchPlayerModel.bulkWrite(aUpdateMatchPlayer, { writeConcern: { w: 'majority' }, ordered: false }),
        MatchModel.bulkWrite(aUpdateMatches, { writeConcern: { w: 'majority' }, ordered: false })
      ])
      if (aBulkPushNotify.length) await Promise.all(aBulkPushNotify)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cplaying11) })
    } catch (error) {
      catchError('MatchPlayer.fetchEntitySportLineUpsPlayer', error, req, res)
    }
  }

  async weeklyMail(req, res) {
    try {
      let dDateTo = moment(new Date()).add(-1, 'd').format('YYYY-MM-DD')
      let dDateFrom = moment(new Date(dDateTo)).add(-6, 'd').format('YYYY-MM-DD')
      const sDates = `${dDateFrom}_${dDateTo}`

      dDateFrom = new Date(moment(dDateFrom).startOf('day').format())
      dDateTo = moment(new Date(dDateTo)).endOf('day').toISOString()

      // const dReportDateTo = moment(new Date(dDateTo)).endOf('day').format('YYYY-MM-DD HH:mm:ss')
      // const dReportDateFrom = moment(new Date(dDateFrom)).startOf('day').format('YYYY-MM-DD HH:mm:ss')

      const [users, nTotal] = await Promise.all([
        UserModel.find({ eType: 'U' }, { sName: 1, eGender: 1, dDob: 1, sMobNum: 1, iCityId: 1, iStateId: 1, sAddress: 1 }).lean(),
        UserModel.countDocuments({ eType: 'U' })
        // getEventReport(dReportDateFrom, dReportDateTo)
      ])

      const aCityId = []
      const aStateId = []
      const aUserId = []
      const aObId = []

      users.forEach(p => {
        aCityId.push(p?.iCityId)
        aStateId.push(p?.iStateId)
        aUserId.push(p?._id.toString())
        aObId.push(p?._id)
      })

      const [cities, states, kycs, passbooks, userBalance, passbookPlays, userLeagues] = await Promise.all([
        CitiesModel.find({ id: { $in: aCityId } }, { id: 1, sName: 1 }).lean(),
        StatesModel.find({ id: { $in: aStateId } }, { id: 1, sName: 1 }).lean(),
        KycModel.find({ iUserId: { $in: aUserId } }).lean(),

        PassbookModel.findAll({
          attributes: [['iUserId', 'userId']],
          where: {
            iUserId: { [Op.in]: aUserId },
            [Op.or]: [{ eTransactionType: 'Refer-Bonus' }, { eTransactionType: 'Bonus' }, { eTransactionType: 'Deposit' }],
            nBonus: { [Op.gt]: 0 },
            eType: 'Cr'
          },
          group: 'iUserId',
          raw: true
        }),

        UserBalanceModel.findAll({
          attributes: [
            ['iUserId', 'userId'],
            ['nCurrentBonus', 'currentBonus'],
            ['nTotalBonusEarned', 'totalBonusEarned'],
            ['nCurrentTotalBalance', 'availableCash'],
            ['nCurrentWinningBalance', 'currentWinningBalance'],
            ['nTotalDepositAmount', 'totalDeposit'],
            ['nTotalWithdrawAmount', 'totalWithdrawal'],
            ['nCurrentDepositBalance', 'currentDeposit']
          ],
          where: {
            iUserId: { [Op.in]: aUserId }
          },
          raw: true
        }
        ),

        PassbookModel.findAll(
          {
            atrributes: [['iUserId', 'userId'], ['eTransactionType', 'transactionType'], [fn('COUNT', col('iUserLeagueId')), 'userLeagueCount']],
            where: {
              iUserId: { [Op.in]: aUserId },
              eTransactionType: 'Play'
            },
            group: 'iUserId',
            raw: true
          }),
        UserLeagueModel.aggregate([
          {
            $match: {
              iUserId: { $in: aObId },
              bCancelled: false
            }
          },
          {
            $sort: {
              dCreatedAt: -1
            }
          },
          {
            $group: {
              _id: '$iUserId',
              dLastLeague: {
                $first: '$dCreatedAt'
              },
              nCount: { $sum: 1 }
            }
          }
        ]).allowDiskUse(true)
      ])
      let count = 0

      const aNewUsers = users.map((ele) => {
        const dDob = ele?.dDob ? moment(ele?.dDob).format('YYYY-MM-DD').toString() : ''
        const sCityName = cities[cities.findIndex(city => city.id === ele.iCityId)]
        const sStateName = states[states.findIndex(state => state.id === ele.iStateId)]

        const oBonusDetails = passbooks[passbooks.findIndex(bonus => bonus.userId === ele?._id?.toString())]
        const sBonusGiven = oBonusDetails ? 'Y' : 'N'

        const oBalanceDetails = userBalance[userBalance.findIndex(balance => balance.userId === ele?._id.toString())]

        const oPlayDetails = passbookPlays[passbookPlays.findIndex(played => played.userId === ele?._id.toString())]
        const nTotalPlay = oPlayDetails?.userLeagueCount ? oPlayDetails.userLeagueCount : 0

        const oKycDetails = kycs[kycs.findIndex(kyc => kyc?.iUserId.toString() === ele?._id?.toString())]
        const eKycStatus = oKycDetails?.oAadhaar?.eStatus === 'A' && oKycDetails?.oPan?.eStatus === 'A' ? 'Accepted' : 'Pending'
        const sPanSubmittedDate = oKycDetails?.oPan?.oVerified?.dActionedAt ? new Date(oKycDetails?.oPan?.oVerified?.dActionedAt).toString() : ''
        const sAadharSubmittedDate = oKycDetails?.oAadhaar?.oVerified?.dActionedAtnew ? new Date(oKycDetails?.oAadhaar?.oVerified?.dActionedAt).toString() : ''
        const sPanNo = oKycDetails?.oPan?.sNo ? oKycDetails?.oPan?.sNo : ''
        const sAadhaarNo = oKycDetails?.oAadhaar?.nNo ? oKycDetails.oAadhaar.nNo.toString() : ''
        const oLastLeaguePlayedOn = userLeagues[userLeagues.findIndex(league => league._id.toString() === ele?._id.toString())]
        const dLastLeaguePlayedOnDate = oLastLeaguePlayedOn?.dLastLeague
        const nLeaguesPlayedCount = oLastLeaguePlayedOn?.nCount ? oLastLeaguePlayedOn.nCount : 0
        // const oAppsFlyer = aAppsFlyer[aAppsFlyer.findIndex(report => report['Customer User ID'] === ele?._id?.toString())]

        let ePanStatus, eAadharStatus

        switch (oKycDetails?.oAadhaar?.eStatus) {
          case 'P':
            eAadharStatus = 'Pending'
            break
          case 'R':
            eAadharStatus = 'Rejected'
            break
          case 'A':
            eAadharStatus = 'Accepted'
            break
          default:
            eAadharStatus = 'Not Uploaded'
        }

        switch (oKycDetails?.oPan?.eStatus) {
          case 'P':
            ePanStatus = 'Pending'
            break
          case 'R':
            ePanStatus = 'Rejected'
            break
          case 'A':
            ePanStatus = 'Accepted'
            break
          default:
            ePanStatus = 'Not Uploaded'
        }

        return {
          nSr_no: ++count,
          ...ele,
          dDob,
          sCityName: sCityName?.sName,
          sStateName: sStateName?.sName,
          oKycDetails,
          sBonusGiven,
          oBalanceDetails,
          nTotalPlay,
          eKycStatus,
          sPanNo,
          ePanStatus,
          sPanSubmittedDate,
          sAadhaarNo,
          eAadharStatus,
          sAadharSubmittedDate,
          dLastLeaguePlayedOnDate,
          nLeaguesPlayedCount
          // oAppsFlyer
        }
      })

      const schema = [{
        column: 'Sr.No.',
        type: Number,
        value: object => object.nSr_no,
        width: '25pt',
        align: 'center'
      },
      {
        column: 'Name \nof User',
        type: String,
        value: object => object.sName,
        width: '16.5pt',
        align: 'center'
      },
      {
        column: 'Gender',
        type: String,
        value: object => object.eGender,
        align: 'center'
      },
      {
        column: 'DOB',
        type: String,
        width: '16.5pt',
        value: object => object.dDob,
        align: 'center'
      },
      {
        column: 'State',
        type: String,
        value: object => object.sStateName,
        width: '22.5pt',
        align: 'center'
      },
      {
        column: 'City',
        type: String,
        value: object => object.sCityName,
        align: 'center',
        height: '12pt',
        span: 2
      },
      {
        column: 'Address',
        type: String,
        value: object => object.sAddress,
        align: 'center',
        width: '14.5pt'
      },
      {
        column: 'Mobile Number',
        type: String,
        value: object => object.sMobNum,
        align: 'center'
      },
      {
        column: 'Email Address',
        type: String,
        value: object => object.sEmail,
        align: 'center'
      },
      {
        column: 'KYC Status',
        type: String,
        value: object => object.eKycStatus,
        align: 'center'
      },
      {
        column: 'Aadhar Status',
        type: String,
        value: object => object.eAadharStatus,
        align: 'center'
      },
      {
        column: 'Aadhar Number',
        type: String,
        value: object => object.sAadhaarNo,
        align: 'center',
        width: '21.5pt'
      },
      {
        column: 'Aadhar Submitted Date',
        type: String,
        value: object => object.sAadharSubmittedDate,
        align: 'center'
      },
      {
        column: 'PAN Status',
        type: String,
        value: object => object.ePanStatus,
        align: 'center',
        width: '21.5pt'
      },
      {
        column: 'PAN Number',
        type: String,
        value: object => object.sPanNo,
        align: 'center'
      },
      {
        column: 'PAN Submitted Date',
        type: String,
        value: object => object.sPanSubmittedDate,
        align: 'center'
      },
      {
        column: 'Bonus Given (Y/N)',
        type: String,
        value: object => object.sBonusGiven,
        align: 'center'
      },
      {
        column: 'Total Bonus',
        type: Number,
        value: object => object.nRealUserWinningCash,
        align: 'center',
        width: '14.5pt'
      },
      {
        column: 'Available Bonus',
        type: Number,
        value: object => object.oBalanceDetails.currentBonus,
        align: 'center',
        width: '14.5pt'
      },
      {
        column: 'Available Winnings',
        type: Number,
        value: object => object.oBalanceDetails.currentWinningBalance,
        align: 'center',
        width: '14.5pt'
      },
      {
        column: 'Total Deposit',
        type: Number,
        value: object => object.oBalanceDetails.totalDeposit,
        align: 'center',
        width: '14.5pt'
      },
      {
        column: 'Available Deposit',
        type: Number,
        value: object => object.oBalanceDetails.currentDeposit,
        align: 'center'
      },
      {
        column: 'Total Play',
        type: Number,
        value: object => object.nTotalPlay,
        align: 'center',
        width: '15.5pt'
      },
      {
        column: 'Available Cash',
        type: Number,
        value: object => object.oBalanceDetails.availableCash,
        align: 'center',
        width: '15.5pt'
      },
      {
        column: 'Total Withdrawal',
        type: Number,
        value: object => object.oBalanceDetails.totalWithdrawal,
        align: 'center',
        width: '15.5pt'
      },
      {
        column: 'No. of Leagues Played',
        type: Number,
        value: object => object.nLeaguesPlayedCount,
        align: 'center',
        width: '15.5pt'
      },
      {
        column: 'Last League Played On',
        type: String,
        value: object => object?.dLastLeaguePlayedOnDate ? moment(object.dLastLeaguePlayedOnDate).format('lll') : '',
        align: 'center',
        width: '15.5pt'
      },
      /* {
        column: 'Ad Id',
        type: String,
        value: object => object?.oAppsFlyer ? object.oAppsFlyer['Advertising ID'] : '',
        align: 'center',
        width: '15.5pt'
      }, */
      {
        column: 'User Id',
        type: String,
        value: object => object?._id.toString(),
        align: 'center',
        width: '15.5pt'
      }
      ]

      const file = await createXlsxFile(schema, aNewUsers, `UserReports_${sDates}`)

      const oOptions = {
        from: `SportsBuzz11 ${config.SMTP_FROM}`,
        to: USER_REPORT_RECIEVER_EMAIL,
        subject: `User Report of ${sDates}`
      }
      await sendMailTo({ oAttachments: file, oOptions })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].user), data: { nTotal, aResult: aNewUsers } })
    } catch (err) {
      return catchError('Cron.weeklyMail', err, req, res)
    }
  }

  async getDailyMatchData(req, res) {
    try {
      const dDateTo = moment(new Date()).add(-1, 'd').endOf('day').toISOString()
      const dDateFrom = moment(new Date()).add(-1, 'd').startOf('day').toISOString()

      const dDate = moment(dDateFrom).format('DD-MM-YYYY')

      const aMatch = await MatchModel.find({ $or: [{ dWinDistAt: { $gte: dDateFrom, $lt: dDateTo } }, { dStartDate: { $gte: dDateFrom, $lte: dDateTo } }], eStatus: { $nin: ['P', 'U'] } }, { _id: 1, sName: 1, dStartDate: 1, dWinDistAt: 1, eStatus: 1, eCategory: 1 }).sort({ dStartDate: 1 }).lean()

      const aMatchId = []
      const aMatchObjectId = []
      aMatch.forEach(m => {
        if (m.eStatus === 'CMP') {
          aMatchId.push(m._id.toString())
          aMatchObjectId.push(m._id)
        }
      })

      const aTotalUniquePlayed = await PassbookModel.count({
        where: { iMatchId: { [Op.in]: aMatchId }, eTransactionType: 'Play ', eUserType: 'U' },
        attributes: [[fn('COUNT', col('id')), 'nTotal'], 'iMatchId'],
        group: 'iMatchId',
        col: 'iUserId',
        distinct: true,
        raw: true
      }) //  Total User , Active User Per Match

      const aTotalPlayedAmount = await PassbookModel.findAll({
        where: { iMatchId: { [Op.in]: aMatchId }, eTransactionType: 'Play', eUserType: 'U' },
        attributes: [[fn('sum', col('nCash')), 'nTotalCash'], [fn('sum', col('nBonus')), 'nTotalBonus'], 'iMatchId'],
        group: 'iMatchId',
        raw: true
      }) // Total Played User Amount , Bonus

      const aTotalWinAmount = await PassbookModel.findAll({
        where: { iMatchId: { [Op.in]: aMatchId }, eTransactionType: 'Win', eUserType: 'U' },
        attributes: [[fn('sum', col('nCash')), 'nTotalCash'], [fn('sum', col('nBonus')), 'nTotalBonus'], 'iMatchId'],
        group: 'iMatchId',
        raw: true
      }) // Winner AM Per Match

      const aTotalPlayReturnAmount = await PassbookModel.findAll({
        where: { iMatchId: { [Op.in]: aMatchId }, eTransactionType: 'Play-Return', eUserType: 'U' },
        attributes: [[fn('sum', col('nCash')), 'nTotalCash'], [fn('sum', col('nBonus')), 'nTotalBonus'], 'iMatchId'],
        group: 'iMatchId',
        raw: true
      }) // Play Return , Bonus return

      const aTotalCreatorBonusAmount = await PassbookModel.findAll({
        where: { iMatchId: { [Op.in]: aMatchId }, eTransactionType: 'Creator-Bonus', eUserType: 'U' },
        attributes: [[fn('sum', col('nCash')), 'nTotalCash'], [fn('sum', col('nBonus')), 'nTotalBonus'], 'iMatchId'],
        group: 'iMatchId',
        raw: true
      }) // Private league bonus

      const aTotalCashBackAmount = await PassbookModel.findAll({
        where: { iMatchId: { [Op.in]: aMatchId }, eTransactionType: 'Cashback-Contest', eUserType: 'U' },
        attributes: [[fn('sum', col('nCash')), 'nTotalCash'], [fn('sum', col('nBonus')), 'nTotalBonus'], 'iMatchId'],
        group: 'iMatchId',
        raw: true
      }) // Cashback

      const aTotalCashBackReturnAmount = await PassbookModel.findAll({
        where: { iMatchId: { [Op.in]: aMatchId }, eTransactionType: 'Cashback-Return', eUserType: 'U' },
        attributes: [[fn('sum', col('nCash')), 'nTotalCash'], [fn('sum', col('nBonus')), 'nTotalBonus'], 'iMatchId'],
        group: 'iMatchId',
        raw: true
      }) // Cashback return

      const aTDSAmount = await PassbookModel.findAll({
        where: { iMatchId: { [Op.in]: aMatchId }, eTransactionType: 'TDS', eUserType: 'U' },
        attributes: [[fn('sum', col('nCash')), 'nTotalCash'], 'iMatchId'],
        group: 'iMatchId',
        raw: true
      }) // TDS

      const [aTotalMatchLeague, aCancelledMatchLeague, aRunMatchLeague, aPromoCodeAmount] = await Promise.all([
        MatchLeagueModel.aggregate([
          { $match: { iMatchId: { $in: aMatchObjectId } } },
          { $group: { _id: '$iMatchId', nTotal: { $sum: 1 } } }
        ]).allowDiskUse(bAllowDiskUse), // Total league
        MatchLeagueModel.aggregate([
          { $match: { iMatchId: { $in: aMatchObjectId }, bCancelled: true } },
          { $group: { _id: '$iMatchId', nTotal: { $sum: 1 } } }
        ]).allowDiskUse(bAllowDiskUse), // Cancel League
        MatchLeagueModel.aggregate([
          { $match: { iMatchId: { $in: aMatchObjectId }, bCancelled: false } },
          { $group: { _id: '$iMatchId', nTotal: { $sum: 1 } } }
        ]).allowDiskUse(bAllowDiskUse), // League (Per Match)
        PromocodeStatisticsModel.aggregate([
          { $match: { iMatchId: { $in: aMatchObjectId } } },
          { $group: { _id: '$iMatchId', nTotalAmount: { $sum: 1 } } }
        ]).allowDiskUse(bAllowDiskUse) // Promo code amount
      ])

      const oStatus = { P: 'Pending', U: 'Upcoming', L: 'Live', CMP: 'Completed', CNCL: 'Cancel', I: 'Inreview' }

      const oData = {
        sName: 'Total',
        nUniqueUser: 0,
        nUser: 0,
        nPlayCash: 0,
        nPlayBonus: 0,
        nWinCash: 0,
        nWinBonus: 0,
        nPlayReturnCash: 0,
        nPlayReturnBonus: 0,
        nProfit: 0,
        nCreatorBonusCash: 0,
        nCreatorBonus: 0,
        nCashBackCash: 0,
        nCashBackBonus: 0,
        nCashBackReturnCash: 0,
        nCashBackReturnBonus: 0,
        nMatchLeague: 0,
        nCancelMatchLeague: 0,
        nRunMatchLeague: 0,
        nPromoAmount: 0,
        nTDS: 0
      }

      const oTotal = { oCricket: { ...oData }, oFootBall: { ...oData } }

      for (const oMatch of aMatch) {
        const oUser = aTotalUniquePlayed[aTotalUniquePlayed.findIndex(p => p.iMatchId === oMatch._id.toString())]
        const oPlay = aTotalPlayedAmount[aTotalPlayedAmount.findIndex(p => p.iMatchId === oMatch._id.toString())]
        const oWin = aTotalWinAmount[aTotalWinAmount.findIndex(p => p.iMatchId === oMatch._id.toString())]
        const oPlayReturn = aTotalPlayReturnAmount[aTotalPlayReturnAmount.findIndex(p => p.iMatchId === oMatch._id.toString())]
        const oCreatorBonus = aTotalCreatorBonusAmount[aTotalCreatorBonusAmount.findIndex(p => p.iMatchId === oMatch._id.toString())]
        const oCashback = aTotalCashBackAmount[aTotalCashBackAmount.findIndex(p => p.iMatchId === oMatch._id.toString())]
        const oCashbackReturn = aTotalCashBackReturnAmount[aTotalCashBackReturnAmount.findIndex(p => p.iMatchId === oMatch._id.toString())]
        const oTDS = aTDSAmount[aTDSAmount.findIndex(p => p.iMatchId === oMatch._id.toString())]
        const oTotalMatchLeague = aTotalMatchLeague[aTotalMatchLeague.findIndex(p => p._id.toString() === oMatch._id.toString())]
        const oCancelMatchLeague = aCancelledMatchLeague[aCancelledMatchLeague.findIndex(p => p._id.toString() === oMatch._id.toString())]
        const oRunMatchLeague = aRunMatchLeague[aRunMatchLeague.findIndex(p => p._id.toString() === oMatch._id.toString())]
        const oPromoAmount = aPromoCodeAmount[aPromoCodeAmount.findIndex(p => p._id.toString() === oMatch._id.toString())]

        oMatch.eStatus = oStatus[oMatch.eStatus] || 'Completed'
        oMatch.dStartDate = moment(oMatch.dStartDate).format('DD-MM-YYYY')
        oMatch.dWinDistAt = moment(oMatch.dWinDistAt).format('DD-MM-YYYY')
        oMatch.nUniqueUser = oUser?.count || 0
        oMatch.nUser = oUser?.nTotal || 0
        oMatch.nPlayCash = oPlay?.nTotalCash || 0
        oMatch.nPlayBonus = oPlay?.nTotalBonus || 0
        oMatch.nWinCash = oWin?.nTotalCash || 0
        oMatch.nWinBonus = oWin?.nTotalBonus || 0
        oMatch.nPlayReturnCash = oPlayReturn?.nTotalCash || 0
        oMatch.nPlayReturnBonus = oPlayReturn?.nTotalBonus || 0
        oMatch.nProfit = convertToDecimal((oPlay?.nTotalCash || 0) - (oPlayReturn?.nTotalCash || 0) - (oWin?.nTotalCash || 0))
        oMatch.nCreatorBonusCash = oCreatorBonus?.nTotalCash || 0
        oMatch.nCreatorBonus = oCreatorBonus?.nTotalBonus || 0
        oMatch.nCashBackCash = oCashback?.nTotalCash || 0
        oMatch.nCashBackBonus = oCashback?.nTotalBonus || 0
        oMatch.nCashBackReturnCash = oCashbackReturn?.nTotalCash || 0
        oMatch.nCashBackReturnBonus = oCashbackReturn?.nTotalBonus || 0
        oMatch.nMatchLeague = oTotalMatchLeague?.nTotal || 0
        oMatch.nCancelMatchLeague = oCancelMatchLeague?.nTotal || 0
        oMatch.nRunMatchLeague = oRunMatchLeague?.nTotal || 0
        oMatch.nPromoAmount = oPromoAmount?.nTotalAmount || 0
        oMatch.nTDS = oTDS?.nTotalCash || 0

        // Total Calculation
        const sCategory = oMatch?.eCategory === 'FOOTBALL' ? 'oFootBall' : 'oCricket'
        oTotal[sCategory].nUniqueUser = convertToDecimal(oTotal[sCategory].nUniqueUser + (oUser?.count || 0))
        oTotal[sCategory].nUser = convertToDecimal(oTotal[sCategory].nUser + (oUser?.nTotal || 0))
        oTotal[sCategory].nPlayCash = convertToDecimal(oTotal[sCategory].nPlayCash + (oPlay?.nTotalCash || 0))
        oTotal[sCategory].nPlayBonus = convertToDecimal(oTotal[sCategory].nPlayBonus + (oPlay?.nTotalBonus || 0))
        oTotal[sCategory].nWinCash = convertToDecimal(oTotal[sCategory].nWinCash + (oWin?.nTotalCash || 0))
        oTotal[sCategory].nWinBonus = convertToDecimal(oTotal[sCategory].nWinBonus + (oWin?.nTotalBonus || 0))
        oTotal[sCategory].nPlayReturnCash = convertToDecimal(oTotal[sCategory].nPlayReturnCash + (oPlayReturn?.nTotalCash || 0))
        oTotal[sCategory].nPlayReturnBonus = convertToDecimal(oTotal[sCategory].nPlayReturnBonus + (oPlayReturn?.nTotalBonus || 0))
        oTotal[sCategory].nProfit = convertToDecimal(oTotal[sCategory].nProfit + (oMatch?.nProfit || 0))
        oTotal[sCategory].nCreatorBonusCash = convertToDecimal(oTotal[sCategory].nCreatorBonusCash + (oCreatorBonus?.nTotalCash || 0))
        oTotal[sCategory].nCreatorBonus = convertToDecimal(oTotal[sCategory].nCreatorBonus + (oCreatorBonus?.nTotalBonus || 0))
        oTotal[sCategory].nCashBackCash = convertToDecimal(oTotal[sCategory].nCashBackCash + (oCashback?.nTotalCash || 0))
        oTotal[sCategory].nCashBackBonus = convertToDecimal(oTotal[sCategory].nCashBackBonus + (oCashback?.nTotalBonus || 0))
        oTotal[sCategory].nCashBackReturnCash = convertToDecimal(oTotal[sCategory].nCashBackReturnCash + (oCashbackReturn?.nTotalCash || 0))
        oTotal[sCategory].nCashBackReturnBonus = convertToDecimal(oTotal[sCategory].nCashBackReturnBonus + (oCashbackReturn?.nTotalBonus || 0))
        oTotal[sCategory].nMatchLeague = convertToDecimal(oTotal[sCategory].nMatchLeague + (oTotalMatchLeague?.nTotal || 0))
        oTotal[sCategory].nCancelMatchLeague = convertToDecimal(oTotal[sCategory].nCancelMatchLeague + (oCancelMatchLeague?.nTotal || 0))
        oTotal[sCategory].nRunMatchLeague = convertToDecimal(oTotal[sCategory].nRunMatchLeague + (oRunMatchLeague?.nTotal || 0))
        oTotal[sCategory].nPromoAmount = convertToDecimal(oTotal[sCategory].nPromoAmount + (oPromoAmount?.nTotalAmount || 0))
        oTotal[sCategory].nTDS = convertToDecimal(oTotal[sCategory].nTDS + (oTDS?.nTotalCash || 0))
      }

      const aCricketMatch = aMatch.filter(m => m.eCategory === 'CRICKET')
      const aFootBallMatch = aMatch.filter(m => m.eCategory === 'FOOTBALL')

      aCricketMatch.push(oTotal.oCricket)
      aFootBallMatch.push(oTotal.oFootBall)

      const schema = [{
        column: 'Date',
        type: String,
        value: object => object.dStartDate,
        width: '25pt',
        align: 'center'
      },
      {
        column: 'Match Name',
        type: String,
        value: object => object.sName,
        width: '16.5pt',
        align: 'center'
      },
      {
        column: 'Match Status',
        type: String,
        value: object => object.eStatus,
        width: '16.5pt',
        align: 'center'
      },
      {
        column: 'Total User',
        type: Number,
        value: object => object.nUser,
        align: 'center'
      },
      {
        column: 'Active User Per Match',
        type: Number,
        width: '16.5pt',
        value: object => object.nUniqueUser,
        align: 'center'
      },
      {
        column: 'League (Per Match)',
        type: Number,
        value: object => object.nRunMatchLeague,
        width: '22.5pt',
        align: 'center'
      },
      {
        column: 'Cancel League',
        type: Number,
        value: object => object.nCancelMatchLeague,
        align: 'center',
        height: '12pt',
        span: 2
      },
      {
        column: 'Total league',
        type: Number,
        value: object => object.nMatchLeague,
        align: 'center',
        width: '14.5pt'
      },
      {
        column: 'Total Played User Amount',
        type: Number,
        value: object => object.nPlayCash,
        align: 'center'
      },
      {
        column: 'Winner AM Per Match',
        type: Number,
        value: object => object.nWinCash,
        align: 'center'
      },
      {
        column: 'Play Return',
        type: Number,
        value: object => object.nPlayReturnCash,
        align: 'center'
      },
      {
        column: 'Profit/Loss',
        type: Number,
        value: object => object.nProfit,
        align: 'center'
      },
      {
        column: 'TDS',
        type: Number,
        value: object => object.nTDS,
        align: 'center'
      },
      {
        column: 'Promo code amount',
        type: Number,
        value: object => object.nPromoAmount,
        align: 'center'
      },
      {
        column: 'Cashback',
        type: Number,
        value: object => object.nCashBackCash,
        align: 'center',
        width: '21.5pt'
      },
      {
        column: 'Cashback return',
        type: Number,
        value: object => object.nCashBackReturnCash,
        align: 'center'
      },
      {
        column: 'Private league bonus (Cash)',
        type: Number,
        value: object => object.nCreatorBonusCash,
        align: 'center',
        width: '21.5pt'
      },
      {
        column: 'Bonus',
        type: Number,
        value: object => object.nPlayBonus,
        align: 'center'
      },
      {
        column: 'Bonus return',
        type: Number,
        value: object => object.nPlayReturnBonus,
        align: 'center'
      },
      {
        column: 'Win Bonus',
        type: Number,
        value: object => object.nWinBonus,
        align: 'center'
      },
      {
        column: 'CashBack Bonus',
        type: Number,
        value: object => object.nCashBackBonus,
        align: 'center'
      },
      {
        column: 'Cashback return Bonus',
        type: Number,
        value: object => object.nCashBackReturnBonus,
        align: 'center'
      },
      {
        column: 'Private league bonus',
        type: Number,
        value: object => object.nCreatorBonus,
        align: 'center',
        width: '21.5pt'
      }
      ]

      const oCricket = await createXlsxFile(schema, aCricketMatch, `Match_Report_Cricket_${dDate}`)
      const oFootball = await createXlsxFile(schema, aFootBallMatch, `Match_Report_Football_${dDate}`)

      const oOptions = {
        from: `SportsBuzz11 ${config.SMTP_FROM}`,
        to: MATCH_REPORT_EMAIL,
        subject: `Match Transaction consolidated report ${dDate}`
      }
      await sendMailTo({ oAttachments: [oCricket, oFootball], oOptions })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].sent_success.replace('##', messages[req.userLanguage].creport) })
    } catch (error) {
      return catchError('Cron.getDailyMatchData', error, req, res)
    }
  }

  async backupOldAdminLogs(req, res) {
    try {
      const dRemoveDate = new Date()
      dRemoveDate.setDate(dRemoveDate.getDate() - 30)
      const aBackupLogs = []

      AdminLogModel.find({ dCreatedAt: { $lt: dRemoveDate } }).lean().cursor()
        .on('data', async (oAdminLog) => {
          try {
            aBackupLogs.push(oAdminLog)
            if (aBackupLogs.length >= 5000) {
              await BackupAdminLogsModel.insertMany(aBackupLogs.splice(0, 5000))
            }
          } catch (error) {
            handleCatchError(error)
          }
        })
        .on('end', async () => {
          try {
            if (aBackupLogs.length) {
              await BackupAdminLogsModel.insertMany(aBackupLogs)
            }
            await AdminLogModel.deleteMany({ dCreatedAt: { $lt: dRemoveDate } })
          } catch (error) {
            handleCatchError(error)
          }
        })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].old_admin_logs_backup })
    } catch (error) {
      handleCatchError(error)
    }
  }

  // finding old bot logs, bot combination logs and copy team logs removing from main db and inserting in backup db
  async backupOldBotLogs(req, res) {
    try {
      const dRemoveDate = new Date()
      dRemoveDate.setDate(dRemoveDate.getDate() - 60)
      // For botlogs backup
      const aBackupBotLogs = []
      BotLogModel.find({ dUpdatedAt: { $lt: dRemoveDate } }).lean().cursor()
        .on('data', async (oBotLog) => {
          try {
            aBackupBotLogs.push(oBotLog)
            if (aBackupBotLogs.length >= 5000) {
              await BackupBotLogModel.insertMany(aBackupBotLogs.splice(0, 5000))
            }
          } catch (error) {
            handleCatchError(error)
          }
        })
        .on('end', async () => {
          try {
            if (aBackupBotLogs.length) {
              console.log(aBackupBotLogs.length)
              await BackupBotLogModel.insertMany(aBackupBotLogs)
            }
            await BotLogModel.deleteMany({ dUpdatedAt: { $lt: dRemoveDate } })
          } catch (error) {
            handleCatchError(error)
          }
        })

      // for botcombinationlogs backup
      const aBackupBotCombinationLogs = []
      BotCombinationLogModel.find({ dUpdatedAt: { $lt: dRemoveDate } }).lean().cursor()
        .on('data', async (oBotCombinationLog) => {
          try {
            aBackupBotCombinationLogs.push(oBotCombinationLog)
            if (aBackupBotCombinationLogs.length >= 5000) {
              await BackupBotCombinationLogModel.insertMany(aBackupBotCombinationLogs.splice(0, 5000))
            }
          } catch (error) {
            handleCatchError(error)
          }
        })
        .on('end', async () => {
          try {
            if (aBackupBotCombinationLogs.length) {
              await BackupBotCombinationLogModel.insertMany(aBackupBotCombinationLogs)
            }
            await BotCombinationLogModel.deleteMany({ dUpdatedAt: { $lt: dRemoveDate } })
          } catch (error) {
            handleCatchError(error)
          }
        })

      // for botcombinationlogs backup
      const aBackupCopyBotLogs = []
      CopyTeamLogModel.find({ dUpdatedAt: { $lt: dRemoveDate } }).lean().cursor()
        .on('data', async (oCopyTeamLog) => {
          try {
            aBackupCopyBotLogs.push(oCopyTeamLog)
            if (aBackupCopyBotLogs.length >= 5000) {
              await BackupCopyTeamLogModel.insertMany(aBackupCopyBotLogs.splice(0, 5000))
            }
          } catch (error) {
            handleCatchError(error)
          }
        })
        .on('end', async () => {
          try {
            if (aBackupCopyBotLogs.length) {
              await BackupCopyTeamLogModel.insertMany(aBackupCopyBotLogs)
            }
            await CopyTeamLogModel.deleteMany({ dUpdatedAt: { $lt: dRemoveDate } })
          } catch (error) {
            handleCatchError(error)
          }
        })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].old_bot_logs_backup })
    } catch (error) {
      handleCatchError(error)
    }
  }

  async fillSetOfSystemUsers(req, res) {
    try {
      const aSystemUsers = []

      UsersModel.find({ eType: USER_ENUM.BOT }, { _id: 1, sName: 1, sUsername: 1, eType: 1 }, { readPreference: REPLICA_ENUM.SECONDARY_PREFERRED }).lean().cursor()
        .on('data', async (user) => {
          aSystemUsers.push(JSON.stringify(user))
          if (aSystemUsers.length >= 10000) await redisClient.sadd('SystemUsers', ...aSystemUsers.splice(0, 10000))
        }).on('end', async () => {
          if (aSystemUsers.length) await redisClient.sadd('SystemUsers', ...aSystemUsers)
        })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK })
    } catch (error) {
      handleCatchError(error)
    }
  }

  async deleteMyMatches(req, res) {
    try {
      const dRemoveDate = new Date()
      dRemoveDate.setDate(dRemoveDate.getDate() - 15)
      await MyMatchesModel.deleteMany({ eType: USER_ENUM.BOT, dCreatedAt: { $lt: dRemoveDate } })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].old_bot_logs_backup })
    } catch (error) {
      return catchError('Cron.deleteMyMatches', error, req, res)
    }
  }

  async userLeagueReportCsv(req, res) {
    try {
      const dDateTo = moment(new Date()).add(-1, 'd').endOf('day').toISOString()
      const dDateFrom = moment(new Date()).add(-1, 'd').startOf('day').toISOString()

      const dDate = moment(dDateFrom).format('DD-MM-YYYY')
      const matchesInBetweenDates = await this.findMatchByTimePeriod(dDateFrom, dDateTo)
      if (!matchesInBetweenDates) return []
      let csvString = ''
      csvString = csvString + 'Match Date,Match Name,League Name,League Count,UsersTeam for leagues,Unique User,League Executed,League Canceled,User Amount for League,Winner Users Count,Promocode Amount,Play Return,Bonus Return,Bonus Used,Winner User Amount,Private League Bonus,Tds Amount,Profit'
      console.log(matchesInBetweenDates.length)
      // matchesInBetweenDates.forEach(match => this.getLeaguesReportForAllMatches(match))
      for (const eachMatch of matchesInBetweenDates) {
        const csvData = await this.getLeaguesReportForAllMatches(eachMatch)
        csvString = csvString + csvData
      }

      const oOptions = {
        from: `SportsBuzz11 League ${config.SMTP_FROM}`,
        to: MATCH_REPORT_EMAIL,
        subject: `League Transaction consolidated report ${dDate}`
      }
      const attachmentFileObject = {
        filename: 'userLeagueReport.csv',
        content: csvString
      }
      console.log('complete')
      await sendMailTo({ oAttachments: [attachmentFileObject], oOptions })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: 'Day League Report is Done' })
    } catch (error) {
      return catchError('Cron.userLeagueReportCsv', error, req, res)
    }
  }

  async findMatchByTimePeriod(fromDate, toDate) {
    console.log('time', fromDate, toDate)
    const dayMatches = await MatchModel.find(
      {
        $or: [{ dWinDistAt: { $gte: fromDate, $lt: toDate } }, { dStartDate: { $gte: fromDate, $lte: toDate } }],
        eStatus: 'CMP'
      }
    ).sort({ dStartDate: 1 }).lean()
    return dayMatches
  }

  async getLeaguesReportForAllMatches(match) {
    const getMatchLeagueDetails = await MatchLeagueModel.aggregate([{ $match: { iMatchId: new ObjectId(match._id) } },
      { $group: { _id: '$sLeagueCategory', leagueCount: { $sum: 1 }, leagueIds: { $push: '$_id' } } }
    ])

    let csvStringForMatch = ''

    for (const eachMatchLeagues of getMatchLeagueDetails) {
      if (!eachMatchLeagues.leagueIds.length) continue
      let leagueName = ''
      let totalUserTeams = 0
      const usersCount = {}
      let passLeagues = 0
      let cancelLeagues = 0
      let userAmount = 0
      let winnerAmount = 0
      let playReturnAmount = 0
      let bonusUsed = 0
      let bonusReturnUsed = 0
      let privateLeagueBonus = 0
      let winnerUsers = 0
      let promocode = 0
      let tdsAmount = 0
      for (const eachLeague of eachMatchLeagues.leagueIds) {
        const leagueData = await MatchLeagueModel.findOne({
          _id: new ObjectId(eachLeague.toString())
        })
        if (!eachMatchLeagues._id) leagueName = 'Private League'
        if (leagueData.bCancelled) cancelLeagues++
        else passLeagues++

        const LeagueData = await PassbookModel.findAll({
          group: ['eTransactionType'],
          where: { iMatchLeagueId: eachLeague.toString(), eStatus: 'CMP', eUserType: 'U' },
          attributes: [
            [sequelize.fn('SUM', sequelize.col('nAmount')), 'nAmount'],
            [sequelize.fn('SUM', sequelize.col('nBonus')), 'nBonus'],
            [sequelize.fn('SUM', sequelize.col('nCash')), 'nCash'],
            [sequelize.fn('COUNT', sequelize.col('*')), 'Count'], 'eTransactionType']
        })

        const winObject = LeagueData.find(e => e.eTransactionType === 'Win')
        const playObject = LeagueData.find(e => e.eTransactionType === 'Play')
        const playReturnObject = LeagueData.find(e => e.eTransactionType === 'Play-Return')
        const tdsReturnObject = LeagueData.find(e => e.eTransactionType === 'TDS')

        playReturnAmount = playReturnAmount + (playReturnObject?.dataValues?.nCash ? playReturnObject.dataValues.nCash : 0)
        bonusReturnUsed = bonusReturnUsed + (playReturnObject?.dataValues?.nBonus ? playReturnObject.dataValues.nBonus : 0)
        userAmount = userAmount + (playObject?.dataValues?.nCash ? playObject.dataValues.nCash : 0)
        bonusUsed = bonusUsed + (playObject?.dataValues?.nBonus ? playObject.dataValues.nBonus : 0)
        tdsAmount = tdsAmount + (tdsReturnObject?.dataValues?.nCash ? tdsReturnObject.dataValues.nCash : 0)
        if (leagueData.bPrivateLeague) {
          privateLeagueBonus = privateLeagueBonus + (playObject?.dataValues?.nBonus ? playObject.dataValues.nBonus : 0)
        }
        winnerUsers = winnerUsers + (winObject?.dataValues?.Count ? winObject.dataValues.Count : 0)
        winnerAmount = winnerAmount + (winObject?.dataValues?.nCash ? winObject.dataValues.nCash : 0)

        const totalUserTeam = await UserLeagueModel.countDocuments({ iMatchLeagueId: eachLeague, eType: 'U' })
        totalUserTeams = totalUserTeams + totalUserTeam

        const usersLeague = await UserLeagueModel.find({ iMatchLeagueId: eachLeague, eType: 'U' }, { iUserId: 1, _id: 0 })
        for (const eachUser of usersLeague) {
          if (usersCount[eachUser.iUserId.toString()]) continue
          usersCount[eachUser.iUserId.toString()] = 1
          promocode = promocode + (eachUser.nPromoDiscount ? Number(eachUser.nPromoDiscount) : 0)
        }
      }
      const string = `${match.dStartDate.toLocaleDateString()},${match.sName},${eachMatchLeagues._id ? eachMatchLeagues._id : leagueName},${eachMatchLeagues.leagueCount},${totalUserTeams},${Object.keys(usersCount).length},${passLeagues},${cancelLeagues},${userAmount},${winnerUsers},${promocode},${playReturnAmount},${bonusReturnUsed},${bonusUsed},${winnerAmount},${privateLeagueBonus},${tdsAmount},${userAmount - (winnerAmount + playReturnAmount)}`
      csvStringForMatch = csvStringForMatch + `\n${string}`
      // break;
    }

    return csvStringForMatch
  }

  async deleteCopyBotUpdateLogs(req, res) {
    try {
      const dRemoveDate = new Date()
      dRemoveDate.setDate(dRemoveDate.getDate() - 7)
      await CopyTeamUpdateLogModel.deleteMany({ dCreatedAt: { $lt: dRemoveDate } })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].old_bot_logs_deleted })
    } catch (error) {
      return catchError('Cron.deleteMyMatches', error, req, res)
    }
  }
}
// to calculate the overall, captain and vice captain percentage of the player's selection
async function matchWiseSetByV2(data) {
  try {
    console.log(':======== Inside MatchWise Function ========:')
    for (const item of data) {
      const { _id } = item
      const teams = await UserTeamModel.countDocuments({ iMatchId: _id })

      const aSetByQuery = []

      // for setBy
      aSetByQuery.push(UserTeamModel.aggregate([
        {
          $match: { iMatchId: _id }
        },
        {
          $lookup: {
            from: 'matchteams',
            localField: 'sHash',
            foreignField: 'sHash',
            as: 'players'
          }
        },
        {
          $project: {
            iMatchId: 1,
            aPlayers: {
              $arrayElemAt: ['$players.aPlayers', 0]
            }
          }
        },
        {
          $unwind: {
            path: '$aPlayers'
          }
        },
        {
          $group: {
            _id: '$aPlayers.iMatchPlayerId',
            noOfSetPlayer: { $sum: 1 }
          }
        },
        {
          $project: {
            setBy: {
              $multiply: [
                { $round: [{ $divide: ['$noOfSetPlayer', teams] }, 2] },
                100
              ]
            }
          }
        }
      ]).allowDiskUse(bAllowDiskUse).exec())

      // for setCapAndViceCap
      aSetByQuery.push(UserTeamModel.aggregate([
        {
          $match: { iMatchId: _id }
        },
        {
          $facet: {
            cap: [
              {
                $group: {
                  _id: '$iCaptainId',
                  NoOfCap: { $sum: 1 }
                }
              },
              {
                $project: {
                  setByCap: {
                    $multiply: [
                      { $round: [{ $divide: ['$NoOfCap', teams] }, 2] }, 100
                    ]
                  }
                }
              }
            ],
            viceCap: [
              {
                $group: {
                  _id: '$iViceCaptainId',
                  NoOfViceCap: { $sum: 1 }
                }
              },
              {
                $project: {
                  setByViceCap: {
                    $multiply: [
                      { $round: [{ $divide: ['$NoOfViceCap', teams] }, 2] },
                      100
                    ]
                  }
                }
              }
            ]
          }
        },
        {
          $project: {
            all: { $concatArrays: ['$cap', '$viceCap'] }
          }
        },
        {
          $unwind: {
            path: '$all',
            preserveNullAndEmptyArrays: false
          }
        },
        {
          $replaceRoot: { newRoot: '$all' }
        }
      ]).allowDiskUse(bAllowDiskUse).exec())

      const [set, setCapAndViceCap] = await Promise.all(aSetByQuery)

      const result = [...set, ...setCapAndViceCap]
      console.log(`:==== Set Data of Match:${_id}, Result: ${result.length}`)
      const aBulkMatchPlayer = []
      for (const player of result) {
        const setObj = {}
        const { setByCap, setByViceCap, setBy } = player
        if (setBy) {
          setObj.nSetBy = Number(setBy.toFixed(2))
        } else if (setByCap) {
          setObj.nCaptainBy = Number(setByCap.toFixed(2))
        } else if (setByViceCap) {
          setObj.nViceCaptainBy = Number(setByViceCap.toFixed(2))
        }

        aBulkMatchPlayer.push({
          updateOne: {
            filter: { _id: player._id },
            update: { $set: { ...setObj, dUpdatedAt: Date.now() } }
          }
        })
      }
      console.log(`:==== Update Data of MatchPlayers:${_id}, Result: ${aBulkMatchPlayer.length}`)
      await MatchPlayerModel.bulkWrite(aBulkMatchPlayer)
    }
  } catch (error) {
    handleCatchError(error)
  }
}

module.exports = new Cron()

async function generateMatchReport(aMatchId, aMatchLeagueId) {
  try {
    const aData = await UserLeagueModel.aggregate([
      { $match: { iMatchId: { $in: aMatchId }, bCancelled: false } },
      {
        $group:
        {
          _id: { iMatchId: '$iMatchId', iUserId: '$iUserId' },
          nLeagueJoinAmount: { $sum: '$nPricePaid' },
          nBonusUtil: { $sum: '$actualBonusUsed' },
          nLeagueJoin: { $sum: 1 },
          nTotalEarned: { $sum: '$nPrice' }
        }
      },
      {
        $facet:
        {
          aTopSpendUser: [
            { $sort: { nLeagueJoinAmount: -1 } },
            { $limit: 10 }
          ],
          aTopEarnedUser: [
            { $match: { nTotalEarned: { $gt: 0 } } },
            { $sort: { nTotalEarned: -1 } },
            { $limit: 10 }
          ],
          aTopLossUser: [
            { $addFields: { nTotalLoss: { $subtract: ['$nLeagueJoinAmount', '$nTotalEarned'] } } },
            { $sort: { nTotalLoss: -1 } },
            { $limit: 10 }
          ]
        }
      }
    ]).allowDiskUse(bAllowDiskUse).exec()

    if (aData && aData.length) {
      let { aTopSpendUser, aTopEarnedUser, aTopLossUser } = aData[0]

      const aTopSpendUserId = aTopSpendUser.map(u => u._id.iUserId)
      const aTopEarnedUserId = aTopEarnedUser.map(u => u._id.iUserId)
      const aTopLossUserId = aTopLossUser.map(u => u._id.iUserId)

      const aUserId = [...aTopSpendUserId, ...aTopEarnedUserId, ...aTopLossUserId]

      let [aUserTeamCount, aUser, aMatch, aUserTds] = await Promise.all([
        UserTeamModel.aggregate([
          { $match: { iMatchId: { $in: aMatchId }, iUserId: { $in: aUserId } } },
          { $group: { _id: { iMatchId: '$iMatchId', iUserId: '$iUserId' }, nTotal: { $sum: 1 } } }
        ]).allowDiskUse(bAllowDiskUse),
        UserModel.find({ _id: { $in: aUserId } }, { sUsername: 1, sEmail: 1, sMobNum: 1, eType: 1 }).lean(),
        MatchModel.find({ _id: { $in: aMatchId } }, { sName: 1 }).lean(),
        UserTdsModel.findAll({ where: { iMatchLeagueId: { [Op.in]: aMatchLeagueId } }, attributes: ['iUserId', 'iMatchLeagueId', 'nPercentage', 'nOriginalAmount', 'nAmount', 'nActualAmount'], raw: true })
      ])

      const aUserTdsMatchLeague = []
      aUserTds.forEach(t => aUserTdsMatchLeague.push(t.iMatchLeagueId))

      const aTdsMatch = await MatchLeagueModel.find({ _id: { $in: aUserTdsMatchLeague } }, { iMatchId: 1 }).lean()

      aUserTds = aUserTds.map(t => {
        const oMatch = aTdsMatch.find(m => m._id.toString() === t.iMatchLeagueId.toString())
        return { ...t, iMatchId: oMatch.iMatchId }
      })

      const oMatch = {}
      aMatch.forEach(m => { oMatch[m._id] = m.sName })

      const addFields = (aData, aUserTeamCount, aUser, oMatch) => {
        return aData.map((user, i) => {
          const nTeam = aUserTeamCount[aUserTeamCount.findIndex(t => t._id.iUserId.toString() === user._id.iUserId.toString() && t._id.iMatchId.toString() === user._id.iMatchId.toString())]?.nTotal || 0
          const oUser = aUser[aUser.findIndex(u => u._id.toString() === user._id.iUserId.toString())]
          const oTds = aUserTds.find(t => t.iMatchId.toString() === user._id.iMatchId.toString() && t.iUserId.toString() === user._id.iUserId.toString())
          return { nSr_no: i + 1, ...user, nTeam, ...oUser, sMatchName: oMatch[user._id.iMatchId.toString()], nTotalActualEarned: oTds ? oTds.nActualAmount.toString() : '', nTdsAmount: oTds ? oTds.nAmount.toString() : '' }
        })
      }

      aTopSpendUser = addFields(aTopSpendUser, aUserTeamCount, aUser, oMatch)
      aTopEarnedUser = addFields(aTopEarnedUser, aUserTeamCount, aUser, oMatch)
      aTopLossUser = addFields(aTopLossUser, aUserTeamCount, aUser, oMatch)

      return { aTopSpendUser, aTopEarnedUser, aTopLossUser }
    }
  } catch (error) {
    handleCatchError(error)
  }
}

function setData(data, oDepositData, iosData) {
  const sMediaSource = 'Media Source (pid)'
  const sCampaign = 'Campaign (c)'
  const sRegistration = 'af_complete_registration (Unique users)'
  const sDeposit = 'custom_purchase_deposit (Unique users)'
  const sKyc = 'custom_kyc_update (Unique users)'
  if (iosData) {
    data.Clicks = iosData.Clicks ? (parseInt(data.Clicks) || 0) + (parseInt(iosData.Clicks) || 0) : 0
    data.Installs = iosData.Installs ? (parseInt(data.Installs) || 0) + (parseInt(iosData.Installs) || 0) : 0
    data[sRegistration] = iosData[sRegistration] ? (parseInt(data[sRegistration]) || 0) + (parseInt(iosData[sRegistration]) || 0) : 0
    data[sDeposit] = iosData[sDeposit] ? (parseInt(data[sDeposit]) || 0) + (parseInt(iosData[sDeposit]) || 0) : 0
    data[sKyc] = iosData[sKyc] ? (parseInt(data[sKyc]) || 0) + (parseInt(iosData[sKyc]) || 0) : 0
  } else {
    data.Clicks = parseInt(data.Clicks) || 0
    data.Installs = parseInt(data.Installs) || 0
    data[sRegistration] = parseInt(data[sRegistration]) || 0
    data[sDeposit] = parseInt(data[sDeposit]) || 0
    data[sKyc] = parseInt(data[sKyc]) || 0
  }
  data.nTotalDepositAmount = data[sMediaSource] && oDepositData[data[sMediaSource]] && oDepositData[data[sMediaSource]][data[sCampaign]] ? oDepositData[data[sMediaSource]][data[sCampaign]].nTotalDeposit : 0
  data.nFirstTotalDeposit = data[sMediaSource] && oDepositData[data[sMediaSource]] && oDepositData[data[sMediaSource]][data[sCampaign]] ? oDepositData[data[sMediaSource]][data[sCampaign]].nFirstTotalDeposit : 0
  data.nFirstTotalDepositCount = data[sMediaSource] && oDepositData[data[sMediaSource]] && oDepositData[data[sMediaSource]][data[sCampaign]] ? oDepositData[data[sMediaSource]][data[sCampaign]].nFirstTotalDepositCount : 0
  data.nTotalDepositCount = data[sMediaSource] && oDepositData[data[sMediaSource]] && oDepositData[data[sMediaSource]][data[sCampaign]] ? oDepositData[data[sMediaSource]][data[sCampaign]].nTotalDepositCount : 0
  data.aDepositUserId = data[sMediaSource] && oDepositData[data[sMediaSource]] && oDepositData[data[sMediaSource]][data[sCampaign]] ? oDepositData[data[sMediaSource]][data[sCampaign]].aDepositUserId : []
  data.aRegisterUserId = data[sMediaSource] && oDepositData[data[sMediaSource]] && oDepositData[data[sMediaSource]][data[sCampaign]] ? oDepositData[data[sMediaSource]][data[sCampaign]].aRegisterUserId : []
}

async function invokeAutoFillQueue(aQueue) {
  try {
    const aPromises = aQueue.map(async (sQueue) => {
      const nQueueLen = await queueLen(sQueue)
      let nTotal = Number(nQueueLen)

      while (nTotal > 0) {
        let data = await bulkQueuePop(sQueue, 100)
        data = data.map(d => JSON.parse(d))

        await Promise.all(data.map((team) => join(team)))
        nTotal -= 100
      }
    })
    await Promise.all(aPromises)
  } catch (error) {
    handleCatchError(error)
  }
}

async function join(payload) {
  let session
  try {
    const { iUserId, iUserTeamId, iMatchLeagueId, bPrivateLeague = false, sType = 'B', iBotLogId } = payload

    const bAlreadyJoined = await checkTeamJoined(iUserId, iUserTeamId, iMatchLeagueId)
    if (bAlreadyJoined === 'EXIST') return { bSuccess: false, status: jsonStatus.BadRequest, message: messages.English.user_already_joined, data: { type: 'redis_user_already_joined' } }

    const query = { _id: ObjectId(iMatchLeagueId), bCancelled: false, bPrivateLeague: false }

    const matchLeague = await MatchLeagueModel.findOne(query, { nAutoFillSpots: 0, bCopyBotInit: 0, dCreatedAt: 0, dUpdatedAt: 0, sShareCode: 0, bIsProcessed: 0, bPlayReturnProcess: 0, sFairPlay: 0, bWinningDone: 0, bPrizeDone: 0, sShareLink: 0, bCopyLeague: 0, iUserId: 0 }, { readPreference: 'primary' }).lean().cache(CACHE_2, `matchLeague:${iMatchLeagueId}:privateLeguae:${bPrivateLeague}`)
    if (!matchLeague) return { bSuccess: false, status: jsonStatus.NotFound, message: messages.English.not_exist.replace('##', messages.English.cmatchLeague) }

    const user = await UserModel.findById(iUserId, { eType: 1, sUsername: 1, sProPic: 1 }).lean()
    if (matchLeague.bInternalLeague === true) {
      return {
        bSuccess: false,
        status: jsonStatus.BadRequest,
        message: messages.English.league_join_err
      }
    }

    const upcomingMatch = await MatchModel.findOne({ _id: matchLeague.iMatchId, eStatus: 'U', dStartDate: { $gt: new Date() } }).lean().cache(CACHE_1, `match:${matchLeague.iMatchId}`)
    if (!upcomingMatch) return { bSuccess: false, status: jsonStatus.BadRequest, message: messages.English.match_started }

    if (matchLeague.bMultipleEntry) {
      const multiTeam = await UserLeagueModel.countDocuments({ iMatchLeagueId: matchLeague._id, iUserId }, { readPreference: 'primary' })
      if (!matchLeague.bMultipleEntry && multiTeam > 0) return { bSuccess: false, status: jsonStatus.BadRequest, message: messages.English.multiple_join_err }

      if (matchLeague.nTeamJoinLimit <= multiTeam) return { bSuccess: false, status: jsonStatus.BadRequest, message: messages.English.team_join_limit_err, type: 'team_join_limit_err' }
    }

    const sameTeam = await UserLeagueModel.findOne({ iMatchLeagueId: matchLeague._id, iUserId, iUserTeamId }, { _id: 1 }, { readPreference: 'primary' }).lean()
    if (sameTeam) return { bSuccess: false, status: jsonStatus.BadRequest, message: messages.English.user_already_joined, data: { type: 'user_already_joined' } }

    const team = await UserTeamModel.findOne({ iMatchId: matchLeague.iMatchId, _id: ObjectId(iUserTeamId), iUserId }, null, { readPreference: 'primary' }).lean()
    if (!team) return { bSuccess: false, status: jsonStatus.NotFound, message: messages.English.not_exist.replace('##', messages.English.cteam) }

    matchLeague.nJoined = await redisClient.incr(`${matchLeague._id}`)

    if (!matchLeague.bUnlimitedJoin && (matchLeague.nJoined > matchLeague.nMax)) {
      await Promise.all([
        redisClient.incr(`mlFull:${matchLeague._id}`),
        redisClient.expire(`mlFull:${matchLeague._id}`, 24 * 60 * 60),
        redisClient.decr(`${matchLeague._id}`)
      ])
      return { bSuccess: false, status: jsonStatus.BadRequest, message: messages.English.league_full }
    }

    const ePlatform = 'O'
    let result

    const nJoinPrice = matchLeague.nPrice
    try {
      const { iMatchId, nTotalPayout, bPoolPrize, sPayoutBreakupDesign, sName, nBonusUtil } = matchLeague
      const { nPrice } = matchLeague
      const nOriginalPrice = nPrice

      let userType
      if (user.eType === 'B') {
        if (['CP', 'CB'].includes(sType)) {
          userType = 'CB'
        } else if (sType === 'CMB') {
          userType = 'CMB'
        } else {
          userType = 'B'
        }
      } else {
        userType = 'U'
      }
      const transactionOptions = {
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' }
      }
      session = await GamesDBConnect.startSession()
      session.startTransaction(transactionOptions)
      const [data] = await UserLeagueModel.create([{ iUserTeamId, iUserId, iMatchLeagueId, iMatchId, nTotalPayout, nPoolPrice: bPoolPrize, sPayoutBreakupDesign, sTeamName: team.sName, sMatchName: upcomingMatch.sName, sLeagueName: sName, sUserName: user.sUsername, eType: userType, ePlatform, sProPic: user.sProPic, nOriginalPrice, nPricePaid: nPrice, eCategory: upcomingMatch.eCategory, sType }]).session(session)

      result = data
      if (nPrice > 0) {
        const response = await userBalanceSerices.userPlayDeduction({ iUserId, iUserLeagueId: data._id, iMatchLeagueId, iMatchId, nPrice, nBonusUtil, sMatchName: upcomingMatch.sName, sUserName: user.sUsername, eType: user.eType, eCategory: upcomingMatch.eCategory, bPrivateLeague, nJoinPrice, iUserTeamId })
        if (!response || typeof response !== 'object') {
          await session.abortTransaction()
          await Promise.all([redisClient.decr(`${matchLeague._id}`), UserLeagueModel.deleteOne({ _id: data._id })])
          return { bSuccess: false, status: jsonStatus.BadRequest, message: messages.English.insuff_balance.replace('##', messages.English.cjoinLeague2), data: { nAmount: nPrice } }
        }
        if (!response.isSuccess) {
          await session.abortTransaction()
          await Promise.all([redisClient.decr(`${matchLeague._id}`), UserLeagueModel.deleteOne({ _id: data._id })])
          return { bSuccess: false, status: jsonStatus.BadRequest, message: messages.English.insuff_balance.replace('##', messages.English.cjoinLeague2), data: { nAmount: response.nPrice } }
        }
      }
      await session.commitTransaction()
      const myMatch = await MyMatchesModel.findOne({ iUserId, iMatchId }).select({ aMatchLeagueId: 1 }).lean()

      if (myMatch) {
        const isLeagueExist = myMatch.aMatchLeagueId.some((matchLeagueId) => matchLeagueId.toString() === iMatchLeagueId.toString())
        if (!isLeagueExist) {
          await MyMatchesModel.updateOne({ _id: ObjectId(myMatch._id) }, { $inc: { nJoinedLeague: 1 }, $addToSet: { aMatchLeagueId: iMatchLeagueId }, $set: { dStartDate: upcomingMatch.dStartDate } }, { upsert: true })
        }
      } else {
        await MyMatchesModel.create([{ iUserId, iMatchId, nJoinedLeague: 1, dStartDate: upcomingMatch.dStartDate, aMatchLeagueId: iMatchLeagueId, nWinnings: 0, eMatchStatus: upcomingMatch.eStatus, eCategory: upcomingMatch.eCategory, eType: user.eType }])
      }
    } catch (error) {
      handleCatchError(error, 'Cron.join')
      await session.abortTransaction()
      await Promise.all([redisClient.decr(`${matchLeague._id}`), UserLeagueModel.deleteOne({ _id: result._id })])
      return { bSuccess: false, status: status.InternalServerError, message: messages.English.error }
    }

    const aPromises = [MatchLeagueModel.updateOne({ _id: ObjectId(matchLeague._id) }, { $inc: { nJoined: 1 } })]
    if (iBotLogId) aPromises.push(BotLogModel.updateOne({ _id: ObjectId(iBotLogId) }, { $inc: { nSuccess: 1 } }))
    await Promise.all(aPromises)

    if ((Number(matchLeague.nMax) === Number(matchLeague.nJoined)) && matchLeague.bAutoCreate === true && matchLeague.bUnlimitedJoin === false) {
      await queuePush('autoCreateLeague', matchLeague)
    }

    result.eType = undefined
    result.sType = undefined
    return { bSuccess: true, status: jsonStatus.OK, message: messages.English.successfully.replace('##', messages.English.cuserJoined), data: result }
  } catch (error) {
    await session.abortTransaction()
    handleCatchError(error, 'Cron.join')
    return { bSuccess: false, status: status.InternalServerError, message: messages.English.error }
  } finally {
    await session.endSession()
  }
}

// This function is Deprecated as We have made Stored Procedure
async function processBonusExpire() {
  let data
  const dDate = new Date()
  try {
    data = await queuePop('BonusExpire')
    if (!data) {
      setTimeout(() => { processBonusExpire() }, 2000)
      return
    }

    // Win

    data = JSON.parse(data)
    const { iUserId } = data
    const aTotalBonus = await PassbookModel.findAll({
      where: {
        iUserId: iUserId,
        [Op.or]: [
          { eTransactionType: 'Refer-Bonus' },
          { eTransactionType: 'Bonus' },
          {
            [Op.and]: [
              { eTransactionType: 'Deposit' },
              { nBonus: { [Op.gt]: 0 } }]
          },
          {
            [Op.and]: [
              { eTransactionType: 'Contest-Cashback' }, { nBonus: { [Op.gt]: 0 } }]
          }],
        eType: 'Cr',
        bIsBonusExpired: false,
        dBonusExpiryDate: {
          [Op.lt]: dDate
        }
      },
      order: [['dBonusExpiryDate', 'DESC']]
    })
    const aExpiredId = []
    const nTotalBonus = aTotalBonus.reduce((acc, { nBonus, id }) => {
      aExpiredId.push(id)
      return (acc + nBonus)
    }, 0)
    const aExpiry = aTotalBonus.sort((a, b) => a.dBonusExpiryDate - b.dBonusExpiryDate)
    const dExpiryDate = aExpiry[0].dCreatedAt

    const aUsedBonus = await PassbookModel.findAll({
      where: {
        [Op.and]: [{ iUserId: iUserId }, { eTransactionType: 'Play' }, { eType: 'Dr' }, { nBonus: { [Op.gt]: 0 } }, { dCreatedAt: { [Op.gt]: dExpiryDate } }]
      }
    })
    const nTotalUsedBonus = aUsedBonus.reduce((acc, { nBonus }) => (acc + nBonus), 0)
    let nTotalUnusedBonus = 0
    if (nTotalBonus > nTotalUsedBonus) {
      nTotalUnusedBonus = nTotalBonus - nTotalUsedBonus
    }
    nTotalUnusedBonus = parseFloat(nTotalUnusedBonus)
    const sInfo = `Bonus amount of Rs.${nTotalUnusedBonus} has debited due to bonus expiration.`
    const sRemarks = `Rs.${Math.abs(nTotalUnusedBonus)} bonus has debited due to bonus expiration`

    await db.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    }, async (t) => {
      for (const id of aExpiredId) {
        await PassbookModel.update({
          bIsBonusExpired: true
        },
        {
          where: { id },
          transaction: t,
          lock: true
        })
      }
      const userBalance = await UserBalanceModel.findOne({ where: { iUserId }, plain: true, transaction: t, lock: true })
      await UserBalanceModel.update({
        nCurrentBonus: literal(`nCurrentBonus - ${nTotalUnusedBonus}`),
        nExpiredBonus: literal(`nExpiredBonus + ${nTotalUnusedBonus}`)
      }, { where: { iUserId }, transaction: t, lock: true })
      await StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, { $inc: { nActualBonus: -(Number(parseFloat(nTotalUnusedBonus).toFixed(2))), nTotalBonusExpired: Number(parseFloat(nTotalUnusedBonus).toFixed(2)) } }, { upsert: true })
      // await StatisticsModel.findOneAndUpdate({ iUserId: ObjectId(iUserId) }, { $inc: { nBonus: -(parseFloat(nTotalUnusedBonus).toFixed(2)) } }, { upsert: true, runValidators: true }).lean()
      const { nCurrentWinningBalance, nCurrentDepositBalance, nCurrentTotalBalance, nCurrentBonus } = userBalance
      const payload = {
        iUserId,
        nBonus: nTotalUnusedBonus,
        nAmount: nTotalUnusedBonus,
        nCash: 0,
        eTransactionType: 'Bonus-Expire',
        eType: 'Dr',
        nOldWinningBalance: nCurrentWinningBalance,
        nOldDepositBalance: nCurrentDepositBalance,
        nOldTotalBalance: nCurrentTotalBalance,
        nOldBonus: nCurrentBonus,
        sInfo,
        sRemarks,
        dActivityDate: new Date()
      }
      await PassbookModel.create(payload, { transaction: t, lock: true })
    })
    processBonusExpire()
  } catch (error) {
    await queuePush('dead:BonusExpire', data)
    handleCatchError(error)
    setTimeout(() => { processBonusExpire() }, 2000)
  }
}

/**
 * It will give right statistics of user by it's id
 * @param  { string } id
 * @return { object } { nActualDepositBalance, nActualWinningBalance, nActualBonus }
 */
async function fixUserStatistics(id) {
  try {
    // for cash difference
    const totalCashGiven = await PassbookModel.sum('nCash', { where: { iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: { [Op.in]: ['Bonus', 'Refer-Bonus'] } } })
    const totalCashTaken = await reverseDepositSumPassbook({ iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: { [Op.in]: ['Cashback-Return'] } })
    const totalCashes = await depositSumPassbook({ iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: { [Op.in]: ['Deposit', 'Cashback-Contest'] } })
    const totalWinWithdraw = await reverseDepositSumPassbook({ iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: 'Withdraw' })
    const totalCashback = await depositSumPassbook({ iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: 'Creator-Bonus' })
    const totalCashbackReturn = await reverseDepositSumPassbook({ iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: 'Creator-Bonus-Return' })
    const totalPlayes = await reverseDepositSumPassbook({ iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: 'Play' })
    const totalPlayesReturn = await depositSumPassbook({ iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: 'Play-Return' })
    const totalDepositWinReturn = await reverseDepositSumPassbook({ iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: 'Win-Return' })
    // console.log(totalCashGiven, totalCashes, totalCashback, totalPlayesReturn, totalCashTaken, totalCashbackReturn, totalWinWithdraw, totalPlayes)
    const nActualDepositBalance = (totalCashGiven + totalCashes + totalCashback + totalPlayesReturn) - totalCashTaken - totalCashbackReturn - totalWinWithdraw - totalPlayes - totalDepositWinReturn

    // for winning difference
    const totalWinGiven = await PassbookModel.sum('nCash', { where: { iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: { [Op.in]: ['Withdraw-Return', 'Win'] } } })
    const totalcreatorBonus = await winningSumPassbook({ iUserId: id, eTransactionType: { [Op.in]: ['Creator-Bonus', 'Cashback-Contest'] } })
    const totalcreatorBonusReturn = await reverseWinningSumPassbook({ iUserId: id, eTransactionType: { [Op.in]: ['Creator-Bonus-Return', 'Cashback-Return'] } })
    const totalWin = await winningSumPassbook({ iUserId: id, eTransactionType: 'Deposit' })
    const totalWithdraw = await reverseWinningSumPassbook({ iUserId: id, eTransactionType: { [Op.in]: ['Withdraw', 'TDS'] } })
    const totalPlayed = await reverseWinningSumPassbook({ iUserId: id, eTransactionType: 'Play' })
    const totalPlayReturn = await winningSumPassbook({ iUserId: id, eTransactionType: 'Play-Return' })
    const totalWinReturn = await reverseWinningSumPassbook({ iUserId: id, eTransactionType: 'Win-Return' })
    // const totalWinReturn = await PassbookModel.sum('nCash', { where: { iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: 'Win-Return' } })
    const nActualWinningBalance = (totalWin + totalWinGiven + totalcreatorBonus + totalPlayReturn) - totalWithdraw - totalcreatorBonusReturn - totalPlayed - totalWinReturn

    // for bonus difference
    const totalBonusGiven = await PassbookModel.sum('nBonus', { where: { iUserId: id, nBonus: { [Op.gt]: 0 }, eTransactionType: { [Op.in]: ['Play-Return', 'Bonus', 'Refer-Bonus', 'Cashback-Contest', 'Creator-Bonus', 'Win', 'KYC-Bonus'] } } })
    const totalBonusTaken = await PassbookModel.sum('nBonus', { where: { iUserId: id, nBonus: { [Op.gt]: 0 }, eTransactionType: { [Op.in]: ['Play', 'Cashback-Return', 'Creator-Bonus-Return', 'Bonus-Expire', 'Win-Return'] } } })
    const totalBonuses = await bonusSumPassbook({ iUserId: id, nBonus: { [Op.gt]: 0 }, eTransactionType: 'Deposit' })
    const nActualBonus = (totalBonusGiven + totalBonuses) - totalBonusTaken

    // for played cash, bonus total
    const nTotalPlayedCash = await PassbookModel.sum('nCash', { where: { iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: 'Play' } })
    const nTotalPlayedBonus = await PassbookModel.sum('nBonus', { where: { iUserId: id, nBonus: { [Op.gt]: 0 }, eTransactionType: 'Play' } })

    // for play-return cash, bonus total
    const nTotalPlayReturnCash = await PassbookModel.sum('nCash', { where: { iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: 'Play-Return' } })
    const nTotalPlayReturnBonus = await PassbookModel.sum('nBonus', { where: { iUserId: id, nBonus: { [Op.gt]: 0 }, eTransactionType: 'Play-Return' } })

    // for total deposit amount
    const totalDeposit = await depositSumPassbook({ iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: { [Op.in]: ['Deposit', 'Creator-Bonus'] } })
    const nTotalDepositGiven = await PassbookModel.sum('nCash', { where: { iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: { [Op.in]: ['Bonus', 'Refer-Bonus'] } } })
    // const nTotalDepositTaken = await PassbookModel.sum('nCash', { where: { iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: 'Cashback-Return' } })
    const nDeposits = totalDeposit + nTotalDepositGiven

    // for total bonus amount
    const nTotalBonusGiven = await PassbookModel.sum('nBonus', { where: { iUserId: id, nBonus: { [Op.gt]: 0 }, eTransactionType: { [Op.in]: ['Deposit', 'Bonus', 'Refer-Bonus', 'Cashback-Contest', 'Creator-Bonus', 'Win', 'KYC-Bonus'] } } })
    // const nTotalBonusTaken = await PassbookModel.sum('nBonus', { where: { iUserId: id, nBonus: { [Op.gt]: 0 }, eTransactionType: 'Cashback-Return' } })
    const nTotalBonusTaken = await PassbookModel.sum('nBonus', { where: { iUserId: id, nBonus: { [Op.gt]: 0 }, eTransactionType: 'Win-Return' } })
    const nBonus = nTotalBonusGiven - nTotalBonusTaken
    // - nTotalBonusTaken

    // for total withdrawal amount
    const nWithdrawal = await PassbookModel.sum('nCash', { where: { iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: 'Withdraw' } })
    const nWithdrawalReturn = await PassbookModel.sum('nCash', { where: { iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: 'Withdraw-Return' } })
    const nWithdraw = nWithdrawal - nWithdrawalReturn

    // for total winning amount
    const nTotalWinningGiven = await winningSumPassbook({ iUserId: id, eTransactionType: { [Op.in]: ['Deposit', 'Cashback-Contest', 'Creator-Bonus'] } })
    const nTotalWinningTaken = await reverseWinningSumPassbook({ iUserId: id, eTransactionType: { [Op.in]: ['Creator-Bonus-Return'] } })
    const nTotalWinning = await PassbookModel.sum('nCash', { where: { iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: { [Op.in]: ['Win'] } } })
    const nTotalTDSdeduction = await PassbookModel.sum('nCash', { where: { iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: 'TDS', [Op.or]: [{ iMatchId: { [Op.ne]: null } }, { iMatchLeagueId: { [Op.ne]: null } }] } })
    // console.log(nTotalWinning, nTotalWinningGiven, nTotalTDSdeduction, nTotalWinningTaken)
    const nTotalWinReturn = await PassbookModel.sum('nCash', { where: { iUserId: id, nCash: { [Op.gt]: 0 }, eTransactionType: 'Win-Return' } })
    const nTotalWinnings = nTotalWinning + nTotalWinningGiven - nTotalTDSdeduction - nTotalWinningTaken - nTotalWinReturn

    const oResult = {
      nActualDepositBalance: nActualDepositBalance || 0,
      nActualWinningBalance: nActualWinningBalance || 0,
      nActualBonus: nActualBonus || 0,
      nDeposits: nDeposits || 0,
      nWithdraw: nWithdraw || 0,
      nTotalWinnings: nTotalWinnings || 0,
      nBonus: nBonus || 0,
      nTotalPlayedCash: nTotalPlayedCash || 0,
      nTotalPlayedBonus: nTotalPlayedBonus || 0,
      nTotalPlayReturnCash: nTotalPlayReturnCash || 0,
      nTotalPlayReturnBonus: nTotalPlayReturnBonus || 0,
      nTotalWinReturn: nTotalWinReturn || 0
    }
    return oResult
    // total deposit and withdraw
  } catch (error) {
    handleCatchError(error)
  }
}

const fixRealUserDebugger = async (query) => {
  try {
    let total = 0

    let nSkip = 0
    const nLimit = 10000
    let bLoopEnd = true
    while (bLoopEnd) {
      const aUsers = await UserModel.find(query, { _id: 1, sUsername: 1 }).skip(nSkip).limit(nLimit).sort({ dCreatedAt: 1 }).lean()
      if (!aUsers || !aUsers.length) {
        bLoopEnd = false
        continue
      }

      for (const usr of aUsers) {
        let iUserId
        let bFlag = false
        let eMatchCategory

        const balance = await UserBalanceModel.findOne({ where: { iUserId: usr._id.toString() }, attributes: ['iUserId', 'nCurrentDepositBalance', 'nCurrentWinningBalance', 'nCurrentBonus', 'nTotalBonusEarned', 'nTotalDepositAmount', 'nTotalWithdrawAmount', 'nTotalWinningAmount'], raw: true })
        const stats = await StatisticsModel.findOne({ iUserId: ObjectId(usr._id) }, {}, { readPreference: 'primaryPreferred' }).lean()
        if (!balance) continue
        const { nCurrentDepositBalance, nCurrentWinningBalance, nCurrentBonus, nTotalBonusEarned, nTotalDepositAmount, nTotalWithdrawAmount, nTotalWinningAmount } = balance
        bFlag = false
        if (convertToDecimal(nCurrentDepositBalance) !== convertToDecimal(stats.nActualDepositBalance)) {
          console.log('Mismatch in Current Deposit Balance', nCurrentDepositBalance, convertToDecimal(stats.nActualDepositBalance))
          iUserId = usr._id
          bFlag = true
        }
        if (convertToDecimal(nCurrentWinningBalance) !== convertToDecimal(stats.nActualWinningBalance)) {
          console.log('Mismatch in Current Winning Balance', nCurrentWinningBalance, convertToDecimal(stats.nActualWinningBalance))
          iUserId = usr._id
          bFlag = true
        }
        if (convertToDecimal(nCurrentBonus) !== convertToDecimal(stats.nActualBonus)) {
          console.log('Mismatch in Current Bonus', nCurrentBonus, convertToDecimal(stats.nActualBonus))
          iUserId = usr._id
          bFlag = true
        }

        if (convertToDecimal(nTotalBonusEarned) !== convertToDecimal(stats.nBonus)) {
          console.log('Mismatch in Total Bonus Earned', nTotalBonusEarned, convertToDecimal(stats.nBonus))
          iUserId = usr._id
          bFlag = true
        }
        if (convertToDecimal(nTotalDepositAmount) !== convertToDecimal(stats.nDeposits)) {
          console.log('Mismatch in Total Deposit', nTotalDepositAmount, convertToDecimal(stats.nDeposits))
          iUserId = usr._id
          bFlag = true
        }
        if (convertToDecimal(nTotalWithdrawAmount) !== convertToDecimal(stats.nWithdraw)) {
          console.log('Mismatch in Total Withdrawal', nTotalWithdrawAmount, convertToDecimal(stats.nWithdraw))
          iUserId = usr._id
          bFlag = true
        }
        if (convertToDecimal(nTotalWinningAmount) !== convertToDecimal(stats.nTotalWinnings)) {
          console.log('Mismatch in Total Winnings', nTotalWinningAmount, convertToDecimal(stats.nTotalWinnings))
          iUserId = usr._id
          bFlag = true
        }

        const [aTotalMatchesPlayed, aTotalMatchesPlayReturned] = await Promise.all([
          PassbookModel.findAll({ attributes: [['iMatchId', 'matchId']], where: { eTransactionType: 'Play', iUserId: usr._id.toString() }, group: ['iMatchId'], raw: true }),
          PassbookModel.findAll({ attributes: [['iMatchId', 'matchId']], where: { eTransactionType: 'Play-Return', iUserId: usr._id.toString() }, group: ['iMatchId'], raw: true })
        ])
        const aMatchIdsPlayed = aTotalMatchesPlayed.map(match => ObjectId(match?.matchId))
        const aMatchIdsPlayRetured = aTotalMatchesPlayReturned.map(match => ObjectId(match?.matchId))
        let nTotalPlayedCash = 0
        let nTotalPlayedBonus = 0
        let nTotalPlayReturnCash = 0
        let nTotalPlayReturnBonus = 0

        const [aMatchesPlayed, aMatchesPlayReturned] = await Promise.all([
          MatchModel.aggregate([{
            $match: {
              _id: { $in: aMatchIdsPlayed }
            }
          },
          {
            $group: {
              _id: '$eCategory',
              aMatchId: {
                $push: '$_id'
              }
            }
          }
          ]),
          MatchModel.aggregate([{
            $match: {
              _id: { $in: aMatchIdsPlayRetured }
            }
          },
          {
            $group: {
              _id: '$eCategory',
              aMatchId: {
                $push: '$_id'
              }
            }
          }])
        ])

        const updateStatsObject = {}

        for (const matchCategory of aMatchesPlayed) {
          eMatchCategory = getStatisticsSportsKey(matchCategory._id)
          const aStringMatchIdsPlayed = matchCategory?.aMatchId.map(id => id.toString())
          const aTotalPlayed = await PassbookModel.findAll({ attributes: [[fn('sum', col('nCash')), 'totalPlayCash'], [fn('sum', col('nBonus')), 'totalPlayBonus']], where: { eTransactionType: 'Play', iUserId: usr._id.toString(), iMatchId: { [Op.in]: aStringMatchIdsPlayed } }, raw: true })

          nTotalPlayedCash += aTotalPlayed.length ? aTotalPlayed[0]?.totalPlayCash : 0
          nTotalPlayedBonus += aTotalPlayed.length ? aTotalPlayed[0]?.totalPlayBonus : 0
        }

        for (const matchCategory of aMatchesPlayReturned) {
          eMatchCategory = getStatisticsSportsKey(matchCategory._id)
          const aStringMatchIdsPlayReturned = matchCategory?.aMatchId.map(id => id.toString())

          const aTotalPlayReturned = await PassbookModel.findAll({ attributes: [[fn('sum', col('nCash')), 'totalPlayReturnCash'], [fn('sum', col('nBonus')), 'totalPlayReturnBonus']], where: { eTransactionType: 'Play-Return', iUserId: usr._id.toString(), iMatchId: { [Op.in]: aStringMatchIdsPlayReturned } }, raw: true })

          updateStatsObject[`${eMatchCategory}.nPlayReturn`] = aTotalPlayReturned.length ? aTotalPlayReturned[0]?.totalPlayReturnCash : 0
          updateStatsObject[`${eMatchCategory}.nPlayReturn`] += aTotalPlayReturned.length ? aTotalPlayReturned[0]?.totalPlayReturnBonus : 0

          nTotalPlayReturnCash += aTotalPlayReturned.length ? aTotalPlayReturned[0]?.totalPlayReturnCash : 0
          nTotalPlayReturnBonus += aTotalPlayReturned.length ? aTotalPlayReturned[0]?.totalPlayReturnBonus : 0
        }

        if (convertToDecimal(nTotalPlayedCash) !== convertToDecimal(stats.nTotalPlayedCash)) {
          console.log('Mismatch in Total Played Cash', nTotalPlayedCash, convertToDecimal(stats.nTotalPlayedCash))
          iUserId = usr._id
          bFlag = true
        }
        if (convertToDecimal(nTotalPlayedBonus) !== convertToDecimal(stats.nTotalPlayedBonus)) {
          console.log('Mismatch in Total Played Bonus', nTotalPlayedBonus, convertToDecimal(stats.nTotalPlayedBonus))
          iUserId = usr._id
          bFlag = true
        }
        if (convertToDecimal(nTotalPlayReturnCash) !== convertToDecimal(stats.nTotalPlayReturnCash)) {
          console.log('Mismatch in Total Play Return Cash', nTotalPlayReturnCash, convertToDecimal(stats.nTotalPlayReturnCash))
          iUserId = usr._id
          bFlag = true
        }
        if (convertToDecimal(nTotalPlayReturnBonus) !== convertToDecimal(stats.nTotalPlayReturnBonus)) {
          console.log('Mismatch in Total Play Return Bonus', nTotalPlayReturnBonus, convertToDecimal(stats.nTotalPlayReturnBonus))
          iUserId = usr._id
          bFlag = true
        }

        if (convertToDecimal(stats.nTotalPlayReturnCash + stats.nTotalPlayReturnBonus) !== convertToDecimal(nTotalPlayReturnBonus + nTotalPlayReturnCash)) {
          console.log('Mismatch in Total Play Return Statistics', convertToDecimal(nTotalPlayReturnBonus + nTotalPlayReturnCash), convertToDecimal(stats.nTotalPlayReturnCash + stats.nTotalPlayReturnBonus))
          iUserId = usr._id
          bFlag = true
        }

        // console.log('Total Play Return Diff :: ', (convertToDecimal(stats.nTotalPlayReturnCash + stats.nTotalPlayReturnBonus) - convertToDecimal(nPlayReturn)))
        if (iUserId && bFlag) {
          console.log('User is :: ', usr.sUsername)
          console.log('iUserId', iUserId.toString())

          const stats = await fixUserStatistics(iUserId.toString())
          const updateObj = {}

          updateObj.$set = { ...stats, ...updateStatsObject }
          // console.log({ updateObj })
          // const updateObj = { $set: { ...stats }, $inc: { updateStatsObject.eMatchCategory.nPlayReturn: (convertToDecimal(stats.nTotalPlayReturnCash + stats.nTotalPlayReturnBonus) - convertToDecimal(nPlayReturn)) } }

          await StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, updateObj, { readPreference: 'primaryPreferred' })
        }

        total++
      }
      nSkip = nSkip + nLimit
    }

    console.log('Total Real Users Till Now Scanned ......', total)
  } catch (error) {
    handleCatchError(error)
  }
}

/**
 * It will do sum (nNewDepositBalance - nOldDepositBalance) of all deposits as per condition
 * @param  { object } condition
 * @return { number }
 */
async function depositSumPassbook(condition) {
  try {
    const passbooks = await PassbookModel.findAll({ where: condition, attributes: ['nOldDepositBalance', 'nNewDepositBalance'] })
    let total = 0
    for (const pass of passbooks) {
      const { nNewDepositBalance, nOldDepositBalance } = pass
      const diff = (nNewDepositBalance - nOldDepositBalance)
      total += diff > 0 ? diff : 0
    }
    return total
  } catch (error) {
    handleCatchError(error)
  }
}

/**
 * It will do reverse sum (nOldDepositBalance - nNewDepositBalance) of all deposits as per condition
 * @param  { object } condition
 * @return { number }
 */
async function reverseDepositSumPassbook(condition) {
  try {
    const passbooks = await PassbookModel.findAll({ where: condition, attributes: ['nOldDepositBalance', 'nNewDepositBalance'] })
    let total = 0
    for (const pass of passbooks) {
      const { nNewDepositBalance, nOldDepositBalance } = pass
      const diff = (nOldDepositBalance - nNewDepositBalance)
      total += diff > 0 ? diff : 0
    }
    return total
  } catch (error) {
    handleCatchError(error)
  }
}

/**
 * It will do sum (nNewWinningBalance - nOldWinningBalance) of all winnings as per condition
 * @param  { object } condition
 * @return { number }
 */
async function winningSumPassbook(condition) {
  try {
    const passbooks = await PassbookModel.findAll({ where: condition, attributes: ['nOldWinningBalance', 'nNewWinningBalance'] })
    let total = 0
    for (const pass of passbooks) {
      const { nNewWinningBalance, nOldWinningBalance } = pass
      const diff = (nNewWinningBalance - nOldWinningBalance)
      total += diff > 0 ? diff : 0
    }
    return total
  } catch (error) {
    handleCatchError(error)
  }
}

/**
 * It will do reverse sum (nOldWinningBalance - nNewWinningBalance) of all winnings as per condition
 * @param  { object } condition
 * @return { number }
 */
async function reverseWinningSumPassbook(condition) {
  try {
    const passbooks = await PassbookModel.findAll({ where: condition, attributes: ['nOldWinningBalance', 'nNewWinningBalance'] })
    let total = 0
    for (const pass of passbooks) {
      const { nNewWinningBalance, nOldWinningBalance } = pass
      const diff = (nOldWinningBalance - nNewWinningBalance)
      total += diff > 0 ? diff : 0
    }
    return total
  } catch (error) {
    handleCatchError(error)
  }
}

/**
 * It will do sum (nNewBonus - nOldBonus) of all bonus as per condition
 * @param  { object } condition
 * @return { number }
 */
async function bonusSumPassbook(condition) {
  try {
    const passbooks = await PassbookModel.findAll({ where: condition, attributes: ['nOldBonus', 'nNewBonus'] })
    let total = 0
    for (const pass of passbooks) {
      const { nNewBonus, nOldBonus } = pass
      const diff = (nNewBonus - nOldBonus)
      total += diff > 0 ? diff : 0
    }
    return total
  } catch (error) {
    handleCatchError(error)
  }
}

// eslint-disable-next-line no-unused-vars
async function winMisMatchDetect() {
  try {
    const matchData = await MatchModel.find({ eStatus: { $in: ['CMP', 'I'] } })
    let userLeagueId
    for (const match of matchData) {
      userLeagueId = await UserLeagueModel.find({ iMatchId: match._id, bWinDistributed: true, $or: [{ nPrice: { $gt: 0 } }, { nBonusWin: { $gt: 0 } }] }, { _id: 1 })
      const ids = []
      for (const id of userLeagueId) {
        ids.push(id.toString())
      }
      // const passbookData = await PassbookModel.findAll({ where: { iUserLeagueId: { [Op.notIn]: ids }, iMatchId: match._id.toString() }, attributes: ['iUserLeagueId', 'iMatchId'], raw: true })
    }
  } catch (error) {
    handleCatchError(error)
  }
}

/**
 * This function is used for fixing all users
 * total referrals count { nReferrals } in statistics
 *
 */ // eslint-disable-next-line no-unused-vars
async function fixReferredUsersCount() {
  try {
    await StatisticsModel.updateMany({ eUserType: 'U' }, { nReferrals: 0 })

    const allReferredUsers = await UserModel.find({ iReferredBy: { $ne: null } }, { iReferredBy: 1 }).lean()

    if (allReferredUsers.length) {
      const groupByReferredBy = allReferredUsers.reduce((group, user) => {
        const { iReferredBy } = user
        group[iReferredBy] = group[iReferredBy] || []
        group[iReferredBy].push(user)
        return group
      }, {})

      for (const iUserId of Object.keys(groupByReferredBy)) {
        await StatisticsModel.updateOne({ iUserId }, { $inc: { nReferrals: groupByReferredBy[iUserId].length } })
      }
    }
  } catch (error) {
    handleCatchError(error)
  }
}

// eslint-disable-next-line no-unused-vars
async function fixDuplicateSeries() {
  try {
    const data = await SeriesLeaderBoardModel.find().lean()
    const duplicateSeries = []

    for (const series of data) {
      const filerData = data.filter((s) => (series.sKey === s.sKey))
      if (filerData.length > 1) {
        duplicateSeries.push(filerData)
      }
    }
    const uniqueSeriesData = duplicateSeries.length ? [...new Map(duplicateSeries.map((item) => [item.sKey, item])).values()] : []

    for (const series of uniqueSeriesData) {
      let iSeriesId
      let iUpdatedSeriesId

      const checkPending = series.find(({ eStatus }) => eStatus === 'P')
      const checkLive = series.find(({ eStatus }) => eStatus !== 'P')
      if (checkPending && checkLive) {
        iSeriesId = checkPending._id
        iUpdatedSeriesId = checkLive._id
      } else {
        iSeriesId = series[0]._id
        iUpdatedSeriesId = series[1]._id
      }

      await pendingMatchModel.updateMany({ iSeriesId }, { iSeriesId: iUpdatedSeriesId })
      await MatchModel.updateMany({ iSeriesId }, { iSeriesId: iUpdatedSeriesId })
      await FullScorecardsModel.updateMany({ iSeriesId }, { iSeriesId: iUpdatedSeriesId })
      await PassbookModel.update({ iSeriesId: iUpdatedSeriesId.toString() }, { where: { iSeriesId: iSeriesId.toString() } })
      await SeriesLeaderBoardModel.deleteOne({ _id: iSeriesId })
    }
  } catch (error) {
    handleCatchError(error)
  }
}

// eslint-disable-next-line no-unused-vars
async function depositDiscountFix() {
  try {
    const data = await PromocodeStatisticsModel.aggregate([{
      $match: {
        sTransactionType: 'DEPOSIT'
      }
    }, {
      $group: {
        _id: '$iUserId',
        nDeposit: {
          $sum: '$nAmount'
        }
      }
    }]).allowDiskUse(bAllowDiskUse)

    for (const user of data) {
      await StatisticsModel.updateOne({ iUserId: user._id }, { nDepositDiscount: user.nDeposit })
    }
  } catch (error) {
    handleCatchError(error)
  }
}

setTimeout(() => {
  processBonusExpire()
}, 2000)
