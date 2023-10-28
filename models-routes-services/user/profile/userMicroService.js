const axios = require('axios')

const config = require('../../../config/config')
const { messages, status } = require('../../../helper/api.responses')
const { handleCatchError } = require('../../../helper/utilities.services')

class UserMicroService {
  // User Related
  async getProfileDetailsV2(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_USER_PROFILE_SERVICE}/api/user/profile/v2`, {
        headers: { 'Content-Type': 'application/json', Language: 'en', user: JSON.stringify(req.user), userlanguage: req.userLanguage ? req.userLanguage : 'English' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      handleCatchError('UserProfileServices.getProfileDetailsV2', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  async getStatistic(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_USER_PROFILE_SERVICE}/api/user/profile-statistics/v1`, {
        headers: { 'Content-Type': 'application/json', Language: 'en', user: JSON.stringify(req.user), userlanguage: req.userLanguage ? req.userLanguage : 'English' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      handleCatchError('UserProfileServices.getStatistics', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  async getStatesList(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_USER_PROFILE_SERVICE}/api/user/profile/states/v1`, {
        headers: { 'Content-Type': 'application/json', Language: 'en', userlanguage: req.userLanguage ? req.userLanguage : 'English' },
        params: { ...req.query }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      handleCatchError('UserProfileServices.getStatesList', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  async getCitiesList(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_USER_PROFILE_SERVICE}/api/user/profile/cities/v1`, {
        headers: { 'Content-Type': 'application/json', Language: 'en', userlanguage: req.userLanguage ? req.userLanguage : 'English' },
        params: { ...req.query }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      handleCatchError('UserProfileServices.getStatesList', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  async updateProfile(req, res) {
    try {
      const response = await axios.put(`${config.SB11_BACKEND_MS_USER_PROFILE_SERVICE}/api/user/profile/v1`, { ...req.body }, {
        headers: { 'Content-Type': 'application/json', Language: 'en', user: JSON.stringify(req.user), userlanguage: req.userLanguage ? req.userLanguage : 'English' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      handleCatchError('UserProfileServices.updateProfile', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  // Admin Related
  async getAdminProfilesListV2(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_USER_PROFILE_SERVICE}/api/admin/profile/v2`, {
        headers: { 'Content-Type': 'application/json', Language: 'en', admin: JSON.stringify(req.admin), userlanguage: req.userLanguage ? req.userLanguage : 'English' },
        params: { ...req.query }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      handleCatchError('AdminProfileServices.getAdminProfilesListV2', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  async getAdminCount(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_USER_PROFILE_SERVICE}/api/admin/profile/counts/v1`, {
        headers: { 'Content-Type': 'application/json', Language: 'en', admin: JSON.stringify(req.admin), userlanguage: req.userLanguage ? req.userLanguage : 'English' },
        params: { ...req.query }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      handleCatchError('AdminProfileServices.getAdminCount', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  async adminRecommendation(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_USER_PROFILE_SERVICE}/api/admin/user/recommendation/v1`, {
        headers: { 'Content-Type': 'application/json', Language: 'en', userlanguage: req.userLanguage ? req.userLanguage : 'English' },
        params: { ...req.query }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      handleCatchError('AdminProfileServices.adminRecommendation', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  async adminGet(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_USER_PROFILE_SERVICE}/api/admin/profile/${req.params.id}/v1`, {
        headers: { 'Content-Type': 'application/json', Language: 'en', admin: JSON.stringify(req.admin), userlanguage: req.userLanguage ? req.userLanguage : 'English' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      handleCatchError('AdminProfileServices.adminGet', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  async adminUpdate(req, res) {
    try {
      const response = await axios.put(`${config.SB11_BACKEND_MS_USER_PROFILE_SERVICE}/api/admin/profile/${req.params.id}/v1`, { ...req.body }, {
        headers: { 'Content-Type': 'application/json', Language: 'en', admin: JSON.stringify(req.admin), userlanguage: req.userLanguage ? req.userLanguage : 'English' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      handleCatchError('AdminProfileServices.adminUpdate', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  async getAdminStatesList(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_USER_PROFILE_SERVICE}/api/admin/states/v1`, {
        headers: { 'Content-Type': 'application/json', Language: 'en', userlanguage: req.userLanguage ? req.userLanguage : 'English' },
        params: { ...req.query }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      handleCatchError('AdminProfileServices.getStatesList', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  async getCitiesListForAdmin(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_USER_PROFILE_SERVICE}/api/admin/city/v1`, {
        headers: { 'Content-Type': 'application/json', Language: 'en', userlanguage: req.userLanguage ? req.userLanguage : 'English' },
        params: { ...req.query }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      handleCatchError('AdminProfileServices.getCitiesList', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  async referredByUserList(req, res) {
    try {
      const response = await axios.get(`${config.SB11_BACKEND_MS_USER_PROFILE_SERVICE}/api/admin/referred-list/${req.params.id}/v1`, {
        headers: { 'Content-Type': 'application/json', Language: 'en', admin: JSON.stringify(req.admin), userlanguage: req.userLanguage ? req.userLanguage : 'English' },
        params: { ...req.query }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      handleCatchError('AdminProfileServices.referredByUserList', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }
}

module.exports = new UserMicroService()
