const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const PromocodeModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { removenull, catchError, pick, getPaginationValues2, getIp, convertToDecimal } = require('../../helper/utilities.services')
const cachegoose = require('recachegoose')
const { Op } = require('sequelize')
const UserDepositModel = require('../userDeposit/model')
const MatchModel = require('../match/model')
const LeagueModel = require('../league/model')
const MatchLeagueModel = require('../matchLeague/model')
const UserLeagueModel = require('../userLeague/model')
const enumData = require('../../data')
const settingServices = require('../setting/services')
const adminServices = require('../admin/subAdmin/services')
const { CACHE_8 } = require('../../config/config')
const adminLogQueue = require('../../rabbitmq/queue/adminLogQueue')
class Promocode {
  // To create new promocode of type deposit or match
  async add(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'sCode', 'bIsPercent', 'bShow', 'eStatus', 'sInfo', 'nAmount', 'nMinAmount', 'nMaxAmount', 'nMaxAllow', 'dStartTime', 'dExpireTime', 'nBonusExpireDays', 'eType', 'aMatches', 'aLeagues', 'bMaxAllowForAllUser', 'nPerUserUsage'])
      removenull(req.body)
      const { nMinAmount, nMaxAmount, dExpireTime, dStartTime, nAmount, bIsPercent, nBonusExpireDays, eType, sCode } = req.body
      let { aMatches = [], aLeagues = [] } = req.body
      const { _id: iAdminId } = req.admin

      if (nMinAmount || nMaxAmount) {
        if (isNaN(nMinAmount) || isNaN(nMaxAmount)) {
          return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].amount) })
        }
      }

      aMatches = aMatches.map((d) => ObjectId(d))
      aLeagues = aLeagues.map((d) => ObjectId(d))

      if (eType === 'MATCH') {
        if (aMatches.length > 0) {
          const matchCount = await MatchModel.countDocuments({ _id: { $in: aMatches } })
          if (matchCount !== aMatches.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })
        }
        if (aLeagues.length > 0) {
          const leagueCount = await LeagueModel.countDocuments({ _id: { $in: aLeagues } })
          if (leagueCount !== aLeagues.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cleague) })
        }
        req.body.aMatches = aMatches
        req.body.aLeagues = aLeagues
      } else if (eType === 'DEPOSIT') {
        req.body.aMatches = []
        req.body.aLeagues = []
      }

      const promoExist = await PromocodeModel.findOne({ sCode, eStatus: 'Y' }).lean()
      if (promoExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cpromocode) })

      if (bIsPercent && (parseInt(nAmount) < 0 || parseInt(nAmount) > 100)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].snAmount) })

      if (eType === 'DEPOSIT') {
        if (nMinAmount && nMaxAmount && parseInt(nMinAmount) > parseInt(nMaxAmount)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].minAmount).replace('#', messages[req.userLanguage].cmaximumAmount) })
      }

      if (dExpireTime && new Date(dExpireTime) < new Date(Date.now())) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].past_date_err.replace('##', messages[req.userLanguage].cexpireTime) })

      if (dStartTime && dExpireTime && new Date(dStartTime) > new Date(dExpireTime)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].cstartTime).replace('#', messages[req.userLanguage].cexpireTime) })

      if (nBonusExpireDays && (nBonusExpireDays < 1)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].expired_days_err.replace('#', messages[req.userLanguage].cBonusExpire) })

      const data = await PromocodeModel.create({ ...req.body })
      cachegoose.clearCache('promocode')

      const oNewFields = { ...data }
      const logData = {
        oOldFields: {},
        oNewFields,
        sIP: getIp(req),
        iAdminId: ObjectId(iAdminId),
        iUserId: null,
        eKey: 'PC'
      }
      adminLogQueue.publish(logData);

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cpromocode), data })
    } catch (error) {
      return catchError('Promocode.add', error, req, res)
    }
  }

  // update promocode of type deposit or match
  async update(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'sCode', 'sInfo', 'nAmount', 'eStatus', 'bShow', 'nMinAmount', 'nMaxAmount', 'nMaxAllow', 'dStartTime', 'dExpireTime', 'bIsPercent', 'nBonusExpireDays', 'eType', 'aMatches', 'aLeagues', 'bMaxAllowForAllUser', 'nPerUserUsage'])

      const { nMinAmount, nMaxAmount, dExpireTime, dStartTime, nAmount, bIsPercent, nBonusExpireDays, eType, sCode } = req.body
      let { aMatches = [], aLeagues = [] } = req.body

      const { _id: iAdminId } = req.admin

      if (eType === 'DEPOSIT') {
        if (req.body.aMatches) delete req.body.aMatches
        if (req.body.aLeagues) delete req.body.aLeagues
      }

      if (nMinAmount || nMaxAmount) {
        if (isNaN(nMinAmount) || isNaN(nMaxAmount)) {
          return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].amount) })
        }
      }

      aMatches = aMatches.map((d) => ObjectId(d))
      aLeagues = aLeagues.map((d) => ObjectId(d))

      const promoExist = await PromocodeModel.findById(req.params.id).lean()
      if (!promoExist) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpromocode) })

      if (sCode) {
        const checkPromo = await PromocodeModel.findOne({ sCode, eStatus: 'Y', _id: { $ne: req.params.id } }).lean()
        if (checkPromo) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cpromocode) })
      }

      if (eType === 'MATCH') {
        if (promoExist.eType === 'DEPOSIT') {
          const { count } = await UserDepositModel.findAndCountAll({ where: { iPromocodeId: promoExist._id.toString() } })
          if (count > 0) {
            return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_in_use.replace('##', messages[req.userLanguage].cpromocode) })
          }
        }
        if (aMatches.length > 0) {
          const matchCount = await MatchModel.countDocuments({ _id: { $in: aMatches } })

          if (matchCount !== aMatches.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].match) })
        }
        if (aLeagues.length > 0) {
          const leagueCount = await LeagueModel.countDocuments({ _id: { $in: aLeagues } })
          if (leagueCount !== aLeagues.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cleague) })
        }
        req.body.aMatches = aMatches
        req.body.aLeagues = aLeagues
      } else if (eType === 'DEPOSIT') {
        // check for promcode already in use with match type
        if (promoExist.eType === 'MATCH') {
          const { count } = await UserLeagueModel.findAndCountAll({ where: { iPromocodeId: promoExist._id.toString() } })
          if (count > 0) {
            return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_in_use.replace('##', messages[req.userLanguage].cpromocode) })
          }
        }
      }

      if (bIsPercent && (parseInt(nAmount) < 0 || parseInt(nAmount) > 100)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].amount) })
      if (eType === 'DEPOSIT') {
        if (nMinAmount && nMaxAmount && parseInt(nMinAmount) > parseInt(nMaxAmount)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].cMinimumAmount).replace('#', messages[req.userLanguage].cMaximumAmount) })
      }
      if (dExpireTime && new Date(dExpireTime) < new Date(Date.now())) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].past_date_err.replace('##', messages[req.userLanguage].cexpireTime) })
      if (dStartTime && dExpireTime && new Date(dStartTime) > new Date(dExpireTime)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].cstartTime).replace('#', messages[req.userLanguage].cexpireTime) })
      if (nBonusExpireDays && (nBonusExpireDays < 1)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].expired_days_err.replace('#', messages[req.userLanguage].cBonusExpire) })

      const data = await PromocodeModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpromocode) })
      cachegoose.clearCache('promocode')

      const oOldFields = { ...promoExist }
      const oNewFields = { ...data }
      const logData = {
        oOldFields,
        oNewFields,
        sIP: getIp(req),
        iAdminId: ObjectId(iAdminId),
        iUserId: null,
        eKey: 'PC'
      }
      adminLogQueue.publish(logData);

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cpromocode), data })
    } catch (error) {
      return catchError('Promocode.update', error, req, res)
    }
  }

  // remove promocode
  async remove(req, res) {
    try {
      const { _id: iAdminId } = req.admin

      const data = await PromocodeModel.findByIdAndDelete(req.params.id).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpromocode) })
      cachegoose.clearCache('promocode')

      const oOldFields = { ...data }
      const logData = {
        oOldFields,
        oNewFields: {},
        sIP: getIp(req),
        iAdminId: ObjectId(iAdminId),
        iUserId: null,
        eKey: 'PC'
      }
      adminLogQueue.publish(logData);

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].cpromocode), data })
    } catch (error) {
      return catchError('Promocode.remove', error, req, res)
    }
  }

  // get list of promocode details for admin
  async list(req, res) {
    try {
      const { eType, datefrom, dateto } = req.query
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      const eTypeFilter = eType ? [eType] : enumData.promocodeTypes

      const datefilter = datefrom && dateto ? { dStartTime: { $gte: (datefrom) }, dExpireTime: { $lte: (dateto) } } : {}
      const codeQuery = {}
      if (search) codeQuery.sCode = { $regex: new RegExp('^.*' + search + '.*', 'i') }

      const query = { ...datefilter, eType: { $in: eTypeFilter }, ...codeQuery }

      const results = await PromocodeModel.find(query, {
        sCode: 1,
        sInfo: 1,
        nAmount: 1,
        bIsPercent: 1,
        eStatus: 1,
        bShow: 1,
        nMinAmount: 1,
        nMaxAmount: 1,
        nMaxAllow: 1,
        dStartTime: 1,
        dExpireTime: 1,
        nBonusExpireDays: 1,
        bMaxAllowForAllUser: 1,
        nPerUserUsage: 1,
        dCreatedAt: 1,
        eType: 1,
        aMatches: 1,
        aLeagues: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const total = await PromocodeModel.countDocuments({ ...query }).cache(CACHE_8, 'promocount')

      const data = [{ total, results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpromocode), data: data })
    } catch (error) {
      return catchError('Promocode.list', error, req, res)
    }
  }

  async getCount(req, res) {
    try {
      const { eType, datefrom, dateto } = req.query
      const { search } = getPaginationValues2(req.query)

      const eTypeFilter = eType ? [eType] : enumData.promocodeTypes

      const datefilter = datefrom && dateto ? { dStartTime: { $gte: new Date(datefrom) }, dExpireTime: { $lte: new Date(dateto) } } : {}
      const codeQuery = {}
      if (search) codeQuery.sCode = { $regex: new RegExp('^.*' + search + '.*', 'i') }

      const query = { ...datefilter, eType: { $in: eTypeFilter }, ...codeQuery }

      const nTotal = await PromocodeModel.countDocuments({ ...query })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpromocodeCount), data: { nTotal } })
    } catch (error) {
      return catchError('Promocode.getCount', error, req, res)
    }
  }

  // get details of single promocode
  async get(req, res) {
    try {
      const promo = await PromocodeModel.findById(req.params.id).populate('aLeagues', ['sName', 'eCategory']).populate('aMatches', ['sName', 'eCategory']).lean()
      if (!promo) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpromocode) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpromocode), data: promo })
    } catch (error) {
      return catchError('Promocode.get', error, req, res)
    }
  }

  // Deposit promocode list for users
  async userPromocodeList(req, res) {
    try {
      const data = await PromocodeModel.find({ eStatus: 'Y', bShow: true, eType: 'DEPOSIT', dStartTime: { $lt: new Date(Date.now()) }, dExpireTime: { $gt: new Date(Date.now()) } }, { dUpdatedAt: 0, __v: 0 }).sort({ _id: -1 }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpromocode), data })
    } catch (error) {
      return catchError('Promocode.userPromocodeList', error, req, res)
    }
  }

  // Match promocode list for users
  async matchPromoList(req, res) {
    try {
      const matchLeague = await MatchLeagueModel.findById({ _id: req.params.id })

      if (!matchLeague) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })

      const { iMatchId, iLeagueId } = matchLeague

      const data = await PromocodeModel.find({
        eStatus: 'Y',
        bShow: true,
        $and: [
          { aMatches: iMatchId },
          { aLeagues: iLeagueId }
        ],
        dStartTime: { $lt: new Date(Date.now()) },
        dExpireTime: { $gt: new Date(Date.now()) },
        eType: 'MATCH'
      }, { sName: 0, dUpdatedAt: 0, __v: 0 }).sort({ _id: -1 }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpromocode), data: data })
    } catch (error) {
      return catchError('Promocode.matchPromoList', error, req, res)
    }
  }

  // Check and validate deposit promocode
  async checkPromocode(req, res) {
    try {
      const { sPromo, nAmount } = req.body

      const promocode = await PromocodeModel.findOne({ eStatus: 'Y', sCode: sPromo.toUpperCase(), dStartTime: { $lt: new Date(Date.now()) }, dExpireTime: { $gt: new Date(Date.now()) } }, { _id: 1, nMaxAllow: 1, sCode: 1, sInfo: 1, nAmount: 1, nMinAmount: 1, nMaxAmount: 1, bMaxAllowForAllUser: 1, nPerUserUsage: 1, nMaxUsed: 1, dStartTime: 1, dExpireTime: 1, dCreatedAt: 1, eOfferType: 1 }).lean()
      if (!promocode) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid_promo_err })

      const symbol = await settingServices.getCurrencySymbol()
      if (nAmount && !(promocode.nMaxAmount >= convertToDecimal(nAmount, 2) && promocode.nMinAmount <= convertToDecimal(nAmount, 2))) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].promo_amount_err.replace('#', promocode.nMinAmount).replace('##', promocode.nMaxAmount).replace('₹', symbol) })

      let bFlag = false
      let rejectInvalid
      // await db.sequelize.transaction({
      //   isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
      // }, async (t) => {

      const [{ count: allCount }, { count }, { count: depositCount }] = await Promise.all([
        UserDepositModel.findAndCountAll({ where: { sPromocode: sPromo.toUpperCase(), ePaymentStatus: { [Op.in]: ['P', 'S'] }, eUserType: 'U' } }),
        UserDepositModel.findAndCountAll({ where: { iUserId: req.user._id.toString(), sPromocode: sPromo.toUpperCase(), ePaymentStatus: { [Op.in]: ['P', 'S'] } } }),
        UserDepositModel.findAndCountAll({ where: { iUserId: req.user._id.toString(), ePaymentStatus: { [Op.in]: ['P', 'S'] } } })
      ])

      if (!promocode.bMaxAllowForAllUser && (count >= promocode.nMaxAllow)) {
        rejectInvalid = { status: jsonStatus.BadRequest, message: messages.English.promo_usage_limit }
        bFlag = true
      } else if ((allCount >= promocode.nMaxAllow) || (count >= promocode.nPerUserUsage)) {
        rejectInvalid = { status: jsonStatus.BadRequest, message: messages.English.promo_usage_limit }
        bFlag = true
      } else if (promocode.eOfferType === 'FIRST_DEPOSIT' && depositCount) {
        rejectInvalid = { status: jsonStatus.BadRequest, message: messages.English.first_deposit_promo }
        bFlag = true
      }
      // })
      if (bFlag) return res.status(status.BadRequest).jsonp(rejectInvalid)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].is_active.replace('##', messages[req.userLanguage].cpromocode) })
    } catch (error) {
      return catchError('Promocode.checkPromo', error, req, res)
    }
  }

  // Check and validate match promocode
  async checkMatchPromocode(req, res) {
    try {
      const iUserId = req.user._id
      const lang = req.userLanguage

      const result = await this.validateMatchPromocode({ ...req.body, iUserId, lang })

      const { data: resultData } = result
      const { nBonus, nTeamCount } = resultData

      resultData.nDiscount = nBonus * nTeamCount

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].is_active.replace('##', messages[req.userLanguage].cpromocode), data: resultData })
    } catch (error) {
      const { status = '', message = '' } = error
      if (!status) { return catchError('Promocode.checkMatchPromocode', error, req, res) }
      return res.status(status).jsonp({ status, message })
    }
  }

  async validateMatchPromocode(data) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const { sPromo, iMatchLeagueId, nTeamCount = 1, iUserId, lang } = data
          const matchLeague = await MatchLeagueModel.findById({ _id: iMatchLeagueId }).lean()
          if (!matchLeague) {
            const limitExceed = { status: jsonStatus.NotFound, message: messages[lang].not_exist.replace('##', messages[lang].cmatchLeague) }
            return reject(limitExceed)
          }

          const { iMatchId, nPrice, iLeagueId } = matchLeague

          const promocode = await PromocodeModel.findOne({
            eStatus: 'Y',
            sCode: sPromo.toUpperCase(),
            $and: [
              { aMatches: iMatchId },
              { aLeagues: iLeagueId }
            ],
            dStartTime: { $lt: new Date(Date.now()) },
            dExpireTime: { $gt: new Date(Date.now()) },
            eType: 'MATCH'
          }, { _id: 1, nMaxAllow: 1, bMaxAllowForAllUser: 1, nPerUserUsage: 1, sCode: 1, sInfo: 1, nAmount: 1, nMinAmount: 1, nMaxAmount: 1, nMaxUsed: 1, dStartTime: 1, dExpireTime: 1, dCreatedAt: 1, bIsPercent: 1 }).lean()
          if (!promocode) {
            const promoError = { status: jsonStatus.BadRequest, message: messages[lang].invalid_promo_err }
            return reject(promoError)
          }

          const { nAmount: promoAmount, bIsPercent, nMaxAllow, _id: iPromocodeId, sCode, bMaxAllowForAllUser, nPerUserUsage } = promocode

          let allCount = await UserLeagueModel.countDocuments({ iPromocodeId, iMatchLeagueId })
          let count = await UserLeagueModel.countDocuments({ iUserId: iUserId, iPromocodeId, iMatchLeagueId })

          count += nTeamCount
          allCount += nTeamCount
          if (!bMaxAllowForAllUser && (count > nMaxAllow)) {
            const countError = { status: jsonStatus.BadRequest, message: messages[lang].promo_usage_limit }
            return reject(countError)
          } else if ((allCount > nMaxAllow) || (count > nPerUserUsage)) {
            const countError = { status: jsonStatus.BadRequest, message: messages[lang].promo_usage_limit }
            return reject(countError)
          }

          let nBonus = 0
          if (bIsPercent) {
            nBonus = Number(parseFloat(parseFloat(promoAmount) * parseFloat(nPrice) / 100).toFixed(2))
          } else {
            nBonus = parseFloat(promoAmount)
          }

          // If bonus amount is more than price then take price as bonus
          if (nBonus > nPrice) {
            nBonus = nPrice
          }

          return resolve({ status: 'success', data: { nBonus, iPromocodeId, sCode, nTeamCount } })
        } catch (error) {
          reject(error)
        }
      })()
    })
  }
}

module.exports = new Promocode()
