const router = require('express').Router()
const fantasyPostServices = require('./services')
const { cacheRoute } = require('../../../helper/redis')
const { validateAdmin } = require('../../../middlewares/middleware')

// 5 mins. cache for user
router.get('/user/predictions/:id/v1', cacheRoute(60 * 5), fantasyPostServices.get)

// admin
router.get('/admin/predictions/:id/v1', validateAdmin('MATCH', 'R'), fantasyPostServices.get)

module.exports = router
