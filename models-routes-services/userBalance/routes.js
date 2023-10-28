const router = require('express').Router()
const balanceServices = require('./services')
const { validateAdmin } = require('../../middlewares/middleware')

router.get('/admin/balance/:id/v1', validateAdmin('BALANCE', 'R'), balanceServices.adminGet)

module.exports = router
