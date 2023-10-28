const PrivateLeaguePrizeModel = require('./model')
const MatchLeagueModel = require('../matchLeague/model')
const MyMatchesModel = require('../myMatches/model')
const UserLeagueModel = require('../userLeague/model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, removenull, getStatisticsSportsKey, randomStr } = require('../../helper/utilities.services')
const matchServices = require('../match/services')
const commonRuleServices = require('../commonRules/services')
const settingServices = require('../setting/services')
const StatisticsModel = require('../user/statistics/model')
const { genDynamicLinkV2 } = require('../../helper/firebase.services')
const UserModel = require('../user/model')
const { GamesDBConnect } = require('../../database/mongoose')
const common = require('../../config/common')

const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId

class PrivateLeague {
  async addV2(req, res) {
    try {
      let { iMatchId, nPrizeBreakup, nMax, nTotalPayout, bPoolPrize, sName } = req.body
      req.body = pick(req.body, ['iMatchId', 'sName', 'nMax', 'bMultipleEntry', 'bPoolPrize', 'nTotalPayout', 'nPrizeBreakup'])
      const iUserId = req.user._id
      const user = await UserModel.findById(iUserId).lean()
      if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

      const bInternalLeague = (user.bIsInternalAccount === true)

      nMax = +nMax
      nTotalPayout = +nTotalPayout
      removenull(req.body)

      // match is already started user cant join
      const match = await matchServices.findUpcomingMatch(iMatchId)
      if (!match) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_started })

      let plc = await commonRuleServices.findRule('PLC')
      plc = !plc ? { nAmount: 0 } : plc
      // if (!plc) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cplcRule) })

      let lcc = await commonRuleServices.findRule('LCC')
      lcc = !lcc ? { nAmount: 0 } : lcc
      // if (!lcc) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].clccRule) })

      let lcg = await commonRuleServices.findRule('LCG')
      lcg = !lcg ? { nAmount: 0 } : lcg
      // if (!lcg) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].lcgRule) })
      const nLeagueCreatorGst = lcg.nAmount

      const nAdminCommission = Number(parseFloat((nTotalPayout * plc.nAmount) / 100).toFixed(2))
      let nPrice = (((parseFloat(nTotalPayout) * plc.nAmount) / 100) + parseFloat(nTotalPayout)) / parseInt(nMax)
      const nReminder = nPrice % 0.5
      if (nReminder > 0) {
        nPrice = nPrice - nReminder + 0.5
      }

      const pcf = await settingServices.findSetting('PCF')
      if (nTotalPayout < pcf.nMin) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].greater_then_err.replace('##', messages[req.userLanguage].entryFee).replace('#', `${pcf.nMin}`) })
      if (nTotalPayout > pcf.nMax) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].entryFee).replace('#', `${pcf.nMax}`) })

      const pcs = await settingServices.findSetting('PCS')
      if (nMax < pcs.nMin) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].greater_then_err.replace('##', messages[req.userLanguage].cContestSize).replace('#', `${pcf.nMin}`) })
      if (nMax > pcs.nMax) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].cContestSize).replace('#', `${pcf.nMax}`) })

      let nCreatorBonus = parseFloat(Number((((nPrice * nMax) - nTotalPayout) * lcc.nAmount / 100).toFixed(2)))
      const nCreatorBonusGST = parseFloat(Number(parseFloat((nCreatorBonus * 100) / (100 + nLeagueCreatorGst)).toFixed(2)))
      const nCreatorDeductedGST = parseFloat(Number(parseFloat(nCreatorBonus - nCreatorBonusGST).toFixed(2)))
      nCreatorBonus = parseFloat(nCreatorBonus - nCreatorDeductedGST)

      const prizeBreakup = await PrivateLeaguePrizeModel.findOne({ nPrizeNo: nPrizeBreakup, eStatus: 'Y' }).lean()

      if (!prizeBreakup) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cPrizeBreakup) })
      prizeBreakup.aPrizeBreakups.forEach(({ nPrizePer }, i) => {
        prizeBreakup.aPrizeBreakups[i].nPrize = bPoolPrize ? nPrizePer : Number(parseFloat((nTotalPayout * nPrizePer) / 100).toFixed(2))
        // prizeBreakup.aPrizeBreakups[i].nPrizePer = Number(parseFloat((nTotalPayout * nPrizePer) / 100).toFixed(2))
        // prizeBreakup.aPrizeBreakups[i].nPrize = Number(parseFloat((nTotalPayout * nPrizePer) / 100).toFixed(2))
      })
      const sShareCode = await generateCode(user.sName || user.sUsername)
      // const sShareCode = await generateCodeV2()
      const sShareLink = await genDynamicLinkV2('join', sShareCode, match.eCategory, match._id)

      const data = await MatchLeagueModel.create({ ...req.body, sName, nCreatorCommission: nCreatorBonus, nAdminCommission, bPrivateLeague: true, eCategory: match.eCategory, aLeaguePrize: prizeBreakup.aPrizeBreakups, sShareCode, nMin: pcs.nMin, iUserId: user._id, nPrice: Number(nPrice), bInternalLeague, nWinnersCount: nPrizeBreakup, sShareLink, nCreatorBonusGst: nCreatorDeductedGST, eMatchStatus: 'U' })

      const matchCategory = getStatisticsSportsKey(match.eCategory)

      await StatisticsModel.updateOne({ iUserId }, { $inc: { [`${matchCategory}.nCreatePLeague`]: 1 } }, { upsert: true, runValidators: true })

      const transactionOptions = {
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' }
      }

      const session = await GamesDBConnect.startSession()
      session.startTransaction(transactionOptions)

      try {
        const myMatch = await MyMatchesModel.findOne({ iUserId, iMatchId }, null, { session })
        const iMatchLeagueId = data._id

        if (myMatch) {
          await MyMatchesModel.updateOne({ _id: ObjectId(myMatch._id) }, { $addToSet: { aMatchLeagueId: iMatchLeagueId } }).session(session)
        } else {
          await MyMatchesModel.create([{ dStartDate: match.dStartDate, iUserId, iMatchId, aMatchLeagueId: iMatchLeagueId, nWinnings: 0, eMatchStatus: match.eStatus, eCategory: match.eCategory, eType: user.eType }], { session })
        }
        await session.commitTransaction()
      } catch (error) {
        await session.abortTransaction()
        return catchError('PrivateLeague.add', error, req, res)
      } finally {
        session.endSession()
      }

      const resp = (data) ? { ...JSON.parse(JSON.stringify(data)) } : {}
      delete resp.nBotsCount
      delete resp.nCopyBotsPerTeam
      delete resp.nSameCopyBotTeam
      delete resp.bBotCreate
      delete resp.bCopyBotInit
      delete resp.bPlayReturnProcess
      delete resp.nAutoFillSpots

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnewPrivateLeague), data: resp })
    } catch (error) {
      catchError('PrivateLeague.addV2', error, req, res)
    }
  }

  async verifyContestCode(req, res) {
    try {
      const { iMatchId, sShareCode } = req.body

      const upcomingMatch = await matchServices.findUpcomingMatch(iMatchId)
      if (!upcomingMatch) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_started })

      const pLeague = await MatchLeagueModel.findOne({ iMatchId: upcomingMatch._id, bPrivateLeague: true, bCancelled: false, sShareCode: sShareCode.toUpperCase() }, { bPlayReturnProcess: 0, nBotsCount: 0, nCopyBotsPerTeam: 0, nSameCopyBotTeam: 0, bBotCreate: 0, bCopyBotInit: 0, nAutoFillSpots: 0 }).lean()
      if (!pLeague) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cleague) })
      const user = await UserModel.findById(req.user._id, { _id: 1, bIsInternalAccount: 1 }).lean()
      if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

      if (user.bIsInternalAccount === true) {
        if (pLeague.bInternalLeague === false) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].league_join_err
          })
        }
      } else {
        if (pLeague.bInternalLeague === true) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].league_join_err
          })
        }
      }

      const totalUserJoin = await UserLeagueModel.countDocuments({ iMatchLeagueId: pLeague._id, iMatchId: upcomingMatch._id }, { readPreference: 'primary' })
      if (!pLeague.bUnlimitedJoin) {
        if (totalUserJoin >= pLeague.nMax) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].league_full })
      }

      const multiTeam = await UserLeagueModel.countDocuments({ iMatchLeagueId: pLeague._id, iUserId: user._id }, { readPreference: 'primary' })
      if (!pLeague.bMultipleEntry && multiTeam > 0) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].multiple_join_err })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cprivateLeague), data: pLeague })
    } catch (error) {
      catchError('PrivateLeague.verifyContestCode', error, req, res)
    }
  }

  async calculateEntryFeeV2(req, res) {
    try {
      let { nMax, nTotalPayout, bMultipleEntry } = req.body

      nMax = Number(nMax)
      nTotalPayout = Number(nTotalPayout)

      if (nMax === 2 && bMultipleEntry === true) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].play_alone_error })
      }

      let plc = await commonRuleServices.findRule('PLC')
      plc = !plc ? { nAmount: 0 } : plc
      // if (!plc) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].error_with.replace('##', messages[req.userLanguage].entryFeeCalculation) })

      let lcc = await commonRuleServices.findRule('LCC')
      lcc = !lcc ? { nAmount: 0 } : lcc
      // if (!lcc) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].error_with.replace('##', messages[req.userLanguage].entryFeeCalculation) })

      let lcg = await commonRuleServices.findRule('LCG')
      lcg = !lcg ? { nAmount: 0 } : lcg
      // if (!lcg) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].error_with.replace('##', messages[req.userLanguage].entryFeeCalculation) })

      let nPrice = (((parseFloat(nTotalPayout) * plc.nAmount) / 100) + parseFloat(nTotalPayout)) / parseInt(nMax)
      const nReminder = nPrice % 0.5
      if (nReminder > 0) {
        nPrice = nPrice - nReminder + 0.5
      }

      const pcf = await settingServices.findSetting('PCF')
      if (nPrice < pcf.nMin) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].greater_then_err.replace('##', messages[req.userLanguage].entryFee).replace('#', `${pcf.nMin}`) })
      if (nPrice > pcf.nMax) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].entryFee).replace('#', `${pcf.nMax}`) })

      const pcs = await settingServices.findSetting('PCS')
      if (nMax > pcs.nMax) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].cContestSize).replace('#', `${pcf.nMax}`) })

      const nCreatorBonus = parseFloat(Number((((nPrice * nMax) - nTotalPayout) * lcc.nAmount / 100).toFixed(2)))
      const nLeagueCreatorGst = lcg.nAmount
      const nCreatorBonusGST = parseFloat(Number(parseFloat((nCreatorBonus * 100) / (100 + nLeagueCreatorGst)).toFixed(2)))
      const nCreatorDeductedGST = parseFloat(Number(parseFloat(nCreatorBonus - nCreatorBonusGST).toFixed(2)))

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].centryFee), data: { nCreatorBonus, nPrice, nCreatorBonusGst: nCreatorDeductedGST } })
    } catch (error) {
      catchError('PrivateLeague.calculateEntryFeeV2', error, req, res)
    }
  }

  async generatePrizeBreakupV2(req, res) {
    try {
      let { nMax, bPoolPrize } = req.body
      nMax = Number(nMax)

      const prize = await PrivateLeaguePrizeModel.find({ eStatus: 'Y' }).lean()
      if (!prize) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].wrong_with.replace('##', messages[req.userLanguage].cprizeBreakups) })
      const aPrizeBreakupIds = prize.map(a => a.nPrizeNo)

      const prizeBreakupDeck = [[1], [5, 4, 3, 2, 1], [7, 6, 5, 3], [10, 7, 6, 5], [15, 7, 6, 5], [25, 15, 10, 7], [50, 25, 15]]
      let actualPrizeBreakupIds

      let pcs = await settingServices.findSetting('PCS')
      if (!pcs) {
        pcs = { nMin: 2 }
      }

      const deckDiffArr = []
      let testIndex
      if (bPoolPrize) {
        prizeBreakupDeck.forEach(s => deckDiffArr.push(Math.abs(((nMax * 2) / 100) - s[0])))
        if ((nMax * pcs.nMin) / 100 >= 2 && (nMax * pcs.nMin) / 100 <= 5) {
          actualPrizeBreakupIds = aPrizeBreakupIds.filter(s => s <= (nMax * pcs.nMin) / 100)
        } else {
          testIndex = deckDiffArr.indexOf(Math.min(...deckDiffArr))
          actualPrizeBreakupIds = prizeBreakupDeck[testIndex]
        }
      } else {
        if (nMax === 2) {
          actualPrizeBreakupIds = prizeBreakupDeck[0]
        } else if (nMax > 2 && nMax <= 5) {
          actualPrizeBreakupIds = aPrizeBreakupIds.filter(s => s <= nMax)
        } else if (nMax > 5 && nMax <= 500) {
          prizeBreakupDeck.forEach(s => deckDiffArr.push(Math.abs(nMax - s[0])))
          testIndex = deckDiffArr.indexOf(Math.min(...deckDiffArr))
          actualPrizeBreakupIds = prizeBreakupDeck[testIndex]
        } else {
          return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].cprizeBreakups) })
        }
        actualPrizeBreakupIds = actualPrizeBreakupIds.filter(s => s <= nMax)
      }
      const prizeBreakup = await PrivateLeaguePrizeModel.find({ nPrizeNo: { $in: actualPrizeBreakupIds } }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cprizeBreakups), data: prizeBreakup })
    } catch (error) {
      catchError('PrivateLeague.generatePrizeBreakupV2', error, req, res)
    }
  }
}

// Deprecated: It will generate private contest code using user sName or userName
function generateCode(sName) {
  return new Promise((resolve, reject) => {
    const sShareCode = (sName) && sName.length >= common.REFERRAL_CODE_USER_NAME_LENGTH
      ? sName.substring(0, common.REFERRAL_CODE_USER_NAME_LENGTH) + randomStr(common.REFERRAL_CODE_RANDOM_NUMBER_LENGTH, 'private')
      : randomStr(common.REFERRAL_CODE_LENGTH, 'private')
    MatchLeagueModel.findOne({ sShareCode }).then((league, err) => {
      if (err || league) generateCode(sName)
      else if (sShareCode.length === common.REFERRAL_CODE_LENGTH) {
        resolve(sShareCode.toUpperCase())
      } else {
        generateCode(sName)
      }
    })
  })
}

// In: It will generate private contest code using 26 alphabets + 10 numeric values.
function generateCodeV2() {
  return new Promise((resolve, reject) => {
    // const sShareCode = (sName) && sName.length >= common.REFERRAL_CODE_USER_NAME_LENGTH
    //   ? sName.substring(0, common.REFERRAL_CODE_USER_NAME_LENGTH) + randomStr(common.REFERRAL_CODE_RANDOM_NUMBER_LENGTH, 'private')
    //   : randomStr(common.REFERRAL_CODE_LENGTH, 'private')
    const sShareCode = randomStr(common.REFERRAL_CODE_LENGTH, 'private')
    MatchLeagueModel.findOne({ sShareCode }).then((league, err) => {
      if (err || league) generateCodeV2()
      else if (sShareCode.length === common.REFERRAL_CODE_LENGTH) {
        resolve(sShareCode.toUpperCase())
      } else {
        generateCodeV2()
      }
    })
  })
}
module.exports = new PrivateLeague()
