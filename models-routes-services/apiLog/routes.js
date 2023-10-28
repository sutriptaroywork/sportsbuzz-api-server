const router = require('express').Router()
const apiLogServices = require('./service')
const { validateAdmin, isAdminAuthenticated, validate } = require('../../middlewares/middleware')
const validators = require('./validators')
const logsMicroService = require('../logsMicroservice/logsMs')

router.get('/admin/api-logs/list/:id/v1', validators.list, validateAdmin('MATCH', 'R'), logsMicroService.getApiLogs)
router.get('/admin/api-logs/:id/v1', validateAdmin('MATCH', 'R'), logsMicroService.getApiLog)
router.get('/admin/pd-logs/:id/v1', validateAdmin('MATCHLEAGUE', 'R'), apiLogServices.getMatchLeagueLogs)
router.get('/admin/transaction-logs/:id/v1', validators.list, validate, isAdminAuthenticated, logsMicroService.listTransactionLog)

module.exports = router
