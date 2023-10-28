const UsersModel = require('../model')
const adminServices = require('../../admin/subAdmin/services')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { catchError, getPaginationValues2, pick, removenull, projectionFields, getIp, convertToDecimal } = require('../../../helper/utilities.services')
const { maleFirstNames, femaleFirstNames, lastNames } = require('../../../helper/name')
const { BOT_DEPOSIT_BALANCE } = require('../../../config/common')
const jwt = require('jsonwebtoken')
const config = require('../../../config/config')
const PassbookModel = require('../../passbook/model')
const UserBalanceModel = require('../../userBalance/model')
const UserDepositModel = require('../../userDeposit/model')
const StatisticsModel = require('../statistics/model')
const { redisClient } = require('../../../helper/redis')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const data = require('../../../data')
const adminLogQueue = require('../../../rabbitmq/queue/adminLogQueue')
class SystemUsers {
  async list(req, res) {
    try {
      const { mobile, internalAccount, email, datefrom, dateto, isFullResponse } = req.query
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      let query = mobile ? { bIsMobVerified: true } : {}
      query = internalAccount ? { ...query, bIsInternalAccount: true } : query
      query = email ? { ...query, bIsEmailVerified: true } : query
      query = datefrom && dateto ? { ...query, dCreatedAt: { $gte: (datefrom), $lte: (dateto) } } : query

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
      query.eType = 'B'

      let results
      if ([true, 'true'].includes(isFullResponse)) {
        if (!datefrom || !dateto) {
          return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].date_filter_err })
        }
        results = await UsersModel.find(query, {
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

        }).sort(sorting).lean()
      } else {
        results = await UsersModel.find(query, {
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
      }
      const data = [{ results }]
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csystemUsers), data: data })
    } catch (error) {
      return catchError('SystemUsers.list', error, req, res)
    }
  }

  async getCounts(req, res) {
    try {
      const { mobile, internalAccount, email, datefrom, dateto } = req.query
      const { search } = getPaginationValues2(req.query)

      let query = mobile ? { bIsMobVerified: true } : {}
      query = internalAccount ? { ...query, bIsInternalAccount: true } : query
      query = email ? { ...query, bIsEmailVerified: true } : query
      query = datefrom && dateto ? { ...query, dCreatedAt: { $gte: (datefrom), $lte: (dateto) } } : query

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
      query.eType = 'B'

      const count = await UsersModel.countDocuments({ ...query })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', `${messages[req.userLanguage].csystemUsers} ${messages[req.userLanguage].cCounts}`), data: { count } })
    } catch (error) {
      return catchError('SystemUsers.getCounts', error, req, res)
    }
  }

  async add(req, res) {
    try {
      const { nUsers } = req.body

      let sUser = 0

      while (sUser < parseInt(nUsers)) {
        // eslint-disable-next-line no-undef
        const randomUser = await isUserNameExist()
        const { sUsername } = randomUser
        const user = await UsersModel.create(randomUser)
        const newToken = {
          sToken: jwt.sign({ _id: (user._id).toHexString(), eType: user.eType }, config.JWT_SECRET)
        }
        await Promise.all([
          UsersModel.updateOne({ _id: ObjectId(user._id) }, { $push: { aJwtTokens: newToken } }),
          PassbookModel.create({
            iUserId: user._id.toString(),
            eUserType: 'B',
            eTransactionType: 'Opening',
            sRemarks: `${sUsername} Initial Account Opened`,
            dActivityDate: new Date()
          }),
          UserBalanceModel.create({ iUserId: user._id.toString(), eUserType: 'B' }),
          StatisticsModel.create([{ iUserId: user._id, eUserType: 'B' }])
        ])
        sUser++
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].csystemUsers) })
    } catch (error) {
      return catchError('SystemUsers.add', error, req, res)
    }
  }

  async addV2(req, res) {
    try {
      const { nUsers } = req.body
      const nCash = convertToDecimal(BOT_DEPOSIT_BALANCE) || 0
      const nAmount = convertToDecimal(nCash)
      let sUser = 0

      while (sUser < parseInt(nUsers)) {
        // eslint-disable-next-line no-undef
        const randomUser = await isUserNameExist()
        const { sUsername } = randomUser
        console.log(randomUser)
        const user = await UsersModel.create(randomUser)
        const newToken = {
          sToken: jwt.sign({ _id: (user._id).toHexString(), eType: user.eType }, config.JWT_SECRET)
        }
        const statCreate = { iUserId: user._id, eUserType: 'B', nActualDepositBalance: convertToDecimal(nCash), nDeposits: convertToDecimal(nCash), nCash: convertToDecimal(nCash), nDepositCount: 1 }

        const [, oUserDeposit] = await Promise.all([
          UsersModel.updateOne({ _id: ObjectId(user._id) }, { $push: { aJwtTokens: newToken } }),
          UserDepositModel.create({
            iUserId: user._id.toString(),
            nAmount,
            nCash,
            ePaymentStatus: 'S',
            sInfo: 'Deposit by admin',
            eUserType: 'B',
            dProcessedDate: new Date()
          }),
          PassbookModel.create({
            iUserId: user._id.toString(),
            eUserType: 'B',
            eTransactionType: 'Opening',
            sRemarks: `${sUsername} Initial Account Opened`,
            dActivityDate: new Date()
          }),
          UserBalanceModel.create({
            iUserId: user._id.toString(),
            eUserType: 'B',
            nCurrentDepositBalance: nCash,
            nCurrentTotalBalance: nCash,
            nTotalDepositAmount: nCash,
            nTotalDepositCount: 1
          }),
          StatisticsModel.create(statCreate)
        ])

        await PassbookModel.create({
          iUserId: user._id.toString(),
          nAmount,
          nCash,
          nOldTotalBalance: nCash,
          nOldDepositBalance: nCash,
          eTransactionType: 'Deposit',
          eUserType: 'B',
          iUserDepositId: oUserDeposit.id,
          eType: 'Cr',
          sRemarks: 'Deposit by admin',
          dActivityDate: new Date(),
          eStatus: 'CMP'
        })
        console.log('UserDeposit', oUserDeposit)
        sUser++
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].csystemUsers) })
    } catch (error) {
      return catchError('SystemUsers.add', error, req, res)
    }
  }

  async addToken(req, res) {
    try {
      const systemUsers = await UsersModel.find({ eType: 'B' }).lean()

      for (const systemUser of systemUsers) {
        const newToken = {
          sToken: jwt.sign({ _id: (systemUser._id).toHexString(), eType: systemUsers.eType }, config.JWT_SECRET)
        }
        await UsersModel.updateOne({ _id: ObjectId(systemUser._id) }, { $push: { aJwtTokens: newToken } })
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cToken) })
    } catch (error) {
      return catchError('SystemUsers.addToken', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const data = await UsersModel.countDocuments({ eType: 'B' })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csystemUser), data })
    } catch (error) {
      return catchError('SystemUsers.get', error, req, res)
    }
  }

  async remove(req, res) {
    try {
      await UsersModel.deleteMany({ eType: 'B' }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].csystemUser) })
    } catch (error) {
      return catchError('SystemUsers.remove', error, req, res)
    }
  }

  async adminGet(req, res) {
    try {
      const user = await UsersModel.findOne({ _id: req.params.id, eType: 'B' }).lean()

      if (!user) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cprofile) })

      UsersModel.filterData(user)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cprofile), data: user })
    } catch (error) {
      return catchError('Users.adminGet', error, req, res)
    }
  }

  async adminUpdate(req, res) {
    try {
      const { sEmail, sMobNum, eStatus, eGender } = req.body
      req.body = pick(req.body, ['sName', 'eGender', 'eStatus', 'sReferCode', 'sProPic', 'dDob', 'iCityId', 'iCountryId', 'iStateId', 'sAddress', 'nPinCode', 'sEmail', 'sMobNum'])
      removenull(req.body)
      const projection = projectionFields(req.body)

      const iUserId = req.params.id

      const oOldFields = await UsersModel.findOne({ _id: iUserId, eType: 'B' }, { ...projection, aJwtTokens: 1, _id: 0 }).lean()
      if (!oOldFields) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].csystemUser) })
      if (eStatus && eStatus === 'N') {
        const { aJwtTokens } = oOldFields
        for (const token of aJwtTokens) {
          const { sToken } = token
          await UsersModel.updateOne({ _id: ObjectId(iUserId) }, { $pull: { aJwtTokens: { sToken } } })
          await redisClient.del(`at:${sToken}`)
        }
      }

      const { _id: iAdminId } = req.admin
      const userExist = await UsersModel.findOne({ $or: [{ sEmail }, { sMobNum }], _id: { $ne: iUserId } }).lean()
      if (userExist) {
        if (userExist.sMobNum === sMobNum) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].mobileNumber) })
        if (userExist.sEmail === sEmail) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].email) })
        if (userExist.sEmail !== sEmail) req.body.bIsEmailVerified = true
        if (userExist.sMobNum !== sMobNum) req.body.bIsMobVerified = true
      }

      if (eGender && !(data.userGender.includes(eGender))) { return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.UnprocessableEntity, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cGender) }) }

      const user = await UsersModel.findByIdAndUpdate(iUserId, { ...req.body }, { new: true, runValidators: true }).lean()

      const oNewFields = { ...req.body }
      const logData = { oOldFields, oNewFields, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: ObjectId(iUserId), eKey: 'P' }
      // await adminServices.adminLog(req, res, logData)
      adminLogQueue.publish(logData)
      

      UsersModel.filterData(user)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].csystemUser), data: user })
    } catch (error) {
      return catchError('Users.adminUpdate', error, req, res)
    }
  }
}

const isUserNameExist = async () => {
  const randomUser = getRandomUser()
  const { sEmail, sMobNum, sUsername } = randomUser
  const isUserExists = await UsersModel.countDocuments({ $or: [{ sEmail }, { sMobNum }, { sUsername }], eStatus: { $ne: 'D' } })
  if (!isUserExists) {
    return randomUser
  } else {
    return isUserNameExist()
  }
}

const getRandomUser = () => {
  const gender = Math.random() >= 0.5 ? 'male' : 'female'
  const users = gender === 'male' ? maleFirstNames : femaleFirstNames
  // const randomNumber = getRandomNDigitNumber(randomBetween(0, 4));
  const fullFirstName = users[randomBetween(0, users.length - 1)]
  const fullLastName = lastNames[randomBetween(0, lastNames.length - 1)]
  const firstName = fullFirstName
  const lastName = /* Math.random() >= 0.5 ? fullLastName.substr(0, 1) : */ fullLastName
  const sName = `${fullFirstName} ${fullLastName}`
  const sUsername = `${firstName}${lastName}`.toLocaleLowerCase()

  return {
    sName,
    sUsername,
    eType: 'B',
    eGender: gender === 'male' ? 'M' : 'F',
    sEmail: `${sUsername}@mail.com`,
    sMobNum: '91' + parseInt((Math.random() * 9 + 1) * Math.pow(10, 7), 10),
    // sReferCode: randomStr(6, 'referral'),
    ePlatform: 'O',
    bIsEmailVerified: true,
    bIsMobVerified: true,
    eStatus: 'Y'
  }
}
// eslint-disable-next-line no-unused-vars
const getRandomNDigitNumber = (numOfDigits) => Math.floor(Math.pow(10, numOfDigits - 1) + Math.random() * Math.pow(10, numOfDigits - 1) * 9)
const randomBetween = (min, max) => Math.floor(Math.random() * max) + min

module.exports = new SystemUsers()
