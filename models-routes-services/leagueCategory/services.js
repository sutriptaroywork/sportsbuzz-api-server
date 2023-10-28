const axios = require('axios')
const LeagueCategoryModel = require('./model')
const FilterCategoryModel = require('./filterCategory.model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const LeagueModel = require('../league/model')
const { catchError, pick, handleCatchError, removenull, getPaginationValues2, checkValidImageType, capitalizeString } = require('../../helper/utilities.services')
const config = require('../../config/config')
const s3 = require('../../helper/s3config')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId

class LeagueCategory {
  // To add leagueCategory
  async add(req, res) {
    try {
      const { sTitle } = req.body
      req.body = pick(req.body, ['sTitle', 'nPosition', 'sRemark', 'sImage'])

      const leagueExist = await LeagueCategoryModel.findOne({ sTitle }).lean()
      if (leagueExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].leagueCatName) })

      const data = await LeagueCategoryModel.create({ ...req.body })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnewLeagueCategory), data })
    } catch (error) {
      catchError('LeagueCategory.add', error, req, res)
    }
  }

  async addLeagueCategory(req, res) {
    try {
      const response = await axios.post(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league-category/v1`, {
        ...req.body
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.addLeagueCategory', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  // To update leagueCategory
  async update(req, res) {
    try {
      const { sTitle, sImage } = req.body
      req.body = pick(req.body, ['sTitle', 'nPosition', 'sRemark'])

      if (sTitle) {
        const leagueExist = await LeagueCategoryModel.findOne({ sTitle, _id: { $ne: req.params.id } }).lean()
        if (leagueExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].leagueCatName) })
      }

      const data = await LeagueCategoryModel.findByIdAndUpdate(req.params.id, { ...req.body, sImage, dUpdatedAt: Date.now() }, { new: true, runValidators: true }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].leagueCategory) })
      await LeagueModel.updateMany({ iLeagueCatId: ObjectId(data._id) }, { $set: { sLeagueCategory: data.sTitle } })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].leagueCategory), data })
    } catch (error) {
      catchError('LeagueCategory.update', error, req, res)
    }
  }

  async updateLeagueCategory(req, res) {
    try {
      const leagueCategoryId = req.params.id
      const response = await axios.put(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league-category/${leagueCategoryId}/v1`, {
        ...req.body
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.updateLeagueCategory', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  // To get List of leagueCategory with pagination, sorting and searching
  async list(req, res) {
    try {
      const { start, limit, sorting, search } = getPaginationValues2(req.query)
      const query = search ? { sTitle: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      const results = await LeagueCategoryModel.find(query, {
        sTitle: 1,
        nPosition: 1,
        sRemark: 1,
        dCreatedAt: 1,
        sKey: 1,
        sImage: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const total = await LeagueCategoryModel.countDocuments({ ...query })

      const data = [{ total, results }]
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].leagueCategory), data })
    } catch (error) {
      return catchError('LeagueCategory.list', error, req, res)
    }
  }

  async getLeagueCategoryListV1(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league-category/list/v1`, {
        params :{
          ...req.query
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (error) {
      handleCatchError(error, 'LeagueService.getLeagueCategoryListV1', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  // To get signedUrl for league category image
  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await s3.signedUrl(sFileName, sContentType, config.s3LeagueCategories)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('LeagueCategory.getSignedUrl', error, req, res)
    }
  }

  async getS3SignedUrl (req, res) {
    try {
      const response = await axios.post(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league-category/pre-signed-url/v1`, {
        ...req.body
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.getS3SignedUrl', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  // To get details of single leagueCategory by _id
  async get(req, res) {
    try {
      const data = await LeagueCategoryModel.findById(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].leagueCategory) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].leagueCategory), data })
    } catch (error) {
      catchError('LeagueCategory.get', error, req, res)
    }
  }

  async getLeagueCategoryById(req, res) {
    try {
      const userId = req.params.id
      const response = await axios.get(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league-category/${userId}/v1`, {
        params :{
          ...req.params
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
    } catch (error) {
      handleCatchError(error, 'LeagueService.getLeagueCategoryById', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  // To get List of leagueCategory sTitle and _id field
  async categoryList(req, res) {
    try {
      const data = await LeagueCategoryModel.find({}, { sTitle: 1 }).lean()
      // Will capitalize first letter of each word of category title
      data.map(obj => {
        obj.sTitle = capitalizeString(obj.sTitle)
        return obj
      })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].leagueCategory), data })
    } catch (error) {
      catchError('LeagueCategory.categoryList', error, req, res)
    }
  }

  async getCategoryList(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league-category/v1`, {
        params :{
          ...req.query
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.getCategoryList', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  async removeLeagueCategory(req, res) {
    try {
      const isHiddenLeague = await LeagueCategoryModel.findOne({ _id: ObjectId(req.params.id), sKey: 'hiddenLeague' }, { _id: 1 }).lean()
      if (isHiddenLeague) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].hidden_league_cat_delete_err })

      const data = await LeagueCategoryModel.findByIdAndDelete(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].leagueCategory) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].leagueCategory), data })
    } catch (error) {
      catchError('LeagueCategory.removeLeagueCategory', error, req, res)
    }
  }

  async deleteLeagueCategory(req, res) {
    try {
      const leagueCategoryId = req.params.id
      const response = await axios.delete(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/league-category/${leagueCategoryId}/v1`, {
        params: {
          ...req.params
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.deleteLeagueCategory', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  async addFilterCategory(req, res) {
    try {
      const { sTitle } = req.body
      req.body = pick(req.body, ['sTitle', 'sRemark'])

      const leagueExist = await FilterCategoryModel.findOne({ sTitle }).lean()
      if (leagueExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].leagueFilterName) })

      const data = await FilterCategoryModel.create({ ...req.body })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnewFilterCategory), data })
    } catch (error) {
      catchError('LeagueCategory.addFilterCategory', error, req, res)
    }
  }

  async createFilterCategory(req, res) {
    try {
      const response = await axios.post(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/filter-category/v1`, {
        ...req.body
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.createFilterCategory', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  async updateFilterCategory(req, res) {
    try {
      const { sTitle } = req.body
      req.body = pick(req.body, ['sTitle', 'sRemark'])
      removenull(req.body)

      if (sTitle) {
        const leagueExist = await FilterCategoryModel.findOne({ sTitle, _id: { $ne: req.params.id } }).lean()
        if (leagueExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].leagueFilterName) })
      }
      const data = await FilterCategoryModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].filterCategory) })
      await LeagueModel.updateMany({ iFilterCatId: ObjectId(data._id) }, { $set: { sFilterCategory: data.sTitle } })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].filterCategory), data })
    } catch (error) {
      catchError('LeagueCategory.updateFilterCategory', error, req, res)
    }
  }

  async editFilterCategory(req, res) {
    try {
      const filterCategoryId = req.params.id
      const response = await axios.put(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/filter-category/${filterCategoryId}/v1`, {
        ...req.body
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.editFilterCategory', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  async listFilterCategory(req, res) {
    try {
      const { start, limit, sorting, search } = getPaginationValues2(req.query)
      const query = search ? { sTitle: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      const results = await FilterCategoryModel.find(query, {
        sTitle: 1,
        sRemark: 1,
        dCreatedAt: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const total = await FilterCategoryModel.countDocuments({ ...query })

      const data = [{ total, results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].filterCategory), data })
    } catch (error) {
      return catchError('LeagueCategory.listFilterCategory', error, req, res)
    }
  }

  async getFilterCategoryListV1(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/filter-category/list/v1`, {
        params :{
          ...req.query
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
    } catch (error) {
      handleCatchError(error, 'LeagueService.getFilterCategoryListV1', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }


  async getFilterCategory(req, res) {
    try {
      const data = await FilterCategoryModel.findById(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].filterCategory) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].filterCategory), data })
    } catch (error) {
      catchError('LeagueCategory.getFilterCategory', error, req, res)
    }
  }

  async getFilterCategoryById(req, res) {
    try {
      const userId = req.params.id
      const response = await axios.get(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/filter-category/${userId}/v1`, {
        params :{
          ...req.params
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
    } catch (error) {
      handleCatchError(error, 'LeagueService.getFilterCategoryById', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  async FilterCategoryList(req, res) {
    try {
      const data = await FilterCategoryModel.find({}, { sTitle: 1 }).lean()
      // Will capitalize first letter of each word of category title
      data.map(obj => {
        obj.sTitle = capitalizeString(obj.sTitle)
        return obj
      })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].filterCategory), data })
    } catch (error) {
      catchError('LeagueCategory.FilterCategoryList', error, req, res)
    }
  }

  async getFilterCategoryV1(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/filter-category/v1`, {
        params :{
          ...req.query,
          ...req.params
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.getFilterCategoryV1', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }

  async removeFilterCategory(req, res) {
    try {
      const data = await FilterCategoryModel.findByIdAndDelete(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].filterCategory) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].filterCategory), data })
    } catch (error) {
      catchError('LeagueCategory.removeFilterCategory', error, req, res)
    }
  }

  async deleteFilterCategory(req, res) {
    try {
      const filterCategoryId = req.params.id
      const response = await axios.delete(`${config.SB11_BACKEND_MS_LEAGUE_SERVICE}/api/admin/filter-category/${filterCategoryId}/v1`, {
        params: {
          ...req.params
        }
      }, {
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization, Language: 'en' }
      })

      return res.status(status.OK).jsonp(response.data)
      
    } catch (error) {
      handleCatchError(error, 'LeagueService.editFilterCategory', req, res)
      return res.status(error?.response?.status || status.InternalServerError).jsonp({
        status: error?.response?.status || status.InternalServerError,
        message: error?.response?.data?.error || messages[req.userLanguage].error})
    }
  }
}

module.exports = new LeagueCategory()
