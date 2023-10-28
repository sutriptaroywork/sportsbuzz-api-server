const router = require('express').Router()
const matchLeagueServices = require('./services')
const validators = require('./validators')
const { validateAdmin, setLanguage, isAdminAuthenticated, isUserAuthenticated } = require('../../middlewares/middleware')
const { cacheRoute, cacheRouteLeague } = require('../../helper/redis')

router.get('/user/match-league/:id/list/v2', isUserAuthenticated, cacheRouteLeague(2), matchLeagueServices.upComingLeagueListV2)

router.get('/user/match-league/:id/v1', isUserAuthenticated, setLanguage, cacheRoute(5), matchLeagueServices.leagueInfo)

// admin

router.post('/admin/match-league/v1', validators.adminAddMatchLeague, validateAdmin('MATCHLEAGUE', 'W'), matchLeagueServices.add)
router.post('/admin/match-league/reset-spot/:id/v1', validateAdmin('MATCHLEAGUE', 'W'), matchLeagueServices.resetRedisJoinCount)

router.get('/admin/match-league/:id/v1', validateAdmin('MATCHLEAGUE', 'R'), matchLeagueServices.get)
router.get('/admin/single-match-league/:id/v1', validateAdmin('MATCHLEAGUE', 'R'), matchLeagueServices.getSingleLeague)
router.get('/admin/upcoming-match-league/:id/v1', validateAdmin('MATCHLEAGUE', 'R'), matchLeagueServices.getUpcomingLeague)

router.get('/admin/match-league/:id/cashback-details/v2', validateAdmin('MATCHLEAGUE', 'R'), matchLeagueServices.cashbackDetailsV2)

router.get('/admin/check-fair-play/:id/v1', validateAdmin('MATCHLEAGUE', 'W'), matchLeagueServices.checkFairPlayDetails)

router.get('/admin/final-league-count/:id/v1', isAdminAuthenticated, matchLeagueServices.getFinalLeagueCount)

router.get('/admin/match-league/:id/list/v1', validators.matchleagueList, validateAdmin('MATCHLEAGUE', 'R'), matchLeagueServices.list)
router.put('/admin/match-league/:id/league/v1', validators.adminUpdateLeague, validateAdmin('MATCHLEAGUE', 'W'), matchLeagueServices.updateLeague) // update league detail in matchleague
router.get('/admin/match-leagues-report/v1', validators.adminMatchLeagueReports, validateAdmin('MATCHLEAGUE', 'R'), matchLeagueServices.leaguesReport)

router.get('/admin/match-league/:id/report/v1', validateAdmin('MATCHLEAGUE', 'R'), matchLeagueServices.leagueReport)
router.get('/admin/match-league/:id/report/v2', validateAdmin('MATCHLEAGUE', 'R'), matchLeagueServices.leagueReportV2)

router.get('/admin/match-league/:id/get-process-count/v1', validateAdmin('MATCHLEAGUE', 'R'), matchLeagueServices.getProcessedCount)

router.put('/admin/match-league/:id/cancel/v1', validateAdmin('MATCHLEAGUE', 'W'), matchLeagueServices.cancelMatchLeague.bind(matchLeagueServices))
router.put('/admin/match-league/bot-create/:id/v1', validators.adminBotCreate, validateAdmin('MATCHLEAGUE', 'W'), matchLeagueServices.botCreateUpdate)

router.get('/admin/match-league/:id/promo-usage/v1', validators.cashbackDetailsV2, validateAdmin('MATCHLEAGUE', 'R'), matchLeagueServices.getPromoUsage)

module.exports = router
