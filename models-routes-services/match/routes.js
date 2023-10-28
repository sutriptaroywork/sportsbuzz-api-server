const router = require('express').Router()
const matchServices = require('./services')
const matchLeagueServices = require('../matchLeague/services')
const validators = require('./validators')
const { validateAdmin, setLanguage, validate } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')
const logMicroService = require('../logsMicroservice/logsMs')

router.get('/user/match/list/v1', validators.upcomingMatchList, setLanguage, cacheRoute(10), matchServices.upcomingMatchList)
router.get('/user/match/list/v2', validators.upcomingMatchList, setLanguage, cacheRoute(10), matchServices.upcomingMatchListV1) // Special Matches changes
router.get('/user/match/stream-button/v1', setLanguage, cacheRoute(20), matchServices.matchStreamButton)
router.get('/user/match/stream-list/:type/v1', validators.matchStreamList, setLanguage, cacheRoute(30), matchServices.matchStreamList)
router.get('/user/match/:id/v1', validators.userGetMatch, validate, setLanguage, cacheRoute(5), matchServices.getMatchInfo)

// admin
router.get('/admin/match/list/v1', validators.adminMatchList, validateAdmin('MATCH', 'R'), matchServices.list)
router.get('/admin/match/counts/v1', validators.adminMatchCount, validateAdmin('MATCH', 'R'), matchServices.getCounts)
router.get('/admin/match/full-list/v1', validators.fullList, validateAdmin('MATCH', 'R'), matchServices.fullList)
router.get('/admin/match/:id/v1', validators.adminGetMatch, validateAdmin('MATCH', 'R'), matchServices.get)
router.post('/admin/match/v1', validators.adminAddMatch, validateAdmin('MATCH', 'W'), matchServices.add)
router.put('/admin/match/:id/v1', validators.adminUpdateMatch, validateAdmin('MATCH', 'W'), matchServices.update.bind(matchLeagueServices))
router.put('/admin/match/lineups-out/:id/v1', validators.adminLineupsOut, validateAdmin('MATCH', 'W'), matchServices.lineupsOutUpdate)
router.post('/admin/match/cricket/v1', validators.adminFetchMatches, validateAdmin('MATCH', 'W'), matchServices.fetchCricket)
router.post('/admin/match/baseball/v1', validateAdmin('MATCH', 'W'), matchServices.fetchBaseball)
router.post('/admin/match/football/v1', validators.adminFetchMatches, validateAdmin('MATCH', 'W'), matchServices.fetchFootball)
router.post('/admin/match/basketball/v1', validators.adminFetchMatches, validateAdmin('MATCH', 'W'), matchServices.fetchBasketball)
router.post('/admin/match/kabaddi/v1', validateAdmin('MATCH', 'W'), matchServices.fetchKabaddi)
router.post('/admin/match/merge/v1', validators.adminMergeMatches, validateAdmin('MATCH', 'W'), matchServices.mergeMatch)
router.post('/admin/match/refresh/:id/v1', validators.adminRefreshMatch, validateAdmin('MATCH', 'W'), matchServices.refreshMatchData)
router.get('/admin/match/logs/:id/v1', validators.adminLogsMatch, validateAdmin('MATCH', 'R'), logMicroService.getAdminMatchLogs)//service redirected to LOGS_MS

module.exports = router
