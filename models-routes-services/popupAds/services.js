const PopupAdsModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, isUrl, getPaginationValues2, checkValidImageType } = require('../../helper/utilities.services')
const config = require('../../config/config')
const s3 = require('../../helper/s3config')
const MatchModel = require('../match/model')
const MatchLeagueModel = require('../matchLeague/model')
class PopupAds {
  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await s3.signedUrl(sFileName, sContentType, config.s3PopupAds)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('PopupAds.getSignedUrl', error, req, res)
    }
  }

  async add(req, res) {
    try {
      const { eType, sLink, iMatchId, iMatchLeagueId, eCategory } = req.body

      // eType -> I = INTERNAL, E = EXTERNAL
      if (eType === 'E') req.body = pick(req.body, ['sImage', 'eType', 'eStatus', 'sLink', 'ePlatform', 'sTitle'])
      if (eType === 'I') req.body = pick(req.body, ['sImage', 'eStatus', 'sLink', 'eType', 'iMatchId', 'iMatchLeagueId', 'eCategory', 'ePlatform', 'sTitle'])

      if (eType === 'I') {
        // For Internal type, we required upcoming match or it's match contest of particular sports for redirection on ads click.
        const upcomingMatch = await MatchModel.findById(iMatchId).lean()

        if (!upcomingMatch) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_upcoming })
        if (upcomingMatch.eCategory !== eCategory) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_upcoming })

        if (iMatchLeagueId) {
          const league = await MatchLeagueModel.findById(iMatchLeagueId).lean()
          if (!league) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })
        }
      } else {
        // For External type, we required link from which it'll be redirect on ads click.
        if (!sLink) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].fields_missing.replace('##', messages[req.userLanguage].link) })
        if (!isUrl(sLink)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].link) })
      }

      const data = await PopupAdsModel.create({ ...req.body })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].newPopupAds), data })
    } catch (error) {
      catchError('PopupAds.add', error, req, res)
    }
  }

  async update(req, res) {
    try {
      const { sTitle, eType, sLink, iMatchId, iMatchLeagueId, eCategory, sImage } = req.body

      if (eType === 'E') req.body = pick(req.body, ['sImage', 'eType', 'eStatus', 'sLink', 'ePlatform', 'sTitle'])
      if (eType === 'I') req.body = pick(req.body, ['sImage', 'eStatus', 'sLink', 'eType', 'iMatchId', 'iMatchLeagueId', 'eCategory', 'ePlatform', 'sTitle'])

      if (eType === 'I') {
        // For Internal type, we required upcoming match or it's match contest of particular sports for redirection on ads click.
        const upcomingMatch = await MatchModel.findById(iMatchId).lean()

        if (!upcomingMatch) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_upcoming })
        if (upcomingMatch.eCategory !== eCategory) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].match_not_upcoming })

        if (iMatchLeagueId) {
          const league = await MatchLeagueModel.findById(iMatchLeagueId).lean()
          if (!league) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cmatchLeague) })
        }
      } else {
        // For External type, we required link from which it'll be redirect on ads click.
        if (!sLink) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].fields_missing.replace('##', messages[req.userLanguage].link) })
        if (!isUrl(sLink)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].link) })
      }
      let data = await PopupAdsModel.findByIdAndUpdate(req.params.id, { ...req.body, iMatchId, iMatchLeagueId, eCategory, sTitle }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].popupAds) })

      const s3Params = {
        Bucket: config.S3_BUCKET_NAME,
        Key: data.sImage
      }

      if (s3Params && data.sImage !== sImage) {
        data = await s3.deleteObject(s3Params)
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].popupAdsDetails), data })
    } catch (error) {
      catchError('PopupAds.update', error, req, res)
    }
  }

  async remove(req, res) {
    try {
      const data = await PopupAdsModel.findByIdAndDelete(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].popupAds) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].popupAds), data })
    } catch (error) {
      return catchError('PopupAds.remove', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const data = await PopupAdsModel.findById(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].popupAds) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].popupAds), data })
    } catch (error) {
      return catchError('PopupAds.get', error, req, res)
    }
  }

  async adminList(req, res) {
    try {
      const { eType } = req.query
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      let query = {}
      if (eType === 'I') {
        query = { eType: 'I' }
      } else if (eType === 'E') {
        query = { eType: 'E' }
      }
      query = search ? {
        ...query,
        $or: [
          { sTitle: { $regex: new RegExp('^.*' + search + '.*', 'i') } },
          { sLink: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
        ]
      } : query

      const results = await PopupAdsModel.find(query, {
        sImage: 1,
        eType: 1,
        ePlatform: 1,
        eStatus: 1,
        sLink: 1,
        sTitle: 1,
        iMatchId: 1,
        iMatchLeagueId: 1,
        eCategory: 1,
        dCreatedAt: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const total = await PopupAdsModel.countDocuments({ ...query })

      const data = [{ total, results }]
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].popupAds), data })
    } catch (error) {
      return catchError('PopupAds.adminList', error, req, res)
    }
  }

  async list(req, res) {
    try {
      const data = await PopupAdsModel.find({ eStatus: 'Y' }).lean()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].popupAds), data })
    } catch (error) {
      catchError('PopupAds.list', error, req, res)
    }
  }
}

module.exports = new PopupAds()
