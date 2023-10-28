const mongoose = require('mongoose')
const KycModel = require('./model')
const UserModel = require('../user/model')
const ObjectId = mongoose.Types.ObjectId
const config = require('../../config/config')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, getPaginationValues, getIp, handleCatchError, checkValidImageType, defaultSearch, replaceSensitiveInfo } = require('../../helper/utilities.services')
var AWS = require('aws-sdk')
const adminServices = require('../admin/subAdmin/services')
const { queuePush } = require('../../helper/redis')
const { bAllowDiskUse, s3KycPan, s3KycAadhaar, s3KycBankDoc } = config
const SecurityProvider = require('../../helper/security-provider')
const securityProvider = new SecurityProvider()
const KycProvider = require('../../helper/kyc-provider')
const kycProvider = new KycProvider()
const KYC_VERIFIED_TYPE = require('../../enums/kycEnums/kycVerifiedType')
const KYC_VERIFY_MESSAGE = require('../../enums/kycEnums/KycVerifyMessage')
const KYC_USER_MESSAGE = require('../../enums/kycEnums/kycMessagetoUser')
const KYC_DOC_TYPE = require('../../enums/kycEnums/kycDocType')
const KYC_STATUS = require('../../enums/kycEnums/KycStatus')
const IDFY_STATUS = require('../../enums/kycEnums/idfyStatus')
const PLATFORMS = require('../../enums/kycEnums/platforms')
const { uuid } = require('uuidv4')
const dbService = require('./dbService')
const axios = require('axios')
const adminLogQueue = require('../../rabbitmq/queue/adminLogQueue')
require('../../rabbitmq/queue/kycNotification')
require('../../rabbitmq/queue/kycLogs')
require('../../rabbitmq/queue/statData')
require('../../rabbitmq/queue/bonusExpire')

AWS.config.update({ accessKeyId: config.AWS_KYC_ACCESS_KEY, secretAccessKey: config.AWS_KYC_SECRET_KEY, signatureVersion: 'v4', region: 'ap-south-1' })
var s3 = new AWS.S3()

async function getSignedUrl(params) {
  return new Promise((resolve, reject) => {
    s3.getSignedUrl('getObject', params, (err, url) => {
      if (err) reject(err)
      resolve(url)
    })
  })
}
class UserKyc {
  async add(req, res) {
    try {
      const { eType } = req.body
      const iUserId = req.user ? ObjectId(req.user._id) : ObjectId(req.params.id)
      const adminFlag = req.user ? '' : 'admin'
      const iAdminId = req.user ? '' : ObjectId(req.admin._id)

      if (!adminFlag) {
        const user = await UserModel.countDocuments({ _id: iUserId })
        if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })
      }

      const user = await KycModel.findOne({ iUserId }).lean()

      if (user && (user.oAadhaar.eStatus === 'P' && user.oPan.eStatus === 'P')) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].kyc_under_review })

      const kycDetails = await validateKyc(req.body, req.userLanguage, iUserId, iAdminId, getIp(req), adminFlag)
      if (kycDetails.isSuccess === false) return res.status(kycDetails.status).jsonp({ status: kycDetails.jsonStatus, message: kycDetails.message })

      let data
      if (user) {
        data = await KycModel.findOneAndUpdate({ iUserId }, { ...kycDetails }, { new: true, runValidators: true }).lean()
      } else {
        data = await KycModel.create({ ...kycDetails })
      }

      eType === 'AADHAAR' ? data.oPan = undefined : data.oAadhaar = undefined
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].newKyc), data })
    } catch (error) {
      catchError('userKyc.add', error, req, res)
    }
  }

  // New kyc flow
  async addV2(req, res) {
    try {
      const { eType } = req.body
      const iUserId = req.user ? ObjectId(req.user._id) : ObjectId(req.params.id)
      const adminFlag = req.user ? '' : 'admin'
      const iAdminId = req.user ? '' : ObjectId(req.admin._id)

      if (!adminFlag) {
        const user = await UserModel.countDocuments({ _id: iUserId })
        if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })
      }

      const user = await KycModel.findOne({ iUserId }).lean()

      if (user && (user.oAadhaar.eStatus === 'P' && user.oPan.eStatus === 'P')) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].kyc_under_review })

      const kycDetails = await validateKycV2(req.body, req.userLanguage, iUserId, iAdminId, getIp(req), adminFlag)
      if (kycDetails.isSuccess === false) return res.status(kycDetails.status).jsonp({ status: kycDetails.jsonStatus, message: kycDetails.message })

      let data
      if (user) {
        data = await KycModel.findOneAndUpdate({ iUserId }, { ...kycDetails }, { new: true, runValidators: true }).lean()
      } else {
        data = await KycModel.create({ ...kycDetails })
      }

      eType === 'AADHAAR' ? data.oPan = undefined : data.oAadhaar = undefined
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].newKyc), data })
    } catch (error) {
      catchError('userKyc.addV2', error, req, res)
    }
  }

  async getSignedUrlKyc(req, res) {
    try {
      req.body = pick(req.body, ['oPath'])

      const { oPath } = req.body
      AWS.config.update({ accessKeyId: config.AWS_KYC_ACCESS_KEY, secretAccessKey: config.AWS_KYC_SECRET_KEY, signatureVersion: 'v4', region: 'ap-south-1' })
      s3 = new AWS.S3()

      const signedUrls = {}
      for (const path in oPath) {
        const key = path
        const value = oPath[path]
        const params = {
          Bucket: config.S3_KYC_BUCKET_NAME,
          Key: value,
          Expires: 300
        }
        let url = ''
        try {
          if (value) url = await getSignedUrl(params)
          Object.assign(signedUrls, { [key]: url })
        } catch (error) {
          return catchError('userKyc.getSignedUrlKyc', error, req, res)
        }
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data: signedUrls })
    } catch (error) {
      return catchError('userKyc.getSignedUrlKyc', error, req, res)
    }
  }

  // update according to new flow
  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])

      let { sFileName, sContentType } = req.body
      const { type, id } = req.params

      if (![KYC_DOC_TYPE.PAN, KYC_DOC_TYPE.AADHAAR, KYC_DOC_TYPE.BANK].includes(type)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].stype) })

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      sFileName = sFileName.replace('/', '-')
      sFileName = sFileName.replace(/\s/gi, '-')

      // if (!imageExtensions.includes(sFileName.split('.').pop()) || !imageMimeTypes.includes(sContentType)) {
      //   return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })
      // }

      let fileKey = ''
      let s3Path = ''

      // * make change for bank varifivation flow
      if (type === KYC_DOC_TYPE.PAN) {
        s3Path = s3KycPan
      } else if (type === KYC_DOC_TYPE.AADHAAR) {
        s3Path = s3KycAadhaar
      } else {
        s3Path = s3KycBankDoc
      }

      // fileKey = `${type}_${Date.now()}_${sFileName}`

      if (req.user) {
        fileKey = `${req.user._id}_${type}_${Date.now()}_${sFileName}`
      } else {
        fileKey = `${id}_${type}_${Date.now()}_${sFileName}`
      }

      const params = {
        Bucket: config.S3_KYC_BUCKET_NAME,
        Key: s3Path + fileKey,
        Expires: 300,
        ContentType: sContentType
      }

      s3.getSignedUrl('putObject', params, function (error, url) {
        if (error) {
          catchError('userKyc.getSignedUrl', error, req, res)
        } else {
          return res.status(status.OK).jsonp({
            status: jsonStatus.OK,
            message: messages[req.userLanguage].presigned_succ,
            data: {
              sUrl: url,
              sPath: s3Path + fileKey
            }
          })
        }
      })
    } catch (error) {
      catchError('userKyc.getSignedUrl', error, req, res)
    }
  }

  async update(req, res) {
    try {
      const { eType } = req.body
      const iUserId = req.user ? ObjectId(req.user._id) : ObjectId(req.params.id)
      const adminFlag = req.user ? '' : 'admin'
      const iAdminId = req.user ? '' : req.admin._id

      let oOldFields, oNewFields

      const user = await KycModel.findOne({ iUserId }).lean()
      if (req.user) {
        // user = await KycModel.findOne({ iUserId }).lean()
        if (user && eType === 'AADHAAR') {
          if (user.oAadhaar.eStatus === 'P') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].kyc_under_review })
        } else if (user && eType === 'PAN') {
          if (user.oPan.eStatus === 'P') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].kyc_under_review })
        }
      }

      const updateObject = await validateKyc(req.body, req.userLanguage, iUserId, iAdminId, getIp(req), adminFlag)
      if (updateObject.isSuccess === false) return res.status(updateObject.status).jsonp({ status: updateObject.jsonStatus, message: updateObject.message })

      const data = await KycModel.findOneAndUpdate({ iUserId }, updateObject, { runValidators: true, new: true })
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].kyc) })

      if (req.admin) {
        let { _id: iAdminId } = req.admin
        iAdminId = ObjectId(iAdminId)

        if (user && eType === 'AADHAAR') {
          oNewFields = data.oAadhaar
          oOldFields = user.oAadhaar
        } else if (eType === 'PAN') {
          oNewFields = data.oPan
          oOldFields = user.oPan
        }
        let logData = { oOldFields, oNewFields, iAdminId, iUserId, sIP: getIp(req), eKey: 'KYC' }
        logData = await replaceSensitiveInfo(logData)
        adminLogQueue.publish(logData)
        // await adminServices.adminLog(req, res, logData)
      }

      eType === 'AADHAAR' ? data.oPan = undefined : data.oAadhaar = undefined
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].kycDetails), data })
    } catch (error) {
      catchError('userKyc.update', error, req, res)
    }
  }

  async updateV2(req, res) {
    try {
      const { eType } = req.body
      const iUserId = req.user ? ObjectId(req.user._id) : ObjectId(req.params.id)
      const adminFlag = req.user ? '' : 'admin'
      const iAdminId = req.user ? '' : req.admin._id

      let oOldFields, oNewFields

      const user = await KycModel.findOne({ iUserId }).lean()
      if (req.user) {
        // user = await KycModel.findOne({ iUserId }).lean()
        if (user && eType === 'AADHAAR') {
          if (user.oAadhaar.eStatus === 'P') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].kyc_under_review })
        } else if (user && eType === 'PAN') {
          if (user.oPan.eStatus === 'P') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].kyc_under_review })
        }
      }

      const updateObject = await validateKycV2(req.body, req.userLanguage, iUserId, iAdminId, getIp(req), adminFlag)
      if (updateObject.isSuccess === false) return res.status(updateObject.status).jsonp({ status: updateObject.jsonStatus, message: updateObject.message })

      const data = await KycModel.findOneAndUpdate({ iUserId }, updateObject, { runValidators: true, new: true })
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].kyc) })

      if (req.admin) {
        let { _id: iAdminId } = req.admin
        iAdminId = ObjectId(iAdminId)

        if (user && eType === 'AADHAAR') {
          oNewFields = data.oAadhaar
          oOldFields = user.oAadhaar
        } else if (eType === 'PAN') {
          oNewFields = data.oPan
          oOldFields = user.oPan
        }
        let logData = { oOldFields, oNewFields, iAdminId, iUserId, sIP: getIp(req), eKey: 'KYC' }
        logData = await replaceSensitiveInfo(logData)
        adminLogQueue.publish(logData)
        // await adminServices.adminLog(req, res, logData)
      }

      eType === 'AADHAAR' ? data.oPan = undefined : data.oAadhaar = undefined
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].kycDetails), data })
    } catch (error) {
      catchError('userKyc.updateV2', error, req, res)
    }
  }

  async updateV3(req, res) {
    try {
      const { eType } = req.body
      const iUserId = req.user ? ObjectId(req.user._id) : ObjectId(req.params.id)
      const adminFlag = req.user ? '' : 'admin'
      const iAdminId = req.user ? '' : req.admin._id

      let oOldFields, oNewFields

      let oUserKyc = await KycModel.findOne({ iUserId }).lean()
      if (!oUserKyc) {
        oUserKyc = { oAadhaar: { eStatus: 'N' }, oPan: { eStatus: 'N' } }
      }

      if (req.user) {
        // user = await KycModel.findOne({ iUserId }).lean()
        if (oUserKyc && eType === 'AADHAAR') {
          if (oUserKyc.oAadhaar.eStatus === 'P') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].kyc_under_review })
        } else if (oUserKyc && eType === 'PAN') {
          if (oUserKyc.oPan.eStatus === 'P') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].kyc_under_review })
        }
      }
      req.body.oUserKyc = oUserKyc
      const updateObject = await validateKycV3(req.body, req.userLanguage, iUserId, iAdminId, getIp(req), adminFlag)
      if (updateObject.isSuccess === false) return res.status(updateObject.status).jsonp({ status: updateObject.jsonStatus, message: updateObject.message })

      let data = await KycModel.findOneAndUpdate({ iUserId }, updateObject, { runValidators: true, new: true })
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].kyc) })

      const consolidated = data?.oAadhaar?.eStatus === KYC_STATUS.ACCEPTED && data?.oPan?.eStatus === KYC_STATUS.ACCEPTED
      if (consolidated) {
        const [, kycUpdatedData] = await Promise.all([UserModel.findByIdAndUpdate(iUserId, { bIsKycApproved: consolidated }, { new: true, runValidators: true }).lean(), KycModel.findOneAndUpdate({ iUserId }, { consolidated }, { runValidators: true, new: true })])
        data = kycUpdatedData
      }

      if (req.admin) {
        let { _id: iAdminId } = req.admin
        iAdminId = ObjectId(iAdminId)

        if (oUserKyc && eType === 'AADHAAR') {
          oNewFields = data.oAadhaar
          oOldFields = oUserKyc.oAadhaar
        } else if (eType === 'PAN') {
          oNewFields = data.oPan
          oOldFields = oUserKyc.oPan
        }
        let logData = { oOldFields, oNewFields, iAdminId, iUserId, sIP: getIp(req), eKey: 'KYC' }
        logData = await replaceSensitiveInfo(logData)
        adminLogQueue.publish(logData)
        // await adminServices.adminLog(req, res, logData)
      }

      eType === 'AADHAAR' ? data.oPan = undefined : data.oAadhaar = undefined
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].kycDetails), data })
    } catch (error) {
      catchError('userKyc.updateV3', error, req, res)
    }
  }

  // Deprecated service, no longer in used.
  async pendingKycList(req, res) {
    try {
      let { panFilter, aadhaarFilter } = req.query
      req.query = pick(req.query, ['start', 'limit', 'sort', 'order', 'search'])

      let { start, limit, sorting, search } = getPaginationValues(req.query)

      panFilter = panFilter ? panFilter.toUpperCase() : undefined
      aadhaarFilter = aadhaarFilter ? aadhaarFilter.toUpperCase() : undefined

      let query = {}
      let filterQuery = {}
      if (panFilter && ['P', 'A', 'R', 'N'].includes(panFilter)) {
        query = { 'oPan.eStatus': panFilter }
      }
      if (aadhaarFilter && ['P', 'A', 'R', 'N'].includes(aadhaarFilter)) {
        filterQuery = { 'oAadhaar.eStatus': aadhaarFilter }
      }
      if (search) search = defaultSearch(search)

      const data = await KycModel.aggregate([
        {
          $match: { ...query, ...filterQuery }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'iUserId',
            foreignField: '_id',
            as: 'userData'
          }
        },
        {
          $unwind: '$userData'
        },
        {
          $sort: sorting
        },
        {
          $match: {
            'userData.sName': { $regex: new RegExp('^.*' + search + '.*', 'i') }
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
                _id: '$document._id',
                iUserId: '$document.iUserId',
                userName: { $ifNull: ['$document.userData.sName', ''] },
                oPan: {
                  sNo: '$document.oPan.sNo',
                  sImage: '$document.oPan.sImage',
                  eStatus: '$document.oPan.eStatus',
                  dCreatedAt: '$document.oPan.dCreatedAt'
                },
                oAadhaar: {
                  nNo: '$document.oAadhaar.nNo',
                  eStatus: '$document.oAadhaar.eStatus',
                  sFrontImage: '$document.oAadhaar.sFrontImage',
                  sBackImage: '$document.oAadhaar.sBackImage',
                  dCreatedAt: '$document.oAadhaar.dCreatedAt'
                }
              }
            }
          }
        }
      ]).allowDiskUse(bAllowDiskUse).exec()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].kyc), data: data })
    } catch (error) {
      return catchError('UserAdminServices.pendingKycList', error, req, res)
    }
  }

  async pendingKycListV2(req, res) {
    try {
      let { panFilter, aadhaarFilter, iUserId, datefrom, dateto, isFullResponse, sort } = req.query
      req.query = pick(req.query, ['start', 'limit', 'sort', 'order', 'search'])

      let { start, limit, sorting } = getPaginationValues(req.query)
      start = parseInt(start)
      limit = parseInt(limit)

      panFilter = panFilter ? panFilter.toUpperCase() : undefined
      aadhaarFilter = aadhaarFilter ? aadhaarFilter.toUpperCase() : undefined

      let query = {}
      let filterQuery = {}
      if (panFilter && ['P', 'A', 'R', 'N'].includes(panFilter)) {
        if (panFilter === 'N') {
          query.$or = [{ 'oPan.eStatus': 'N' }, { 'oPan.eStatus': { $exists: false } }]
        } else {
          query = { 'oPan.eStatus': panFilter }
        }
      }

      if (aadhaarFilter && ['P', 'A', 'R', 'N'].includes(aadhaarFilter)) {
        if (aadhaarFilter === 'N') {
          filterQuery.$or = [{ 'oAadhaar.eStatus': 'N' }, { 'oAadhaar.eStatus': { $exists: false } }]
        } else {
          filterQuery = { 'oAadhaar.eStatus': aadhaarFilter }
        }
      }
      if (iUserId) query.iUserId = ObjectId(iUserId)
      if (datefrom && dateto) {
        query = { ...query, $or: [{ 'oPan.dCreatedAt': { $gte: (datefrom), $lte: (dateto) } }, { 'oAadhaar.dCreatedAt': { $gte: (datefrom), $lte: (dateto) } }] }
      }
      query = { ...query, ...filterQuery }
      let kycDetails
      const total = await KycModel.countDocuments(query)
      if ([true, 'true'].includes(isFullResponse)) {
        if (!datefrom || !dateto) {
          return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].date_filter_err })
        }
        kycDetails = await KycModel.find(query).populate({ path: 'iUserId', select: 'sUsername' }).populate({ path: 'oAadhaar.oVerifiedAt.iAdminId', select: 'sUsername' }).populate({ path: 'oPan.oVerifiedAt.iAdminId', select: 'sUsername' }).sort(sorting).lean()
      } else {
        kycDetails = sort
          ? await KycModel.find(query).populate({ path: 'iUserId', select: 'sUsername' }).populate({ path: 'oAadhaar.oVerifiedAt.iAdminId', select: 'sUsername' }).populate({ path: 'oPan.oVerifiedAt.iAdminId', select: 'sUsername' }).sort(sorting).skip(start).limit(limit).lean()
          : await KycModel.find(query).populate({ path: 'iUserId', select: 'sUsername' }).populate({ path: 'oAadhaar.oVerifiedAt.iAdminId', select: 'sUsername' }).populate({ path: 'oPan.oVerifiedAt.iAdminId', select: 'sUsername' }).sort({ dUpdatedAt: -1 }).skip(start).limit(limit).lean()
      }

      if (kycDetails && kycDetails.length) {
        kycDetails.forEach(element => {
          if (element?.oAadhaar?.oVerifiedAt?.iAdminId?._id) {
            element.oAadhaar.oVerifiedAt.iAdminId = element.oAadhaar.oVerifiedAt.iAdminId.sUsername
          }
          if (element?.oPan?.oVerifiedAt?.iAdminId?._id) {
            element.oPan.oVerifiedAt.iAdminId = element.oPan.oVerifiedAt.iAdminId.sUsername
          }
        })
      }

      if (kycDetails && kycDetails.length) {
        kycDetails.forEach(element => {
          if (element?.oAadhaar?.oVerifiedAt?.iAdminId?._id) {
            element.oAadhaar.oVerifiedAt.iAdminId = element.oAadhaar.oVerifiedAt.iAdminId.sUsername
          }
          if (element?.oPan?.oVerifiedAt?.iAdminId?._id) {
            element.oPan.oVerifiedAt.iAdminId = element.oPan.oVerifiedAt.iAdminId.sUsername
          }
        })
      }
      kycDetails.forEach(element => {
        if (element?.oAadhaar?.oVerifiedAt?.iAdminId?._id) {
          element.oAadhaar.oVerifiedAt.iAdminId = element.oAadhaar.oVerifiedAt.iAdminId.sUsername
        }

        if (element?.oPan?.oVerifiedAt?.iAdminId?._id) {
          element.oPan.oVerifiedAt.iAdminId = element.oPan.oVerifiedAt.iAdminId.sUsername
        }
      })

      const data = { total, data: kycDetails }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].kyc), data })
    } catch (error) {
      return catchError('UserAdminServices.pendrsingKycListV2', error, req, res)
    }
  }

  async getKycCount(req, res) {
    try {
      let { ePanStatus, eAadharStatus, datefrom, dateto } = req.query
      const data = {}

      ePanStatus = ePanStatus ? ePanStatus.toUpperCase() : undefined
      eAadharStatus = eAadharStatus ? eAadharStatus.toUpperCase() : undefined

      let query = {}
      let filterQuery = {}

      if (ePanStatus && ['P', 'A', 'R', 'N'].includes(ePanStatus)) {
        if (ePanStatus === 'N') {
          query.$or = [{ 'oPan.eStatus': 'N' }, { 'oPan.eStatus': { $exists: false } }]
        } else {
          query = { 'oPan.eStatus': ePanStatus }
        }
      }

      if (eAadharStatus && ['P', 'A', 'R', 'N'].includes(eAadharStatus)) {
        if (eAadharStatus === 'N') {
          filterQuery.$or = [{ 'oAadhaar.eStatus': 'N' }, { 'oAadhaar.eStatus': { $exists: false } }]
        } else {
          filterQuery = { 'oAadhaar.eStatus': eAadharStatus }
        }
      }

      if (datefrom && dateto) {
        query = { ...query, $or: [{ 'oPan.dCreatedAt': { $gte: (datefrom), $lte: (dateto) } }, { 'oAadhaar.dCreatedAt': { $gte: (datefrom), $lte: (dateto) } }] }
      }
      query = { ...query, ...filterQuery }
      data.nPanCount = await KycModel.countDocuments(query)
      data.nAadharCount = data.nPanCount
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', `${messages[req.userLanguage].kyc} ${messages[req.userLanguage].cCounts}`), data })
    } catch (error) {
      return catchError('UserKyc.getCounts', error, req, res)
    }
  }

  async getKycDetails(req, res) {
    try {
      const iUserId = req.user ? mongoose.Types.ObjectId(req.user._id) : mongoose.Types.ObjectId(req.params.id)

      const data = await KycModel.findOne({ iUserId }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].kyc) })
      if (data.oPan.eStatus === 'R') {
        data.oPan = { sRejectReason: data.oPan ? data.oPan.sRejectReason : '', eStatus: 'R' }
      }
      if (data.oAadhaar.eStatus === 'R') {
        data.oAadhaar = { sRejectReason: data.oAadhaar ? data.oAadhaar.sRejectReason : '', eStatus: 'R' }
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].kyc), data })
    } catch (error) {
      return catchError('UserAdminServices.getKycDetails', error, req, res)
    }
  }

  async getKycDetailsV2(req, res) {
    try {
      const iUserId = req.user ? ObjectId(req.user._id) : ObjectId(req.params.id)

      const data = await KycModel.findOne({ iUserId }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].kyc) })
      if (data.oPan.eStatus === 'R') {
        data.oPan = { sRejectReason: data.oPan ? data.oPan.sRejectReason : '', eStatus: 'R' }
      }
      if (data.oAadhaar.eStatus === 'R') {
        data.oAadhaar = { sRejectReason: data.oAadhaar ? data.oAadhaar.sRejectReason : '', eStatus: 'R' }
      }

      if (data.oAadhaar) {
        if (data.oAadhaar.sFrontImage && data.oAadhaar.sBackImage) {
          data.oAadhaar.sFrontImage = await getUrl(data.oAadhaar.sFrontImage)
          data.oAadhaar.sBackImage = await getUrl(data.oAadhaar.sBackImage)
        }
      }
      if (data.oPan) {
        if (data.oPan.sImage) {
          data.oPan.sImage = await getUrl(data.oPan.sImage)
        }
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].kyc), data })
    } catch (error) {
      return catchError('UserAdminServices.getKycDetails', error, req, res)
    }
  }

  async updateKycStatus(req, res) {
    try {
      const { eStatus, sRejectReason, eType } = req.body
      const iUserId = ObjectId(req.params.id)
      let { _id: iAdminId } = req.admin
      iAdminId = ObjectId(iAdminId)
      let sAadhaarStatus = 'P'
      let sPanStatus = 'P'
      const oUser = await UserModel.findOne({ _id: ObjectId(iUserId) }, { ePlatform: 1 }).lean()

      if (!(['PAN', 'AADHAAR'].includes(eType))) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].stype) }) }

      const deleteObjs = []
      let data, oOldFields, oNewFields
      if (eType === 'PAN') {
        const ePanStatus = eStatus === 'R' ? ['P', 'A'] : ['P']
        const user = await KycModel.findOne({ iUserId, 'oPan.eStatus': { $in: ePanStatus } }).lean()
        if (!user) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].kyc) })

        if (!user.oPan.sImage) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].kyc_status_v_err }) }
        oOldFields = user.oPan
        const panData = {}
        panData.sNo = req.body.sNo ? req.body.sNo : ''
        panData.sDateOfBirth = req.body.sDateOfBirth ? req.body.sDateOfBirth : ''
        panData.sName = req.body.sName ? req.body.sName : ''
        panData.sRejectReason = sRejectReason || ''
        panData.oVerifiedAt = {}
        panData.oVerifiedAt.sIP = getIp(req)
        panData.oVerifiedAt.iAdminId = req.admin._id
        panData.eStatus = eStatus
        panData.oVerifiedAt.dActionedAt = Date.now()
        panData.dUpdatedAt = Date.now()
        panData.eVerifiedBy = KYC_VERIFIED_TYPE.MANUAL
        panData.sImage = user.oPan.sImage
        sAadhaarStatus = (eStatus === 'R') ? 'A' : 'R'
        if (eStatus === 'R') {
          deleteObjs.push({ Key: user.oPan.sImage })
          panData.sImage = ''
        }
        if (user.oPan.sImage) {
          data = await KycModel.findOneAndUpdate({ iUserId }, {
            oPan: panData
          }, { runValidators: true, new: true })
          sAadhaarStatus = 'A'
        }
        oNewFields = data.oPan
        await queuePush('pushNotification:KYC', { iUserId, eStatus, sPushType: 'KYC', ePlatform: oUser.ePlatform })
      } else {
        const eAadhaarStatus = eStatus === 'R' ? ['P', 'A'] : ['P']
        const user = await KycModel.findOne({ iUserId, 'oAadhaar.eStatus': { $in: eAadhaarStatus } }).lean()
        if (!user) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].kyc) })

        if (!user.oAadhaar.sFrontImage && !user.oAadhaar.sBackImage) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].kyc_status_v_err }) }
        oOldFields = user.oAadhaar
        if (eStatus === 'A') {
          data = await KycModel.findOneAndUpdate({ iUserId }, {
            'oAadhaar.eStatus': eStatus,
            'oAadhaar.dUpdatedAt': Date.now(),
            'oAadhaar.oVerifiedAt.dActionedAt': Date.now(),
            'oAadhaar.oVerifiedAt.sIP': getIp(req),
            'oAadhaar.oVerifiedAt.iAdminId': req.admin._id,
            'oAadhaar.sRejectReason': '',
            'oAadhaar.eVerifiedBy': KYC_VERIFIED_TYPE.MANUAL
          }, { runValidators: true, new: true })
          sPanStatus = 'A'
        }
        if (eStatus === 'R') {
          deleteObjs.push({ Key: user.oAadhaar.sFrontImage })
          deleteObjs.push({ Key: user.oAadhaar.sBackImage })
          data = await KycModel.findOneAndUpdate({ iUserId }, {
            'oAadhaar.eStatus': eStatus,
            'oAadhaar.nNo': '',
            'oAadhaar.sRejectReason': sRejectReason,
            'oAadhaar.sFrontImage': '',
            'oAadhaar.sBackImage': '',
            'oAadhaar.dUpdatedAt': Date.now(),
            'oAadhaar.oVerifiedAt.dActionedAt': Date.now(),
            'oAadhaar.oVerifiedAt.iAdminId': req.admin._id,
            'oAadhaar.oVerifiedAt.sIP': getIp(req),
            'oAadhaar.sAadharHashedNumber': '',
            'oAadhaar.eVerifiedBy': KYC_VERIFIED_TYPE.MANUAL
          }, { runValidators: true, new: true })
          await queuePush('pushNotification:KYC', { iUserId, eStatus, sPushType: 'KYC', ePlatform: oUser.ePlatform })
        }
        oNewFields = data.oAadhaar
      }

      if (deleteObjs.length) {
        const s3Params = {
          Bucket: config.S3_KYC_BUCKET_NAME,
          Delete: {
            Objects: deleteObjs,
            Quiet: false
          }
        }
        s3.deleteObjects(s3Params, function (err, dta) {
          if (err) {
            handleCatchError(err)
          }
        })
      }
      let logData = { oOldFields, oNewFields, iAdminId, iUserId, sIP: getIp(req), eKey: 'KYC' }
      logData = await replaceSensitiveInfo(logData)
      adminLogQueue.publish(logData)
      // await adminServices.adminLog(req, res, logData)

      const kycApproval = await KycModel.countDocuments({ iUserId, 'oPan.eStatus': 'A', 'oAadhaar.eStatus': 'A' })
      if (kycApproval) {
        await UserModel.updateOne({ _id: ObjectId(iUserId) }, { bIsKycApproved: true })
      }
      if (oNewFields.eStatus === 'R' && oOldFields.eStatus === 'A') {
        await UserModel.updateOne({ _id: ObjectId(iUserId) }, { bIsKycApproved: false })
      }

      if (sAadhaarStatus === 'A' && sPanStatus === 'A') await queuePush('pushNotification:KYC', { iUserId, eStatus: 'A', sPushType: 'KYC', ePlatform: oUser.ePlatform })

      // if (eStatus === 'R') {
      //   return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', (eType === 'PAN') ? 'Pancard status' : 'Aadhar Card status') })
      // }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', (eType === 'PAN') ? 'Pancard status' : 'Aadhar Card status'), data: data })
    } catch (error) {
      return catchError('UserAdminServices.updateKycStatus', error, req, res)
    }
  }

  getDisclaimer(req, res) {
    try {
      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cDisclaimer),
        data: [
          {
            eStatus: 'P',
            sInfo: `${messages[req.userLanguage].kyc_approval}
            ${messages[req.userLanguage].kyc_info}`
          },

          {
            eStatus: 'N',
            sInfo: messages[req.userLanguage].kyc_info
          }

        ]
      })
    } catch (error) {
      return catchError('UserAdminServices.getDisclaimer', error, req, res)
    }
  }

  async kycPanVerificationV3(req, res) {
    try {
      let sGroupId = uuid()
      const sImagePath = req.body.panCards3Url
      const ePlatform = [PLATFORMS.ANDROID, PLATFORMS.iOS].includes(req.header('Platform')) ? req.header('Platform') : PLATFORMS.OTHERS
      if (!sImagePath) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_uploaded_anything })
      const iUserId = req.user ? ObjectId(req.user._id) : ObjectId(req.params.id)
      const userExistsKycData = await dbService.getExistingUserData(iUserId)
      const signedUrlForPanResponse = {}
      const s3ParamsforSignedUrl = {
        Bucket: config.S3_KYC_BUCKET_NAME, Key: sImagePath, Expires: 300
      }

      let getPanDataFromIdfy = {
        status: IDFY_STATUS.IDFY_STATUS_COMPLETE,
        isKycExistsWithIdfy: false,
        count: {}
      }

      if (userExistsKycData) {
        getPanDataFromIdfy.count = userExistsKycData && userExistsKycData.count ? userExistsKycData.count : {}
        if (userExistsKycData.sIdfyGroupId) {
          sGroupId = userExistsKycData.sIdfyGroupId
          getPanDataFromIdfy.isKycExistsWithIdfy = true
        }
        if (userExistsKycData.oAadhaar && userExistsKycData.oAadhaar.sFrontImage && userExistsKycData.oAadhaar.sBackImage) {
          const [aadhaarBackSignedUrl, aadhaarFrontSigned, panSignedUrl] = await kycUrlGeneration({ sAadharBackImagePath: userExistsKycData.oAadhaar.sBackImage, sAadharFrontImagePath: userExistsKycData.oAadhaar.sFrontImage, panImagePath: sImagePath })
          signedUrlForPanResponse.sFrontImage = aadhaarBackSignedUrl
          signedUrlForPanResponse.sBackImage = aadhaarFrontSigned
          signedUrlForPanResponse.panImageUrl = panSignedUrl
        } else {
          signedUrlForPanResponse.panImageUrl = await getSignedUrl(s3ParamsforSignedUrl)
        }
      } else {
        signedUrlForPanResponse.panImageUrl = await getSignedUrl(s3ParamsforSignedUrl)
      }

      // if (!getPanDataFromIdfy.count.panDIVHit || getPanDataFromIdfy.count.panDIVHit < 3) {
      // getPanDataFromIdfy.count.panDIVHit = getPanDataFromIdfy.count.panDIVHit ? getPanDataFromIdfy.count.panDIVHit + 1 : 1

      getPanDataFromIdfy = await getPanIdfyData({ panImageUrl: signedUrlForPanResponse.panImageUrl, groupId: sGroupId, language: req.userLanguage, getPanDataFromIdfy })
      if (!getPanDataFromIdfy.isVerify) {
        await dbService.updateKycDataWithUpsert({ iUserId: userExistsKycData.iUserId }, { count: getPanDataFromIdfy.count })
        return res.status(getPanDataFromIdfy.status).jsonp({ status: getPanDataFromIdfy.status, message: getPanDataFromIdfy.message, count: getPanDataFromIdfy.count })
      }
      // }
      const kycPanData = { sImage: sImagePath }
      switch (getPanDataFromIdfy.status) {
        case IDFY_STATUS.IDFY_STATUS_FAILED: {
          const kycPanValidationFailedCase = await panValidationFailedCase(iUserId, kycPanData, { language: req.userLanguage, imageUrls: signedUrlForPanResponse, groupId: sGroupId, count: getPanDataFromIdfy.count }, ePlatform)
          return res.status(kycPanValidationFailedCase.status).jsonp({ status: kycPanValidationFailedCase.status, message: kycPanValidationFailedCase.message, data: kycPanValidationFailedCase.data, count: getPanDataFromIdfy.count })
        }
        case IDFY_STATUS.IDFY_STATUS_COMPLETE: {
          let kycAadhaarValidationCompleted
          if (!checkForIdFyMandatoryPanData(getPanDataFromIdfy.idfyPanData)) {
            kycAadhaarValidationCompleted = await panValidationPendingStateCase(iUserId, kycPanData, { language: req.userLanguage, imageUrls: signedUrlForPanResponse, idfyPanData: getPanDataFromIdfy.idfyPanData, groupId: sGroupId, count: getPanDataFromIdfy.count })
          } else {
            kycAadhaarValidationCompleted = await panValidationCompletedCaseV3(iUserId, kycPanData, { language: req.userLanguage, imageUrls: signedUrlForPanResponse, idfyPanData: getPanDataFromIdfy.idfyPanData, groupId: sGroupId, count: getPanDataFromIdfy.count })
          }
          return res.status(kycAadhaarValidationCompleted.status).jsonp({ status: kycAadhaarValidationCompleted.status, message: kycAadhaarValidationCompleted.message, data: kycAadhaarValidationCompleted.data })
        }
        default:
          return res.status(status.InternalServerError).jsonp({ status: jsonStatus.InternalServerError, message: messages[req.userLanguage].error })
      }
    } catch (error) {
      return catchError('UserAdminServices.panVerification', error, req, res)
    }
  }

  // new KYC PAN verification 2.1 flow end

  async kycAadhaarVerificationV3(req, res) {
    try {
      const sAadharBackImagePath = req.body.aadharBack
      const sAadharFrontImagePath = req.body.aadharFront
      const ePlatform = [PLATFORMS.ANDROID, PLATFORMS.iOS].includes(req.header('Platform')) ? req.header('Platform') : PLATFORMS.OTHERS
      if (!sAadharBackImagePath || !sAadharFrontImagePath) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_uploaded_anything })

      const iUserId = req.user ? ObjectId(req.user._id) : ObjectId(req.params.id)
      const userExistsKycData = await checkForpanDataExists(iUserId, req.userLanguage)
      if (!userExistsKycData?.oPan?.eStatus) return res.status(userExistsKycData.status).jsonp({ status: userExistsKycData.status, message: userExistsKycData.message })
      const [aadhaarBackImageUrl, aadhaarFrontImageUrl, panImageUrl] = await kycUrlGeneration({ sAadharBackImagePath, sAadharFrontImagePath, panImagePath: userExistsKycData.oPan.sImage })
      const imageUrls = { aadhaarBackImageUrl, aadhaarFrontImageUrl, panImageUrl }

      // TODO: We need to optimise the code from line 786-794 in future.
      // merge image path
      // const mergeImagePath = await kycProvider.joinImagesAndUpload(aadhaarFrontImageUrl, aadhaarBackImageUrl, iUserId)

      // const s3Params = {
      //   Bucket: config.S3_KYC_BUCKET_NAME,
      //   Expires: 300,
      //   Key: mergeImagePath
      // }
      // // merge image S3 url
      // const mergeImageUrl = await getSignedUrl(s3Params)

      const oKycAadhaarData = {
        sFrontImage: sAadharFrontImagePath,
        sBackImage: sAadharBackImagePath
      }
      let getAdharDataFromIdfy = {
        status: IDFY_STATUS.IDFY_STATUS_COMPLETE,
        count: userExistsKycData.count || {}
      }

      if (userExistsKycData?.oPan?.eStatus === KYC_STATUS.ACCEPTED) {
        // getAdharDataFromIdfy.count.addharDIVHit = 1
        getAdharDataFromIdfy = await getAadhaarIdfyDatav2({ aadhaarFrontImageUrl, aadhaarBackImageUrl, groupId: userExistsKycData.sIdfyGroupId, language: req.userLanguage, getAdharDataFromIdfy })

        if (!getAdharDataFromIdfy.isVerify) {
          await dbService.updateKycDataWithUpsert({ iUserId: userExistsKycData.iUserId }, { count: getAdharDataFromIdfy.count })

          return res.status(getAdharDataFromIdfy.status).jsonp({ status: getAdharDataFromIdfy.status, message: getAdharDataFromIdfy.message })
        }
      }

      switch (getAdharDataFromIdfy.status) {
        case IDFY_STATUS.IDFY_STATUS_FAILED: {
          const kycAadhaarValidationFailedCase = await aadhaarValidationFailedCase(iUserId, oKycAadhaarData, { language: req.userLanguage, imageUrls }, ePlatform)
          return res.status(kycAadhaarValidationFailedCase.status).jsonp({ status: kycAadhaarValidationFailedCase.status, message: kycAadhaarValidationFailedCase.message, data: kycAadhaarValidationFailedCase.data })
        }
        case IDFY_STATUS.IDFY_STATUS_COMPLETE: {
          let kycAadhaarValidationCompleted
          if (!checkForIdFyMandatoryAadhaarData(getAdharDataFromIdfy.idfyAadharData)) {
            kycAadhaarValidationCompleted = await aadhaarValidationPendingCase(iUserId, oKycAadhaarData, { language: req.userLanguage, imageUrls, idfyAadharData: getAdharDataFromIdfy.idfyAadharData, existingKycPanData: userExistsKycData.oPan, count: getAdharDataFromIdfy.count })
          } else {
            kycAadhaarValidationCompleted = await aadhaarValidationCompletedCase(iUserId, oKycAadhaarData, { language: req.userLanguage, imageUrls, idfyAadharData: getAdharDataFromIdfy.idfyAadharData, existingKycPanData: userExistsKycData.oPan, count: getAdharDataFromIdfy.count }, ePlatform)
          }
          return res.status(kycAadhaarValidationCompleted.status).jsonp({ status: kycAadhaarValidationCompleted.status, message: kycAadhaarValidationCompleted.message, data: kycAadhaarValidationCompleted.data })
        }
        default:
          return res.status(status.InternalServerError).jsonp({ status: jsonStatus.InternalServerError, message: messages[req.userLanguage].error })
      }
    } catch (error) {
      return catchError('UserAdminServices.aadhaarVerification', error, req, res)
    }
  }

  // for new Aadhaar-kyc flow 2.1
  async kycAadhaarVarificationV4 (req, res) {
    try {
      let sGroupId = uuid()
      const sAadharBackImagePath = req.body.aadharBack
      const sAadharFrontImagePath = req.body.aadharFront

      let getAadhaarDataFromIdfy = {
        status: 'completed',
        count: {}
      }
      const signedUrlForAadhaarResponse = {}

      const KycAadhaarData = {
        sFrontImage: sAadharFrontImagePath,
        sBackImage: sAadharBackImagePath
      }
      const ePlatform = ['A', 'I'].includes(req.header('Platform')) ? req.header('Platform') : 'O'

      if (!sAadharBackImagePath || !sAadharFrontImagePath) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_uploaded_anything })

      const iUserId = req.user ? ObjectId(req.user._id) : ObjectId(req.params.id)
      // check for existing user data
      const userExistsKycData = await checkForAadhaarDataExistsV2(iUserId, req.userLanguage)
      if (userExistsKycData) {
        if (userExistsKycData.oAadhaar && userExistsKycData.oAadhaar.eStatus === KYC_STATUS.ACCEPTED) {
          return res.status(jsonStatus.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].already_updated.replace('##', 'Aadhaar Info'), count: userExistsKycData.count })
        }
        getAadhaarDataFromIdfy.count = userExistsKycData && userExistsKycData.count ? userExistsKycData.count : {}
        if (userExistsKycData.sIdfyGroupId) {
          sGroupId = userExistsKycData.sIdfyGroupId
        }
      }

      // url generation
      const [aadhaarBackImageUrl, aadhaarFrontImageUrl] = await kycUrlGeneration({ sAadharBackImagePath, sAadharFrontImagePath })
      signedUrlForAadhaarResponse.aadhaarFrontImageUrl = aadhaarFrontImageUrl
      signedUrlForAadhaarResponse.aadhaarBackImageUrl = aadhaarBackImageUrl

      // const mergeImagePath = await kycProvider.joinImagesAndUpload(aadhaarFrontImageUrl, aadhaarBackImageUrl, iUserId)

      // const s3Params = {
      //   Bucket: config.S3_KYC_BUCKET_NAME,
      //   Expires: 300,
      //   Key: mergeImagePath
      // }
      // // merge image S3 url
      // const mergeImageUrl = await getSignedUrl(s3Params)

      // if (!getAadhaarDataFromIdfy.count.aadhaarDIVHit || getAadhaarDataFromIdfy.count.aadhaarDIVHit < 3) {
      // getAadhaarDataFromIdfy.count.aadhaarDIVHit = getAadhaarDataFromIdfy.count.aadhaarDIVHit ? getAadhaarDataFromIdfy.count.aadhaarDIVHit + 1 : 1

      getAadhaarDataFromIdfy = await getAadhaarIdfyDatav3({ aadhaarFrontImageUrl: signedUrlForAadhaarResponse.aadhaarFrontImageUrl, aadhaarBackImageUrl: signedUrlForAadhaarResponse.aadhaarBackImageUrl, groupId: sGroupId, language: req.userLanguage, getAadhaarDataFromIdfy })

      if (!getAadhaarDataFromIdfy.isVerify) {
        await dbService.updateKycDataWithUpsert({ iUserId: userExistsKycData.iUserId }, { count: getAadhaarDataFromIdfy.count })

        return res.status(getAadhaarDataFromIdfy.status).jsonp({ status: getAadhaarDataFromIdfy.status, message: getAadhaarDataFromIdfy.message, count: getAadhaarDataFromIdfy.count })
      }
      // }
      switch (getAadhaarDataFromIdfy.status) {
        case 'failed': {
          const kycAadhaarValidationFailedCase = await aadhaarValidationFailedCase(iUserId, KycAadhaarData, { language: req.userLanguage, imageUrls: signedUrlForAadhaarResponse, groupId: sGroupId, count: getAadhaarDataFromIdfy.count }, ePlatform)
          return res.status(kycAadhaarValidationFailedCase.status).jsonp({ status: kycAadhaarValidationFailedCase.status, message: kycAadhaarValidationFailedCase.message, data: kycAadhaarValidationFailedCase.data })
        }
        case 'completed': {
          let kycAadhaarValidationCompleted
          if (!checkForIdFyMandatoryAadhaarData(getAadhaarDataFromIdfy.idfyAadhaarData)) {
            kycAadhaarValidationCompleted = await aadhaarValidationPendingCaseV2(iUserId, KycAadhaarData, { language: req.userLanguage, imageUrls: signedUrlForAadhaarResponse, idfyAadhaarData: getAadhaarDataFromIdfy.idfyAadhaarData, groupId: sGroupId, count: getAadhaarDataFromIdfy.count })
          } else {
            kycAadhaarValidationCompleted = await aadhaarValidationCompletedCaseV2(iUserId, KycAadhaarData, { language: req.userLanguage, imageUrls: signedUrlForAadhaarResponse, idfyAadhaarData: getAadhaarDataFromIdfy.idfyAadhaarData, groupId: sGroupId, count: getAadhaarDataFromIdfy.count }, ePlatform)
          }
          return res.status(kycAadhaarValidationCompleted.status).jsonp({ status: kycAadhaarValidationCompleted.status, message: kycAadhaarValidationCompleted.message, data: kycAadhaarValidationCompleted.data })
        }
        default:
          return res.status(status.InternalServerError).jsonp({ status: jsonStatus.InternalServerError, message: messages[req.userLanguage].error })
      }
    } catch (error) {
      return catchError('UserAdminServices.aadhaarVerification', error, req, res)
    }
  }

  // new KYC PAN verification 2.1 flow
  async kycPanVerificationV4(req, res) {
    try {
      let sGroupId = uuid()
      const sImagePath = req.body.panCards3Url
      const ePlatform = ['A', 'I'].includes(req.header('Platform')) ? req.header('Platform') : 'O'
      if (!sImagePath) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_uploaded_anything })
      const iUserId = req.user ? ObjectId(req.user._id) : ObjectId(req.params.id)
      const userExistsKycData = await dbService.getExistingUserData(iUserId)
      const signedUrlForPanResponse = {}
      const s3ParamsforSignedUrl = {
        Bucket: config.S3_KYC_BUCKET_NAME, Key: sImagePath, Expires: 300
      }

      let getPanDataFromIdfy = {
        status: 'completed',
        count: {},
        idfyPanData: {}
      }
      if (!userExistsKycData || !userExistsKycData.oAadhaar || !userExistsKycData.oAadhaar.eStatus || userExistsKycData.oAadhaar.eStatus !== KYC_STATUS.ACCEPTED) {
        return res.status(jsonStatus.NotAcceptable).jsonp({ status: jsonStatus.NotAcceptable, message: messages[req.userLanguage].please_verify_Aadhaar_first, count: {} })
      }
      if (userExistsKycData) {
        if (userExistsKycData.oPan && userExistsKycData.oPan.eStatus === KYC_STATUS.ACCEPTED) {
          return res.status(jsonStatus.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].already_updated.replace('##', 'Pan Info'), count: userExistsKycData.count })
        }
        getPanDataFromIdfy.count = userExistsKycData && userExistsKycData.count ? userExistsKycData.count : {}

        if (userExistsKycData.sIdfyGroupId) {
          sGroupId = userExistsKycData.sIdfyGroupId
        }
        if (userExistsKycData.oAadhaar && userExistsKycData.oAadhaar.sFrontImage && userExistsKycData.oAadhaar.sBackImage) {
          const [aadhaarBackSignedUrl, aadhaarFrontSigned, panSignedUrl] = await kycUrlGeneration({ sAadharBackImagePath: userExistsKycData.oAadhaar.sBackImage, sAadharFrontImagePath: userExistsKycData.oAadhaar.sFrontImage, panImagePath: sImagePath })
          signedUrlForPanResponse.sFrontImage = aadhaarBackSignedUrl
          signedUrlForPanResponse.sBackImage = aadhaarFrontSigned
          signedUrlForPanResponse.panImageUrl = panSignedUrl
        } else {
          signedUrlForPanResponse.panImageUrl = await getSignedUrl(s3ParamsforSignedUrl)
        }
      }

      // if (!getPanDataFromIdfy.count.panDIVHit || getPanDataFromIdfy.count.panDIVHit < 3) {
      // getPanDataFromIdfy.count.panDIVHit = getPanDataFromIdfy.count.panDIVHit ? getPanDataFromIdfy.count.panDIVHit + 1 : 1
      getPanDataFromIdfy = await getPanIdfyDataV2({ panImageUrl: signedUrlForPanResponse.panImageUrl, groupId: sGroupId, language: req.userLanguage, getPanDataFromIdfy })

      if (!getPanDataFromIdfy.isVerify) {
        await dbService.updateKycDataWithUpsert({ iUserId: iUserId }, { count: getPanDataFromIdfy.count })
        return res.status(getPanDataFromIdfy.status).jsonp({ status: getPanDataFromIdfy.status, message: getPanDataFromIdfy.message, count: getPanDataFromIdfy.count })
      }
      // }

      const kycPanData = { sImage: sImagePath }
      switch (getPanDataFromIdfy.status) {
        case 'failed': {
          const kycPanValidationFailedCase = await panValidationFailedCase(iUserId, kycPanData, { language: req.userLanguage, imageUrls: signedUrlForPanResponse, groupId: sGroupId, count: getPanDataFromIdfy.count }, ePlatform)
          return res.status(kycPanValidationFailedCase.status).jsonp({ status: kycPanValidationFailedCase.status, message: kycPanValidationFailedCase.message, data: kycPanValidationFailedCase.data, count: getPanDataFromIdfy.count })
        }
        case 'completed': {
          let kycAadhaarValidationCompleted
          if (!checkForIdFyMandatoryPanData(getPanDataFromIdfy.idfyPanData)) {
            kycAadhaarValidationCompleted = await panValidationPendingStateCaseV2(iUserId, kycPanData, { existingAadhaarData: userExistsKycData?.oAadhaar, language: req.userLanguage, imageUrls: signedUrlForPanResponse, idfyPanData: getPanDataFromIdfy.idfyPanData, groupId: sGroupId, count: getPanDataFromIdfy.count })
          } else {
            console.log(req.userLanguage)
            kycAadhaarValidationCompleted = await panValidationCompletedCaseV4(iUserId, kycPanData, { existingAadhaarData: userExistsKycData?.oAadhaar, language: req.userLanguage, imageUrls: signedUrlForPanResponse, idfyPanData: getPanDataFromIdfy.idfyPanData, groupId: sGroupId, count: getPanDataFromIdfy.count })
          }
          return res.status(kycAadhaarValidationCompleted.status).jsonp({ status: kycAadhaarValidationCompleted.status, message: kycAadhaarValidationCompleted.message, data: kycAadhaarValidationCompleted.data })
        }
        default:
          return res.status(status.InternalServerError).jsonp({ status: jsonStatus.InternalServerError, message: messages[req.userLanguage].error })
      }
    } catch (error) {
      return catchError('UserAdminServices.panVerification', error, req, res)
    }
  }

  // * <------------------------User-KYC-service MS functions starts here----------------->
  // Aadhaar re-Routing
  async kycAadhaarVarificationV5 (req, res) {
    try {
      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.USER_KYC_SERVICE_BASE_URL}/kyc/aadhaar-lite/v1`)
      const response = await axios.post(`${config.USER_KYC_SERVICE_BASE_URL}/kyc/aadhaar-lite/v1`, {
        userId: req.user._id,
        aadhaarFront: req.body.aadhaarFront,
        aadhaarBack: req.body.aadhaarBack,
        aadhaarNumber: req.body.aadhaarNumber
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      handleCatchError('UserAdminServices.aadhaarVerification', err, req, res)
      console.log(err)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  // Pan re-Routing
  async kycPanVarificationV5 (req, res) {
    try {
      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.USER_KYC_SERVICE_BASE_URL}/kyc/pan-plus/v1`)
      const response = await axios.post(`${config.USER_KYC_SERVICE_BASE_URL}/kyc/pan-plus/v1`, {
        userId: req.user._id,
        panImage: req.body.panImage,
        panNumber: req.body.panNumber
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      handleCatchError('UserAdminServices.PanVerification', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  // Bank re-Routing
  async kycBankVarification (req, res) {
    try {
      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.USER_KYC_SERVICE_BASE_URL}/kyc/bank-varify/v1`)
      const response = await axios.post(`${config.USER_KYC_SERVICE_BASE_URL}/kyc/bank-varify/v1`, {
        userId: req.user._id,
        bankAccountNumber: req.body.bankAccountNumber,
        bankIfscCode: req.body.bankIfscCode,
        bankDoc: req.body.bankDoc
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      handleCatchError('UserAdminServices.BankVerification', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  // get KYC-Details [admin]
  async kycDetails (req, res) {
    try {
      const userId = req.user ? req.user._id : req.params.id
      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.USER_KYC_SERVICE_BASE_URL}/kyc/info/${userId}/v1`)
      const response = await axios.get(`${config.USER_KYC_SERVICE_BASE_URL}/kyc/info/${userId}/v1`, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      console.log(err)
      handleCatchError('UserAdminServices.kycDetails', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  // update KYC-Details [admin]
  async updateKycDetails (req, res) {
    try {
      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.USER_KYC_SERVICE_BASE_URL}/admin/kyc/update/v1`)
      const response = await axios.post(`${config.USER_KYC_SERVICE_BASE_URL}/admin/kyc/update/v1`, {
        eType: req.body.eType,
        userId: req.params.id,
        iAdminId: req.admin._id,
        ...req.body
      }, {
        headers: { 'Content-Type': 'application/json', Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      console.log(err)
      handleCatchError('UserAdminServices.updateKycDetails', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  // search KYC-Details [admin]
  async searchKycDetails (req, res) {
    try {
      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.USER_KYC_SERVICE_BASE_URL}/admin/kyc/search/v1`)
      const response = await axios.get(`${config.USER_KYC_SERVICE_BASE_URL}/admin/kyc/search/v1`, {
        params: {
          eType: req.body.eType,
          adminFlag: req.user ? '' : 'admin',
          iAdminId: req.admin._id,
          ...req.query
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      console.log(err)
      handleCatchError('UserAdminServices.searchKycDetails', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  // count KYC-Details [admin]
  async countKycDetails (req, res) {
    try {
      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.USER_KYC_SERVICE_BASE_URL}/admin/kyc/search/v1 ---> count`)
      const response = await axios.get(`${config.USER_KYC_SERVICE_BASE_URL}/admin/kyc/search/v1`, {
        params: {
          panFilter: req.query.ePanStatus,
          aadhaarFilter: req.query.eAadharStatus,
          bankFilter: req.query.eBankStatus,
          isCount: true,
          eType: req.body.eType,
          adminFlag: req.user ? '' : 'admin',
          iAdminId: req.admin._id,
          ...req.query
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      console.log(err)
      handleCatchError('UserAdminServices.countKycDetails', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }
  // * <------------------------User-KYC-service MS functions Ends here----------------->
}

async function validateKyc(oBody, userLanguage, iUserId, iAdminId = '', ip = '', flag = '') {
  const { eType } = oBody
  const errResponse = { isSuccess: false, status: status.BadRequest, jsonStatus: jsonStatus.BadRequest }

  if (![KYC_DOC_TYPE.PAN, KYC_DOC_TYPE.AADHAAR].includes(eType)) {
    errResponse.message = messages[userLanguage].went_wrong_with.replace('##', messages[userLanguage].stype)
    return errResponse
  }

  let data
  if (eType === KYC_DOC_TYPE.AADHAAR) {
    const { sFrontImage, sBackImage, nNo } = oBody

    if (!sFrontImage || !sBackImage) {
      errResponse.message = messages[userLanguage].required.replace('##', messages[userLanguage].bothImages)
      return errResponse
    }

    const numberExist = await KycModel.findOne({ 'oAadhaar.nNo': nNo, iUserId: { $ne: ObjectId(iUserId) }, 'oAadhaar.eStatus': { $ne: KYC_STATUS.REJECTED } }).lean()
    if (numberExist) {
      errResponse.message = messages[userLanguage].already_exist.replace('##', messages[userLanguage].aadharNum)
      errResponse.jsonStatus = jsonStatus.ResourceExist
      errResponse.status = status.ResourceExist
      return errResponse
    }

    if (flag === 'admin') {
      data = {
        iUserId,
        'oAadhaar.sFrontImage': sFrontImage,
        'oAadhaar.sBackImage': sBackImage,
        'oAadhaar.eStatus': KYC_STATUS.ACCEPTED,
        'oAadhaar.nNo': nNo,
        'oAadhaar.sAadharHashedNumber': securityProvider.hashStrWithCrypto(nNo),
        'oAadhaar.dCreatedAt': new Date(),
        'oAadhaar.dUpdatedAt': new Date(),
        'oAadhaar.oVerifiedAt.dActionedAt': Date.now(),
        'oAadhaar.oVerifiedAt.sIP': ip,
        'oAadhaar.oVerifiedAt.iAdminId': iAdminId,
        'oAadhaar.sRejectReason': undefined,
        'oAadhaar.eVerifiedBy': KYC_VERIFIED_TYPE.MANUAL
      }
    } else {
      data = {
        iUserId,
        'oAadhaar.sFrontImage': sFrontImage,
        'oAadhaar.sBackImage': sBackImage,
        'oAadhaar.eStatus': KYC_STATUS.PENDING,
        'oAadhaar.nNo': nNo,
        'oAadhaar.sAadharHashedNumber': securityProvider.hashStrWithCrypto(nNo),
        'oAadhaar.dCreatedAt': new Date(),
        'oAadhaar.dUpdatedAt': new Date(),
        'oAadhaar.eVerifiedBy': KYC_VERIFIED_TYPE.MANUAL
      }
    }
  } else if (eType === KYC_DOC_TYPE.PAN) {
    const { sImage, sNo, sName } = oBody

    if (!sImage) {
      errResponse.message = messages[userLanguage].required.replace('##', messages[userLanguage].image)
      return errResponse
    }
    if (!sName) {
      errResponse.message = messages[userLanguage].required.replace('##', messages[userLanguage].cName)
      return errResponse
    }

    const panNo = await KycModel.findOne({ 'oPan.sNo': sNo, iUserId: { $ne: ObjectId(iUserId) }, 'oPan.eStatus': { $ne: KYC_STATUS.REJECTED } }).lean()
    if (panNo) {
      errResponse.message = messages[userLanguage].already_exist.replace('##', messages[userLanguage].panNum)
      errResponse.jsonStatus = jsonStatus.ResourceExist
      errResponse.status = status.ResourceExist
      return errResponse
    }

    if (flag === 'admin') {
      data = {
        iUserId,
        'oPan.sImage': sImage,
        'oPan.eStatus': KYC_STATUS.ACCEPTED,
        'oPan.sNo': sNo,
        'oPan.dCreatedAt': new Date(),
        'oPan.dUpdatedAt': new Date(),
        'oPan.oVerifiedAt.dActionedAt': Date.now(),
        'oPan.oVerifiedAt.sIP': ip,
        'oPan.oVerifiedAt.iAdminId': iAdminId,
        'oPan.sRejectReason': undefined,
        'oPan.sName': sName,
        'oPan.eVerifiedBy': KYC_VERIFIED_TYPE.MANUAL
      }
    } else {
      data = {
        iUserId,
        'oPan.sImage': sImage,
        'oPan.eStatus': KYC_STATUS.PENDING,
        'oPan.sNo': sNo,
        'oPan.dCreatedAt': new Date(),
        'oPan.dUpdatedAt': new Date(),
        'oPan.sName': sName,
        'oPan.eVerifiedBy': KYC_VERIFIED_TYPE.MANUAL
      }
    }
  }
  return data
}

async function validateKycV2(oBody, userLanguage, iUserId, iAdminId = '', ip = '', flag = '') {
  const { eType } = oBody
  const errResponse = { isSuccess: false, status: status.BadRequest, jsonStatus: jsonStatus.BadRequest }

  if (!['PAN', 'AADHAAR'].includes(eType)) {
    errResponse.message = messages[userLanguage].went_wrong_with.replace('##', messages[userLanguage].stype)
    return errResponse
  }

  let data
  if (eType === 'AADHAAR') {
    const { sFrontImage, sBackImage, nNo } = oBody

    if (!sFrontImage || !sBackImage) {
      errResponse.message = messages[userLanguage].required.replace('##', messages[userLanguage].bothImages)
      return errResponse
    }

    const numberExist = await KycModel.findOne({ 'oAadhaar.nNo': nNo, iUserId: { $ne: ObjectId(iUserId) }, 'oAadhaar.eStatus': { $ne: 'R' } }).lean()
    if (numberExist) {
      errResponse.message = messages[userLanguage].already_exist.replace('##', messages[userLanguage].aadharNum)
      errResponse.jsonStatus = jsonStatus.ResourceExist
      errResponse.status = status.ResourceExist
      return errResponse
    }

    if (flag === 'admin') {
      data = {
        iUserId,
        'oAadhaar.sFrontImage': sFrontImage,
        'oAadhaar.sBackImage': sBackImage,
        'oAadhaar.eStatus': 'A',
        'oAadhaar.dCreatedAt': new Date(),
        'oAadhaar.dUpdatedAt': new Date(),
        'oAadhaar.oVerifiedAt.dActionedAt': Date.now(),
        'oAadhaar.oVerifiedAt.sIP': ip,
        'oAadhaar.oVerifiedAt.iAdminId': iAdminId,
        'oAadhaar.sRejectReason': undefined,
        'oAadhaar.eVerifiedBy': KYC_VERIFIED_TYPE.MANUAL
      }
    } else {
      data = {
        iUserId,
        'oAadhaar.sFrontImage': sFrontImage,
        'oAadhaar.sBackImage': sBackImage,
        'oAadhaar.eStatus': 'P',
        'oAadhaar.dCreatedAt': new Date(),
        'oAadhaar.dUpdatedAt': new Date(),
        'oAadhaar.eVerifiedBy': KYC_VERIFIED_TYPE.MANUAL
      }
    }
  } else if (eType === 'PAN') {
    const { sImage } = oBody

    if (!sImage) {
      errResponse.message = messages[userLanguage].required.replace('##', messages[userLanguage].image)
      return errResponse
    }
    if (flag === 'admin') {
      data = {
        iUserId,
        'oPan.sImage': sImage,
        'oPan.eStatus': 'A',
        'oPan.dCreatedAt': new Date(),
        'oPan.dUpdatedAt': new Date(),
        'oPan.oVerifiedAt.dActionedAt': Date.now(),
        'oPan.oVerifiedAt.sIP': ip,
        'oPan.oVerifiedAt.iAdminId': iAdminId,
        'oPan.sRejectReason': undefined,
        'oPan.eVerifiedBy': KYC_VERIFIED_TYPE.MANUAL
      }
    } else {
      data = {
        iUserId,
        'oPan.sImage': sImage,
        'oPan.eStatus': 'P',
        'oPan.dCreatedAt': new Date(),
        'oPan.dUpdatedAt': new Date(),
        'oPan.eVerifiedBy': KYC_VERIFIED_TYPE.MANUAL
      }
    }
  }
  return data
}

async function validateKycV3(oBody, userLanguage, iUserId, iAdminId = '', ip = '', flag = '') {
  const { eType, oUserKyc } = oBody
  const errResponse = { isSuccess: false, status: status.BadRequest, jsonStatus: jsonStatus.BadRequest }

  if (!['PAN', 'AADHAAR'].includes(eType)) {
    errResponse.message = messages[userLanguage].went_wrong_with.replace('##', messages[userLanguage].stype)
    return errResponse
  }

  let data
  if (eType === 'AADHAAR') {
    const { sFrontImage, sBackImage, nNo, sDateOfBirth, sState, sAadharName } = oBody
    if (!(oUserKyc.oAadhaar.sFrontImage || oUserKyc.oAadhaar.sFrontImage) && !(sFrontImage || sBackImage)) {
      errResponse.message = messages[userLanguage].required.replace('##', messages[userLanguage].bothImages)
      return errResponse
    }
    // if (!sAadharName) {
    //   errResponse.message = messages[userLanguage].required.replace('##', messages[userLanguage].cName)
    //   return errResponse
    // }
    if (nNo) {
      const hasNumber = securityProvider.hashStrWithCrypto(`${nNo}`)
      const numberExist = await KycModel.findOne({ 'oAadhaar.sAadharHashedNumber': hasNumber, iUserId: { $ne: ObjectId(iUserId) }, 'oAadhaar.eStatus': { $ne: 'R' } }).lean()
      if (numberExist) {
        errResponse.message = messages[userLanguage].already_exist.replace('##', messages[userLanguage].aadharNum)
        errResponse.jsonStatus = jsonStatus.ResourceExist
        errResponse.status = status.ResourceExist
        return errResponse
      }
    }
    if (flag === 'admin') {
      data = {
        iUserId,
        'oAadhaar.sFrontImage': sFrontImage,
        'oAadhaar.sBackImage': sBackImage,
        'oAadhaar.eStatus': 'A',
        'oAadhaar.dCreatedAt': new Date(),
        'oAadhaar.dUpdatedAt': new Date(),
        'oAadhaar.oVerifiedAt.dActionedAt': Date.now(),
        'oAadhaar.oVerifiedAt.sIP': ip,
        'oAadhaar.oVerifiedAt.iAdminId': iAdminId,
        'oAadhaar.sRejectReason': undefined,
        'oAadhaar.eVerifiedBy': KYC_VERIFIED_TYPE.MANUAL
      }
    } else {
      data = {
        iUserId,
        'oAadhaar.sFrontImage': sFrontImage,
        'oAadhaar.sBackImage': sBackImage,
        'oAadhaar.eStatus': 'P',
        'oAadhaar.sAadharName': sAadharName || '',
        'oAadhaar.dCreatedAt': new Date(),
        'oAadhaar.dUpdatedAt': new Date(),
        'oAadhaar.eVerifiedBy': KYC_VERIFIED_TYPE.MANUAL
      }
    }
    if (nNo) {
      data['oAadhaar.sAadharHashedNumber'] = securityProvider.hashStrWithCrypto(`${nNo}`)
    }
    if (sAadharName) {
      data['oAadhaar.sAadharName'] = sAadharName
    }
    if (sDateOfBirth) {
      data['oAadhaar.sDateOfBirth'] = sDateOfBirth
    }
    if (sState) {
      data['oAadhaar.sState'] = sState
    }
  } else if (eType === 'PAN') {
    const { sImage, sNo, sName, sDateOfBirth } = oBody
    if (!(oUserKyc.oPan.sImage) && !(sImage)) {
      errResponse.message = messages[userLanguage].required.replace('##', messages[userLanguage].image)
      return errResponse
    }
    let panNo
    if (sNo) panNo = await KycModel.findOne({ 'oPan.sNo': sNo, iUserId: { $ne: ObjectId(iUserId) }, 'oPan.eStatus': { $ne: 'R' } }).lean()
    if (panNo) {
      errResponse.message = messages[userLanguage].already_exist.replace('##', messages[userLanguage].panNum)
      errResponse.jsonStatus = jsonStatus.ResourceExist
      errResponse.status = status.ResourceExist
      return errResponse
    }
    if (flag === 'admin') {
      data = {
        iUserId,
        'oPan.sImage': sImage,
        'oPan.eStatus': 'A',
        'oPan.dCreatedAt': new Date(),
        'oPan.dUpdatedAt': new Date(),
        'oPan.oVerifiedAt.dActionedAt': Date.now(),
        'oPan.oVerifiedAt.sIP': ip,
        'oPan.oVerifiedAt.iAdminId': iAdminId,
        'oPan.sRejectReason': undefined,
        'oPan.eVerifiedBy': KYC_VERIFIED_TYPE.MANUAL
      }
    } else {
      data = {
        iUserId,
        'oPan.sImage': sImage,
        'oPan.eStatus': 'P',
        'oPan.dCreatedAt': new Date(),
        'oPan.dUpdatedAt': new Date(),
        'oPan.eVerifiedBy': KYC_VERIFIED_TYPE.MANUAL,
        'oPan.sDateOfBirth': sDateOfBirth
      }
    }
    if (sNo) {
      data['oPan.sNo'] = sNo
    }
    if (sName) {
      data['oPan.sName'] = sName
    }
    if (sDateOfBirth) {
      data['oPan.sDateOfBirth'] = sDateOfBirth
    }
  }
  return data
}

async function getUrl(path) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        AWS.config.update({ accessKeyId: config.AWS_KYC_ACCESS_KEY, secretAccessKey: config.AWS_KYC_SECRET_KEY, signatureVersion: 'v4', region: 'ap-south-1' })
        s3 = new AWS.S3()

        const params = {
          Bucket: config.S3_KYC_BUCKET_NAME,
          Key: path,
          Expires: 300
        }
        try {
          const url = await getSignedUrl(params)
          return resolve(url)
        } catch (error) {
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })()
  })
}

async function aadhaarValidationFailedCase(userId, kycAadhaarData, { language, imageUrls, groupId, count }, ePlatform) {
  kycAadhaarData.eStatus = KYC_STATUS.REJECTED
  kycAadhaarData.sRejectReason = KYC_VERIFY_MESSAGE.IMAGE_NOT_CLEAR
  kycAadhaarData.eVerifiedBy = KYC_VERIFIED_TYPE.IDFY
  kycAadhaarData.dCreatedAt = Date.now()
  kycAadhaarData.dUpdatedAt = Date.now()

  const updatedKycdata = await dbService.updateKycData({ iUserId: userId }, { oAadhaar: kycAadhaarData, sIdfyGroupId: groupId, sMessage: KYC_USER_MESSAGE.UPLOADED_AADHAR_NOT_VERIFIED, count })
  await queuePush('pushNotification:KYC', { iUserId: userId, eStatus: KYC_STATUS.REJECTED, sPushType: 'KYC', ePlatform })

  // assign url for response
  updatedKycdata.oPan.sImage = imageUrls.panImageUrl
  updatedKycdata.oAadhaar.sFrontImage = imageUrls.aadhaarFrontImageUrl
  updatedKycdata.oAadhaar.sBackImage = imageUrls.aadhaarBackImageUrl
  return { status: jsonStatus.BadRequest, message: messages[language].image_not_clear, data: updatedKycdata }
}

async function checkForExistingAadhaarData(userId, aadhaarId, language) {
  const hashedAadharNumber = securityProvider.hashStrWithCrypto(aadhaarId)
  const existingAadhaarData = await dbService.kycAadhaarDedupeCheck(hashedAadharNumber)
  if (!existingAadhaarData || (existingAadhaarData && existingAadhaarData.iUserId.toString() === userId.toString())) return { isDedupe: false, hashedAadharNumber }
  return { isDedupe: true, status: jsonStatus.ResourceExist, message: messages[language].aadhar_info_already_used }
}

async function aadhaarValidationPendingCase(userId, kycAadhaarData, { language, imageUrls, idfyAadharData, existingKycPanData, count }) {
  let kycVerificationCheck = {}
  if (idfyAadharData) {
    const aadhaarNumberStringify = idfyAadharData?.id_number && idfyAadharData.id_number.toString()
    if (aadhaarNumberStringify) {
      const deDupe = await checkForExistingAadhaarData(userId, aadhaarNumberStringify, language)
      if (deDupe.isDedupe) {
        kycAadhaarData.eStatus = KYC_STATUS.REJECTED
        kycAadhaarData.sRejectReason = KYC_VERIFY_MESSAGE.INFO_ALREADY_USED
        kycVerificationCheck.responseMessage = KYC_VERIFY_MESSAGE.INFO_ALREADY_USED
        kycVerificationCheck.message = KYC_VERIFY_MESSAGE.INFO_ALREADY_USED
      }
      kycAadhaarData.sAadharHashedNumber = deDupe.hashedAadharNumber
    }
    kycAadhaarData.sAadharName = idfyAadharData?.name_on_card
    kycAadhaarData.sDateOfBirth = idfyAadharData?.date_of_birth
    kycAadhaarData.sState = idfyAadharData?.state
    kycAadhaarData.sPincode = idfyAadharData?.pincode
    kycAadhaarData.dCreatedAt = Date.now()
    kycAadhaarData.dUpdatedAt = Date.now()
    if (!kycAadhaarData?.eStatus && kycAadhaarData.sState) kycVerificationCheck = aadhaarLocationCheck(kycAadhaarData, { existingKycPanData, language })

    if (!kycVerificationCheck?.oAadhaar?.eStatus && kycAadhaarData.sDateOfBirth) kycVerificationCheck = aadhaarPanDateCheck(kycAadhaarData, { existingKycPanData, language })

    if (!kycVerificationCheck?.oAadhaar?.eStatus && kycAadhaarData.sAadharName) kycVerificationCheck = aadhaarPanNameCheck(kycAadhaarData, { existingKycPanData, language })
  }
  if (!kycVerificationCheck?.oAadhaar?.eStatus && !kycAadhaarData?.eStatus) {
    kycAadhaarData.eStatus = KYC_STATUS.PENDING
    kycVerificationCheck = { oAadhaar: kycAadhaarData, message: messages[language].update_success.replace('##', 'Aadhar Card status') }
  }
  kycAadhaarData.eVerifiedBy = KYC_VERIFIED_TYPE.IDFY
  if (!kycVerificationCheck.oAadhaar) kycVerificationCheck.oAadhaar = kycAadhaarData
  const kycVerificationCompleted = await dbService.updateKycDataWithUpsert({ iUserId: userId }, { oAadhaar: kycVerificationCheck.oAadhaar, sMessage: kycVerificationCheck.message, count })
  // assign url for response
  kycVerificationCompleted.oPan.sImage = imageUrls.panImageUrl
  kycVerificationCompleted.oAadhaar.sFrontImage = imageUrls.aadhaarFrontImageUrl
  kycVerificationCompleted.oAadhaar.sBackImage = imageUrls.aadhaarBackImageUrl
  return { status: jsonStatus.OK, message: kycVerificationCheck.responseMessage, data: kycVerificationCompleted }
}

// for new Aadhaar-kyc flow 2.1
async function aadhaarValidationPendingCaseV2(userId, kycAadhaarData, { language, imageUrls, idfyAadhaarData, groupId, count }) {
  let kycVerificationCheck = {}
  if (idfyAadhaarData) {
    const aadhaarNumberStringify = idfyAadhaarData?.id_number && idfyAadhaarData.id_number.toString()
    if (aadhaarNumberStringify) {
      const deDupe = await checkForExistingAadhaarData(userId, aadhaarNumberStringify, language)
      if (deDupe.isDedupe) {
        kycAadhaarData.eStatus = KYC_STATUS.REJECTED
        kycAadhaarData.sRejectReason = KYC_VERIFY_MESSAGE.INFO_ALREADY_USED
        kycVerificationCheck.responseMessage = KYC_VERIFY_MESSAGE.INFO_ALREADY_USED
        kycVerificationCheck.message = KYC_VERIFY_MESSAGE.INFO_ALREADY_USED
      }
      kycAadhaarData.sAadharHashedNumber = deDupe.hashedAadharNumber
    }
    if (!kycAadhaarData?.eStatus && idfyAadhaarData?.age) aadhaarAgeValidationCheck(kycAadhaarData, idfyAadhaarData)

    kycAadhaarData.sName = idfyAadhaarData?.name_on_card
    kycAadhaarData.sDateOfBirth = idfyAadhaarData?.date_of_birth
    kycAadhaarData.sAadharName = idfyAadhaarData?.name_on_card
    kycAadhaarData.sDateOfBirth = idfyAadhaarData?.date_of_birth
    kycAadhaarData.sState = idfyAadhaarData?.state
    kycAadhaarData.sPincode = idfyAadhaarData?.pincode
    kycAadhaarData.dCreatedAt = Date.now()
    kycAadhaarData.dUpdatedAt = Date.now()

    if (!kycAadhaarData?.eStatus && kycAadhaarData.sState) kycVerificationCheck = aadhaarLocationCheck(kycAadhaarData, { language })
  }
  if (!kycAadhaarData?.eStatus) {
    kycAadhaarData.eStatus = KYC_STATUS.PENDING
    kycVerificationCheck = { oAadhaar: kycAadhaarData, message: messages[language].update_success.replace('##', 'Aadhar Card status') }
  }
  if (!kycVerificationCheck.oAadhaar) kycVerificationCheck.oAadhaar = kycAadhaarData
  kycAadhaarData.eVerifiedBy = KYC_VERIFIED_TYPE.IDFY
  const kycVerificationCompleted = await dbService.updateKycDataWithUpsert({ iUserId: userId }, { oAadhaar: kycVerificationCheck.oAadhaar, sIdfyGroupId: groupId, sMessage: kycVerificationCheck.message, count })
  // assign url for response
  kycVerificationCompleted.oAadhaar.sFrontImage = imageUrls.aadhaarFrontImageUrl
  kycVerificationCompleted.oAadhaar.sBackImage = imageUrls.aadhaarBackImageUrl
  return { status: jsonStatus.OK, message: kycVerificationCheck.responseMessage, data: kycVerificationCompleted, count }
}

async function aadhaarValidationCompletedCase(userId, kycAadhaarData, { language, imageUrls, idfyAadharData, existingKycPanData, count }, ePlatform) {
  let kycVerificationCheck = {}
  let consolidated = false
  const deDupe = await checkForExistingAadhaarData(userId, idfyAadharData.id_number.toString(), language)
  if (deDupe.isDedupe) {
    kycAadhaarData.eStatus = KYC_STATUS.REJECTED
    kycAadhaarData.sRejectReason = KYC_VERIFY_MESSAGE.INFO_ALREADY_USED
    kycVerificationCheck.responseMessage = KYC_VERIFY_MESSAGE.INFO_ALREADY_USED
    kycVerificationCheck.message = KYC_VERIFY_MESSAGE.INFO_ALREADY_USED
  }
  kycAadhaarData.eVerifiedBy = KYC_VERIFIED_TYPE.IDFY
  kycAadhaarData.sAadharName = idfyAadharData.name_on_card
  kycAadhaarData.sDateOfBirth = idfyAadharData.date_of_birth.toString()
  kycAadhaarData.sAadharHashedNumber = deDupe.hashedAadharNumber
  kycAadhaarData.sState = idfyAadharData.state
  kycAadhaarData.sPincode = idfyAadharData.pincode
  kycAadhaarData.dCreatedAt = Date.now()
  kycAadhaarData.dUpdatedAt = Date.now()

  if (!kycAadhaarData.eStatus) kycVerificationCheck = aadhaarLocationCheck(kycAadhaarData, { existingKycPanData, language })

  if (!kycVerificationCheck?.oAadhaar?.eStatus) kycVerificationCheck = aadhaarPanDateCheck(kycAadhaarData, { existingKycPanData, language })

  if (!kycVerificationCheck?.oAadhaar?.eStatus) kycVerificationCheck = aadhaarPanNameCheck(kycAadhaarData, { existingKycPanData, language })

  if (!kycVerificationCheck?.oAadhaar?.eStatus && !kycAadhaarData.eStatus) {
    kycAadhaarData.eStatus = KYC_STATUS.ACCEPTED
    consolidated = true
    kycVerificationCheck = { oAadhaar: kycAadhaarData, message: messages[language].update_success.replace('##', 'Aadhar Card status') }
  }
  if (!kycVerificationCheck.oAadhaar) kycVerificationCheck.oAadhaar = kycAadhaarData
  const kycVerificationCompleted = await dbService.updateKycData({ iUserId: userId }, { oAadhaar: kycVerificationCheck.oAadhaar, sMessage: kycVerificationCheck.message, count, consolidated })

  if (kycVerificationCompleted?.oPan?.eStatus === 'A' && kycVerificationCompleted?.oAadhaar?.eStatus === 'A') {
    await Promise.all([
      queuePush('pushNotification:KYC', { iUserId: kycVerificationCompleted.iUserId, eStatus: 'A', sPushType: 'KYC', ePlatform }),
      UserModel.findByIdAndUpdate(userId, { bIsKycApproved: true }, { new: true, runValidators: true }).lean()
    ])
  }
  // assign url for response
  kycVerificationCompleted.oPan.sImage = imageUrls.panImageUrl
  kycVerificationCompleted.oAadhaar.sFrontImage = imageUrls.aadhaarFrontImageUrl
  kycVerificationCompleted.oAadhaar.sBackImage = imageUrls.aadhaarBackImageUrl
  return { status: jsonStatus.OK, message: kycVerificationCheck.responseMessage, data: kycVerificationCompleted, count }
}

// for new Aadhaar-kyc flow 2.1
async function aadhaarValidationCompletedCaseV2(userId, kycAadhaarData, { language, imageUrls, idfyAadhaarData, groupId, count }, ePlatform) {
  let kycVerificationCheck = {}
  if (idfyAadhaarData) {
    const aadhaarNumberStringify = idfyAadhaarData?.id_number && idfyAadhaarData.id_number.toString()
    if (aadhaarNumberStringify) {
      const deDupe = await checkForExistingAadhaarData(userId, aadhaarNumberStringify, language)
      if (deDupe.isDedupe) {
        kycAadhaarData.eStatus = KYC_STATUS.REJECTED
        kycAadhaarData.sRejectReason = KYC_VERIFY_MESSAGE.INFO_ALREADY_USED
        kycVerificationCheck.responseMessage = KYC_VERIFY_MESSAGE.INFO_ALREADY_USED
        kycVerificationCheck.message = KYC_VERIFY_MESSAGE.INFO_ALREADY_USED
      }

      kycAadhaarData.sAadharHashedNumber = deDupe.hashedAadharNumber
    }
    if (!kycAadhaarData?.eStatus && idfyAadhaarData?.date_of_birth) aadhaarAgeValidationCheck(kycAadhaarData, idfyAadhaarData)

    kycAadhaarData.sName = idfyAadhaarData?.name_on_card
    kycAadhaarData.sDateOfBirth = idfyAadhaarData?.date_of_birth
    kycAadhaarData.eVerifiedBy = KYC_VERIFIED_TYPE.IDFY
    kycAadhaarData.sAadharName = idfyAadhaarData.name_on_card
    kycAadhaarData.sDateOfBirth = idfyAadhaarData.date_of_birth.toString()
    kycAadhaarData.sState = idfyAadhaarData.state
    kycAadhaarData.sPincode = idfyAadhaarData.pincode
    kycAadhaarData.dCreatedAt = Date.now()
    kycAadhaarData.dUpdatedAt = Date.now()

    if (!kycAadhaarData?.eStatus) kycVerificationCheck = aadhaarLocationCheck(kycAadhaarData, { language })
  }
  if (!kycVerificationCheck?.oAadhaar?.eStatus && !kycAadhaarData?.eStatus) {
    kycAadhaarData.eStatus = KYC_STATUS.ACCEPTED
    kycVerificationCheck = { oAadhaar: kycAadhaarData, message: messages[language].update_success.replace('##', 'Aadhar Card status') }
  }
  if (!kycVerificationCheck.oAadhaar) kycVerificationCheck.oAadhaar = kycAadhaarData
  const kycVerificationCompleted = await dbService.updateKycDataWithUpsert({ iUserId: userId }, { oAadhaar: kycVerificationCheck.oAadhaar, sIdfyGroupId: groupId, sMessage: kycVerificationCheck.message, count })

  if (kycVerificationCompleted?.oPan?.eStatus === 'A' && kycVerificationCompleted?.oAadhaar?.eStatus === 'A') await queuePush('pushNotification:KYC', { iUserId: kycVerificationCompleted.iUserId, eStatus: 'A', sPushType: 'KYC', ePlatform })

  // assign url for response
  kycVerificationCompleted.oAadhaar.sFrontImage = imageUrls.aadhaarFrontImageUrl
  kycVerificationCompleted.oAadhaar.sBackImage = imageUrls.aadhaarBackImageUrl

  return { status: jsonStatus.OK, message: kycVerificationCheck.responseMessage, data: kycVerificationCompleted, count }
}

async function checkForExistingPanData(userId, panId, language) {
  const existingPanData = await dbService.kycPanDedupeCheck(panId)
  if (!existingPanData || (existingPanData && existingPanData.iUserId.toString() === userId.toString())) return { isDedupe: false, panId }
  return { isDedupe: true, status: jsonStatus.ResourceExist, message: messages[language].pan_already_used }
}

function panAgeValidationCheck(kycPanData, idfyPanData) {
  if (!kycProvider.isAgeValid(idfyPanData?.age)) {
    kycPanData.eStatus = KYC_STATUS.REJECTED
    kycPanData.sRejectReason = KYC_VERIFY_MESSAGE.BELOW_EIGHTEEN
  }
}
// for new Aadhaar-kyc flow 2.1
function aadhaarAgeValidationCheck(kycAadhaarData, idfyAadhaarData) {
  if (!kycProvider.aadhaarAgeValidator(idfyAadhaarData?.date_of_birth)) {
    kycAadhaarData.eStatus = KYC_STATUS.REJECTED
    kycAadhaarData.sRejectReason = KYC_VERIFY_MESSAGE.BELOW_EIGHTEEN
  }
}

async function panValidationPendingStateCase(userId, kycPanData, { language, imageUrls, idfyPanData, groupId, count }) {
  if (idfyPanData) {
    const panNumberStringify = idfyPanData?.id_number && idfyPanData.id_number.toString()
    if (panNumberStringify) {
      const deDupe = await checkForExistingPanData(userId, panNumberStringify, language)
      if (deDupe.isDedupe) {
        kycPanData.eStatus = KYC_STATUS.REJECTED
        kycPanData.sRejectReason = KYC_VERIFY_MESSAGE.INFO_ALREADY_USED
      }
      kycPanData.sNo = panNumberStringify
    }
    if (kycPanData.eStatus !== KYC_STATUS.REJECTED && idfyPanData?.age) panAgeValidationCheck(kycPanData, idfyPanData)
    kycPanData.sName = idfyPanData?.name_on_card
    kycPanData.sDateOfBirth = idfyPanData?.date_of_birth
  }
  if (kycPanData.eStatus !== KYC_STATUS.REJECTED) kycPanData.eStatus = KYC_STATUS.PENDING
  kycPanData.eVerifiedBy = KYC_VERIFIED_TYPE.IDFY
  kycPanData.dCreatedAt = Date.now()
  kycPanData.dUpdatedAt = Date.now()
  const kycVerificationCompleted = await dbService.updateKycDataWithUpsert({ iUserId: userId }, { sIdfyGroupId: groupId, oPan: kycPanData, oAadhaar: {}, message: KYC_USER_MESSAGE.UPLOADED_PAN_VERIFIED, count: count })
  // assign url for response
  kycVerificationCompleted.oPan.sImage = imageUrls.panImageUrl
  kycVerificationCompleted.oAadhaar.sFrontImage = imageUrls.aadhaarFrontImageUrl
  kycVerificationCompleted.oAadhaar.sBackImage = imageUrls.aadhaarBackImageUrl
  return { status: jsonStatus.OK, message: messages[language].update_success.replace('##', 'Pancard status'), data: kycVerificationCompleted, count }
}

// for pan-validation 2.1
async function panValidationPendingStateCaseV2(userId, kycPanData, { existingAadhaarData, language, imageUrls, idfyPanData, groupId, count }) {
  kycPanData.eStatus = KYC_STATUS.PENDING
  let responseMessage = messages[language].update_success.replace('##', 'Pancard status')
  let responseStatus = jsonStatus.OK
  let kycFlowMessage = KYC_USER_MESSAGE.UPLOADED_PAN_VERIFIED
  if (idfyPanData) {
    const panNumberStringify = idfyPanData?.id_number && idfyPanData.id_number.toString()
    if (panNumberStringify) {
      const deDupe = await checkForExistingPanData(userId, panNumberStringify, language)
      if (deDupe.isDedupe) {
        kycPanData.eStatus = KYC_STATUS.REJECTED
        kycPanData.sRejectReason = KYC_VERIFY_MESSAGE.INFO_ALREADY_USED
      }
      kycPanData.sNo = panNumberStringify
      kycPanData.eVerifiedBy = KYC_VERIFIED_TYPE.IDFY
      kycPanData.sName = idfyPanData?.name_on_card
      kycPanData.sDateOfBirth = idfyPanData.date_of_birth && idfyPanData.date_of_birth.toString()
      kycPanData.dCreatedAt = Date.now()
      kycPanData.dUpdatedAt = Date.now()
    }
    if (kycPanData.eStatus !== KYC_STATUS.REJECTED && idfyPanData?.age) panAgeValidationCheck(kycPanData, idfyPanData)

    if (kycPanData?.sDateOfBirth && kycPanData.eStatus !== KYC_STATUS.REJECTED) {
      const aadharPanDateCheck = aadhaarPanDateCheckV2(kycPanData, { existingAadhaarData, language })
      if (aadharPanDateCheck && aadharPanDateCheck.responseMessage) {
        responseMessage = aadharPanDateCheck.responseMessage
        responseStatus = jsonStatus.NotAcceptable
        kycFlowMessage = kycPanData.sRejectReason
      }
    }
    if (kycPanData?.sName && kycPanData.eStatus !== KYC_STATUS.REJECTED) {
      const panNameValidationCheck = aadhaarPanNameCheckV2(kycPanData, { existingAadhaarData, language })
      if (panNameValidationCheck && panNameValidationCheck.responseMessage) {
        responseMessage = panNameValidationCheck.responseMessage
        responseStatus = jsonStatus.NotAcceptable
        kycFlowMessage = kycPanData.sRejectReason
      }
    }
  }

  kycPanData.eVerifiedBy = KYC_VERIFIED_TYPE.IDFY
  kycPanData.dCreatedAt = Date.now()
  kycPanData.dUpdatedAt = Date.now()
  const kycVerificationCompleted = await dbService.updateKycDataWithUpsert({ iUserId: userId }, { sIdfyGroupId: groupId, oPan: kycPanData, oAadhaar: existingAadhaarData, message: kycFlowMessage, count: count })
  // assign url for response
  kycVerificationCompleted.oPan.sImage = imageUrls.panImageUrl
  kycVerificationCompleted.oAadhaar.sFrontImage = imageUrls.aadhaarFrontImageUrl
  kycVerificationCompleted.oAadhaar.sBackImage = imageUrls.aadhaarBackImageUrl
  return { status: responseStatus, message: responseMessage, data: kycVerificationCompleted, count }
}

async function panValidationCompletedCaseV4(userId, kycPanData, { existingAadhaarData, language, imageUrls, idfyPanData, groupId, count }) {
  kycPanData.eStatus = KYC_STATUS.ACCEPTED
  let responseMessage = messages[language].update_success.replace('##', 'Pancard status')
  let responseStatus = jsonStatus.OK
  let kycFlowMessage = KYC_USER_MESSAGE.UPLOADED_PAN_VERIFIED
  const deDupe = await checkForExistingPanData(userId, idfyPanData.id_number.toString(), language)
  if (deDupe.isDedupe) {
    kycPanData.eStatus = KYC_STATUS.REJECTED
    kycPanData.sRejectReason = KYC_VERIFY_MESSAGE.INFO_ALREADY_USED
  }
  kycPanData.sNo = idfyPanData.id_number.toString()
  kycPanData.eVerifiedBy = KYC_VERIFIED_TYPE.IDFY
  kycPanData.sName = idfyPanData.name_on_card
  kycPanData.sDateOfBirth = idfyPanData.date_of_birth.toString()
  kycPanData.dCreatedAt = Date.now()
  kycPanData.dUpdatedAt = Date.now()
  if (kycPanData.eStatus !== KYC_STATUS.REJECTED) panAgeValidationCheck(kycPanData, idfyPanData)
  if (kycPanData.eStatus === KYC_STATUS.REJECTED) {
    responseMessage = kycPanData.sRejectReason
    responseStatus = jsonStatus.NotAcceptable
    kycFlowMessage = kycPanData.sRejectReason
  }

  if (kycPanData.eStatus !== KYC_STATUS.REJECTED) {
    const aadharPanDateCheck = aadhaarPanDateCheckV2(kycPanData, { existingAadhaarData, language })
    if (aadharPanDateCheck && aadharPanDateCheck.responseMessage) {
      responseMessage = aadharPanDateCheck.responseMessage
      responseStatus = jsonStatus.NotAcceptable
      kycFlowMessage = kycPanData.sRejectReason
    }
  }

  if (kycPanData.eStatus !== KYC_STATUS.REJECTED) {
    const panNameValidationCheck = aadhaarPanNameCheckV2(kycPanData, { existingAadhaarData, language })
    if (panNameValidationCheck && panNameValidationCheck.responseMessage) {
      responseMessage = panNameValidationCheck.responseMessage
      responseStatus = jsonStatus.NotAcceptable
      kycFlowMessage = kycPanData.sRejectReason
    }
  }

  const consolidated = existingAadhaarData?.eStatus === KYC_STATUS.ACCEPTED && kycPanData.eStatus === KYC_STATUS.ACCEPTED
  if (consolidated) {
    await UserModel.findByIdAndUpdate(userId, { bIsKycApproved: consolidated }, { new: true, runValidators: true }).lean()
  }
  kycPanData.eVerifiedBy = KYC_VERIFIED_TYPE.IDFY
  kycPanData.sName = idfyPanData.name_on_card
  kycPanData.sDateOfBirth = idfyPanData.date_of_birth
  kycPanData.dCreatedAt = Date.now()
  kycPanData.dUpdatedAt = Date.now()
  const kycVerificationCompleted = await dbService.updateKycDataWithUpsert({ iUserId: userId }, { sIdfyGroupId: groupId, oPan: kycPanData, message: kycFlowMessage, count, consolidated })
  // assign url for response
  kycVerificationCompleted.oPan.sImage = imageUrls.panImageUrl
  kycVerificationCompleted.oAadhaar.sFrontImage = imageUrls.aadhaarFrontImageUrl
  kycVerificationCompleted.oAadhaar.sBackImage = imageUrls.aadhaarBackImageUrl
  return { status: responseStatus, message: responseMessage, data: kycVerificationCompleted, count }
}

// async function panValidationCompletedCase(userId, kycPanData, { language, imageUrls, idfyPanData, groupId }) {
// async function panValidationCompletedCase(userId, kycPanData, { language, imageUrls, idfyPanData, groupId }) {
//   const deDupe = await checkForExistingPanData(userId, idfyPanData.id_number.toString(), language)
//   if (deDupe.isDedupe) return deDupe
//   kycPanData.sNo = idfyPanData.id_number.toString()
//   kycPanData.eStatus = KYC_STATUS.ACCEPTED
//   panAgeValidationCheck(kycPanData, idfyPanData)
//   kycPanData.eVerifiedBy = KYC_VERIFIED_TYPE.IDFY
//   kycPanData.sName = idfyPanData.name_on_card
//   kycPanData.sDateOfBirth = idfyPanData.date_of_birth
//   kycPanData.dCreatedAt = Date.now()
//   kycPanData.dUpdatedAt = Date.now()
//   const kycVerificationCompleted = await dbService.updateKycDataWithUpsert({ iUserId: userId }, { sIdfyGroupId: groupId, oPan: kycPanData, oAadhaar: {}, message: KYC_USER_MESSAGE.UPLOADED_PAN_VERIFIED })
//   // assign url for response
//   kycVerificationCompleted.oPan.sImage = imageUrls.panImageUrl
//   kycVerificationCompleted.oAadhaar.sFrontImage = imageUrls.aadhaarFrontImageUrl
//   kycVerificationCompleted.oAadhaar.sBackImage = imageUrls.aadhaarBackImageUrl
//   return { status: jsonStatus.OK, message: messages[language].update_success.replace('##', 'Pancard status'), data: kycVerificationCompleted }
// }

async function panValidationCompletedCaseV3(userId, kycPanData, { language, imageUrls, idfyPanData, groupId, count }) {
  const deDupe = await checkForExistingPanData(userId, idfyPanData.id_number.toString(), language)
  if (deDupe.isDedupe) {
    kycPanData.eStatus = KYC_STATUS.REJECTED
    kycPanData.sRejectReason = KYC_VERIFY_MESSAGE.INFO_ALREADY_USED
  }
  kycPanData.sNo = idfyPanData.id_number.toString()
  if (!kycPanData?.eStatus) panAgeValidationCheck(kycPanData, idfyPanData)
  if (kycPanData.sRejectReason === KYC_VERIFY_MESSAGE.BELOW_EIGHTEEN) {
    return { status: jsonStatus.ResourceExist, message: KYC_VERIFY_MESSAGE.BELOW_EIGHTEEN, count }
  }
  if (!kycPanData?.eStatus) kycPanData.eStatus = KYC_STATUS.ACCEPTED
  kycPanData.eVerifiedBy = KYC_VERIFIED_TYPE.IDFY
  kycPanData.sName = idfyPanData.name_on_card
  kycPanData.sDateOfBirth = idfyPanData.date_of_birth
  kycPanData.dCreatedAt = Date.now()
  kycPanData.dUpdatedAt = Date.now()
  const kycVerificationCompleted = await dbService.updateKycDataWithUpsert({ iUserId: userId }, { sIdfyGroupId: groupId, oPan: kycPanData, message: KYC_USER_MESSAGE.UPLOADED_PAN_VERIFIED, count })
  // assign url for response
  kycVerificationCompleted.oPan.sImage = imageUrls.panImageUrl
  kycVerificationCompleted.oAadhaar.sFrontImage = imageUrls.aadhaarFrontImageUrl
  kycVerificationCompleted.oAadhaar.sBackImage = imageUrls.aadhaarBackImageUrl
  return { status: jsonStatus.OK, message: messages[language].update_success.replace('##', 'Pancard status'), data: kycVerificationCompleted, count }
}
async function panValidationFailedCase(userId, kycPanData, { language, imageUrls, groupId, count }, ePlatform) {
  kycPanData.eStatus = KYC_STATUS.REJECTED
  kycPanData.sRejectReason = KYC_VERIFY_MESSAGE.IMAGE_NOT_CLEAR
  kycPanData.eVerifiedBy = KYC_VERIFIED_TYPE.IDFY
  kycPanData.dCreatedAt = Date.now()
  kycPanData.dUpdatedAt = Date.now()
  const updatedKycdata = await dbService.updateKycDataWithUpsert({ iUserId: userId }, { sIdfyGroupId: groupId, oPan: kycPanData, message: KYC_USER_MESSAGE.UPLOADED_PAN_NOT_VERIFIED, count })
  await queuePush('pushNotification:KYC', { iUserId: userId, eStatus: KYC_STATUS.REJECTED, sPushType: 'KYC', ePlatform })
  // assign url for response
  updatedKycdata.oPan.sImage = imageUrls.panImageUrl
  if (imageUrls.sFrontImage && imageUrls.sBackImage) {
    updatedKycdata.oAadhaar.sFrontImage = imageUrls.sFrontImage
    updatedKycdata.oAadhaar.sBackImage = imageUrls.sBackImage
  }
  return { status: jsonStatus.BadRequest, message: messages[language].image_not_clear, data: updatedKycdata, count }
}

async function checkForpanDataExists(userId, language) {
  const existingKycData = await dbService.getExistingUserData(userId)
  if (existingKycData || existingKycData?.oPan) return existingKycData
  return { status: jsonStatus.NotAcceptable, message: messages[language].please_verify_pan_first }
}

// for Kyc-varification Aadhaar
async function checkForAadhaarDataExistsV2(userId, language) {
  const existingKycData = await dbService.getExistingUserData(userId)
  if (existingKycData && existingKycData.oAadhaar) return existingKycData
}

// for kyc- varification
async function kycUrlGeneration({ sAadharBackImagePath, sAadharFrontImagePath, panImagePath }) {
  const s3Params = {
    Bucket: config.S3_KYC_BUCKET_NAME,
    Expires: 300
  }
  const allPath = []
  if (sAadharBackImagePath && sAadharFrontImagePath) {
    const backImageparams = {
      ...s3Params,
      Key: sAadharBackImagePath
    }
    const frontImageparams = {
      ...s3Params,
      Key: sAadharFrontImagePath
    }
    allPath.push(await getSignedUrl(backImageparams))
    allPath.push(await getSignedUrl(frontImageparams))
  }
  if (panImagePath) {
    const panImagePrams = {
      ...s3Params,
      Key: panImagePath
    }
    allPath.push(await getSignedUrl(panImagePrams))
  }
  return Promise.all(allPath)
}

async function getPanIdfyData({ panImageUrl, groupId, language, getPanDataFromIdfy }) {
  // const imgValidation = await documentImageValidation(panImageUrl, groupId, KYC_DOC_TYPE.DOCTYPE_PAN, KYC_DOC_TYPE.DOC_SIDE_FRONT)
  // if (!imgValidation) return { isVerify: false, status: status.BadRequest, message: 'Pancard is not valid or readable', count: getPanDataFromIdfy.count }

  let idfyPanData = {}
  let panValidationStatus = getPanDataFromIdfy.status
  if (!getPanDataFromIdfy?.count?.panOCRHit) {
    const panDataFromIdfy = await kycProvider.verifyPan(panImageUrl, groupId)
    getPanDataFromIdfy.count.panOCRHit = getPanDataFromIdfy.count.panOCRHit ? getPanDataFromIdfy.count.panOCRHit + 1 : 1
    if (!panDataFromIdfy?.result && panDataFromIdfy.error !== IDFY_STATUS.DIV_IMAGE_INVALID) return { isVerify: false, status: status.BadRequest, message: messages[language].image_not_clear, count: panDataFromIdfy.count }
    panValidationStatus = panDataFromIdfy.status
    idfyPanData = panDataFromIdfy.result ? panDataFromIdfy.result.extraction_output : panDataFromIdfy
  }

  return { isVerify: true, idfyPanData, status: panValidationStatus, count: getPanDataFromIdfy.count }
}
// TODO : if getAadhaarIdfyDatav2() will work need to remove getAadhaarIdfyData()

// async function getAadhaarIdfyData({ aadhaarFrontImageUrl, aadhaarBackImageUrl, groupId, language }) {
//   const [frontImageValidation, backImageValidation] = await Promise.all([documentImageValidation(aadhaarFrontImageUrl, groupId, KYC_DOC_TYPE.DOCTYPE_AADHAR, KYC_DOC_TYPE.DOC_SIDE_FRONT),
//     documentImageValidation(aadhaarBackImageUrl, groupId, KYC_DOC_TYPE.DOCTYPE_AADHAR, KYC_DOC_TYPE.DOC_SIDE_BACK)])
//   if (!frontImageValidation || !backImageValidation) return { isVerify: false, status: status.BadRequest, message: 'Front or back side of aadhar is not valid or readable' }
//   const getAdhaarDataFromIdfy = await kycProvider.verifyAadhar(aadhaarFrontImageUrl, aadhaarBackImageUrl, groupId)
//   if (!getAdhaarDataFromIdfy?.result && getAdhaarDataFromIdfy.error !== 'INVALID_IMAGE') return { isVerify: false, status: status.BadRequest, message: messages[language].image_not_clear }

//   const idfyAadharData = getAdhaarDataFromIdfy.result ? getAdhaarDataFromIdfy.result.extraction_output : getAdhaarDataFromIdfy

//   return { isVerify: true, idfyAadharData, status: getAdhaarDataFromIdfy.status }
// }

// async function getAadhaarIdfyData({ aadhaarFrontImageUrl, aadhaarBackImageUrl, groupId, language }) {
//   const getAdhaarDataFromIdfy = await kycProvider.verifyAadhar(aadhaarFrontImageUrl, aadhaarBackImageUrl, groupId)
//   if (!getAdhaarDataFromIdfy?.result && getAdhaarDataFromIdfy.error !== 'INVALID_IMAGE') return { isVerify: false, status: status.BadRequest, message: messages[language].image_not_clear }

//   const idfyAadharData = getAdhaarDataFromIdfy.result ? getAdhaarDataFromIdfy.result.extraction_output : getAdhaarDataFromIdfy
//   return { isVerify: true, idfyAadharData, status: getAdhaarDataFromIdfy.status }
// }

// async function getAadhaarIdfyData({ aadhaarFrontImageUrl, aadhaarBackImageUrl, groupId, language }) {
//   const getAdhaarDataFromIdfy = await kycProvider.verifyAadhar(aadhaarFrontImageUrl, aadhaarBackImageUrl, groupId)
//   if (!getAdhaarDataFromIdfy?.result && getAdhaarDataFromIdfy.error !== 'INVALID_IMAGE') return { isVerify: false, status: status.BadRequest, message: messages[language].image_not_clear }

//   const idfyAadharData = getAdhaarDataFromIdfy.result ? getAdhaarDataFromIdfy.result.extraction_output : getAdhaarDataFromIdfy
//   return { isVerify: true, idfyAadharData, status: getAdhaarDataFromIdfy.status }
// }
async function getAadhaarIdfyDatav2({ aadhaarFrontImageUrl, aadhaarBackImageUrl, groupId, language, getAdharDataFromIdfy }) {
  // const imageValidation = await documentImageValidation(mergeImageUrl, groupId, KYC_DOC_TYPE.DOCTYPE_AADHAR, KYC_DOC_TYPE.DOC_SIDE_BOTH)

  // if (!imageValidation) return { isVerify: false, status: status.BadRequest, message: 'Front or back side of aadhar is not valid or readable', count: getAdharDataFromIdfy.count }

  const getAdhaarDataFromIdfy = await kycProvider.verifyAadhar(aadhaarFrontImageUrl, aadhaarBackImageUrl, groupId)
  getAdharDataFromIdfy.count.aadhaarOCRHit = 1
  if (!getAdhaarDataFromIdfy?.result && getAdhaarDataFromIdfy.error !== IDFY_STATUS.DIV_IMAGE_INVALID) return { isVerify: false, status: status.BadRequest, message: messages[language].image_not_clear, count: getAdharDataFromIdfy.count }

  const idfyAadharData = getAdhaarDataFromIdfy.result ? getAdhaarDataFromIdfy.result.extraction_output : getAdhaarDataFromIdfy

  return { isVerify: true, idfyAadharData, status: getAdhaarDataFromIdfy.status, count: getAdharDataFromIdfy.count }
}

// for new Aadhaar-kyc flow 2.1
async function getAadhaarIdfyDatav3({ aadhaarFrontImageUrl, aadhaarBackImageUrl, groupId, language, getAadhaarDataFromIdfy }) {
  let idfyAadhaarData = {}
  // const imageValidation = await documentImageValidation(mergeImageUrl, groupId, KYC_DOC_TYPE.DOCTYPE_AADHAR, KYC_DOC_TYPE.DOC_SIDE_BOTH)
  // if (!imageValidation) return { isVerify: false, status: status.BadRequest, message: 'Front or back image of Aadhaar is not valid or readable', count: getAadhaarDataFromIdfy.count }

  // sending user to pending after failed in div
  // if (!imageValidation) {
  //   getAadhaarDataFromIdfy.count.aadhaarfailedHit = (getAadhaarDataFromIdfy.count.aadhaarfailedHit || 0) + 1
  //   return { isVerify: true, idfyAadhaarData, status: getAadhaarDataFromIdfy.status, count: getAadhaarDataFromIdfy.count }
  // }

  let aadhaarValidationStatus = getAadhaarDataFromIdfy.status
  if (!getAadhaarDataFromIdfy?.count?.aadhaarOCRHit) {
    const AadhaarDataFromIdfy = await kycProvider.verifyAadhar(aadhaarFrontImageUrl, aadhaarBackImageUrl, groupId)

    getAadhaarDataFromIdfy.count.aadhaarOCRHit = getAadhaarDataFromIdfy.count.aadhaarOCRHit ? getAadhaarDataFromIdfy.count.aadhaarOCRHit + 1 : 1

    if (!AadhaarDataFromIdfy?.result && AadhaarDataFromIdfy.error !== 'INVALID_IMAGE') return { isVerify: false, status: status.BadRequest, message: messages[language].image_not_clear, count: getAadhaarDataFromIdfy.count }

    aadhaarValidationStatus = AadhaarDataFromIdfy.status
    idfyAadhaarData = AadhaarDataFromIdfy.result ? AadhaarDataFromIdfy.result.extraction_output : AadhaarDataFromIdfy
  }
  return { isVerify: true, idfyAadhaarData, status: aadhaarValidationStatus, count: getAadhaarDataFromIdfy.count }
}

// for new Aadhaar-kyc flow 2.1
async function getPanIdfyDataV2({ panImageUrl, groupId, language, getPanDataFromIdfy }) {
  let idfyPanData = {}
  // const imgValidation = await documentImageValidation(panImageUrl, groupId, KYC_DOC_TYPE.DOCTYPE_PAN, KYC_DOC_TYPE.DOC_SIDE_FRONT)
  // if (!imgValidation) return { isVerify: false, status: status.BadRequest, message: 'Pancard is not valid or readable', count: getPanDataFromIdfy.count }

  // sending user to pending after failed in div
  // if (!imgValidation) {
  //   getPanDataFromIdfy.count.panfailedHit = (getPanDataFromIdfy.count.panfailedHit || 0) + 1
  //   return { isVerify: true, idfyPanData, status: getPanDataFromIdfy.status, count: getPanDataFromIdfy.count }
  // }

  let panValidationStatus = getPanDataFromIdfy.status
  if (!getPanDataFromIdfy.count?.panOCRHit) {
    const panDataFromIdfy = await kycProvider.verifyPan(panImageUrl, groupId)
    getPanDataFromIdfy.count.panOCRHit = getPanDataFromIdfy.count.panOCRHit ? getPanDataFromIdfy.count.panOCRHit + 1 : 1
    if (!panDataFromIdfy?.result && panDataFromIdfy.error !== 'INVALID_IMAGE') return { isVerify: false, status: status.BadRequest, message: messages[language].image_not_clear, count: panDataFromIdfy.count }
    panValidationStatus = panDataFromIdfy.status
    idfyPanData = panDataFromIdfy.result ? panDataFromIdfy.result.extraction_output : panDataFromIdfy
  }

  return { isVerify: true, idfyPanData, status: panValidationStatus, count: getPanDataFromIdfy.count }
}

// for kyc-aadhar-varification
function checkForIdFyMandatoryAadhaarData(idfyAaddharData) {
  return idfyAaddharData && idfyAaddharData.id_number && idfyAaddharData.state && idfyAaddharData.date_of_birth && idfyAaddharData.name_on_card
}

function checkForIdFyMandatoryPanData(idfyPanData) {
  return idfyPanData && idfyPanData.id_number && idfyPanData.age && idfyPanData.name_on_card && idfyPanData.date_of_birth
}

function aadhaarPanDateCheck(kycAadhaarData, { existingKycPanData, language }) {
  if (!kycAadhaarData?.sDateOfBirth) return kycAadhaarData
  if (existingKycPanData.sDateOfBirth === kycAadhaarData.sDateOfBirth.toString()) return kycAadhaarData
  kycAadhaarData.sRejectReason = KYC_VERIFY_MESSAGE.DOB_DOES_NOT_MATCH
  kycAadhaarData.eStatus = KYC_STATUS.REJECTED
  return { oAadhaar: kycAadhaarData, message: KYC_USER_MESSAGE.UPLOADED_BOTH_REJECTED, responseMessage: messages[language].dob_does_not_match }
}

function aadhaarPanNameCheck(kycAadhaarData, { existingKycPanData, language }) {
  if (!kycAadhaarData?.sAadharName) return kycAadhaarData
  if (kycProvider.isAadharPanNameMatch(existingKycPanData.sName, kycAadhaarData.sAadharName)) return kycAadhaarData
  kycAadhaarData.sRejectReason = KYC_VERIFY_MESSAGE.NAME_DOES_NOT_MATCH
  kycAadhaarData.eStatus = KYC_STATUS.PENDING
  return { oAadhaar: kycAadhaarData, message: KYC_USER_MESSAGE.UPLOADED_BOTH_REJECTED, responseMessage: messages[language].name_does_not_match }
}

function aadhaarPanDateCheckV2(kycPanData, { existingAadhaarData, language }) {
  if (!existingAadhaarData?.sDateOfBirth) return kycPanData
  if (existingAadhaarData.sDateOfBirth === kycPanData.sDateOfBirth.toString()) return kycPanData
  kycPanData.sRejectReason = KYC_VERIFY_MESSAGE.DOB_DOES_NOT_MATCH
  kycPanData.eStatus = KYC_STATUS.REJECTED
  return { oPan: kycPanData, message: KYC_USER_MESSAGE.UPLOADED_BOTH_REJECTED, responseMessage: messages[language].dob_does_not_match }
}

function aadhaarPanNameCheckV2(kycPanData, { existingAadhaarData, language }) {
  if (!kycPanData?.sName) return kycPanData
  if (kycProvider.isAadharPanNameMatch(existingAadhaarData.sAadharName, kycPanData.sName)) return kycPanData
  kycPanData.sRejectReason = KYC_VERIFY_MESSAGE.NAME_DOES_NOT_MATCH
  kycPanData.eStatus = KYC_STATUS.PENDING
  return { oPan: kycPanData, message: KYC_USER_MESSAGE.UPLOADED_BOTH_REJECTED, responseMessage: messages[language].name_does_not_match }
}

function aadhaarLocationCheck(kycAadhaarData, { language }) {
  if (!kycAadhaarData?.sState) return kycAadhaarData
  if (!kycProvider.isLocationValid(kycAadhaarData.sState)) return kycAadhaarData
  kycAadhaarData.sRejectReason = KYC_VERIFY_MESSAGE.BLOCKED_LOCATION
  kycAadhaarData.eStatus = KYC_STATUS.REJECTED
  return { oAadhaar: kycAadhaarData, message: KYC_USER_MESSAGE.UPLOADED_BOTH_REJECTED, responseMessage: messages[language].blocked_location }
}

// for kyc-varification
// async function documentImageValidation(sImage, sGroupId, docType, docSide) {
//   if (!sImage) {
//     return false
//   }
//   const validationResult = await kycProvider.documentImageValidation(sImage, sGroupId, docType)
//   // eslint-disable-next-line no-prototype-builtins
//   if (validationResult.hasOwnProperty('result')) {
//     if (validationResult.result.is_readable && validationResult.result.readability.confidence >= 40 && validationResult.result.detected_doc_side === docSide && validationResult.result.detected_doc_type === docType) {
//       return true
//     }
//     return false
//   }
//   return false
// }

module.exports = new UserKyc()
