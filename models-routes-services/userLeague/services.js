const UserLeagueModel = require('./model')
const UserTeamModel = require('../userTeam/model')
const MatchLeagueModel = require('../matchLeague/model')
const MyMatchesModel = require('../myMatches/model')
const AdminsModel = require('../admin/model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, getPaginationValues2, handleCatchError, getUpdatedPrizeBreakupData } = require('../../helper/utilities.services')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const matchServices = require('../match/services')
const userBalanceServices = require('../userBalance/services')
const { queuePush, redisClient, redisClient2, checkTeamJoined, redisClient3 } = require('../../helper/redis')
const promocodeServices = require('../promocode/services')
const PromocodeStatisticModel = require('../promocode/statistics/model')
const axios = require('axios')
const config = require('../../config/config')
const { bAllowDiskUse, CACHE_2 } = config
const UsersModel = require('../user/model')
const commonRuleServices = require('../commonRules/services')
const { GamesDBConnect } = require('../../database/mongoose')
const MatchTeamsModel = require('../matchTeams/model')
const cachegoose = require('recachegoose')
const { getPrice } = require('./common')
const BotLogModel = require('../botLogs/model')
const { CopyTeamUpdate, generateUserLeagueReport } = require('./common')
const s3 = require('../../helper/s3config')
const { createXlsxFile } = require('../cron/common')
const LeagueCategoryModel = require('../leagueCategory/model')
const { CACHE_1 } = require('../../config/config')

const moment = require('moment')
const { getMyTeamsWithRankCalculationV2 } = require('../leaderBoard/common')
const UnhandledUserLeagueModel = require('./unhandledUserLeagueModel')
const MatchPlayerModel = require('../matchPlayer/model')
const MatchModel = require('../match/model')
const UserBalanceModel = require('../userBalance/model')

class UserLeague {
  // Join contest with single team ( removed mongodb transaction from old functions  )
  async addV4(req, res) {
    try {
      let { aUserTeamId, iMatchLeagueId, sPromo, sType } = req.body
      const iUserId = req.user._id
      const lang = req.userLanguage

      if (!iUserId) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].user_already_joined })
      }

      aUserTeamId = [...new Set(aUserTeamId)]
      //* Checking if duplicate team is joining contest
      for (const iUserTeamId of aUserTeamId) {
        const bAlreadyJoined = await checkTeamJoined(iUserId, iUserTeamId, iMatchLeagueId)
        if (bAlreadyJoined === 'EXIST') aUserTeamId = Array.isArray(aUserTeamId) && aUserTeamId.length ? aUserTeamId.filter(id => id !== iUserTeamId) : []
      }

      if (Array.isArray(aUserTeamId) && !aUserTeamId.length) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].user_already_joined })
      }
      //*
      const nTotalTeam = aUserTeamId.length
      const query = { _id: ObjectId(iMatchLeagueId), bCancelled: false }

      let validationResult = {
        data: {}
      }

      if (sPromo && sPromo.length) {
        try {
          const data = { sPromo, iMatchLeagueId, nTeamCount: nTotalTeam, iUserId, lang }
          validationResult = await promocodeServices.validateMatchPromocode(data)
        } catch (error) {
          const { status: s = '', message = '' } = error
          if (!s) { return catchError('UserLeague.addV4', error, req, res) }
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: message, data: { sKey: 'OTHER', Value: { nJoinSuccess: 0, nTotalTeam } } })
        }
      }
      const { iPromocodeId, nBonus: nPromoDiscount = 0 } = validationResult.data || {}

      const aErrors = []

      const matchLeague = await MatchLeagueModel.findOne(query, { dCreatedAt: 0, dUpdatedAt: 0, sShareCode: 0, bIsProcessed: 0, bPlayReturnProcess: 0, sFairPlay: 0, bWinningDone: 0, bPrizeDone: 0, sShareLink: 0, bCopyLeague: 0, iUserId: 0 }, { readPreference: 'primary' }).lean().cache(CACHE_2, `matchLeague:${iMatchLeagueId}:active`)

      if (!matchLeague) {
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague), data: { sKey: 'OTHER', oValue: { nJoinSuccess: 0, nTotalTeam } } })
      }

      const user = await UsersModel.findById(iUserId, { bIsInternalAccount: 1, eType: 1, sUsername: 1, sProPic: 1, sReferrerRewardsOn: 1, iReferredBy: 1 }).lean()
      if (user.bIsInternalAccount === true) {
        if (matchLeague.bPrivateLeague === false) {
          // hidden league category
          const hiddenLeague = await LeagueCategoryModel.findOne({ _id: matchLeague.iLeagueCatId, sKey: 'hiddenLeague' }, { _id: 1, sKey: 1 }).lean()
          if (!hiddenLeague) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].public_league_join_err, data: { sKey: 'OTHER', oValue: { nJoinSuccess: 0, nTotalTeam } } })
        } else if (matchLeague.bPrivateLeague === true && matchLeague.bInternalLeague === false) {
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].league_join_err, data: { sKey: 'OTHER', oValue: { nJoinSuccess: 0, nTotalTeam } } })
        }
      } else {
        if (matchLeague.bInternalLeague === true) {
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].league_join_err, data: { sKey: 'OTHER', oValue: { nJoinSuccess: 0, nTotalTeam } } })
        }
      }

      const [upcomingMatch, multiTeam] = await Promise.all([
        matchServices.findUpcomingMatch(matchLeague.iMatchId),
        UserLeagueModel.countDocuments({ iMatchLeagueId: matchLeague._id, iUserId }, { readPreference: 'primary' })
      ])

      if (!upcomingMatch) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_started, data: { sKey: 'OTHER', oValue: { nJoinSuccess: 0, nTotalTeam } } })

      if (!matchLeague.bMultipleEntry && (aUserTeamId.length > matchLeague.nTeamJoinLimit || multiTeam > 0)) {
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].multiple_join_err, data: { sKey: 'OTHER', oValue: { nJoinSuccess: 0, nTotalTeam } } })
      }
      if (matchLeague.nTeamJoinLimit <= multiTeam && !matchLeague.bPrivateLeague) {
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].team_join_limit_err, data: { sKey: 'OTHER', oValue: { nJoinSuccess: 0, nTotalTeam } } })
      }

      let teams = []
      let remainTeams
      if (Array.isArray(aUserTeamId)) {
        teams = aUserTeamId.map(team => ObjectId(team))

        const [teamAlreadyJoin, team] = await Promise.all([
          UserLeagueModel.find({ iMatchLeagueId: matchLeague._id, iUserId, iUserTeamId: { $in: teams } }, { iUserTeamId: 1 }, { readPreference: 'primary' }).lean(), // check for multi join
          UserTeamModel.find({ iMatchId: matchLeague.iMatchId, _id: { $in: teams }, iUserId }, { sName: 1 }, { readPreference: 'primary' }).lean()
        ])

        if (!team.length) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cteam), data: { sKey: 'OTHER', oValue: { nJoinSuccess: 0, nTotalTeam } } })

        remainTeams = team.filter(team => {
          return !(teamAlreadyJoin.some(joinedTeam => joinedTeam.iUserTeamId.toString() === team._id.toString()))
        })

        if (!remainTeams.length) {
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].user_already_joined, data: { sKey: 'OTHER', oValue: { nJoinSuccess: 0, nTotalTeam } } })
        }

        if (remainTeams.length > team.length) {
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cteam), data: { sKey: 'OTHER', oValue: { nJoinSuccess: 0, nTotalTeam } } })
        }
        remainTeams = remainTeams.map(({ _id, sName }) => ({ iUserTeamId: _id, sName }))
      }

      const userBalance = await UserBalanceModel.findOne({ where: { iUserId: iUserId.toString() }, plain: true, raw: true })
      const nJoinPrice = (nPromoDiscount) ? matchLeague.nPrice - nPromoDiscount : matchLeague.nPrice
      let { nCurrentTotalBalance, nCurrentBonus } = userBalance
      const { nBonusUtil } = matchLeague

      let nTotalAmount = 0
      let bValid = true
      remainTeams.forEach(t => {
        let nActualBonus = 0
        if (nBonusUtil && nBonusUtil > 0 && nJoinPrice > 0) {
          const nBonus = (nJoinPrice * nBonusUtil) / 100
          if (nCurrentBonus - nBonus >= 0) {
            nActualBonus = nBonus
            if (nCurrentTotalBalance < nJoinPrice - nBonus) {
              nTotalAmount = nTotalAmount + nJoinPrice - nBonus - nCurrentTotalBalance
              bValid = false
              return
            }
          } else {
            nActualBonus = userBalance.nCurrentBonus
            if (nCurrentTotalBalance < nJoinPrice - nCurrentBonus) {
              nTotalAmount = nTotalAmount + nJoinPrice - nCurrentBonus - nCurrentTotalBalance
              bValid = false
              return
            }
          }
        } else if (nCurrentTotalBalance < nJoinPrice) {
          nTotalAmount = nTotalAmount + nJoinPrice - nCurrentTotalBalance
          bValid = false
          return
        }

        const nPrice = nActualBonus ? nJoinPrice - nActualBonus : nJoinPrice
        nCurrentTotalBalance = nCurrentTotalBalance - nPrice
        nCurrentBonus = nCurrentBonus - nActualBonus
      })

      if (!bValid) {
        return res.status(status.OK).jsonp({
          status: jsonStatus.OK,
          message: messages[req.userLanguage].join_contest_succ.replace('##', messages[req.userLanguage].cuserJoined),
          data: {
            sKey: 'INSUFFICIENT_BALANCE',
            oValue: {
              nJoinSuccess: 0,
              nTotalTeam,
              nAmount: nTotalAmount > 0 ? nTotalAmount : undefined
            }
          }
        })
      }

      matchLeague.nJoined = await redisClient.incrby(`${matchLeague._id}`, remainTeams.length)

      if (!matchLeague.bUnlimitedJoin) {
        if (matchLeague.nJoined > matchLeague.nMax) {
          await redisClient.decrby(`${matchLeague._id}`, remainTeams.length)
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].league_full, data: { sKey: 'REFRESH_LEAGUE', oValue: { nJoinSuccess: 0, nTotalTeam, bRefreshLeague: true } } })
        }
      }

      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform')) ? req.header('Platform') : 'O'

      let nJoinSuccess = 0
      let nAmount = 0
      let bDoCopyBot = false
      let token = null
      let teamCount = ''
      // const userBalance = 0
      let userType
      if (user.eType === 'B') {
        if (sType === 'CP') {
          userType = 'CB'
        } else if (sType === 'CMB') {
          userType = 'CMB'
        } else {
          userType = 'B'
        }
      } else {
        userType = 'U'
      }

      let actualUserJoined, iAdminId
      if (user.eType === 'U' && matchLeague.bBotCreate) {
        actualUserJoined = await UserLeagueModel.countDocuments({ iMatchLeagueId: ObjectId(matchLeague._id), eType: 'U' }, { readPreference: 'primary' })
      }

      const { nMinTeamCount, bCopyBotInit = '', nCopyBotsPerTeam = '' } = matchLeague
      for (const remainTeam of remainTeams) {
        const nJoinPrice = (nPromoDiscount) ? matchLeague.nPrice - nPromoDiscount : matchLeague.nPrice
        const sPromocode = nPromoDiscount ? sPromo : ''

        const bAfterMinJoin = (actualUserJoined + nJoinSuccess) >= nMinTeamCount
        const data = await joinLeagueTeamWiseV2({
          matchLeague, iUserTeamId: remainTeam.iUserTeamId, iUserId, iMatchLeagueId, team: remainTeam.sName, upcomingMatch, ePlatform, user: user, iPromocodeId, nPromoDiscount, sType: userType, sPromocode, nJoinPrice, bAfterMinJoin
        })

        if (!data.isSuccess) {
          nAmount = data.nAmount ? nAmount + data.nAmount : nAmount
          await redisClient.decr(`${matchLeague._id}`)
          // need to add entry of userLeague creation entry
          continue
        }
        nJoinSuccess++

        try {
          if (nCopyBotsPerTeam) teamCount = nCopyBotsPerTeam
          if (nMinTeamCount && bAfterMinJoin) {
            const adminData = await AdminsModel.findOne({ eStatus: 'Y', eType: 'SUPER', aJwtTokens: { $exists: true, $ne: [] } }, { _id: 1, sDepositToken: 1 }).sort({ dLoginAt: -1 }).lean()
            if (adminData) {
              token = adminData.sDepositToken
              if (!token) {
                token = jwt.sign({ _id: (adminData._id).toHexString() }, config.JWT_SECRET)
                await AdminsModel.updateOne({ _id: adminData._id }, { sDepositToken: token })
              }
            }
            iAdminId = adminData._id

            if (token) {
              const botlog = await BotLogModel.create({
                iMatchId: matchLeague.iMatchId,
                iMatchLeagueId,
                nTeams: nCopyBotsPerTeam,
                iAdminId,
                bInstantAdd: false,
                eType: 'CB'
              })
              try {
                // axios.post(`${config.FANTASY_NODE_URL}/api/admin/copy-user-team/${matchLeague.iMatchId}/v1`, {
                //   iMatchLeagueId: iMatchLeagueId,
                //   iUserId: iUserId,
                //   iBotLogId: botlog._id,
                //   aUserTeamId: [remainTeam.iUserTeamId],
                //   teamCount: nCopyBotsPerTeam
                // }, { headers: { 'Content-Type': 'application/json', Authorization: token } })
                const oCopyTeamData = {
                  iMatchId: matchLeague.iMatchId,
                  iMatchLeagueId: iMatchLeagueId,
                  iUserId: iUserId,
                  iBotLogId: botlog._id,
                  aUserTeamId: [remainTeam.iUserTeamId],
                  teamCount: nCopyBotsPerTeam,
                  oAdminData: {
                    iAdminId,
                    token
                  }
                }
                await queuePush('COPY_USER_TEAM', oCopyTeamData)
                bDoCopyBot = !bCopyBotInit
              } catch (e) {
                await BotLogModel.updateOne({ _id: ObjectId(botlog._id) }, { $inc: { nErrors: 1 }, $push: { aError: e } })
                handleCatchError(e)
              }
            } else {
            }
          }
        } catch (e) {
          handleCatchError(e)
        }

        if (!matchLeague.bUnlimitedJoin) {
          if (matchLeague.nJoined > matchLeague.nMax) {
            const matchLeagueData = await MatchLeagueModel.findByIdAndUpdate(matchLeague._id, { $inc: { nJoined: nJoinSuccess } }, { upsert: false, runValidators: true, new: true, readPreference: 'primary' }).lean()

            const sKey = nJoinSuccess === 0 && nAmount ? 'INSUFFICIENT_BALANCE' : 'SUCCESS'
            const responseData = {
              sKey: sKey,
              oValue: {
                nJoinSuccess,
                nTotalTeam,
                nAmount: nAmount > 0 ? nAmount : undefined,
                nJoined: sKey === 'SUCCESS' ? matchLeagueData.nJoined : undefined,
                aErrors: sKey === 'SUCCESS' ? aErrors : undefined
              }
            }

            return res.status(status.OK).jsonp({
              status: jsonStatus.OK,
              message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cuserJoined),
              data: responseData
            })
          }
        }
      }
      const matchLeagueData = await MatchLeagueModel.findByIdAndUpdate(matchLeague._id, { $inc: { nJoined: nJoinSuccess } }, { upsert: false, runValidators: true, new: true, readPreference: 'primary' }).lean()

      if (Number(matchLeague.nMax) === Number(matchLeague.nJoined) && matchLeagueData.bAutoCreate && matchLeagueData.bUnlimitedJoin === false) {
        await queuePush('autoCreateLeague', matchLeague)
      }
      // Assign referral on first league join
      const { sReferrerRewardsOn = '', iReferredBy = '' } = user
      if (iReferredBy && sReferrerRewardsOn && (sReferrerRewardsOn === 'FIRST_LEAGUE_JOIN' || (sReferrerRewardsOn === 'FIRST_PAID_LEAGUE_JOIN' && matchLeague.nPrice > 0))) {
        let totalLeagueJoinCount
        if (sReferrerRewardsOn === 'FIRST_PAID_LEAGUE_JOIN') {
          totalLeagueJoinCount = await UserLeagueModel.countDocuments({ iUserId, nOriginalPrice: { $gt: 0 } })
        } else {
          totalLeagueJoinCount = await UserLeagueModel.countDocuments({ iUserId })
        }

        if (nJoinSuccess !== 0) {
          totalLeagueJoinCount = totalLeagueJoinCount - nJoinSuccess

          if (totalLeagueJoinCount === 0) {
            const referredBy = await UsersModel.findOne({ _id: iReferredBy }, { sReferCode: 1, sUsername: 1, eType: 1, _id: 1 }).lean()
            if (referredBy) {
              const registerReferBonus = await commonRuleServices.findRule('RR')
              if (registerReferBonus) {
                const refer = await userBalanceServices.referBonus({ iUserId: referredBy._id, rule: registerReferBonus, sReferCode: referredBy.sReferCode, sUserName: referredBy.sUsername, eType: referredBy.eType, nReferrals: 1, iReferById: iUserId })
                if (refer.isSuccess === true) {
                  // Add Push Notification
                  await queuePush('pushNotification:registerReferBonus', { _id: referredBy._id })
                }
              }
            }
          }
        }
      }

      if (bDoCopyBot && token && user.eType === 'U') {
        try {
          const botlog = await BotLogModel.create({
            iMatchId: matchLeague.iMatchId,
            iMatchLeagueId,
            nTeams: teamCount * nMinTeamCount,
            iAdminId,
            bInstantAdd: false,
            eType: 'CB'
          })
          // axios.post(`${config.FANTASY_NODE_URL}/api/admin/copy-joined-user-team/${matchLeague.iMatchId}/v1`, {
          //   iMatchLeagueId: iMatchLeagueId,
          //   iBotLogId: botlog._id,
          //   teamCount: teamCount
          // }, { headers: { 'Content-Type': 'application/json', Authorization: token } }).catch(e => {
          //   (async () => {
          //     handleCatchError(e)
          //     await BotLogModel.updateOne({ _id: ObjectId(botlog._id) }, { $inc: { nErrors: 1 }, $push: { aError: e } })
          //   })()
          // })
          const oCopyTeamJoinData = {
            iMatchId: matchLeague.iMatchId,
            iMatchLeagueId,
            iBotLogId: botlog._id,
            teamCount: teamCount,
            oAdminData: {
              iAdminId,
              token
            }
          }
          await queuePush('JOIN_COPY_USER_TEAM', oCopyTeamJoinData)
        } catch (e) {
          handleCatchError(e)
        }
        cachegoose.clearCache(`matchLeague:${iMatchLeagueId}:active`)
      } else if (user.eType === 'U') {
      }

      const sKey = nJoinSuccess === 0 && nAmount ? 'INSUFFICIENT_BALANCE' : 'SUCCESS'
      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].join_contest_succ.replace('##', messages[req.userLanguage].cuserJoined),
        data: {
          sKey: sKey,
          oValue: {
            nJoinSuccess,
            nTotalTeam,
            nAmount: nAmount > 0 ? nAmount : undefined,
            nJoined: sKey === 'SUCCESS' ? matchLeagueData.nJoined : undefined,
            aErrors: sKey === 'SUCCESS' ? aErrors : undefined
          }
        }
      })
    } catch (error) {
      const { status = '', message = '' } = error
      if (!status) { return catchError('UserLeague.addV4', error, req, res) }
      return res.status(status).jsonp({ status, message })
    }
  }

  async list(req, res) {
    try {
      const { start, limit, sorting, search } = getPaginationValues2(req.query)
      const { bBotTeams, eType } = req.query

      let query = search ? { sUserName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}
      query = eType ? { ...query, eType } : { ...query }
      query = { ...query, iMatchLeagueId: ObjectId(req.params.id) }

      const matchLeague = await MatchLeagueModel.findOne({ _id: ObjectId(req.params.id) }, { iLeagueId: 1, iMatchId: 1, bBotCreate: 1, sName: 1, nTotalPayout: 1, sPayoutBreakupDesign: 1, bPrivateLeague: 1, eMatchStatus: 1, bCancelled: 1, nDistributedPayout: 1, eReportStatus: 1, aReportUrl: 1 }).lean()
      if (!matchLeague) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })

      let results = []

      const projection = {
        iUserTeamId: 1,
        iUserId: 1,
        iMatchLeagueId: 1,
        iMatchId: 1,
        nPoolPrice: 1,
        nTotalPoints: 1,
        nRank: 1,
        nPrice: 1,
        sUserName: 1,
        sTeamName: 1,
        sMatchName: 1,
        dCreatedAt: 1,
        bCancelled: 1,
        eType: 1,
        aExtraWin: 1,
        nBonusWin: 1
      }
      const isCached = await redisClient3.hmget(`hml:${matchLeague.iMatchId}:${req.params.id}`, 'exists', 'putTime', 'expireTime', 'matchId')

      if ([true, 'true'].includes(bBotTeams)) {
        results = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(req.params.id), eType: { $in: ['B', 'CB', 'CMB', 'U'] } }, projection).populate({ path: 'iUserTeamId', select: ['sHash', 'iCaptainId', 'iViceCaptainId'] }).sort(sorting).lean()

        const teamHashes = results.map(({ iUserTeamId }) => iUserTeamId.sHash)
        const uniqueHashes = [...new Set(teamHashes)]

        const teams = await MatchTeamsModel.find({ sHash: { $in: uniqueHashes } }, { aPlayers: 1, sHash: 1, _id: 0 }).populate([{ path: 'aPlayers.iMatchPlayerId', select: ['sName', 'nFantasyCredit', 'eRole'] }, { path: 'aPlayers.iTeamId', select: ['sName'] }]).lean()

        results = results.map((userLeague) => {
          const iUserTeamId = userLeague.iUserTeamId
          const team = teams.find((t) => t.sHash === iUserTeamId.sHash)
          delete iUserTeamId.sHash
          return { ...userLeague, aPlayers: team.aPlayers, iUserTeamId: iUserTeamId._id, iCaptainId: iUserTeamId.iCaptainId, iViceCaptainId: iUserTeamId.iViceCaptainId }
        })
      } else if (matchLeague.eMatchStatus === 'L' && matchLeague.bCancelled === false && Number(isCached[0])) {
        if (search || eType) {
          const aUserLeague = await UserLeagueModel.find(query, projection).skip(Number(start)).limit(Number(limit)).lean()

          const teamIds = []
          aUserLeague.forEach(s => {
            teamIds.push(s.iUserTeamId.toString())
          })

          const redisData = teamIds.length ? await getMyTeamsWithRankCalculationV2(matchLeague.iMatchId, req.params.id, teamIds) : []
          aUserLeague.forEach(s => {
            redisData.forEach(singleTeam => {
              if (s.iUserTeamId.toString() === singleTeam[0]) {
                const obj = { ...s }
                obj.nTotalPoints = parseFloat(singleTeam[1])
                obj.nRank = singleTeam[2]
                results.push(obj)
              }
            })
          })
          results.sort((a, b) => (a.nRank > b.nRank ? 1 : -1))
        } else {
          const end = parseInt(start) + parseInt(limit) - 1
          const data = await redisClient3.evalsha('5b9a4657e92b7ce3a7abe5cbb7441730454eda5e', 1, `ml:${matchLeague.iMatchId}:${req.params.id}`, parseInt(start), end)

          const userTeams = {}

          if (data.length > 0) {
            data.forEach(s => { userTeams[s[0]] = { nTotalPoints: parseFloat(s[1]), nRank: s[2] } })
            let ids = Object.keys(userTeams)
            ids = ids.map(s => ObjectId(s))
            const aUserLeague = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(req.params.id), iUserTeamId: { $in: ids }, bCancelled: false }, projection).lean()

            aUserLeague.forEach(s => {
              const obj = { ...s }
              obj.nTotalPoints = userTeams[s.iUserTeamId].nTotalPoints
              obj.nRank = userTeams[s.iUserTeamId].nRank
              results.push(obj)
            })
            results.sort((a, b) => (a.nRank > b.nRank ? 1 : -1))
          }
        }
      } else {
        results = await UserLeagueModel.find(query, projection).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()
      }
      const total = [true, 'true'].includes(bBotTeams) ? results.length : await UserLeagueModel.countDocuments({ ...query })

      results = results.map((league) => {
        league.nTotalPoints = league.nTotalPoints ? Number(parseFloat(league.nTotalPoints).toFixed(2)) : 0
        return league
      })
      const data = [{ total, results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cuserLeague), data: { data, matchLeague } })
    } catch (error) {
      return catchError('UserLeague.list', error, req, res)
    }
  }

  // match wise user-league list
  async matchWiseUserLeagueList(req, res) {
    try {
      const { iMatchId, iUserId } = req.body

      const data = await UserLeagueModel.find({ iMatchId: ObjectId(iMatchId), iUserId: ObjectId(iUserId) },
        { sTeamName: 1, aExtraWin: 1, nRank: 1, sLeagueName: 1, nPoolPrice: 1, bCancelled: 1, bWinDistributed: 1, iUserTeamId: 1, nTotalPayout: 1, nBonusWin: 1, nPrice: 1 },
        { readPreference: 'primaryPreferred' }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cuserLeague), data: data })
    } catch (error) {
      return catchError('UserLeague.matchWiseUserLeagueList', error, req, res)
    }
  }

  // To get list of user joined leagueId for particular match (For validation)
  async userJoinLeagueIdList(req, res) {
    try {
      const iUserId = req.user._id
      const data = await UserLeagueModel.aggregate([
        {
          $match: {
            iUserId,
            iMatchId: ObjectId(req.params.id)
          }
        }, {
          $group: {
            _id: '$iMatchLeagueId',
            nJoinedCount: { $sum: 1 },
            aUserTeams: {
              $push: '$iUserTeamId'
            }
          }
        }, {
          $project: {
            iMatchLeagueId: '$_id',
            nJoinedCount: 1,
            aUserTeams: 1, // Array of userteams added
            _id: 0
          }
        }
      ]).allowDiskUse(bAllowDiskUse).read('primary').exec()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cUserJoinedLeagueList), data })
    } catch (error) {
      catchError('UserLeague.userJoinLeagueList', error, req, res)
    }
  }

  // Joined validation for league
  async joinDetailsInSingleLeague(req, res) {
    try {
      const iUserId = req.user._id
      const data = await UserLeagueModel.aggregate([
        {
          $match: {
            iUserId,
            iMatchLeagueId: ObjectId(req.params.id)
          }
        }, {
          $group: {
            _id: '$iMatchLeagueId',
            nJoinedCount: { $sum: 1 },
            aUserTeams: {
              $push: '$iUserTeamId'
            }
          }
        }, {
          $project: {
            iMatchLeagueId: '$_id',
            nJoinedCount: 1,
            aUserTeams: 1, // Array of userteams added
            _id: 0
          }
        }
      ]).allowDiskUse(bAllowDiskUse).read('primary').exec()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cUserJoinedLeagueList), data: data[0] || {} })
    } catch (error) {
      catchError('UserLeague.joinDetailsInSingleLeague', error, req, res)
    }
  }

  // To get my-contest list
  async userJoinLeagueListV3(req, res) {
    try {
      const iUserId = req.user._id
      const matchLeagues = await MyMatchesModel.findOne({ iUserId, iMatchId: ObjectId(req.params.id) }, { aMatchLeagueId: 1 }, { readPreference: 'primary' }).lean()

      let matchLeagueIds = []
      if (matchLeagues && matchLeagues.aMatchLeagueId && matchLeagues.aMatchLeagueId.length) {
        matchLeagueIds = matchLeagues.aMatchLeagueId.map(id => ObjectId(id))
      }

      let data = await MatchLeagueModel.find({
        $or: [
          { $and: [{ _id: { $in: matchLeagueIds } }, { bCancelled: false, bPlayReturnProcess: false }] },
          { $and: [{ bPrivateLeague: true }, { bCancelled: false, bPlayReturnProcess: false }, { iUserId }, { iMatchId: ObjectId(req.params.id) }] }
        ]
      }, { bPlayReturnProcess: 0, nCopyBotsPerTeam: 0, nSameCopyBotTeam: 0, bBotCreate: 0, bCopyBotInit: 0, bInternalLeague: 0, bWinningDone: 0, nAutoFillSpots: 0 }).lean()

      const aMatchLeagueIds = data.map(({ _id }) => _id)
      const allUserLeagues = await UserLeagueModel.find({ iMatchLeagueId: { $in: aMatchLeagueIds }, iUserId: req.user._id, bCancelled: false }, { bAfterMinJoin: 0 }).lean()

      for (const matchLeaguesData of data) {
        const { _id: iMatchLeagueId, iMatchId, nWinnersCount, eMatchStatus, aLeaguePrize } = matchLeaguesData
        // const userLeagues = await UserLeagueModel.find({ iMatchLeagueId: iMatchLeagueId, iUserId: req.user._id, bCancelled: false }).lean()

        // To get all userLeagues of this matchLeague
        const userLeagues = Array.isArray(allUserLeagues) && allUserLeagues.length
          ? allUserLeagues.filter(userLeague => userLeague.iMatchLeagueId.toString() === iMatchLeagueId.toString()) : []

        let isCached = []

        if (eMatchStatus === 'U') {
          matchLeaguesData.userJoined = userLeagues.map(({ sTeamName, iUserTeamId, iUserId, _id }) => ({ sTeamName, nTotalPoints: 0, iUserTeamId, iUserId, _id }))
        } else if (eMatchStatus === 'L' || eMatchStatus === 'I') {
          try {
            isCached = await redisClient3.hmget(`hml:${iMatchId}:${iMatchLeagueId}`, 'exists', 'putTime', 'expireTime', 'matchId')

            if (Number(isCached[0])) {
              const teamIds = userLeagues.map(s => s.iUserTeamId)
              const redisData = teamIds.length ? await getMyTeamsWithRankCalculationV2(iMatchId, iMatchLeagueId, teamIds) : []
              const bPrizeCalculated = matchLeaguesData.bPrizeDone
              matchLeaguesData.userJoined = userLeagues.map((userLeague) => {
                const { sTeamName, iUserTeamId, iUserId, _id, bRankCalculated, bPointCalculated } = userLeague
                const cachedTeam = redisData.find(singleTeam => iUserTeamId.toString() === singleTeam[0].toString())
                const nTotalPoints = bPointCalculated ? userLeague.nTotalPoints : Number(cachedTeam[1])
                const nRank = bRankCalculated ? userLeague.nRank : Number(cachedTeam[2])
                if (bPointCalculated && bRankCalculated && bPrizeCalculated) redisClient2.hset(`hml:${iMatchId}:${iMatchLeagueId}`, 'exists', 0).then(() => { Promise.resolve() })

                if (nWinnersCount >= nRank) {
                  const prize = getPrice(aLeaguePrize, nRank, 1)
                  const { nTotalRealMoney, nTotalBonus, aTotalExtraWin } = prize

                  return ({ sTeamName, nRank, nTotalPoints, bTeamWinningZone: true, aExtraWin: aTotalExtraWin, nBonusWin: nTotalBonus, nPrice: nTotalRealMoney, iUserTeamId, iUserId, _id })
                }
                return { sTeamName, nRank, nTotalPoints, bTeamWinningZone: false, iUserTeamId, iUserId, _id }
              })
            } else {
              matchLeaguesData.userJoined = userLeagues.map(({ sTeamName, nTotalPoints = 0, iUserTeamId, iUserId, _id, nRank, aExtraWin = [], nBonusWin = 0, nPrice = 0 }) => (
                { sTeamName, nTotalPoints, iUserTeamId, iUserId, _id, nRank, aExtraWin, nBonusWin, nPrice, bTeamWinningZone: !!(aExtraWin.length || nPrice || nBonusWin) }
              ))
            }
          } catch (error) {
            matchLeaguesData.userJoined = userLeagues.map(({ sTeamName, nTotalPoints = 0, iUserTeamId, iUserId, _id, nRank, aExtraWin = [], nBonusWin = 0, nPrice = 0 }) => (
              { sTeamName, nTotalPoints, iUserTeamId, iUserId, _id, nRank, aExtraWin, nBonusWin, nPrice, bTeamWinningZone: !!(aExtraWin.length || nPrice || nBonusWin) }
            ))
            data = getUpdatedPrizeBreakupData(data)
            return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cUserJoinedLeagueList), data })
          }
        } else if (eMatchStatus === 'CMP') {
          matchLeaguesData.userJoined = userLeagues.map(({ sTeamName, nTotalPoints, iUserTeamId, iUserId, _id, nRank, aExtraWin, nBonusWin, nPrice }) => (
            { sTeamName, nTotalPoints, iUserTeamId, iUserId, _id, nRank, aExtraWin, nBonusWin, nPrice }
          ))
        }
      }

      // to get calculated prizeBreakup
      data = getUpdatedPrizeBreakupData(data)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cUserJoinedLeagueList), data })
    } catch (error) {
      catchError('UserLeague.userJoinLeagueListV3', error, req, res)
    }
  }

  // To switch user team
  async switchUserTeam(req, res) {
    try {
      const iUserId = req.user._id
      let { iUserTeamId } = req.body

      iUserTeamId = ObjectId(iUserTeamId)
      const iUserLeagueId = req.params.id

      const userLeague = await UserLeagueModel.findOne({ _id: iUserLeagueId, iUserId }, { iMatchId: 1, iMatchLeagueId: 1 }, { readPreference: 'primary' }).lean()
      if (!userLeague) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cuserSpLeague) })

      // check match is started or not
      const match = await matchServices.findUpcomingMatch(userLeague.iMatchId)
      if (!match) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_started })

      // check userteam is exist in Userteam model
      const switchTeam = await UserTeamModel.findOne({ iUserId, iMatchId: userLeague.iMatchId, _id: iUserTeamId }, {}, { readPreference: 'primary' }).lean()
      if (!switchTeam) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cuserTeam) })

      // check switch team is already exist in userLeague
      const switchTeamExist = await UserLeagueModel.findOne({ iUserId, _id: userLeague._id, iUserTeamId }, { bAfterMinJoin: 0 }, { readPreference: 'primary' }).lean()
      if (switchTeamExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cuserTeam) })

      const oldUserLeague = await UserLeagueModel.findByIdAndUpdate({ _id: userLeague._id }, { iUserTeamId, sTeamName: switchTeam.sName }, { new: false, runValidators: true, readPreference: 'primary' }).lean()

      res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].cuserTeamSwitched) })
      if (switchTeam) { // For update copy system user team
        const league = await MatchLeagueModel.findOne({ _id: userLeague.iMatchLeagueId, iMatchId: userLeague.iMatchId, bBotCreate: true, bCancelled: false }).lean()

        if (league) {
          const oUpdateCopyBotTeamData = { matchLeagueIds: [league._id], iMatchId: userLeague.iMatchId, iUserId, iUserTeamId: oldUserLeague.iUserTeamId, iNewUserTeamId: switchTeam._id, eUpdateTeamType: 'SWITCH', dStartDate: match.dStartDate }
          await CopyTeamUpdate(oUpdateCopyBotTeamData)
          // await queuePush('CopyTeamUpdate', { matchLeagueIds: [league._id], iMatchId: userLeague.iMatchId, iUserId, iUserTeamId: oldUserLeague.iUserTeamId, iNewUserTeamId: switchTeam._id, eUpdateTeamType: 'SWITCH', dStartDate: match.dStartDate })
        }
      }
    } catch (error) {
      catchError('UserLeague.switchUserTeam', error, req, res)
    }
  }

  // use for load test userLeague join
  async createUserLeague(req, res) {
    try {
      const { aUserTeamId, iMatchLeagueId, sPromo, sType } = req.body
      const iUserId = req.user._id
      const lang = req.userLanguage
      const nTotalTeam = aUserTeamId.length
      const query = { _id: ObjectId(iMatchLeagueId), bCancelled: false }

      let validationResult = {
        data: {}
      }

      if (sPromo && sPromo.length) {
        try {
          const data = { sPromo, iMatchLeagueId, nTeamCount: nTotalTeam, iUserId, lang }
          validationResult = await promocodeServices.validateMatchPromocode(data)
        } catch (error) {
          const { status: s = '', message = '' } = error
          if (!s) { return catchError('UserLeague.addV3', error, req, res) }
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: message, data: { sKey: 'OTHER', Value: { nJoinSuccess: 0, nTotalTeam } } })
        }
      }
      const { iPromocodeId, nBonus: nPromoDiscount = 0 } = validationResult.data || {}

      const aErrors = []

      const [matchLeague, user] = await Promise.all([
        MatchLeagueModel.findOne(query, { dCreatedAt: 0, dUpdatedAt: 0, sShareCode: 0, bIsProcessed: 0, bPlayReturnProcess: 0, sFairPlay: 0, bWinningDone: 0, bPrizeDone: 0, sShareLink: 0, bCopyLeague: 0, iUserId: 0 }, { readPreference: 'primary' }).lean().cache(CACHE_2, `matchLeague:${iMatchLeagueId}:active`),
        UsersModel.findById(iUserId, { bIsInternalAccount: 1, eType: 1, sUsername: 1, sProPic: 1, sReferrerRewardsOn: 1, iReferredBy: 1 }).lean().cache(CACHE_2, `user:${iUserId}`)
      ])

      if (!matchLeague) {
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague), data: { sKey: 'OTHER', oValue: { nJoinSuccess: 0, nTotalTeam } } })
      }

      // if (user.bIsInternalAccount === true) {
      //   if (matchLeague.bPrivateLeague === false) {
      //     return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].public_league_join_err, data: { sKey: 'OTHER', oValue: { nJoinSuccess: 0, nTotalTeam } } })
      //   } else if (matchLeague.bPrivateLeague === true && matchLeague.bInternalLeague === false) {
      //     return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].league_join_err, data: { sKey: 'OTHER', oValue: { nJoinSuccess: 0, nTotalTeam } } })
      //   }
      // } else {
      //   if (matchLeague.bInternalLeague === true) {
      //     return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].league_join_err, data: { sKey: 'OTHER', oValue: { nJoinSuccess: 0, nTotalTeam } } })
      //   }
      // }
      // eslint-disable-next-line no-unused-vars
      const [upcomingMatch, multiTeam] = await Promise.all([
        matchServices.findUpcomingMatch(matchLeague.iMatchId),
        UserLeagueModel.countDocuments({ iMatchLeagueId: matchLeague._id, iUserId }, { readPreference: 'primary' })
      ])
      if (!upcomingMatch) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_started, data: { sKey: 'OTHER', oValue: { nJoinSuccess: 0, nTotalTeam } } })

      let teams = []
      let remainTeams
      if (!Array.isArray(aUserTeamId)) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_started, data: { sKey: 'OTHER', oValue: { nJoinSuccess: 0, nTotalTeam } } }) }

      teams = aUserTeamId.filter(team => !teams.includes(team))
      teams = teams.map(team => ObjectId(team))

      const teamAlreadyJoin = await UserLeagueModel.find({ iMatchLeagueId: matchLeague._id, iUserId, iUserTeamId: { $in: teams } }, { bAfterMinJoin: 0 }, { readPreference: 'primary' }).lean() // check for multi join

      remainTeams = teams.filter(team => {
        return !(teamAlreadyJoin.some(joinedTeam => joinedTeam.iUserTeamId.toString() === team.toString()))
      })

      const team = await UserTeamModel.find({ iMatchId: matchLeague.iMatchId, _id: { $in: aUserTeamId }, iUserId }, {}, { readPreference: 'primary' }).lean()
      remainTeams = team.map(({ _id, sName }) => ({ iUserTeamId: _id, sName }))

      matchLeague.nJoined = await redisClient.incrby(`${matchLeague._id}`, remainTeams.length)

      if (!matchLeague.bUnlimitedJoin) {
        if (matchLeague.nJoined > matchLeague.nMax) {
          await redisClient.decrby(`${matchLeague._id}`, remainTeams.length)
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].league_full, data: { sKey: 'REFRESH_LEAGUE', oValue: { nJoinSuccess: 0, nTotalTeam, bRefreshLeague: true } } })
        }
      }

      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform')) ? req.header('Platform') : 'O'

      let nJoinSuccess = 0
      let nAmount = 0
      let bDoCopyBot = false
      let token = null
      let teamCount = ''
      // const userBalance = 0
      let userType
      if (user.eType === 'B') {
        if (sType === 'CP') {
          userType = 'CB'
        } else if (sType === 'CMB') {
          userType = 'CMB'
        } else {
          userType = 'B'
        }
      } else {
        userType = 'U'
      }
      let actualUserJoined, iAdminId
      if (user.eType === 'U' && matchLeague && matchLeague.bBotCreate) {
        actualUserJoined = await UserLeagueModel.countDocuments({ iMatchLeagueId: ObjectId(matchLeague._id), eType: 'U' }, { readPreference: 'primary' })
      }
      for (const remainTeam of remainTeams) {
        const nJoinPrice = (nPromoDiscount) ? matchLeague.nPrice - nPromoDiscount : matchLeague.nPrice
        const sPromocode = nPromoDiscount ? sPromo : ''
        const data = await joinLeagueTeamWiseV2({
          matchLeague, iUserTeamId: remainTeam.iUserTeamId, iUserId, iMatchLeagueId, team: remainTeam.sName, upcomingMatch, ePlatform, user: user, iPromocodeId, nPromoDiscount, sType: userType, sPromocode, nJoinPrice
        })

        if (!data.isSuccess) {
          nAmount = data.nAmount ? nAmount + data.nAmount : nAmount
          await redisClient.decr(`${matchLeague._id}`)
          continue
        }
        nJoinSuccess++

        if (user.eType === 'U') {
          try {
            const { bBotCreate, nMinTeamCount, bCopyBotInit = '', nCopyBotsPerTeam = '' } = matchLeague
            if (nCopyBotsPerTeam) teamCount = nCopyBotsPerTeam
            if (bBotCreate && bBotCreate === true && nMinTeamCount && (actualUserJoined + nJoinSuccess) > nMinTeamCount) {
              const adminData = await AdminsModel.findOne({ eStatus: 'Y', eType: 'SUPER', aJwtTokens: { $exists: true, $ne: [] } }, { _id: 1, sDepositToken: 1 }).sort({ dLoginAt: -1 }).lean()
              if (adminData) {
                token = adminData.sDepositToken
                if (!token) {
                  token = jwt.sign({ _id: (adminData._id).toHexString() }, config.JWT_SECRET)
                  await AdminsModel.updateOne({ _id: adminData._id }, { sDepositToken: token })
                }
              }
              iAdminId = adminData._id

              if (token) {
                try {
                  axios.post(`${config.FANTASY_NODE_URL}/api/admin/copy-user-team/${matchLeague.iMatchId}/v1`, {
                    iMatchLeagueId: iMatchLeagueId,
                    iUserId: iUserId,
                    aUserTeamId: [remainTeam.iUserTeamId],
                    teamCount: nCopyBotsPerTeam
                  }, { headers: { 'Content-Type': 'application/json', Authorization: token } }).catch(e => {
                    (async () => {
                      handleCatchError(e)
                      const botLogError = new BotLogModel({
                        iMatchId: matchLeague.iMatchId,
                        iMatchLeagueId,
                        nTeams: nCopyBotsPerTeam,
                        nErrors: nCopyBotsPerTeam,
                        iAdminId,
                        bInstantAdd: false,
                        eType: 'CB'
                      })
                      botLogError.aError.push(e)
                      await botLogError.save()
                    })()
                  })

                  bDoCopyBot = (bCopyBotInit === false)
                } catch (e) {
                  handleCatchError(e)
                }
              } else {
                console.log('createUserLeague Copy Bots Request Details 1 :: ', token, adminData, remainTeam.iUserTeamId)
              }
            }
          } catch (e) {
            handleCatchError(e)
          }
        }

        if (!matchLeague.bUnlimitedJoin) {
          if (matchLeague.nJoined > matchLeague.nMax) {
            const matchLeagueData = await MatchLeagueModel.findByIdAndUpdate(matchLeague._id, { $inc: { nJoined: nJoinSuccess } }, { upsert: false, runValidators: true, new: true, readPreference: 'primary' }).lean()

            const sKey = nJoinSuccess === 0 && nAmount ? 'INSUFFICIENT_BALANCE' : 'SUCCESS'
            const responseData = {
              sKey: sKey,
              oValue: {
                nJoinSuccess,
                nTotalTeam,
                nAmount: nAmount > 0 ? nAmount : undefined,
                nJoined: sKey === 'SUCCESS' ? matchLeagueData.nJoined : undefined,
                aErrors: sKey === 'SUCCESS' ? aErrors : undefined
              }
            }

            return res.status(status.OK).jsonp({
              status: jsonStatus.OK,
              message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cuserJoined),
              data: responseData
            })
          }
        }
      }
      const matchLeagueData = await MatchLeagueModel.findByIdAndUpdate(matchLeague._id, { $inc: { nJoined: nJoinSuccess } }, { upsert: false, runValidators: true, new: true, readPreference: 'primary' }).lean()

      if (Number(matchLeague.nMax) === Number(matchLeague.nJoined) && matchLeagueData.bAutoCreate && matchLeagueData.bUnlimitedJoin === false) {
        await queuePush('autoCreateLeague', matchLeague)
      }
      // Assign referral on first league join
      const { sReferrerRewardsOn = '', iReferredBy = '' } = user
      if (iReferredBy && sReferrerRewardsOn && (sReferrerRewardsOn === 'FIRST_LEAGUE_JOIN' || (sReferrerRewardsOn === 'FIRST_PAID_LEAGUE_JOIN' && matchLeague.nPrice > 0))) {
        let totalLeagueJoinCount
        if (sReferrerRewardsOn === 'FIRST_PAID_LEAGUE_JOIN') {
          totalLeagueJoinCount = await UserLeagueModel.countDocuments({ iUserId, nOriginalPrice: { $gt: 0 } })
        } else {
          totalLeagueJoinCount = await UserLeagueModel.countDocuments({ iUserId })
        }

        if (nJoinSuccess !== 0) {
          totalLeagueJoinCount = totalLeagueJoinCount - nJoinSuccess

          if (totalLeagueJoinCount === 0) {
            const referredBy = await UsersModel.findOne({ _id: iReferredBy }, { sReferCode: 1, sUsername: 1, eType: 1, _id: 1 }).lean()
            if (referredBy) {
              const registerReferBonus = await commonRuleServices.findRule('RR')
              if (registerReferBonus) {
                const refer = await userBalanceServices.referBonus({ iUserId: referredBy._id, rule: registerReferBonus, sReferCode: referredBy.sReferCode, sUserName: referredBy.sUsername, eType: referredBy.eType, nReferrals: 1, iReferById: iUserId })
                if (refer.isSuccess === true) {
                  // Add Push Notification
                  await queuePush('pushNotification:registerReferBonus', { _id: referredBy._id })
                }
              }
            }
          }
        }
      }

      if (bDoCopyBot && token && user.eType === 'U') {
        try {
          axios.post(`${config.FANTASY_NODE_URL}/api/admin/copy-joined-user-team/${matchLeague.iMatchId}/v1`, {
            iMatchLeagueId: iMatchLeagueId,
            teamCount: teamCount
          }, { headers: { 'Content-Type': 'application/json', Authorization: token } }).catch(e => {
            (async () => {
              handleCatchError(e)
              const botLogError = new BotLogModel({
                iMatchId: matchLeague.iMatchId,
                iMatchLeagueId,
                nTeams: teamCount,
                nErrors: teamCount,
                iAdminId,
                bInstantAdd: false,
                eType: 'CB'
              })
              botLogError.aError.push(e)
              await botLogError.save()
            })()
          })
        } catch (e) {
          handleCatchError(e)
        }
        cachegoose.clearCache(`matchLeague:${iMatchLeagueId}:active`)
      } else if (user.eType === 'U') {
        console.log('createUserLeague Copy Bots Request Details 2 :: ', token, bDoCopyBot, iMatchLeagueId, user._id)
      }

      const sKey = nJoinSuccess === 0 && nAmount ? 'INSUFFICIENT_BALANCE' : 'SUCCESS'
      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].join_contest_succ.replace('##', messages[req.userLanguage].cuserJoined),
        data: {
          sKey: sKey,
          oValue: {
            nJoinSuccess,
            nTotalTeam,
            nAmount: nAmount > 0 ? nAmount : undefined,
            nJoined: sKey === 'SUCCESS' ? matchLeagueData.nJoined : undefined,
            aErrors: sKey === 'SUCCESS' ? aErrors : undefined
          }
        }
      })
    } catch (error) {
      const { status = '', message = '' } = error
      if (!status) { return catchError('UserLeague.addV3', error, req, res) }
      return res.status(status).jsonp({ status, message })
    }
  }

  // get Match Contest Extra win list
  async extraWinList(req, res) {
    try {
      const { nStart, nLimit, sSorting } = req.query
      const { start, limit, sorting } = getPaginationValues2({ start: nStart, limit: nLimit, sort: sSorting })

      const [data, nTotal] = await Promise.all([
        UserLeagueModel.find({ iMatchId: ObjectId(req.params.id), bCancelled: false, 'aExtraWin.0': { $exists: true } }, { iMatchId: 1, iMatchLeagueId: 1, iUserId: 1, aExtraWin: 1 })
          .populate('oUser', 'sName sUsername eType')
          .populate('oMatchLeague', 'sName')
          .sort(sorting).skip(Number(start)).limit(Number(limit))
          .lean(),
        UserLeagueModel.countDocuments({ iMatchId: ObjectId(req.params.id), bCancelled: false, 'aExtraWin.0': { $exists: true } }, { iMatchId: 1, iMatchLeagueId: 1, iUserId: 1, aExtraWin: 1 })

      ])

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].extrawin_list), data, nTotal })
    } catch (error) {
      catchError('UserLeague.extraWinList', error, req, res)
    }
  }

  async generateMatchLeagueReport(req, res) {
    try {
      const matchLeague = await MatchLeagueModel.findOneAndUpdate({ _id: ObjectId(req.params.id) }, { eReportStatus: 'P', aReportUrl: [] }, { new: true, runValidators: true }).lean()
      if (!matchLeague) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })

      const oMatch = await MatchModel.findOne({ _id: matchLeague.iMatchId }, { sName: 1, _id: 0 }).lean()
      const projection = { iUserTeamId: 1, nTotalPoints: 1, nRank: 1, nPrice: 1, sUserName: 1, sTeamName: 1, dCreatedAt: 1, eType: 1 }

      const aMatchPlayer = await MatchPlayerModel.find({ iMatchId: matchLeague.iMatchId }, { sName: 1 }).lean()

      const oMatchPlayers = aMatchPlayer.reduce((acc, cur) => {
        acc = { ...acc, [cur._id.toString()]: cur.sName }
        return acc
      }, {})

      const sPrizePool = matchLeague?.bPoolPrize ? 'Yes' : 'No'
      const sMatchName = oMatch?.sName ? oMatch.sName : ''

      const schema = [
        {
          column: 'Sr.No.',
          type: Number,
          value: object => object.nSr_no,
          width: '15pt',
          align: 'center'
        },
        {
          column: 'Username',
          type: String,
          value: object => object.sUserName,
          width: '16.5pt',
          align: 'center'
        },
        {
          column: 'User Type',
          type: String,
          value: object => object.eType,
          width: '15pt',
          align: 'center'
        },
        {
          column: 'Match Name',
          type: String,
          width: '16.5pt',
          value: object => sMatchName,
          align: 'center'
        },
        {
          column: 'Team Name',
          type: String,
          value: object => object.sTeamName,
          width: '16.5pt',
          align: 'center'
        },
        {
          column: 'Total Points',
          type: Number,
          value: object => object.nTotalPoints,
          align: 'center',
          width: '16.5pt'
        },
        {
          column: 'Rank',
          type: Number,
          value: object => object.nRank,
          align: 'center',
          width: '16.5pt'
        },
        {
          column: 'Prize',
          type: Number,
          value: object => object.nPrice,
          align: 'center',
          width: '16.5pt'
        },
        {
          column: 'Pool Prize',
          type: String,
          value: object => sPrizePool,
          align: 'center',
          width: '16.5pt'
        },
        {
          column: 'Contest Join Time',
          type: String,
          value: object => moment(object.dCreatedAt).format('lll'),
          align: 'center',
          width: '25pt'
        },
        {
          column: 'Player1',
          type: String,
          value: object => object.aPlayers[0],
          align: 'center'
        },
        {
          column: 'Player2',
          type: String,
          value: object => object.aPlayers[1],
          align: 'center'
        },
        {
          column: 'Player3',
          type: String,
          value: object => object.aPlayers[2],
          align: 'center'
        },
        {
          column: 'Player4',
          type: String,
          value: object => object.aPlayers[3],
          align: 'center'
        },
        {
          column: 'Player5',
          type: String,
          value: object => object.aPlayers[4],
          align: 'center'
        },
        {
          column: 'Player6',
          type: String,
          value: object => object.aPlayers[5],
          align: 'center'
        },
        {
          column: 'Player7',
          type: String,
          value: object => object.aPlayers[6],
          align: 'center'
        },
        {
          column: 'Player8',
          type: String,
          value: object => object.aPlayers[7],
          align: 'center'
        },
        {
          column: 'Player9',
          type: String,
          value: object => object.aPlayers[8],
          align: 'center'
        },
        {
          column: 'Player10',
          type: String,
          value: object => object.aPlayers[9],
          align: 'center'
        },
        {
          column: 'Player11',
          type: String,
          value: object => object.aPlayers[10],
          align: 'center'
        }
      ]

      let nCount = 1
      let nFile = 1
      const aUserLeague = []
      UserLeagueModel.find({ iMatchLeagueId: ObjectId(req.params.id), eType: { $in: ['B', 'CB', 'CMB', 'U'] } }, projection).populate({ path: 'iUserTeamId', select: ['sHash', 'iCaptainId', 'iViceCaptainId'] }).sort({ nRank: 1 }).lean().cursor({ batchSize: 500 })
        .on('data', async (league) => {
          if (aUserLeague.length > 100000) {
            let aData = aUserLeague.splice(0, 100000)
            const teamHashes = aData.map(({ iUserTeamId }) => iUserTeamId.sHash)
            const uniqueHashes = [...new Set(teamHashes)]

            const teams = await MatchTeamsModel.find({ sHash: { $in: uniqueHashes } }, { 'aPlayers.iMatchPlayerId': 1, sHash: 1, _id: 0 }).lean()

            aData = aData.map((userLeague) => {
              const iUserTeamId = userLeague.iUserTeamId

              const team = teams[teams.findIndex((t) => t.sHash === iUserTeamId.sHash)]
              const aPlayers = team.aPlayers.map(p => {
                const isC = p.iMatchPlayerId.toString() === iUserTeamId.iCaptainId.toString()
                const isVc = p.iMatchPlayerId.toString() === iUserTeamId.iViceCaptainId.toString()
                const replace = isC ? '(C)' : isVc ? '(VC)' : ''
                const sName = `${oMatchPlayers[p.iMatchPlayerId.toString()]}${replace}`
                return sName
              })
              const oType = { U: 'User', B: 'Bot', CB: 'Copy Bot', CMB: 'Combination Bot' }

              delete userLeague.iUserTeamId
              return { ...userLeague, eType: oType[userLeague.eType], nSr_no: nCount++, aPlayers }
            })

            const sFileName = `${req.params.id}_${nFile++}`
            const sPath = config.s3MatchLeagueReport
            const sContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            const sDeposition = `filename=${matchLeague.sName}_${nFile}.xlsx`

            const file = await createXlsxFile(schema, aData, sFileName)

            const sUrl = await s3.putFile(file.filename, sContentType, sPath, file.content, sDeposition)

            await MatchLeagueModel.updateOne({ _id: ObjectId(req.params.id) }, { $addToSet: { aReportUrl: sUrl.Key } })
          }

          aUserLeague.push(league)
        })
        .on('end', async (league) => {
          const teamHashes = aUserLeague.map(({ iUserTeamId }) => iUserTeamId.sHash)
          const uniqueHashes = [...new Set(teamHashes)]

          const teams = await MatchTeamsModel.find({ sHash: { $in: uniqueHashes } }, { 'aPlayers.iMatchPlayerId': 1, sHash: 1, _id: 0 }).lean()

          const aData = aUserLeague.map((userLeague) => {
            const iUserTeamId = userLeague.iUserTeamId
            const team = teams[teams.findIndex((t) => t.sHash === iUserTeamId.sHash)]

            const aPlayers = team.aPlayers.map(p => {
              const isC = p.iMatchPlayerId.toString() === iUserTeamId.iCaptainId.toString()
              const isVc = p.iMatchPlayerId.toString() === iUserTeamId.iViceCaptainId.toString()
              const replace = isC ? '(C)' : isVc ? '(VC)' : ''
              const sName = `${oMatchPlayers[p.iMatchPlayerId.toString()]}${replace}`
              return sName
            })
            const oType = { U: 'User', B: 'Bot', CB: 'Copy Bot', CMB: 'Combination Bot' }

            delete userLeague.iUserTeamId
            return { ...userLeague, eType: oType[userLeague.eType], nSr_no: nCount++, aPlayers }
          })

          const sFileName = `${req.params.id}_${nFile}`
          const sPath = config.s3MatchLeagueReport
          const sContentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          const sDeposition = `filename=${matchLeague.sName}_${nFile}.xlsx`

          const file = await createXlsxFile(schema, aData, sFileName)

          const sUrl = await s3.putFile(file.filename, sContentType, sPath, file.content, sDeposition)

          await MatchLeagueModel.updateOne({ _id: ObjectId(req.params.id) }, { eReportStatus: 'S', $addToSet: { aReportUrl: sUrl.Key } })
        })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cuserLeague), data: matchLeague })
    } catch (error) {
      catchError('UserLeague.generateMatchLeagueReport', error, req, res)
    }
  }

  async generateMatchLeagueReportV2(req, res) {
    try {
      const matchLeague = await MatchLeagueModel.findOneAndUpdate({ _id: ObjectId(req.params.id) }, { eReportStatus: 'P', aReportUrl: [] }, { new: true, runValidators: true }).lean()
      if (!matchLeague) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })

      const aMatchPlayer = await MatchPlayerModel.find({ iMatchId: matchLeague.iMatchId }, { sName: 1 }).lean()

      const oMatchPlayers = aMatchPlayer.reduce((acc, cur) => {
        acc = { ...acc, [cur._id.toString()]: cur.sName }
        return acc
      }, {})

      const sPrizePool = matchLeague?.bPoolPrize ? 'Yes' : 'No'

      generateUserLeagueReport(req.params.id, oMatchPlayers, sPrizePool)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cuserLeague), data: matchLeague })
    } catch (error) {
      catchError('UserLeague.generateMatchLeagueReport', error, req, res)
    }
  }
}
// To add new MatchLeague

// done
async function joinLeagueTeamWiseV2(data) {
  let pcs, session, oUserleaguePayload, iUserLeagueId, oInitialData
  try {
    const { matchLeague, iUserTeamId, iUserId, iMatchLeagueId, iPromocodeId, nPromoDiscount, team, upcomingMatch, ePlatform, user, sType, sPromocode, nJoinPrice, bAfterMinJoin } = data
    const { iMatchId, nTotalPayout, bPoolPrize, sPayoutBreakupDesign, sName, nBonusUtil, bPrivateLeague } = matchLeague
    let { nPrice } = matchLeague
    const nOriginalPrice = nPrice

    nPrice = (nPromoDiscount) ? nPrice - nPromoDiscount : nPrice

    const transactionOptions = {
      readPreference: 'primary',
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority' }
    }

    oUserleaguePayload = { iUserId, iMatchLeagueId, iMatchId, iUserTeamId, eType: user.eType, eCategory: upcomingMatch.eCategory, nTotalPayout, nPoolPrice: bPoolPrize, sPayoutBreakupDesign, sTeamName: team, sMatchName: upcomingMatch.sName, sLeagueName: sName, sUserName: user.sUsername, ePlatform, sProPic: user.sProPic, nOriginalPrice, iPromocodeId, nPromoDiscount, nPricePaid: nPrice, sType, bAfterMinJoin }
    const isUserJoined = await UserLeagueModel.findOne({ iUserId, iMatchLeagueId }).lean()

    session = await GamesDBConnect.startSession()
    session.startTransaction(transactionOptions)
    const [d] = await UserLeagueModel.create([oUserleaguePayload], { session })
    iUserLeagueId = d._id
    // await UserLeagueModel.updateOne({ _id: ObjectId(d._id) }, )
    const oPlayDeductionPayload = { iUserId, iUserLeagueId: d._id, iMatchLeagueId, iMatchId, nPrice, nBonusUtil, sMatchName: upcomingMatch.sName, sUserName: user.sUsername, eType: user.eType, eCategory: upcomingMatch.eCategory, sPromocode, bPrivateLeague, nJoinPrice, nPromoDiscount, iUserTeamId }
    const response = await userBalanceServices.userPlayDeduction(oPlayDeductionPayload, session)

    if (!response || typeof response !== 'object') {
      console.log('joinLeagueTeamWiseV2 !response', { iUserLeagueId, response, iMatchLeagueId })
      await session.abortTransaction()
      await Promise.all([
        UnhandledUserLeagueModel.create({
          iDeletedUserLeagueId: ObjectId(d._id),
          iUserId,
          iMatchLeagueId,
          oCreationPayload: oUserleaguePayload,
          oPlayDeductionPayload,
          oPlayDeductionResponse: response
        }),
        UserLeagueModel.deleteOne({ _id: ObjectId(d._id) })
      ])

      return { nAmount: nPrice, isSuccess: false }
    }

    if (response && !response.isSuccess) {
      console.log('joinLeagueTeamWiseV2 response', { iUserLeagueId, response, iMatchLeagueId })
      await session.abortTransaction()
      await UnhandledUserLeagueModel.create({
        iDeletedUserLeagueId: ObjectId(d._id),
        iUserId,
        iMatchLeagueId,
        oCreationPayload: oUserleaguePayload,
        oPlayDeductionPayload,
        oPlayDeductionResponse: response
      })
      await UserLeagueModel.deleteOne({ _id: ObjectId(d._id) })
      return { nAmount: response.nPrice, isSuccess: false }
    }
    await session.commitTransaction()
    // Added actual amount and actual bonus used in user league
    // await UserLeagueModel.updateOne(
    //   { _id: iUserLeagueId },
    //   oUserleaguePayload)
    const aQuery = []
    aQuery.push(MyMatchesModel.findOne({ iUserId, iMatchId }, { aMatchLeagueId: 1 }, { readPreference: 'primary' }).lean(),
      UserLeagueModel.updateOne({ _id: ObjectId(d._id) }, { actualCashUsed: response.nPrice || 0, actualBonusUsed: response.nActualBonus || 0 }))

    if (nPromoDiscount) {
      aQuery.push(PromocodeStatisticModel.create({ iUserId, iPromocodeId, nAmount: nPromoDiscount, sTransactionType: 'MATCH', iMatchId, iMatchLeagueId, iUserLeagueId: d._id }))
    }

    let myMatch
    [myMatch, , pcs] = await Promise.all(aQuery)

    if (myMatch) {
      const isLeagueExist = myMatch.aMatchLeagueId.some((matchLeagueId) => matchLeagueId.toString() === iMatchLeagueId.toString())
      if (!isLeagueExist || !isUserJoined) {
        await MyMatchesModel.updateOne({ _id: ObjectId(myMatch._id) }, { $inc: { nJoinedLeague: 1 }, $addToSet: { aMatchLeagueId: iMatchLeagueId }, $set: { dStartDate: upcomingMatch.dStartDate } }, { upsert: true })
      }
    } else {
      await MyMatchesModel.create([{ iUserId, iMatchId, dStartDate: upcomingMatch.dStartDate, nJoinedLeague: 1, aMatchLeagueId: iMatchLeagueId, nWinnings: 0, eMatchStatus: upcomingMatch.eStatus, eCategory: upcomingMatch.eCategory, eType: user.eType }])
    }
    return { isSuccess: true }
  } catch (error) {
    await session.abortTransaction()
    const promises = []
    console.log('joinLeagueTeamWiseV2 error', error, oUserleaguePayload, iUserLeagueId)
    if (iUserLeagueId) {
      promises.push(
        UserLeagueModel.deleteOne({ _id: ObjectId(iUserLeagueId) }),
        UnhandledUserLeagueModel.create({
          iDeletedUserLeagueId: ObjectId(iUserLeagueId),
          oError: { error, oUserleaguePayload }
        })
      )
    }
    if (pcs && pcs._id) {
      promises.push(PromocodeStatisticModel.deleteOne({ _id: ObjectId(pcs._id) }))
    }
    await Promise.all(promises)
    handleCatchError(error)
    return { isSuccess: false }
  } finally {
    await session.endSession()
  }
}

module.exports = new UserLeague()
