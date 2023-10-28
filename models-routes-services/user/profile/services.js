const UsersModel = require('../model')
// const adminServices = require('../../admin/subAdmin/services')
const StatisticsModel = require('../statistics/model')
const MyMatchesModel = require('../../myMatches/model')
const UserBalanceModel = require('../../userBalance/model')
const UserLeagueModel = require('../../userLeague/model')
const SeriesLBUserRankModel = require('../../seriesLeaderBoard/seriesLBUserRank.model')
const CitiesModel = require('../cities')
const StatesModel = require('../states')
const cachegoose = require('recachegoose')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const userBalanceServices = require('../../userBalance/services')
const { catchError, getPaginationValues, pick, projectionFields, getIp, validatePIN, checkValidImageType, defaultSearch } = require('../../../helper/utilities.services')
const s3 = require('../../../helper/s3config')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const commonRuleServices = require('../../commonRules/services')
const { bAllowDiskUse, s3UserProfile } = require('../../../config/config')
const data = require('../../../data')
const { blackListToken } = require('../../../helper/redis')
const adminLogQueue = require('../../../rabbitmq/queue/adminLogQueue')

class Users {
  async listV2(req, res) {
    try {
      let { start = 0, limit = 10, order, search, mobile, internalAccount, email, datefrom, dateto, isFullResponse } = req.query

      const orderBy = order && order === 'asc' ? 1 : -1

      const sorting = { dCreatedAt: orderBy }

      let query = mobile ? { bIsMobVerified: true } : {}
      query = internalAccount ? { ...query, bIsInternalAccount: true } : query
      query = email ? { ...query, bIsEmailVerified: true } : query
      query = datefrom && dateto ? { ...query, dCreatedAt: { $gte: (datefrom), $lte: (dateto) } } : query

      if (search) search = defaultSearch(search)
      if (search && search.length) {
        if (ObjectId.isValid(search) && (new ObjectId(search)).toString() === search) {
          query = {
            ...query,
            _id: ObjectId(search)
          }
        } else {
          query = {
            ...query,
            $or: [
              { sUsername: { $regex: new RegExp('^.*' + search + '.*', 'i') } },
              { sEmail: { $regex: new RegExp('^.*' + search + '.*', 'i') } },
              { sMobNum: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
            ]
          }
        }
      }

      query = { ...query, eType: 'U' }

      let usersList
      if ([true, 'true'].includes(isFullResponse)) {
        if (!datefrom || !dateto) {
          return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].date_filter_err })
        }
        usersList = await UsersModel.find(query, {
          sName: 1,
          sUsername: 1,
          sEmail: 1,
          sMobNum: 1,
          bIsEmailVerified: 1,
          bIsMobVerified: 1,
          sProPic: 1,
          eType: 1,
          eGender: 1,
          eStatus: 1,
          iReferredBy: 1,
          sReferCode: 1,
          iStateId: 1,
          dDob: 1,
          iCountryId: 1,
          iCityId: 1,
          sAddress: 1,
          nPinCode: 1,
          dLoginAt: 1,
          dPasswordchangeAt: 1,
          dCreatedAt: 1,
          bIsInternalAccount: 1,
          ePlatform: 1
        }).sort(sorting).lean()
      } else {
        usersList = await UsersModel.find(query, {
          sName: 1,
          sUsername: 1,
          sEmail: 1,
          sMobNum: 1,
          bIsEmailVerified: 1,
          bIsMobVerified: 1,
          sProPic: 1,
          eType: 1,
          eGender: 1,
          eStatus: 1,
          iReferredBy: 1,
          sReferCode: 1,
          iStateId: 1,
          dDob: 1,
          iCountryId: 1,
          iCityId: 1,
          sAddress: 1,
          nPinCode: 1,
          dLoginAt: 1,
          dPasswordchangeAt: 1,
          dCreatedAt: 1,
          bIsInternalAccount: 1,
          ePlatform: 1
        }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()
      }

      if (usersList.length && req.admin.eType !== 'SUPER') {
        usersList.forEach(eachUser => {
          eachUser.sMobNum = !!(eachUser.sMobNum && eachUser.sMobNum.trim())
          eachUser.sEmail = !!(eachUser.sEmail && eachUser.sEmail.trim())
        })
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cusers), data: { results: usersList } })
    } catch (error) {
      return catchError('Users.listV2', error, req, res)
    }
  }

  async getCounts(req, res) {
    try {
      let { search, mobile, internalAccount, email, datefrom, dateto } = req.query

      let query = mobile ? { bIsMobVerified: true } : {}
      query = internalAccount ? { ...query, bIsInternalAccount: true } : query
      query = email ? { ...query, bIsEmailVerified: true } : query
      query = datefrom && dateto ? { ...query, dCreatedAt: { $gte: (datefrom), $lte: (dateto) } } : query

      if (search) search = defaultSearch(search)
      if (search && search.length) {
        if (ObjectId.isValid(search) && (new ObjectId(search)).toString() === search) {
          query = {
            ...query,
            _id: ObjectId(search)
          }
        } else {
          query = {
            ...query,
            $or: [
              { sUsername: { $regex: new RegExp('^.*' + search + '.*', 'i') } },
              { sEmail: { $regex: new RegExp('^.*' + search + '.*', 'i') } },
              { sMobNum: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
            ]
          }
        }
      }

      query = { ...query, eType: 'U' }

      const count = await UsersModel.countDocuments({ ...query })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', `${messages[req.userLanguage].cusers} ${messages[req.userLanguage].cCounts}`), data: { count } })
    } catch (error) {
      return catchError('Users.getCounts', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const user = await UsersModel.findById(req.user._id, { dLoginAt: 0 }).lean()
      if (!user) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].user) })

      UsersModel.filterData(user)

      const balance = await UserBalanceModel.findOne({ where: { iUserId: req.user._id.toString() }, raw: true })
      const aTotalJoinLeague = await MyMatchesModel.aggregate([
        { $match: { iUserId: req.user._id } }, {
          $project: {
            count: { $cond: { if: { $isArray: '$aMatchLeagueId' }, then: { $size: '$aMatchLeagueId' }, else: 0 } }
          }
        }
      ])
        .allowDiskUse(bAllowDiskUse)
        .exec()

      const plc = await commonRuleServices.findRule('PLC')
      const nLeagueCreatorCom = plc ? plc.nAmount : undefined

      const nTotalJoinLeague = aTotalJoinLeague.length ? aTotalJoinLeague.reduce((sum, { count }) => (sum + count), 0) : 0
      const nTotalMatch = await MyMatchesModel.countDocuments({ iUserId: req.user._id, aMatchLeagueId: { $exists: true } })

      const data = await StatisticsModel.findOne({ iUserId: req.user._id }, { nTotalWinnings: 1, _id: 0 }).lean()
      if (!data) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].user), data: { ...user, ...balance, nLeagueCreatorCom } })

      const statistic = { nWinnings: data.nTotalWinnings, nTotalJoinLeague, nTotalMatch }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].user), data: { ...user, ...statistic, ...balance, nLeagueCreatorCom } })
    } catch (error) {
      return catchError('Users.get', error, req, res)
    }
  }

  async getV2(req, res) {
    try {
      const user = await UsersModel.findById(req.user._id, { dLoginAt: 0 }).lean()
      if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

      const balanceExist = await UserBalanceModel.findOne({ where: { iUserId: req.user._id.toString() }, raw: true })

      const llc = await commonRuleServices.findRule('LCC')
      const nLeagueCreatorCom = llc ? llc.nAmount : undefined

      if (!balanceExist) {
        const openAccount = await userBalanceServices.openAccount({ iUserId: user._id, sUsername: user.sUsername, eType: user.eType })
        if (openAccount.isSuccess === false) {
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].user), data: { ...user, nLeagueCreatorCom, id: undefined, iUserId: undefined } })
        }
      }
      UsersModel.filterData(user)

      const balance = await UserBalanceModel.findOne({ where: { iUserId: req.user._id.toString() }, raw: true })
      balance.eUserType = undefined
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].user), data: { ...user, ...balance, nLeagueCreatorCom, id: undefined, iUserId: undefined } })
    } catch (error) {
      return catchError('Users.get', error, req, res)
    }
  }

  async getStatistic(req, res) {
    try {
      const aTotalJoinLeague = await MyMatchesModel.aggregate([
        { $match: { iUserId: req.user._id } }, {
          $project: {
            count: { $cond: { if: { $isArray: '$aMatchLeagueId' }, then: { $size: '$aMatchLeagueId' }, else: 0 } }
          }
        }
      ])
        .allowDiskUse(bAllowDiskUse)
        .exec()

      const nTotalJoinLeague = aTotalJoinLeague.length ? aTotalJoinLeague.reduce((sum, { count }) => (sum + count), 0) : 0
      const nTotalMatch = await MyMatchesModel.countDocuments({ iUserId: req.user._id, 'aMatchLeagueId.0': { $exists: true } })

      const data = await StatisticsModel.findOne({ iUserId: req.user._id }, { nTotalWinnings: 1, _id: 0 }).lean()
      if (!data) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].user) })
      const statistic = { ...data, nTotalJoinLeague, nTotalMatch }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].user), data: { ...statistic } })
    } catch (error) {
      return catchError('Users.getStatistic', error, req, res)
    }
  }

  async adminGet(req, res) {
    try {
      const user = await UsersModel.findOne({ _id: req.params.id, eType: 'U' }).lean()
      if (!user) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cprofile) })

      UsersModel.filterData(user)

      const statistics = await StatisticsModel.findOne({ iUserId: req.params.id }, { nReferrals: 1, _id: 0 }).lean()

      const data = { ...user, ...statistics }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cprofile), data })
    } catch (error) {
      return catchError('Users.adminGet', error, req, res)
    }
  }

  async update(req, res) {
    try {
      const { sProPic, nPinCode, eGender } = req.body
      req.body = pick(req.body, ['sName', 'eGender', 'sProPic', 'dDob', 'sAddress', 'nPinCode', 'iCityId', 'iStateId', 'iCountryId'])
      const kycApproval = await UsersModel.countDocuments({ _id: req.user._id, bIsKycApproved: true })

      if (kycApproval) {
        req.body = pick(req.body, ['sAddress', 'nPinCode', 'sProPic', 'iCityId', 'sEmail'])
      }
      if (eGender && !(data.userGender.includes(eGender))) { return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.UnprocessableEntity, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cGender) }) }

      if (nPinCode && !validatePIN(nPinCode)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cPin) })

      const iUserId = req.user._id

      const user = await UsersModel.findByIdAndUpdate(iUserId, { ...req.body }, { new: true, runValidators: true }).lean()
      UsersModel.filterData(user)

      if (sProPic && sProPic.length) {
        UserLeagueModel.updateMany({ iUserId: ObjectId(user._id) }, { sProPic: user.sProPic }).exec()
        SeriesLBUserRankModel.updateMany({ iUserId: ObjectId(user._id) }, { sProPic: user.sProPic }).exec()
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cprofile), data: user })
    } catch (error) {
      return catchError('Users.update', error, req, res)
    }
  }

  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await s3.signedUrl(sFileName, sContentType, s3UserProfile)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('Users.getSignedUrl', error, req, res)
    }
  }

  async adminUpdate(req, res) {
    try {
      const { sEmail, sMobNum, eStatus, sProPic, sUsername, nPinCode, eGender } = req.body
      req.body = pick(req.body, ['sName', 'eGender', 'eStatus', 'sReferCode', 'dDob', 'sAddress', 'nPinCode', 'sEmail', 'sMobNum', 'bIsInternalAccount', 'iCityId', 'iStateId', 'iCountryId', 'sUsername'])

      const projection = projectionFields(req.body)

      const iUserId = req.params.id

      const oOldFields = await UsersModel.findOne({ _id: iUserId }, { ...projection, aJwtTokens: 1, _id: 0 }).lean()
      if (!oOldFields) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cuserProfile) })
      if (eStatus && eStatus === 'N') {
        const { aJwtTokens } = oOldFields
        for (const token of aJwtTokens) {
          const { sToken } = token
          await UsersModel.updateOne({ _id: ObjectId(iUserId) }, { $pull: { aJwtTokens: { sToken } } })
          blackListToken(sToken)
          cachegoose.clearCache(`at:${sToken}`)
        }
      }

      if (eGender && !(data.userGender.includes(eGender))) { return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.UnprocessableEntity, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cGender) }) }

      if (nPinCode && !validatePIN(nPinCode)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cPin) })

      const { _id: iAdminId } = req.admin
      const userExist = await UsersModel.findOne({ $or: [{ sEmail }, { sMobNum }, { sUsername }], _id: { $ne: iUserId } }).lean()
      if (userExist) {
        if (userExist.sMobNum === sMobNum) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].mobileNumber) })
        if (userExist.sEmail && userExist.sEmail === sEmail) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].email) })
        if (userExist.sUsername === sUsername) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].username) })

        if (userExist.sEmail !== sEmail) req.body.bIsEmailVerified = true
        if (userExist.sMobNum !== sMobNum) req.body.bIsMobVerified = true
      }
      const user = await UsersModel.findByIdAndUpdate(iUserId, { ...req.body, sProPic }, { new: true, runValidators: true }).lean()

      const oNewFields = { ...req.body }
      oOldFields.aJwtTokens = undefined
      const logData = { oOldFields, oNewFields, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: ObjectId(iUserId), eKey: 'P' }
      // await adminServices.adminLog(req, res, logData)
      adminLogQueue.publish(logData)

      UsersModel.filterData(user)

      if (sProPic && sProPic.length) {
        UserLeagueModel.updateMany({ iUserId: ObjectId(user._id) }, { sProPic: user.sProPic }).exec()
        SeriesLBUserRankModel.updateMany({ iUserId: ObjectId(user._id) }, { sProPic: user.sProPic }).exec()
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].user), data: user })
    } catch (error) {
      return catchError('Users.adminUpdate', error, req, res)
    }
  }

  async getState(req, res) {
    try {
      // List of State (Static) only be added in DB from backend developer, it'll not be add and update from admin
      const query = req.query.eStatus ? { eStatus: req.query.eStatus } : {}

      const states = await StatesModel.find(query, { sName: 1, id: 1, _id: 0, eStatus: 1 }).lean()
      if (!states) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cUserStates) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cUserStates), data: states })
    } catch (error) {
      return catchError('Users.getState', error, req, res)
    }
  }

  async listCity(req, res) {
    try {
      // List of City (Static) only be added in DB from backend developer, it'll not be add and update from admin
      let { start, limit } = getPaginationValues(req.query)
      if (!start || !limit) {
        start = 0
        limit = 10
      }
      const data = await CitiesModel.aggregate([
        {
          $match: {
            nStateId: Number(req.query.nStateId)
          }
        },
        {
          $group: {
            _id: 0,
            count: {
              $sum: 1
            },
            document: {
              $push: '$$ROOT'
            }
          }
        },
        {
          $unwind: '$document'
        },
        { $limit: parseInt(start) + parseInt(limit) },
        { $skip: parseInt(start) },
        {
          $group: {
            _id: 0,
            total: {
              $first: '$count'
            },
            results: {
              $push: {
                sName: { $ifNull: ['$document.sName', ''] }
              }
            }
          }
        }
      ]).allowDiskUse(bAllowDiskUse).exec()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cUsersCity), data: data })
    } catch (error) {
      return catchError('Users.listCity', error, req, res)
    }
  }

  async adminRecommendation(req, res) {
    try {
      let { sSearch, nLimit } = req.query
      sSearch = !sSearch ? '' : defaultSearch(sSearch)
      nLimit = !nLimit ? 10 : parseInt(nLimit)

      const sValue = { $regex: new RegExp('^.*' + sSearch + '.*', 'i') }
      const query = { $or: [{ sName: sValue }, { sUsername: sValue }, { sEmail: sValue }, { sMobNum: sValue }] }

      const data = await UsersModel.find(query, { _id: 1, sName: 1, sEmail: 1, sUsername: 1, sMobNum: 1 }).limit(nLimit).lean()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cRecommendedUsers), data })
    } catch (error) {
      return catchError('Users.adminRecommendation', error, req, res)
    }
  }

  async referredByUserList(req, res) {
    try {
      let { start = 0, limit = 10, sort = 'dCreatedAt', order, search } = req.query

      const orderBy = order && order === 'asc' ? 1 : -1

      const sorting = { [sort]: orderBy }

      if (search) search = defaultSearch(search)

      let query = { iReferredBy: ObjectId(req.params.id) }
      if (search && search.length) {
        query = {
          ...query,
          $or: [
            { sUsername: { $regex: new RegExp('^.*' + search + '.*', 'i') } },
            { sEmail: { $regex: new RegExp('^.*' + search + '.*', 'i') } },
            { sMobNum: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
          ]
        }
      }
      const usersList = await UsersModel.find(query, {
        sName: 1,
        sUsername: 1,
        sEmail: 1,
        sMobNum: 1,
        bIsEmailVerified: 1,
        bIsMobVerified: 1,
        sProPic: 1,
        eType: 1,
        eGender: 1,
        eStatus: 1,
        iReferredBy: 1,
        sReferCode: 1,
        iStateId: 1,
        dDob: 1,
        iCountryId: 1,
        iCityId: 1,
        sAddress: 1,
        nPinCode: 1,
        dLoginAt: 1,
        dPasswordchangeAt: 1,
        dCreatedAt: 1,
        bIsInternalAccount: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const count = await UsersModel.countDocuments({ ...query })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cUsersCity), data: { results: usersList, count } })
    } catch (error) {
      return catchError('Users.referredByUserList', error, req, res)
    }
  }

  async userCitiesList(req, res) {
    try {
      const cities = await CitiesModel.find({ nStateId: Number(req.query.nStateId) }, { sName: 1, _id: 0 }).lean()
      if (!cities) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cUsersCity) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cUsersCity), data: cities })
    } catch (error) {
      return catchError('Users.userCitiesList', error, req, res)
    }
  }
}

module.exports = new Users()
