const axios = require('axios')

const config = require('../../config/config')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { handleCatchError } = require('../../helper/utilities.services')

class LogsMicroService {
    async getAdminLogs(req, res) {
        try {
            const { query = {} } = req;
            const response = await axios.get(
                `${config.SB11_BACKEND_MS_LOG_SERVICE}/api/admin/sub-admin-logs/v1`, {
                headers: { 'Content-Type': 'application/json' }, data: { ...query }
            })
            return res.status(status.OK).jsonp(response.data)
        } catch (err) {
            handleCatchError('LogsMicroService.getAdminLogs', err, req, res)
            return res.status(err?.response?.status || status.InternalServerError).jsonp({
                status: err?.response?.status || status.InternalServerError,
                message: err?.response?.data?.error || messages[req.userLanguage].error
            })
        }
    }

    async getAdminLog(req, res) {
        try {
            const response = await axios.get(
                `${config.SB11_BACKEND_MS_LOG_SERVICE}/api/admin/sub-admin-logs/${req.params.id}/v1`, {
                headers: { 'Content-Type': 'application/json' }
            })
            return res.status(status.OK).jsonp(response.data)
        } catch (err) {
            handleCatchError('LogsMicroService.getAdminLog', err, req, res)
            return res.status(err?.response?.status || status.InternalServerError).jsonp({
                status: err?.response?.status || status.InternalServerError,
                message: err?.response?.data?.error || messages[req.userLanguage].error
            })
        }
    }

    async getAdminMatchLogs(req, res) {
        try {

            const { query = {} } = req;
            const response = await axios.get(
                `${config.SB11_BACKEND_MS_LOG_SERVICE}/api/admin/match/logs/${req.params.id}/v1`, {
                headers: { 'Content-Type': 'application/json' }, data: { ...query }
            })
            return res.status(status.OK).jsonp(response.data)
        } catch (err) {
            handleCatchError('LogsMicroService.getAdminMatchLogs', err, req, res)
            return res.status(err?.response?.status || status.InternalServerError).jsonp({
                status: err?.response?.status || status.InternalServerError,
                message: err?.response?.data?.error || messages[req.userLanguage].error
            })
        }
    }

    async getApiLogs(req, res) {
        try {
            const { query = {} } = req
            const response = await axios.get(
                `${config.SB11_BACKEND_MS_LOG_SERVICE}/api/admin/api-logs/list/${req.params.id}/v1`, {
                headers: { 'Content-Type': 'application/json' }, data: { ...query }
            })
            return res.status(status.OK).jsonp(response.data)
        } catch (err) {
            handleCatchError('LogsMicroService.getApiLogs', err, req, res)
            return res.status(err?.response?.status || status.InternalServerError).jsonp({
                status: err?.response?.status || status.InternalServerError,
                message: err?.response?.data?.error || messages[req.userLanguage].error
            })
        }
    }

    async getApiLog(req, res) {
        try {
            const response = await axios.get(
                `${config.SB11_BACKEND_MS_LOG_SERVICE}/api/admin/api-logs/${req.params.id}/v1`, {
                headers: { 'Content-Type': 'application/json' }
            })
            return res.status(status.OK).jsonp(response.data)
        } catch (err) {
            handleCatchError('LogsMicroService.getApiLog', err, req, res)
            return res.status(err?.response?.status || status.InternalServerError).jsonp({
                status: err?.response?.status || status.InternalServerError,
                message: err?.response?.data?.error || messages[req.userLanguage].error
            })
        }
    }

    async getAdminLeagueLogs(req, res) {
        try {

            const { query = {} } = req;
            const response = await axios.get(
                `${config.SB11_BACKEND_MS_LOG_SERVICE}/api/admin/league/logs/${req.params.id}/v1`, {
                headers: { 'Content-Type': 'application/json' }, data: { ...query }
            })
            return res.status(status.OK).jsonp(response.data)
        } catch (err) {
            handleCatchError('LogsMicroService.getAdminLeagueLogs', err, req, res)
            return res.status(err?.response?.status || status.InternalServerError).jsonp({
                status: err?.response?.status || status.InternalServerError,
                message: err?.response?.data?.error || messages[req.userLanguage].error
            })
        }
    }

    async listTransactionLog(req, res) {
        try {
            console.log("fetching transaction log")
            const { query = {} } = req
            const response = await axios.get(
                `${config.SB11_BACKEND_MS_LOG_SERVICE}/api/admin/transaction-logs/${req.params.id}/v1`, {
                headers: { 'Content-Type': 'application/json' }, data: { ...query }
            })
            return res.status(status.OK).jsonp(response.data)
        } catch (err) {
            handleCatchError('LogsMicroService.listTransactionLogs', err, req, res)
            return res.status(err?.response?.status || status.InternalServerError).jsonp({
                status: err?.response?.status || status.InternalServerError,
                message: err?.response?.data?.error || messages[req.userLanguage].error
            })
        }
    }
}

module.exports = new LogsMicroService()