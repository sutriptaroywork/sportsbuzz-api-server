const mongoose = require('mongoose')
const { ObjectId } = mongoose.Types
const BannerModel = require('../model')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { catchError, getPaginationValues } = require('../../../helper/utilities.services')
const BannerStatisticModel = require('../statistics/model')
const { CACHE_1 } = require('../../../config/config')

class BannerStatistic {
  // To get single banner's statistics details
  async getV2(req, res) {
    try {
      const { datefrom, dateto } = req.query

      const { iUserId } = req.query
      let { start, limit, sorting } = getPaginationValues(req.query)
      start = parseInt(start)
      limit = parseInt(limit)

      const banner = await BannerModel.findById(req.params.id).lean()
      if (!banner) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].banner) })

      let query = { iBannerId: ObjectId(req.params.id) }
      query = iUserId ? { ...query, iUserId: ObjectId(iUserId) } : query

      query = datefrom && dateto ? { ...query, dCreatedAt: { $gte: (datefrom), $lte: (dateto) } } : query

      const total = await BannerStatisticModel.countDocuments(query)
      const bannerStats = await BannerStatisticModel.find(query).populate({ path: 'iUserId', select: ['sUsername', '_id', 'eType'] }).sort(sorting).skip(start).limit(limit).lean()

      const nTotalBannerClick = await BannerStatisticModel.countDocuments({ iBannerId: banner._id })

      const data = { total, data: bannerStats, nTotalBannerClick }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cbannerStatistic), data })
    } catch (error) {
      return catchError('BannerStatistic.getV2', error, req, res)
    }
  }

  async log(req, res) {
    try {
      const { _id: iUserId } = req.user

      const banner = await BannerModel.findById(req.params.id, { _id: 1 }).lean().cache(CACHE_1, `banner:${req.params.id}`)
      if (!banner) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].banner) })

      const data = await BannerStatisticModel.create(
        {
          iUserId,
          iBannerId: req.params.id
        }
      )

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cbannerLog), data })
    } catch (error) {
      return catchError('BannerStatistic.log', error, req, res)
    }
  }
}

module.exports = new BannerStatistic()
