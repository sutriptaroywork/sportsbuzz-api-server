const OfferModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, getPaginationValues2, checkValidImageType } = require('../../helper/utilities.services')
const config = require('../../config/config')
const s3 = require('../../helper/s3config')

class AdminOffer {
  async get(req, res) {
    try {
      const offer = await OfferModel.findById(req.params.id).lean()
      if (!offer) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].coffer) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].coffer), data: offer })
    } catch (error) {
      return catchError('AdminOffer.get', error, req, res)
    }
  }

  async add(req, res) {
    try {
      req.body = pick(req.body, ['sTitle', 'sDescription', 'sImage', 'sDetail', 'eStatus'])

      const data = await OfferModel.create({ ...req.body })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnewOffer), data })
    } catch (error) {
      catchError('AdminOffer.add', error, req, res)
    }
  }

  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await s3.signedUrl(sFileName, sContentType, config.s3Offer)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('AdminOffer.getSignedUrl', error, req, res)
    }
  }

  async list(req, res) {
    try {
      const data = await OfferModel.find({ eStatus: 'Y' }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].coffer), data })
    } catch (error) {
      catchError('AdminOffer.list', error, req, res)
    }
  }

  async adminList(req, res) {
    try {
      const { start, limit, sorting, search } = getPaginationValues2(req.query)
      const query = search ? { sTitle: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      const results = await OfferModel.find(query, {
        sTitle: 1,
        sDescription: 1,
        sImage: 1,
        sDetail: 1,
        eStatus: 1,
        dCreatedAt: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const total = await OfferModel.countDocuments({ ...query })

      const data = [{ total, results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].coffer), data })
    } catch (error) {
      return catchError('AdminOffer.list', error, req, res)
    }
  }

  async update(req, res) {
    try {
      const { sImage } = req.body
      const data = await OfferModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].coffer) })

      const s3Params = {
        Bucket: config.S3_BUCKET_NAME,
        Key: data.sImage
      }

      let offer
      if (s3Params && data.sImage !== sImage) {
        offer = await s3.deleteObject(s3Params) // remove old image from s3 bucket also.
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cofferDetails), data: offer || data })
    } catch (error) {
      catchError('AdminOffer.update', error, req, res)
    }
  }

  async remove(req, res) {
    try {
      const data = await OfferModel.findByIdAndDelete(req.params.id)

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].coffer) })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].coffer), data })
    } catch (error) {
      catchError('AdminOffer.remove', error, req, res)
    }
  }
}

module.exports = new AdminOffer()
