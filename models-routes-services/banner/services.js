const BannerModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, isUrl, getPaginationValues2, checkValidImageType } = require('../../helper/utilities.services')
const config = require('../../config/config')
const s3 = require('../../helper/s3config')
const MatchModel = require('../match/model')
const MatchLeagueModel = require('../matchLeague/model')

class AdminBanner {
  async get(req, res) {
    try {
      const banner = await BannerModel.findById(req.params.id).lean()
      if (!banner) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].banner) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].banner), data: banner })
    } catch (error) {
      return catchError('AdminBanner.get', error, req, res)
    }
  }

  // To get list of banners of admin panel
  async adminList(req, res) {
    try {
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      const query = search && search.length ? { sLink: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      const results = await BannerModel.find(query, {
        sImage: 1,
        eType: 1,
        eStatus: 1,
        sLink: 1,
        eScreen: 1,
        sDescription: 1,
        nPosition: 1,
        iMatchId: 1,
        iMatchLeagueId: 1,
        ePlace: 1,
        eCategory: 1,
        dCreatedAt: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const total = await BannerModel.countDocuments({ ...query })

      const data = [{ total, results }]
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].banner), data })
    } catch (error) {
      return catchError('AdminBanner.adminList', error, req, res)
    }
  }

  // Banner list in APP
  async list(req, res) {
    try {
      const data = await BannerModel.find({ eStatus: 'Y', ePlace: req.params.place.toUpperCase() }, {
        __v: 0, dUpdatedAt: 0, dCreatedAt: 0
      }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].banner), data })
    } catch (error) {
      catchError('AdminBanner.list', error, req, res)
    }
  }

  // Add new banner
  async add(req, res) {
    try {
      let { eType, sLink, eScreen, iMatchId, iMatchLeagueId, eCategory, nPosition } = req.body

      if (eType === 'L') req.body = pick(req.body, ['sLink', 'sImage', 'eType', 'eStatus', 'sDescription', 'nPosition', 'ePlace'])
      if (eType === 'S' && eScreen !== 'CR') req.body = pick(req.body, ['sImage', 'eType', 'eStatus', 'sDescription', 'eScreen', 'ePlace', 'nPosition'])
      if (eScreen === 'CR') req.body = pick(req.body, ['sImage', 'eStatus', 'sDescription', 'eType', 'iMatchId', 'iMatchLeagueId', 'eCategory', 'ePlace', 'nPosition', 'eScreen'])

      nPosition = nPosition ? parseInt(nPosition) : undefined
      if (eScreen === 'CR') {
        req.body.eType = 'S'
        const upcomingMatch = await MatchModel.findById(iMatchId).lean()
        if (!upcomingMatch) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_upcoming })
        if (upcomingMatch.eCategory !== eCategory) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_upcoming })
        if (iMatchLeagueId) {
          const league = await MatchLeagueModel.findById(iMatchLeagueId).lean()
          if (!league) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })
        }
      } else {
        if (eType === 'L' && !sLink) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].fields_missing.replace('##', messages[req.userLanguage].link) })
        if (eType === 'L' && !isUrl(sLink)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].link) })
        if (eType === 'S' && !eScreen) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].fields_missing.replace('##', messages[req.userLanguage].screen) })
      }

      const data = await BannerModel.create({ ...req.body, nPosition })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].newBanner), data: data })
    } catch (error) {
      catchError('AdminBanner.add', error, req, res)
    }
  }

  // To get signedUrl for banner image
  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await s3.signedUrl(sFileName, sContentType, config.s3Banners)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('AdminBanner.getSignedUrl', error, req, res)
    }
  }

  // Update banner details
  async update(req, res) {
    try {
      let { eType, sLink, eScreen, sImage, iMatchId, iMatchLeagueId, eCategory, nPosition } = req.body

      if (eType === 'L') req.body = pick(req.body, ['sLink', 'sImage', 'eType', 'eStatus', 'sDescription', 'nPosition', 'ePlace'])
      if (eType === 'S' && eScreen !== 'CR') req.body = pick(req.body, ['sImage', 'eType', 'eStatus', 'sDescription', 'eScreen', 'nPosition', 'ePlace'])
      if (eType === 'CR') req.body = pick(req.body, ['sImage', 'eStatus', 'sDescription', 'eType', 'iMatchId', 'iMatchLeagueId', 'eCategory', 'nPosition', 'ePlace'])

      nPosition = nPosition ? parseInt(nPosition) : ''
      if (eType === 'CR') {
        req.body.eType = 'S'
        const upcomingMatch = await MatchModel.findById(iMatchId).lean()
        if (!upcomingMatch) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_upcoming })
        if (upcomingMatch.eCategory !== eCategory) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_upcoming })
        if (iMatchLeagueId) {
          const league = await MatchLeagueModel.findById(iMatchLeagueId).lean()
          if (!league) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })
        } else {
          iMatchLeagueId = ''
        }
      } else {
        if (eType === 'L' && !sLink) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].fields_missing.replace('##', messages[req.userLanguage].link) })
        if (eType === 'L' && !isUrl(sLink)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].link) })
        if (eType === 'S' && !eScreen) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].fields_missing.replace('##', messages[req.userLanguage].screen) })
      }
      let data = await BannerModel.findByIdAndUpdate(req.params.id, { ...req.body, nPosition, iMatchId, iMatchLeagueId, eCategory }, { new: true, runValidators: true }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].banner) })

      const s3Params = {
        Bucket: config.S3_BUCKET_NAME,
        Key: data.sImage
      }

      if (s3Params && data.sImage !== sImage) {
        data = await s3.deleteObject(s3Params)
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].bannerDetails), data })
    } catch (error) {
      catchError('AdminBanner.update', error, req, res)
    }
  }

  // Remove banner
  async remove(req, res) {
    try {
      const data = await BannerModel.findByIdAndDelete(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].banner) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].banner), data })
    } catch (error) {
      return catchError('BannerModel.remove', error, req, res)
    }
  }

  getUrl(req, res) {
    try {
      let data
      if (req.params.type === 'kyc') {
        data = config.S3_BUCKET_KYC_URL
      } else if (req.params.type === 'media') {
        data = config.S3_BUCKET_URL
      } else {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].type) })
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].url), data })
    } catch (error) {
      catchError('AdminBanner.getUrl', error, req, res)
    }
  }

  getUrls(req, res) {
    try {
      const data = {
        kyc: config.S3_BUCKET_KYC_URL,
        media: config.S3_BUCKET_URL
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].url), data })
    } catch (error) {
      catchError('AdminBanner.getUrls', error, req, res)
    }
  }
}
module.exports = new AdminBanner()
