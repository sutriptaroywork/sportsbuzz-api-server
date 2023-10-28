const router = require('express').Router()
const PromocodeStatisticServices = require('./services')
const { validateAdmin } = require('../../../middlewares/middleware')
const validators = require('../validators')

router.get('/admin/promocode/stats/:id/v2', validators.list, validateAdmin('PROMO', 'R'), PromocodeStatisticServices.getV2)

module.exports = router
