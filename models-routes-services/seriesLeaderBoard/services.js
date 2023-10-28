const SeriesLeaderBoardModel = require('./model')
const SeriesLBCategoriesTemplateModel = require('./seriesLBCategoriesTemplate.model')
const SeriesLBUserRankModel = require('./seriesLBUserRank.model')
const MatchModel = require('../match/model')
const MatchLeagueModel = require('../matchLeague/model')
const UserLeagueModel = require('../userLeague/model')
const PassbookModel = require('../passbook/model')
const { Op, fn, col } = require('sequelize')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, removenull, getPaginationValues2, checkValidImageType, defaultSearch, getIp } = require('../../helper/utilities.services')
const ObjectId = require('mongoose').Types.ObjectId
const s3 = require('../../helper/s3config')
const { queuePush } = require('../../helper/redis')
const { generateRank } = require('./common')
const { bAllowDiskUse, S3_BUCKET_NAME } = require('../../config/config')
const UserModel = require('../user/model')
const config = require('../../config/config')
const adminLogQueue = require('../../rabbitmq/queue/adminLogQueue')

class SeriesLeaderBoard {
  async add(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'sInfo', 'eCategory', 'eStatus'])

      const data = await SeriesLeaderBoardModel.create({ ...req.body, sKey: `${req.body.sName.toLocaleLowerCase().split(' ').join('-')}:${+new Date()}` })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cseries), data: data })
    } catch (error) {
      return catchError('SeriesLeaderBoard.add', error, req, res)
    }
  }

  async update(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'sInfo', 'eCategory', 'eStatus'])
      removenull(req.body)

      const data = await SeriesLeaderBoardModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseries) })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cseries), data })
    } catch (error) {
      catchError('SeriesLeaderBoard.update', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const data = await SeriesLeaderBoardModel.findById(req.params.id).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseries) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cseries), data })
    } catch (error) {
      catchError('SeriesLeaderBoard.get', error, req, res)
    }
  }

  async remove(req, res) {
    try {
      const data = await SeriesLeaderBoardModel.findByIdAndDelete(req.params.id).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseries) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].cseries), data })
    } catch (error) {
      catchError('SeriesLeaderBoard.remove', error, req, res)
    }
  }

  async adminList(req, res) {
    try {
      const { sportsType, sort, order, eStatus } = req.query
      const { start, limit, search } = getPaginationValues2(req.query)

      let query = search ? { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') }, eCategory: sportsType.toUpperCase() } : { eCategory: sportsType.toUpperCase() }
      const sorting = sort && order ? { [sort]: order === 'asc' ? 1 : -1 } : { sName: 1 }
      if (eStatus) query = { ...query, eStatus }

      const results = await SeriesLeaderBoardModel.find(query, {
        sName: 1,
        sInfo: 1,
        eCategory: 1,
        eStatus: 1,
        dCreatedAt: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const total = await SeriesLeaderBoardModel.countDocuments({ ...query })

      const data = [{ total, results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cseries), data: data })
    } catch (error) {
      return catchError('SeriesLeaderBoard.adminList', error, req, res)
    }
  }

  async list(req, res) {
    try {
      const { nOffset = 0, nLimit = 10, eCategory } = req.body

      const dateQuery = getLastWeekDateRange()

      const query = { eCategory, $or: [{ eStatus: 'L' }, { eStatus: 'CMP', dWinDistributedAt: dateQuery.week }] }
      const data = await SeriesLeaderBoardModel.find(query, { _id: 1, sName: 1 }).sort({ dCreatedAt: -1 }).skip(+nOffset).limit(+nLimit).lean()

      // const data = await SeriesLeaderBoardModel.find({ eStatus: { $in: ['L'] }, eCategory }, { _id: 1, sName: 1 }).sort({ dCreatedAt: -1 }).skip(+nOffset).limit(+nLimit).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cseries), data })
    } catch (error) {
      catchError('SeriesLeaderBoard.list', error, req, res)
    }
  }

  async adminListId(req, res) {
    try {
      let { sportsType, sSearch, nLimit, nSkip } = req.query

      nLimit = parseInt(nLimit) || 10
      nSkip = parseInt(nSkip) || 0

      const findQuery = { eCategory: sportsType }

      if (sSearch) sSearch = defaultSearch(sSearch)
      if (sSearch) findQuery.sName = { $regex: new RegExp('^.*' + sSearch + '.*', 'i') }

      const nTotal = await SeriesLeaderBoardModel.countDocuments(findQuery)
      const aData = await SeriesLeaderBoardModel.find(findQuery, { _id: 1, sName: 1 }).skip(nSkip).limit(nLimit).lean()

      const data = { nTotal, aData }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cseries), data })
    } catch (error) {
      catchError('SeriesLeaderBoard.adminListId', error, req, res)
    }
  }

  async addSeriesPriceBreakup(req, res) {
    try {
      const { nRankFrom, nRankTo, nPrize, eRankType, sInfo, sImage } = req.body
      req.body = pick(req.body, ['nRankFrom', 'nRankTo', 'nPrize', 'eRankType', 'sInfo', 'sImage'])

      if ((eRankType === 'E') && !sInfo) { return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].ssinfo) }) }
      if ((eRankType === 'E') && (parseInt(nPrize) !== 0)) { return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].snprice) }) }

      if (nRankFrom && nRankTo && (parseInt(nRankFrom) > parseInt(nRankTo))) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].crankFrom).replace('#', messages[req.userLanguage].crankTo) }) }

      const seriesCategory = await SeriesLeaderBoardModel.findOne({ aSeriesCategory: { $elemMatch: { _id: ObjectId(req.params.id) } } }).lean()
      if (!seriesCategory) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseriesCategory) }) }

      let { aSeriesCategory } = seriesCategory
      aSeriesCategory = aSeriesCategory.find(({ _id }) => _id.toString() === req.params.id)
      if ((nRankFrom > aSeriesCategory.nMaxRank) || (nRankTo > aSeriesCategory.nMaxRank)) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].crankFrom).replace('#', messages[req.userLanguage].snMax) }) }

      let { aPrizeBreakup: seriesPrice, nTotalPayout } = aSeriesCategory
      if (seriesPrice) {
        const totalPay = seriesPrice.reduce((acc, pb) => (acc + (Number(pb.nPrize) * ((Number(pb.nRankTo) - Number(pb.nRankFrom)) + 1))), 0)
        if (totalPay + (nPrize * (nRankTo - nRankFrom + 1)) > nTotalPayout) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].stotalPay) }) }

        const priceExist = seriesPrice.find((pb) => {
          if ((pb.nRankFrom <= parseInt(nRankFrom)) && (pb.nRankTo >= parseInt(nRankFrom))) return true
          if ((pb.nRankFrom <= parseInt(nRankTo)) && (pb.nRankTo >= parseInt(nRankTo))) return true
        })
        if (priceExist) { return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cpriceBreakup) }) }
      }
      let aPrizeBreakup = {}
      if (eRankType === 'E' && sImage) {
        aPrizeBreakup = { nRankFrom, nRankTo, nPrize, eRankType, sInfo, sImage }
      } else {
        aPrizeBreakup = { nRankFrom, nRankTo, nPrize, eRankType, sInfo }
      }

      if (Array.isArray(seriesPrice)) { seriesPrice.push(aPrizeBreakup) } else { seriesPrice = [aPrizeBreakup] }

      seriesPrice.sort((a, b) => a.nRankFrom - b.nRankFrom)

      const data = await SeriesLeaderBoardModel.findOneAndUpdate({
        aSeriesCategory: { $elemMatch: { _id: ObjectId(req.params.id) } }
      }, { 'aSeriesCategory.$.aPrizeBreakup': seriesPrice, dUpdatedAt: Date.now() }, { new: true, runValidators: true }).lean()
      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseriesCategory) }) }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnewPriceBreakup), data })
    } catch (error) {
      catchError('SeriesLeaderBoard.addSeriesPriceBreakup', error, req, res)
    }
  }

  async listPriceBreakup(req, res) {
    try {
      let data = await SeriesLeaderBoardModel.findOne({
        aSeriesCategory: { $elemMatch: { _id: ObjectId(req.params.id) } }
      }, { aSeriesCategory: 1, _id: 0 }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseries) })
      const aSeriesCategory = data.aSeriesCategory.find(({ _id }) => _id.toString() === req.params.id)
      data = aSeriesCategory.aPrizeBreakup

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpriceBreakup), data: data })
    } catch (error) {
      return catchError('SeriesLeaderBoard.listPriceBreakup', error, req, res)
    }
  }

  async getPriceBreakup(req, res) {
    try {
      let data = await SeriesLeaderBoardModel.findOne({
        aSeriesCategory: { $elemMatch: { _id: ObjectId(req.params.id) } }
      }, { aSeriesCategory: 1, _id: 0 }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseriesCategory) })
      const aSeriesCategory = data.aSeriesCategory.find(({ _id }) => _id.toString() === req.params.id)
      data = aSeriesCategory.aPrizeBreakup.find(({ _id }) => _id.toString() === req.params.pid)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpriceBreakup), data })
    } catch (error) {
      catchError('SeriesLeaderBoard.getPriceBreakup', error, req, res)
    }
  }

  async updatePriceBreakup(req, res) {
    try {
      const { nRankFrom, nRankTo, nPrize, eRankType, sInfo, sImage } = req.body

      if ((eRankType === 'E') && !sInfo) { return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.UnprocessableEntity, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].ssinfo) }) }
      if ((eRankType === 'E') && (parseInt(nPrize) !== 0)) { return res.status(status.UnprocessableEntity).jsonp({ status: jsonStatus.UnprocessableEntity, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].snprice) }) }

      if (nRankFrom && nRankTo && (parseInt(nRankFrom) > parseInt(nRankTo))) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].crankFrom).replace('#', messages[req.userLanguage].crankTo) }) }

      const seriesCategory = await SeriesLeaderBoardModel.findOne({ aSeriesCategory: { $elemMatch: { _id: ObjectId(req.params.id) } } })
      if (!seriesCategory) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseriesCategory) }) }

      let { aSeriesCategory } = seriesCategory
      aSeriesCategory = aSeriesCategory.find(({ _id }) => _id.toString() === req.params.id)
      if ((nRankFrom > aSeriesCategory.nMax) || (nRankTo > aSeriesCategory.nMax)) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].crankFrom).replace('#', messages[req.userLanguage].snMax) }) }

      const { aPrizeBreakup: seriesPrice, nTotalPayout } = aSeriesCategory
      const old = seriesPrice.find(({ _id }) => req.params.pid === _id.toString())

      if (seriesPrice) {
        const totalPay = seriesPrice.reduce((acc, pb) => (acc + (Number(pb.nPrize) * ((Number(pb.nRankTo) - Number(pb.nRankFrom)) + 1))), 0)
        const nOldPrize = old.nPrize * ((old.nRankTo - old.nRankFrom) + 1)
        if (totalPay + (nPrize * (nRankTo - nRankFrom + 1) - nOldPrize) > nTotalPayout) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].stotalPay) }) }

        const priceExist = seriesPrice.find((pb) => {
          if ((pb.nRankFrom <= parseInt(nRankFrom)) && (pb.nRankTo >= parseInt(nRankFrom)) && (pb._id.toString() !== req.params.pid.toString())) { return true }
          if ((pb.nRankFrom <= parseInt(nRankTo)) && (pb.nRankTo >= parseInt(nRankTo)) && (pb._id.toString() !== req.params.pid.toString())) { return true }
        })
        if (priceExist) { return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cpriceBreakup) }) }
      }

      seriesCategory.aSeriesCategory.map(({ _id }, j) => {
        if (_id.toString() === req.params.id) {
          seriesCategory.aSeriesCategory[j].aPrizeBreakup.map(({ _id }, i) => {
            if (_id.toString() === req.params.pid) {
              seriesCategory.aSeriesCategory[j].aPrizeBreakup[i].nRankFrom = nRankFrom
              seriesCategory.aSeriesCategory[j].aPrizeBreakup[i].nRankTo = nRankTo
              seriesCategory.aSeriesCategory[j].aPrizeBreakup[i].nPrize = nPrize
              seriesCategory.aSeriesCategory[j].aPrizeBreakup[i].eRankType = eRankType
              seriesCategory.aSeriesCategory[j].aPrizeBreakup[i].sInfo = sInfo
              if (eRankType === 'E' && sImage) {
                seriesCategory.aSeriesCategory[j].aPrizeBreakup[i].sImage = sImage
              }
            }
          })
        }
      })
      await seriesCategory.save()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cpriceBreakup), data: { nRankFrom, nRankTo, nPrize, eRankType, sInfo, sImage } })
    } catch (error) {
      catchError('SeriesLeaderBoard.updatePriceBreakup', error, req, res)
    }
  }

  async removePrizeBreakup(req, res) {
    try {
      const data = await SeriesLeaderBoardModel.findOneAndUpdate({ 'aSeriesCategory._id': ObjectId(req.params.id) }, { $pull: { 'aSeriesCategory.$.aPrizeBreakup': { _id: ObjectId(req.params.pid) } } }, { new: false, runValidators: true }).lean()
      if (!data) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpriceBreakup) }) }

      let { aSeriesCategory } = data
      aSeriesCategory = aSeriesCategory.find(({ _id }) => _id.toString() === req.params.id)

      const old = aSeriesCategory.aPrizeBreakup.find(p => p._id.toString() === req.params.pid)

      if (old && old.eRankType === 'E' && old.sImage) {
        const s3Params = {
          Bucket: S3_BUCKET_NAME,
          Key: old.sImage
        }
        await s3.deleteObject(s3Params)
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cpriceBreakup), data })
    } catch (error) {
      catchError('SeriesLeaderBoard.removePrizeBreakup', error, req, res)
    }
  }

  async addCategory(req, res) {
    try {
      const { iCategoryId } = req.body
      req.body = pick(req.body, ['sName', 'iCategoryId', 'sFirstPrize', 'nMaxRank', 'sContent', 'nTotalPayout'])

      let template = await SeriesLBCategoriesTemplateModel.findById(iCategoryId).lean()
      if (!template) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cTemplate) })

      template = pick(template, ['sName', 'eType', 'sInfo', 'sImage', 'sColumnText'])
      const data = await SeriesLeaderBoardModel.findByIdAndUpdate(req.params.id, { $push: { aSeriesCategory: { ...template, ...req.body } }, dUpdatedAt: Date.now() }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseries) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cseriesLeaderBoardCategory), data: data })
    } catch (error) {
      return catchError('SeriesLeaderBoard.addCategory', error, req, res)
    }
  }

  async getCategory(req, res) {
    try {
      const data = await SeriesLeaderBoardModel.findOne({ aSeriesCategory: { $elemMatch: { _id: ObjectId(req.params.id) } } }).lean()
      if (!data || !data.aSeriesCategory) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseries) })
      const aSeriesCategory = data.aSeriesCategory.find(({ _id }) => _id.toString() === req.params.id)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cseriesLeaderBoardCategory), data: aSeriesCategory })
    } catch (error) {
      catchError('SeriesLeaderBoard.getCategory', error, req, res)
    }
  }

  async listCategory(req, res) {
    try {
      const data = await SeriesLeaderBoardModel.findById(req.params.id, { aSeriesCategory: 1, _id: 0 }).lean()

      const aSeriesCategory = data && data.aSeriesCategory ? data.aSeriesCategory.filter(category => category.eStatus !== 'N') : []

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cseriesLeaderBoardCategory), data: aSeriesCategory })
    } catch (error) {
      catchError('SeriesLeaderBoard.listCategory', error, req, res)
    }
  }

  async updateCategory(req, res) {
    try {
      const { sFirstPrize, nMaxRank, sContent, nTotalPayout } = req.body
      req.body = pick(req.body, ['sFirstPrize', 'nMaxRank', 'sContent', 'nTotalPayout'])
      removenull(req.body)

      const updateObj = {
        'aSeriesCategory.$.sFirstPrize': sFirstPrize,
        'aSeriesCategory.$.sContent': sContent,
        'aSeriesCategory.$.nMaxRank': nMaxRank,
        'aSeriesCategory.$.nTotalPayout': nTotalPayout
      }
      const data = await SeriesLeaderBoardModel.findOneAndUpdate({
        aSeriesCategory: { $elemMatch: { _id: ObjectId(req.params.id) } }
      }, updateObj, { new: true, runValidators: true }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseriesLeaderBoardCategory) })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cseriesLeaderBoardCategory), data })
    } catch (error) {
      catchError('SeriesLeaderBoard.updateCategory', error, req, res)
    }
  }

  async removeCategory(req, res) {
    try {
      const series = await SeriesLeaderBoardModel.findById(req.params.id)
      if (!series) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseries) })

      if (series.aSeriesCategory) {
        const category = series.aSeriesCategory.find((category) => (category._id.toString() === req.body.iCategoryId.toString()) && (!category.bWinningDone))
        if (!category) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].no_series_category_remove })

        await SeriesLeaderBoardModel.updateOne({ _id: ObjectId(req.params.id), aSeriesCategory: { $elemMatch: { _id: ObjectId(req.body.iCategoryId) } } }, { $set: { 'aSeriesCategory.$.eStatus': 'N' } })
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].cseriesLeaderBoardCategory) })
    } catch (error) {
      catchError('SeriesLeaderBoard.removeCategory', error, req, res)
    }
  }

  // List of series category
  async userListCategory(req, res) {
    try {
      let data = await SeriesLeaderBoardModel.findById(req.params.id, { aSeriesCategory: 1, sContent: 1, _id: 0 }).lean()
      data = data && data.aSeriesCategory ? data.aSeriesCategory.filter(category => category.eStatus !== 'N') : []

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cseriesLeaderBoardCategory), data })
    } catch (error) {
      catchError('SeriesLeaderBoard.userListCategory', error, req, res)
    }
  }

  async getSignedUrlCategory(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await s3.signedUrl(sFileName, sContentType, config.s3SeriesCategories)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('SeriesLBCategoriesTemplate.getSignedUrlCategoryTemplate', error, req, res)
    }
  }

  // add series category template
  async addCategoryTemplate(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'sInfo', 'sImage', 'sColumnText', 'eType'])

      const data = await SeriesLBCategoriesTemplateModel.create({ ...req.body })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cseriesLBCategoriesTemplates), data: data })
    } catch (error) {
      return catchError('SeriesLBCategoriesTemplate.addCategoryTemplate', error, req, res)
    }
  }

  async listCategoryTemplate(req, res) {
    try {
      const data = await SeriesLBCategoriesTemplateModel.find().lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cseriesLBCategoriesTemplates), data: data })
    } catch (error) {
      return catchError('SeriesLBCategoriesTemplate.listCategoryTemplate', error, req, res)
    }
  }

  async getIdCategoryTemplate(req, res) {
    try {
      const data = await SeriesLBCategoriesTemplateModel.find({}, { _id: 1, sName: 1 }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cseriesLBCategoriesTemplates), data: data })
    } catch (error) {
      return catchError('SeriesLBCategoriesTemplate.getIdCategoryTemplate', error, req, res)
    }
  }

  async calculateRank(req, res) {
    try {
      let series = await SeriesLeaderBoardModel.findOne({ _id: ObjectId(req.params.id) }).lean()
      series = series ? series.aSeriesCategory.length ? series : null : null
      if (!series) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseries) })

      const matches = await MatchModel.find({ iSeriesId: series._id, eStatus: 'CMP' }, { _id: 1 }).lean()
      if (!matches.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseriesMatch) })

      const { aSeriesCategory: allSeriesCategory } = series
      const matchIds = matches.map(({ _id }) => ObjectId(_id))
      const matchLeague = await MatchLeagueModel.find({ iMatchId: { $in: matchIds }, bCancelled: false }, { _id: 1, nLoyaltyPoint: 1 }).lean()

      for (const aSeriesCategory of allSeriesCategory) {
        let query = {}
        if (aSeriesCategory.eStatus === 'N') continue
        if (aSeriesCategory.eType === 'CONTEST_JOIN') {
          query = { $sum: 1 }
        } else if (aSeriesCategory.eType === 'PRIZE_WON') {
          query = { $sum: '$nPrice' }
        } else if (aSeriesCategory.eType === 'LOYALTY_POINTS') {
          query = { $sum: '$matchleagues.nLoyaltyPoint' }
        }

        let userLeagues
        if (aSeriesCategory.eType === 'LOYALTY_POINTS') {
          const matchLeagueId = matchLeague.map(({ _id }) => _id.toString())

          userLeagues = await PassbookModel.findAll({
            attributes: [['iUserId', '_id'], [fn('sum', col('nLoyaltyPoint')), 'nUserScore']],
            group: 'iUserId',
            order: [[col('nUserScore'), 'desc']],
            where: { eTransactionType: 'Loyalty-Point', iMatchLeagueId: { [Op.in]: matchLeagueId } },
            limit: aSeriesCategory.nMaxRank,
            raw: true
          })
        } else {
          const matchLeagueId = matchLeague.map(({ _id }) => ObjectId(_id))

          userLeagues = await UserLeagueModel.aggregate([
            {
              $match: {
                iMatchLeagueId: { $in: matchLeagueId }
              }
            }, {
              $group: {
                _id: '$iUserId',
                nUserScore: query
              }
            }, {
              $sort: { nUserScore: -1 }
            }, {
              $limit: aSeriesCategory.nMaxRank
            }
          ]).allowDiskUse(bAllowDiskUse).exec()
        }

        if (userLeagues.length) {
          const [data] = await Promise.all([
            generateRank(userLeagues, aSeriesCategory, series._id),
            SeriesLBUserRankModel.deleteMany({ iCategoryId: aSeriesCategory._id })
          ])
          await SeriesLBUserRankModel.insertMany(data, { ordered: false })
        }
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].crankCalculate) })
    } catch (error) {
      return catchError('SeriesLBUserRank.userTeamList', error, req, res)
    }
  }

  async calculateRankV2(req, res) {
    try {
      const { _id: iAdminId } = req.admin
      let series = await SeriesLeaderBoardModel.findOne({ _id: ObjectId(req.params.id) }).lean()
      series = series ? series.aSeriesCategory.length ? series : null : null
      if (!series) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseries) })

      const matches = await MatchModel.find({ iSeriesId: series._id, eStatus: 'CMP' }, { _id: 1 }).lean()
      if (!matches.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseriesMatch) })

      const { aSeriesCategory: allSeriesCategory } = series
      const matchIds = matches.map(({ _id }) => ObjectId(_id))
      const matchLeague = await MatchLeagueModel.find({ iMatchId: { $in: matchIds }, bCancelled: false, bPrivateLeague: false }, { _id: 1, nLoyaltyPoint: 1 }).lean()
      console.log('=====:SLB Rank Calculation Started:=====')
      for (const aSeriesCategory of allSeriesCategory) {
        // let query = {}
        // if (aSeriesCategory.eType === 'CONTEST_JOIN') {
        //   query = { $sum: 1 }
        // } else if (aSeriesCategory.eType === 'PRIZE_WON') {
        //   query = { $sum: '$nPrice' }
        // } else if (aSeriesCategory.eType === 'LOYALTY_POINTS') {
        //   query = { $sum: '$matchleagues.nLoyaltyPoint' }
        // }

        let userLeagues
        if (aSeriesCategory.eStatus === 'N') continue
        if (aSeriesCategory.eType === 'LOYALTY_DEPOSIT_POINTS') {
          const matchLeagueId = matchLeague.map(({ _id }) => _id.toString())
          const oUserLoyalty = {}
          const proceedUsers = []
          let onlyLoyaltyPoints = []

          // Calculate total deposit entries , 2022-03-31T00:00:00.000Z, 2022-04-27T00:00:00.000Z
          const aUserDepositEntries = await PassbookModel.findAll({
            attributes: [['iUserId', '_id'], [fn('sum', col('nCash')), 'nUserScore']],
            group: 'iUserId',
            order: [[col('nUserScore'), 'desc']],
            where: { eTransactionType: 'Deposit', [Op.and]: [{ dCreatedAt: { [Op.gte]: new Date('2023-10-05T00:00:00.000Z') } }, { dCreatedAt: { [Op.lte]: new Date('2023-11-19T00:00:00.000Z') } }], eUserType: 'U' },
            raw: true
          })

          // Calculate total loyalty points
          const aUserLoyaltyPoints = await PassbookModel.findAll({
            attributes: [['iUserId', '_id'], [fn('sum', col('nLoyaltyPoint')), 'nUserScore']],
            group: 'iUserId',
            order: [[col('nUserScore'), 'desc']],
            where: { eTransactionType: 'Loyalty-Point', [Op.and]: [{ dCreatedAt: { [Op.gte]: new Date('2023-10-05T00:00:00.000Z') } }, { dCreatedAt: { [Op.lte]: new Date('2023-11-19T00:00:00.000Z') } }], iMatchLeagueId: { [Op.in]: matchLeagueId }, eUserType: 'U' },
            raw: true
          })

          // // make Object For loyalty point
          aUserLoyaltyPoints.forEach(e => {
            oUserLoyalty[e._id] = e.nUserScore
          })
          // // Calculate deposit score
          aUserDepositEntries.forEach(e => {
            if (oUserLoyalty[e._id]) {
              e.nUserScore = oUserLoyalty[e._id] + (e.nUserScore * 0.1)
              proceedUsers.push(e._id)
            } else {
              e.nUserScore = (e.nUserScore * 0.1)
            }
          })
          // Calculate remaining loyalty score
          aUserLoyaltyPoints.forEach(e => {
            if (!proceedUsers.includes(e._id)) {
              onlyLoyaltyPoints.push({ _id: e._id, nUserScore: e.nUserScore })
            }
          })
          onlyLoyaltyPoints = [...onlyLoyaltyPoints, ...aUserDepositEntries]
          onlyLoyaltyPoints.sort((a, b) => b.nUserScore - a.nUserScore)
          userLeagues = [...onlyLoyaltyPoints].splice(0, aSeriesCategory.nMaxRank * 5)

          // // Map Loyalty points and deposit score
          // Map Loyalty points and deposit score
          // aUserDepositEntries.forEach(e => {
          //   if (oUserLoyalty[e._id]) {
          //     e.nUserScore = oUserLoyalty[e._id] + (e.nUserScore * 0.1)
          //   }
          // })
          // aUserDepositEntries.sort((a, b) => b.nUserScore - a.nUserScore)
          // userLeagues = [...aUserDepositEntries]
        } else if (aSeriesCategory.eType === 'LOYALTY_POINTS') {
          const matchLeagueId = matchLeague.map(({ _id }) => _id.toString())

          userLeagues = await PassbookModel.findAll({
            attributes: [['iUserId', '_id'], [fn('sum', col('nLoyaltyPoint')), 'nUserScore']],
            group: 'iUserId',
            order: [[col('nUserScore'), 'desc']],
            where: { eTransactionType: 'Loyalty-Point', iMatchLeagueId: { [Op.in]: matchLeagueId } },
            limit: aSeriesCategory.nMaxRank,
            raw: true
          })
        } else if (aSeriesCategory.eType === 'CONTEST_JOIN') {
          userLeagues = await UserLeagueModel.aggregate([
            { $match: { iMatchId: { $in: matchIds }, bCancelled: false, nPricePaid: { $gt: 0 } } },
            {
              $lookup: {
                from: 'matchleagues',
                localField: 'iMatchLeagueId',
                foreignField: '_id',
                as: 'matchleagues'
              }
            },
            { $match: { 'matchleagues.bPrivateLeague': false } },
            { $group: { _id: { iUserId: '$iUserId', iMatchId: '$iMatchId', iLeagueId: '$matchleagues.iLeagueId' } } },
            { $group: { _id: '$_id.iUserId', nUserScore: { $sum: 1 } } },
            { $sort: { nUserScore: -1 } },
            { $limit: aSeriesCategory.nMaxRank }
          ]).allowDiskUse(bAllowDiskUse)
        } else {
          const matchLeagueId = matchLeague.map(({ _id }) => ObjectId(_id))

          userLeagues = await UserLeagueModel.aggregate([
            {
              $match: {
                iMatchLeagueId: { $in: matchLeagueId }
              }
            }, {
              $group: {
                _id: '$iUserId',
                nUserScore: { $sum: '$nPrice' }
              }
            }, {
              $sort: { nUserScore: -1 }
            }, {
              $limit: aSeriesCategory.nMaxRank
            }
          ]).allowDiskUse(bAllowDiskUse).exec()
        }
        if (userLeagues.length) {
          const [data] = await Promise.all([
            generateRank(userLeagues, aSeriesCategory, series._id),
            SeriesLBUserRankModel.deleteMany({ iCategoryId: aSeriesCategory._id })
          ])
          await SeriesLBUserRankModel.insertMany(data, { ordered: false })
        }
        const logData = { eKey: 'SLB', iAdminId: ObjectId(iAdminId), sIP: getIp(req) }
        adminLogQueue.publish(logData)// changes Here
      }
      const logData = { eKey: 'SLB', iAdminId: ObjectId(iAdminId), sIP: getIp(req) }
      adminLogQueue.publish(logData)// changes Here
      console.log('=====: SLB Rank Calculation Completed:======')

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].crankCalculate) })
    } catch (error) {
      return catchError('SeriesLBUserRank.userTeamList', error, req, res)
    }
  }

  async getMyRank(req, res) {
    try {
      const user = await UserModel.findById(req.user._id).lean()
      if (!user) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].user) })

      let seriesCategory = await SeriesLeaderBoardModel.findOne({ aSeriesCategory: { $elemMatch: { _id: ObjectId(req.params.id) } } }).lean()
      seriesCategory = seriesCategory ? seriesCategory.aSeriesCategory.length ? seriesCategory : null : null
      if (!seriesCategory) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseriesCategory) })

      let { aSeriesCategory } = seriesCategory
      aSeriesCategory = aSeriesCategory.find((category) => category._id.toString() === req.params.id)

      const data = await SeriesLBUserRankModel.findOne({ iCategoryId: ObjectId(aSeriesCategory._id), iUserId: ObjectId(user._id) }, { sUsername: 0, sName: 0, sProPic: 0 }).populate('oUser', ['sName', 'sUsername', 'sProPic']).lean()

      let userRankData = {}
      if (data) {
        userRankData = { ...data }
        delete userRankData.oUser._id
      } else {
        userRankData = {
          sName: aSeriesCategory.sName,
          iSeriesId: seriesCategory._id,
          iCategoryId: req.params.id,
          oUser: {
            iUserId: user._id,
            sUsername: user.sUsername,
            sName: user.sName,
            sProPic: user.sProPic
          },
          nUserRank: 0,
          nUserScore: 0
        }
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cuserRank), data: userRankData })
    } catch (error) {
      return catchError('SeriesLBUserRank.getMyRank', error, req, res)
    }
  }

  async getAllRankV2(req, res) {
    try {
      let { nLimit, nOffset, isFullResponse } = req.query

      nLimit = parseInt(nLimit) || 200
      nOffset = parseInt(nOffset) || 0

      let seriesCategory = await SeriesLeaderBoardModel.findOne({ aSeriesCategory: { $elemMatch: { _id: ObjectId(req.params.id) } } }).lean()
      seriesCategory = seriesCategory ? seriesCategory.aSeriesCategory.length ? seriesCategory : null : null

      if (!seriesCategory) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cseriesCategory) })

      const series = await SeriesLeaderBoardModel.findOne({ _id: seriesCategory._id, eStatus: { $in: ['L', 'CMP'] } }).lean()
      if (!series) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].series_pending })

      const total = await SeriesLBUserRankModel.countDocuments({ iCategoryId: ObjectId(req.params.id) }, { sName: 0, sUsername: 0, sProPic: 0 })

      let userRankData = []
      if (req.admin) {
        let data
        if ([true, 'true'].includes(isFullResponse)) {
          data = await SeriesLBUserRankModel.find({ iCategoryId: ObjectId(req.params.id) }, { sName: 0, sProPic: 0 }).sort({ nUserRank: 1, sUsername: 1 }).populate('iUserId', ['sName', 'sUsername', 'sProPic', 'eType']).lean()
        } else {
          data = await SeriesLBUserRankModel.find({ iCategoryId: ObjectId(req.params.id) }, { sName: 0, sProPic: 0 }).sort({ nUserRank: 1, sUsername: 1 }).populate('iUserId', ['sName', 'sUsername', 'sProPic', 'eType']).skip(nOffset).limit(nLimit).lean()
        }
        userRankData = data.map(l => {
          const ml = { ...l, oUser: { ...l.iUserId, iUserId: l.iUserId._id } }
          delete ml.oUser._id
          delete ml.iUserId
          return ml
        })
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cuserRank), data: { total, data: userRankData } })
      } else {
        const data = await SeriesLBUserRankModel.find({ iCategoryId: ObjectId(req.params.id) }, { sName: 0, sProPic: 0 }).sort({ nUserRank: 1, sUsername: 1 }).populate('iUserId', ['sName', 'sUsername', 'sProPic']).skip(nOffset).limit(nLimit).lean()
        userRankData = data.map(l => {
          const ml = { ...l, oUser: { ...l.iUserId, iUserId: l.iUserId._id } }
          delete ml.oUser._id
          delete ml.iUserId
          return ml
        })
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cuserRank), data: userRankData })
      }
    } catch (error) {
      return catchError('SeriesLBUserRank.getAllRankV2', error, req, res)
    }
  }

  async seriesCategoryPrizeDistribution(req, res) {
    try {
      const data = await SeriesLeaderBoardModel.findOne({
        _id: ObjectId(req.params.id),
        eStatus: 'CMP'
      }, { aSeriesCategory: 1, _id: 1, bPriceDone: 1 }).lean()
      if (!data || data.bPriceDone) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].cseriesAlreadyDistributeAndNotExist.replace('##', messages[req.userLanguage].cseries) })

      if (data.aSeriesCategory.length) {
        for (const seriesCategory of data.aSeriesCategory) {
          if (!seriesCategory.bPrizeDone && seriesCategory.eStatus !== 'N') {
            const sCategory = { aPrizeBreakup: seriesCategory.aPrizeBreakup, _id: data._id, iCategoryId: seriesCategory._id }
            await queuePush('MatchSeriesRank', sCategory)
          }
        }
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cprizeDistribution) })
    } catch (error) {
      catchError('SeriesLBUserRank.seriesCategoryPrizeDistribution', error, req, res)
    }
  }

  async winDistributionBySeriesCategory(req, res) {
    try {
      const data = await SeriesLeaderBoardModel.findOne({
        _id: ObjectId(req.params.id),
        eStatus: 'CMP'
      }, { aSeriesCategory: 1, _id: 1, sName: 1, eCategory: 1, bPriceDone: 1 }).lean()
      if (!data || data.bPriceDone) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].cseriesAlreadyDistributeAndNotExist.replace('##', messages[req.userLanguage].cseries) })

      if (data.aSeriesCategory.length) {
        for (const seriesCategory of data.aSeriesCategory) {
          if (!seriesCategory.bWinningDone && seriesCategory.eStatus !== 'N') {
            const sCategory = { _id: data._id, iCategoryId: seriesCategory._id, sName: data.sName, eCategory: data.eCategory }
            await queuePush('MatchSeriesWin', sCategory)
          }
        }
        await SeriesLeaderBoardModel.updateOne({ _id: ObjectId(data._id) }, { dWinDistributedAt: new Date() })
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].winPrizeDistribution) })
    } catch (error) {
      catchError('SeriesLBUserRank.winDistributionBySeriesCategory', error, req, res)
    }
  }

  async getFinalSeriesCount(req, res) {
    try {
      const series = await SeriesLeaderBoardModel.findById(req.params.id).lean()
      if (!series) { return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cseries) }) }
      series.aSeriesCategory = series.aSeriesCategory.filter(category => category.eStatus !== 'N') // N: Deleted category need to be avoid

      const result = await Promise.all([
        SeriesLBUserRankModel.countDocuments({ iSeriesId: ObjectId(req.params.id) }),
        SeriesLBUserRankModel.countDocuments({ iSeriesId: ObjectId(req.params.id), bPrizeCalculated: true }),
        SeriesLBUserRankModel.countDocuments({ iSeriesId: ObjectId(req.params.id), bWinDistribution: true })
      ])
      const winDistributedCategory = series.aSeriesCategory.filter(category => category.bWinningDone === true)
      const prizeCalculatedCategory = series.aSeriesCategory.filter(category => category.bPrizeDone === true)
      const data = {
        nRankCalculated: result[0], nPrizeCalculated: result[1], nWinDistributed: result[2], nSeriesCategoryCount: series.aSeriesCategory.length, nPrizeCalculatedCategory: prizeCalculatedCategory.length, nWinDistributedCategory: winDistributedCategory.length
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cseries), data })
    } catch (error) {

    }
  }
}

function getLastWeekDateRange () {
  const today = new Date()

  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())
  const weekEnd = new Date()

  const dates = {
    week: {
      $gte: new Date(weekStart.setHours(0, 0, 0)).toJSON(),
      $lt: new Date(weekEnd.setHours(23, 59, 59)).toJSON()
    }
  }

  return dates
}

module.exports = new SeriesLeaderBoard()
