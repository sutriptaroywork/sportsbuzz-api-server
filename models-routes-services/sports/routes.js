const router = require('express').Router()
const sportServices = require('./services')
const validators = require('./validators')
const { validateAdmin, setLanguage } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

router.post('/admin/sport/v1', validators.adminAddSports, validateAdmin('SPORT', 'W'), sportServices.add)
router.get('/admin/sport/list/v1', validateAdmin('SPORT', 'R'), sportServices.list)
router.get('/admin/sport/:id/v1', validateAdmin('SPORT', 'R'), sportServices.get)
router.put('/admin/sport/:id/v1', validateAdmin('SPORT', 'W'), sportServices.update)

// active sports list can access both side user and admin
router.get('/admin/match/active-sports/v1', setLanguage, cacheRoute(60), sportServices.activeSports)

router.get('/user/match/active-sports/v2', setLanguage, cacheRoute(60), sportServices.activeSportsV2)

router.get('/user/match/active-sports/v3', setLanguage, cacheRoute(60), sportServices.activeSportsV3)

module.exports = router
