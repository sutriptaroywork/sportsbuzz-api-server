const PayoutOptionModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, getPaginationValues2, checkValidImageType } = require('../../helper/utilities.services')
const config = require('../../config/config')
const s3 = require('../../helper/s3config')

class PayoutOption {
  async get(req, res) {
    try {
      const paymentOption = await PayoutOptionModel.findById(req.params.id).lean()
      if (!paymentOption) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpayoutOption) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpayoutOption), data: paymentOption })
    } catch (error) {
      return catchError('PayoutOption.get', error, req, res)
    }
  }

  async add(req, res) {
    try {
      req.body = pick(req.body, ['sTitle', 'eType', 'sImage', 'sInfo', 'eKey', 'bEnable', 'nWithdrawFee', 'nMinAmount', 'nMaxAmount'])

      const data = await PayoutOptionModel.create({ ...req.body })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].snewPayoutOption), data })
    } catch (error) {
      catchError('PayoutOption.add', error, req, res)
    }
  }

  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await s3.signedUrl(sFileName, sContentType, config.s3PayoutOption)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('PayoutOption.getSignedUrl', error, req, res)
    }
  }

  async listV2(req, res) {
    try {
      const data = await PayoutOptionModel.find().lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpayoutOptions), data })
    } catch (error) {
      catchError('PayoutOption.listV2', error, req, res)
    }
  }

  async adminList(req, res) {
    try {
      const { start, limit, sorting, search } = getPaginationValues2(req.query)
      const query = search ? { sTitle: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      const results = await PayoutOptionModel.find(query, {
        sTitle: 1,
        eType: 1,
        sImage: 1,
        eKey: 1,
        sInfo: 1,
        bEnable: 1,
        dCreatedAt: 1,
        nWithdrawFee: 1,
        nMinAmount: 1,
        nMaxAmount: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const total = await PayoutOptionModel.countDocuments({ ...query })

      const data = [{ total, results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpayoutOption), data })
    } catch (error) {
      return catchError('PayoutOption.adminList', error, req, res)
    }
  }

  async update(req, res) {
    try {
      req.body = pick(req.body, ['sTitle', 'eType', 'sImage', 'sInfo', 'eKey', 'bEnable', 'nWithdrawFee', 'nMinAmount', 'nMaxAmount'])

      const { sImage } = req.body

      const data = await PayoutOptionModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpayoutOption) })

      const s3Params = {
        Bucket: config.S3_BUCKET_NAME,
        Key: data.sImage
      }

      let paymentOption
      if (s3Params && data.sImage !== sImage) {
        paymentOption = await s3.deleteObject(s3Params) // We'll remove old image from s3 bucket also
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cpayoutOptionDetails), data: paymentOption || data })
    } catch (error) {
      catchError('PayoutOption.update', error, req, res)
    }
  }
}

module.exports = new PayoutOption()
