const PaymentOptionModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, getPaginationValues2, checkValidImageType } = require('../../helper/utilities.services')
const config = require('../../config/config')
const s3 = require('../../helper/s3config')

class PaymentOption {
  async get(req, res) {
    try {
      const paymentOption = await PaymentOptionModel.findById(req.params.id).lean()
      if (!paymentOption) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpaymentOption) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpaymentOption), data: paymentOption })
    } catch (error) {
      return catchError('PaymentOption.get', error, req, res)
    }
  }

  async add(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'nOrder', 'sImage', 'sOffer', 'eKey', 'bEnable'])

      const data = await PaymentOptionModel.create({ ...req.body })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].snewPaymentOption), data })
    } catch (error) {
      catchError('PaymentOption.add', error, req, res)
    }
  }

  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await s3.signedUrl(sFileName, sContentType, config.s3PaymentOption)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('PaymentOption.getSignedUrl', error, req, res)
    }
  }

  async listV2(req, res) {
    try {
      const data = await PaymentOptionModel.find({}, { sKey: 0 }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpaymentOptions), data })
    } catch (error) {
      catchError('PaymentOption.listV2', error, req, res)
    }
  }

  async adminList(req, res) {
    try {
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      const query = search ? { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      const results = await PaymentOptionModel.find(query, {
        sName: 1,
        nOrder: 1,
        sImage: 1,
        eKey: 1,
        sOffer: 1,
        bEnable: 1,
        dCreatedAt: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const total = await PaymentOptionModel.countDocuments({ ...query })

      const data = [{ total, results }]
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpaymentOption), data })
    } catch (error) {
      return catchError('PaymentOption.list', error, req, res)
    }
  }

  async update(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'nOrder', 'sImage', 'sOffer', 'bEnable'])

      const { sImage } = req.body

      const data = await PaymentOptionModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpaymentOption) })

      const s3Params = {
        Bucket: config.S3_BUCKET_NAME,
        Key: data.sImage
      }

      let paymentOption
      if (s3Params && data.sImage !== sImage) {
        paymentOption = await s3.deleteObject(s3Params) // we'll remove old image also from s3 bucket list
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cpaymentOptionDetails), data: paymentOption || data })
    } catch (error) {
      catchError('PaymentOption.update', error, req, res)
    }
  }
}

module.exports = new PaymentOption()
