const router = require('express').Router()
const BannerStatisticServices = require('./services')
const { validateAdmin, isUserAuthenticated } = require('../../../middlewares/middleware')

router.get('/admin/banner/stats/:id/v2', validateAdmin('BANNER', 'R'), BannerStatisticServices.getV2)

router.post('/user/banner/log/:id/v1', isUserAuthenticated, BannerStatisticServices.log)

module.exports = router
