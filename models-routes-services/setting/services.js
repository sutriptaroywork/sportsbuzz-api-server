const SettingModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, removenull, getPaginationValues2, handleCatchError, getIp, checkValidImageType, defaultSearch } = require('../../helper/utilities.services')
const { CACHE_2 } = require('../../config/config')
const cachegoose = require('recachegoose')
const s3 = require('../../helper/s3config')
const mongoose = require('mongoose')
const config = require('../../config/config')
const ObjectId = mongoose.Types.ObjectId
const { contestKeys } = require('../../data')
const { redisClient } = require('../../helper/redis')
const adminServices = require('../admin/subAdmin/services')
const adminLogQueue = require('../../rabbitmq/queue/adminLogQueue')

class Setting {
  findSetting(key) {
    return SettingModel.findOne({ sKey: key, eStatus: 'Y' }).lean().cache(CACHE_2, `setting:${key}`)
  }

  // To add Setting
  async add(req, res) {
    try {
      const { sKey } = req.body
      const { _id: iAdminId } = req.admin
      req.body = pick(req.body, ['sTitle', 'sKey', 'nMax', 'nMin', 'eStatus', 'sDescription'])

      if (req.body.sKey) req.body.sKey = defaultSearch(req.body.sKey)

      const exist = await SettingModel.findOne({ sKey: { $regex: new RegExp('^.*' + req.body.sKey + '.*', 'i') } }).lean()
      if (exist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cvalidationSetting) })

      if (contestKeys.includes(sKey.toUpperCase())) {
        req.body.eStatus = 'Y'
      }
      const data = await SettingModel.create({ ...req.body })

      const logData = { oOldFields: {}, oNewFields: data, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'S' }
      adminLogQueue.publish(logData);
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnewSetting), data })
    } catch (error) {
      catchError('Setting.add', error, req, res)
    }
  }

  // To update Setting
  async update(req, res) {
    try {
      const { sKey } = req.body
      const { _id: iAdminId } = req.admin
      req.body = pick(req.body, ['sTitle', 'sKey', 'nMax', 'nMin', 'eStatus', 'sDescription', 'sValue'])
      removenull(req.body)

      const setting = await Promise.all([
        SettingModel.findOne({ sKey: req.body.sKey, _id: { $ne: ObjectId(req.params.id) } }).lean(),
        SettingModel.findOne({ _id: ObjectId(req.params.id) }).lean()
      ])

      if (setting[0]) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cvalidationSetting) })

      if (contestKeys.includes(sKey.toUpperCase())) {
        req.body.eStatus = 'Y'
      }

      const data = await SettingModel.findByIdAndUpdate(req.params.id, { ...req.body, dUpdatedAt: Date.now() }, { new: true, runValidators: true }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].csetting) })

      cachegoose.clearCache(`setting:${data.sKey}`)
      if (data.sKey === 'Withdraw') {
        await redisClient.del('__express__/api/user/setting/Withdraw/v2')
      } else if (data.sKey === 'PCF' || data.sKey === 'PCS') {
        await redisClient.del('__express__/api/user/setting/PrivateLeague/v2')
      } else if (data.sKey === 'Deposit') {
        await redisClient.del('__express__/api/user/setting/Deposit/v2')
      }
      const logData = { oOldFields: setting[1], oNewFields: data, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'S' }
      adminLogQueue.publish(logData);//chnages here
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].csetting), data })
    } catch (error) {
      catchError('Setting.update', error, req, res)
    }
  }

  // To get List of Setting with pagination, sorting and searching
  async list(req, res) {
    try {
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      const query = search ? { sTitle: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : { }

      const results = await SettingModel.find(query, {
        sTitle: 1,
        sKey: 1,
        nMax: 1,
        nMin: 1,
        sValue: 1,
        eStatus: 1,
        sDescription: 1,
        dCreatedAt: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const total = await SettingModel.countDocuments({ ...query })

      const data = [{ total, results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csetting), data: data })
    } catch (error) {
      return catchError('Setting.list', error, req, res)
    }
  }

  // To get details of single Setting by _id
  async get(req, res) {
    try {
      const data = await SettingModel.findById(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].csetting) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csetting), data })
    } catch (error) {
      catchError('Setting.get', error, req, res)
    }
  }

  // To get details of single Setting by key for admin side validation
  async getSettingByKeyAdmin(req, res) {
    try {
      const data = await SettingModel.findOne({ sKey: req.params.key.toUpperCase() }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csetting), data: data || {} })
    } catch (error) {
      catchError('Setting.get', error, req, res)
    }
  }

  async getDepositWithdrawSettingByType(req, res) {
    try {
      const type = req.params.type
      let data
      if (type === 'Deposit' || type === 'Withdraw') {
        data = await SettingModel.findOne({ sKey: type }).lean()
      }
      const currencySetting = await SettingModel.findOne({ sKey: 'CURRENCY' }, { sLogo: 1 }).lean()
      const symbol = currencySetting && currencySetting.sLogo ? currencySetting.sLogo : '₹'

      // we'll add validation message according to setting type from below format
      if (type === 'Deposit' && data) {
        data.sMinMessage = `Minimum amount to deposit is ${symbol}${data.nMin}`
        data.sMaxMessage = `Maximum amount to deposit is ${symbol}${data.nMax}`
      } else if (type === 'Withdraw' && data) {
        data.sMinMessage = `Minimum amount to withdraw is ${symbol}${data.nMin}`
        data.sMaxMessage = `Maximum amount to withdraw is ${symbol}${data.nMax}`
      } else if (type === 'PrivateLeague') {
        data = await SettingModel.find({ sKey: { $in: ['PUBC', 'PCF'] } }, { sKey: 1, nMax: 1, nMin: 1, sTitle: 1 }).lean()

        let oSize = {}
        let oPrize = {}

        data = data.map((d) => {
          if (d.sKey === 'PUBC') {
            oSize = {
              ...d,
              sName: d.sTitle,
              sMinMessage: `Choose Contest Size between ${d.nMin} and ${d.nMax}.`,
              sMaxMessage: `Choose Contest Size between ${d.nMin} and ${d.nMax}.`
            }
          } else if (d.sKey === 'PCF') {
            oPrize = {
              ...d,
              sName: d.sTitle,
              sMinMessage: `Choose winning amount between ${symbol}${d.nMin} and ${symbol}${d.nMax}.`,
              sMaxMessage: `Choose winning amount between ${symbol}${d.nMin} and ${symbol}${d.nMax}.`
            }
          }
        })
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csetting), data: { oSize, oPrize } })
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csetting), data })
    } catch (error) {
      catchError('Setting.getDepositWithdrawSettingByType', error, req, res)
    }
  }

  async getDepositWithdrawSettingByTypeV2(req, res) {
    try {
      const type = req.params.type
      let data
      if (type === 'Deposit' || type === 'Withdraw') {
        data = await SettingModel.findOne({ sKey: type }).lean()
      }
      const currencySetting = await SettingModel.findOne({ sKey: 'CURRENCY' }, { sLogo: 1 }).lean()
      const symbol = currencySetting && currencySetting.sLogo ? currencySetting.sLogo : '₹'

      // we'll add validation message according to setting type from below format
      if (type === 'Deposit' && data) {
        data.sMinMessage = `Minimum amount to deposit is ${symbol}${data.nMin}`
        data.sMaxMessage = `Maximum amount to deposit is ${symbol}${data.nMax}`
      } else if (type === 'Withdraw' && data) {
        data.sMinMessage = `Minimum amount to withdraw is ${symbol}${data.nMin}`
        data.sMaxMessage = `Maximum amount to withdraw is ${symbol}${data.nMax}`
      } else if (type === 'PrivateLeague') {
        data = await SettingModel.find({ sKey: { $in: ['PCS', 'PCF'] } }, { sKey: 1, nMax: 1, nMin: 1, sTitle: 1 }).lean()

        let oSize = {}
        let oPrize = {}

        data = data.map((d) => {
          if (d.sKey === 'PCS') {
            oSize = {
              ...d,
              sName: d.sTitle,
              sMinMessage: `Choose Contest Size between ${d.nMin} and ${d.nMax}.`,
              sMaxMessage: `Choose Contest Size between ${d.nMin} and ${d.nMax}.`
            }
          } else if (d.sKey === 'PCF') {
            oPrize = {
              ...d,
              sName: d.sTitle,
              sMinMessage: `Choose winning amount between ${symbol}${d.nMin} and ${symbol}${d.nMax}.`,
              sMaxMessage: `Choose winning amount between ${symbol}${d.nMin} and ${symbol}${d.nMax}.`
            }
          }
        })
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csetting), data: { oSize, oPrize } })
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csetting), data })
    } catch (error) {
      catchError('Setting.getDepositWithdrawSettingByType', error, req, res)
    }
  }

  async getFixDepositSetting(req, res) {
    try {
      const data = await SettingModel.find({ sKey: /FIX_DEPOSIT*/, eStatus: 'Y' }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].csetting), data })
    } catch (error) {
      catchError('Setting.getFixDepositSetting', error, req, res)
    }
  }

  // To update COUNTRY Currency
  async updateCurrency(req, res) {
    try {
      req.body = pick(req.body, ['sTitle', 'sShortName', 'sLogo', 'sDescription'])
      removenull(req.body)
      const { _id: iAdminId } = req.admin

      let data = await SettingModel.findOneAndUpdate({ sKey: 'CURRENCY' }, { ...req.body, dUpdatedAt: Date.now() }, { runValidators: true }).lean()

      if (!data) {
        data = await SettingModel.create({ ...req.body, sKey: 'CURRENCY' })
      }
      const oNewFields = { ...data, ...req.body }
      const logData = { oOldFields: data, oNewFields, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'S' }
      adminLogQueue.publish(logData);
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].currency), data: oNewFields })
    } catch (error) {
      catchError('Setting.updateCurrency', error, req, res)
    }
  }

  // To get details of single COUNTRY Currency by _id
  async getCurrency(req, res) {
    try {
      const data = await SettingModel.findOne({ sKey: 'CURRENCY' }, { sTitle: 1, sLogo: 1, sShortName: 1, sKey: 1, sDescription: 1 }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].currency), data })
    } catch (error) {
      catchError('Setting.getCurrency', error, req, res)
    }
  }

  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await s3.signedUrl(sFileName, sContentType, config.s3SideBackground)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('Setting.getSignedUrl', error, req, res)
    }
  }

  async getSideBackground(req, res) {
    try {
      const data = await SettingModel.findOne({ sKey: req.params.key }, { sImage: 1, sKey: 1, sDescription: 1 }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].sideBackground), data })
    } catch (error) {
      catchError('Setting.getSideBackground', error, req, res)
    }
  }

  async getUserSideBackground(req, res) {
    try {
      const img = await SettingModel.find({ $or: [{ sKey: 'BG' }, { sKey: 'IMG' }] }, { sImage: 1, sKey: 1, sDescription: 1 }).lean()
      const data = {}
      if (img[0].sKey === 'BG') {
        data.sBackImage = img[0].sImage
        data.sImage = img[1].sImage
      } else {
        data.sBackImage = img[1].sImage
        data.sImage = img[0].sImage
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].sideBackground), data })
    } catch (error) {
      catchError('Setting.getUserSideBackground', error, req, res)
    }
  }

  async updateSideBackground(req, res) {
    try {
      const { sImage, sKey } = req.body
      const { _id: iAdminId } = req.admin
      req.body = pick(req.body, ['sImage', 'sDescription'])

      let data = await SettingModel.findOneAndUpdate({ sKey }, { ...req.body, dUpdatedAt: Date.now() }, { runValidators: true }).lean()
      if (!data) {
        const sTitle = sKey === 'BG' ? 'Side Background' : 'Side Image'
        data = await SettingModel.create({ sImage, sKey, sTitle })
      }
      const oNewFields = { ...data, ...req.body }
      const logData = { oOldFields: data, oNewFields, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'S' }
      adminLogQueue.publish(logData);
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].sideBackground), data: oNewFields })
    } catch (error) {
      catchError('Setting.updateSideBackground', error, req, res)
    }
  }

  async getCurrencySymbol() {
    try {
      const data = await SettingModel.findOne({ sKey: 'CURRENCY' }, { sLogo: 1 }).lean().cache(CACHE_2, 'setting:CURRENCY')
      return data && data.sLogo ? data.sLogo : '₹'
    } catch (error) {
      handleCatchError(error)
      return '₹'
    }
  }
}

module.exports = new Setting()
