const router = require('express').Router()
const botLogsServices = require('./services')
const { validateAdmin } = require('../../middlewares/middleware')
const validators = require('./validators')

router.get('/admin/contest-bot-logs/:id/v1', validators.getContestLogs, validateAdmin('BOT_LOG', 'R'), botLogsServices.getContestLogs)

module.exports = router
