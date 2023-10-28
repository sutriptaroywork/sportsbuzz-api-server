const router = require('express').Router()
const scorecardServices = require('./services')
const { isUserAuthenticated, validateAdmin } = require('../../middlewares/middleware')
const { cacheRoute, cacheHTMLRoute } = require('../../helper/redis')

router.post('/admin/scorecard/cricket/:iMatchId/v1', validateAdmin('MATCH', 'W'), scorecardServices.updateCricketScorecard)
router.get('/admin/scorecard/:iMatchId/v1', validateAdmin('MATCH', 'R'), scorecardServices.fetchFullScorecardData)
router.get('/user/live-innings/:iMatchId/v1', isUserAuthenticated, scorecardServices.fetchLiveInningsData)
router.get('/user/live-innings/:iMatchId/v2', cacheRoute(120), scorecardServices.fetchLiveInningsData)

router.get('/admin/live-innings/:iMatchId/v1', validateAdmin('MATCH', 'R'), scorecardServices.fetchLiveInningsData)

router.get('/user/view-scorecard/:iMatchId/v1', cacheHTMLRoute(60), scorecardServices.viewScorecard)

module.exports = router
