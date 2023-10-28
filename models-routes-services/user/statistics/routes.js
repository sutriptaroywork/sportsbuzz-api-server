const router = require('express').Router()
const userAuthServices = require('./services')
const { validateAdmin, setLanguage } = require('../../../middlewares/middleware')
const { cacheRoute } = require('../../../helper/redis')

router.get('/admin/statistics/:id/v1', validateAdmin('STATISTICS', 'R'), userAuthServices.get)
router.post('/admin/leadership-board/v2', validateAdmin('LEADERSHIP_BOARD', 'R'), userAuthServices.calculateLeaderShipboardV2)

router.get('/admin/leadership-board/v2', validateAdmin('LEADERSHIP_BOARD', 'R'), userAuthServices.getLeaderShipboardV2)

router.post('/admin/leadership-board-add-season/v1', validateAdmin('LEADERSHIP_BOARD', 'R'), userAuthServices.addSeasonInLeadership)

router.get('/admin/system-user/statistics/:id/v1', validateAdmin('SYSTEM_USERS', 'R'), userAuthServices.get)

router.get('/user/leadership-board/v2', setLanguage, cacheRoute(60), userAuthServices.getLeaderShipboardV2)

module.exports = router
