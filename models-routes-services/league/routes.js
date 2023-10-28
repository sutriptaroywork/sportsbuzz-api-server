const router = require('express').Router()
const leagueServices = require('./services')
const validators = require('./validators')
const { validateAdmin } = require('../../middlewares/middleware')
const logMicroService = require('../logsMicroservice/logsMs')

router.post('/admin/league/v1', validators.adminAddLeague, validateAdmin('LEAGUE', 'W'), leagueServices.addLeague)
router.get('/admin/league/v1', validators.adminLeagueList, validateAdmin('LEAGUE', 'R'), leagueServices.getLeagueList)
router.get('/admin/league/full-list/v2', validators.fullLeagueListV2, validateAdmin('LEAGUE', 'R'), leagueServices.getFullLeagueListV2)
router.get('/admin/league/list/v1', validators.adminLeagueList, validateAdmin('LEAGUE', 'R'), leagueServices.getListV1)
router.get('/admin/league/:id/v1', validateAdmin('LEAGUE', 'R'), leagueServices.getLeagueById)
router.put('/admin/league/:id/v1', validators.adminUpdateLeague, validateAdmin('LEAGUE', 'W'), leagueServices.updateLeague)
router.delete('/admin/league/:id/v1', validateAdmin('LEAGUE', 'W'), leagueServices.deleteLeague)
router.post('/admin/league/copy/:id/v1', validators.adminCopyLeague, validateAdmin('LEAGUE', 'W'), leagueServices.duplicateLeague)
router.get('/admin/league/logs/:id/v1', validators.adminLogsLeague, validateAdmin('LEAGUE', 'R'), logMicroService.getAdminLeagueLogs)

router.post('/admin/league/pre-signed-url/v1', validators.adminGetLeagueSignedUrl, validateAdmin('LEAGUE', 'W'), leagueServices.getS3SignedUrl)
router.post('/admin/league/:id/prize-breakup/v1', validators.adminAddPrizeBreakup, validateAdmin('LEAGUE', 'W'), leagueServices.createPrizeBreakup)
router.get('/admin/league/:id/prize-breakup/v1', validateAdmin('LEAGUE', 'R'), leagueServices.getListPrizeBreakup)
router.get('/admin/league/:id/prize-breakup/:pid/v1', validateAdmin('LEAGUE', 'R'), leagueServices.getPrizeBreakupPid)
router.put('/admin/league/:id/prize-breakup/:pid/v1', validators.adminUpdatePrizeBreakup, validateAdmin('LEAGUE', 'W'), leagueServices.editPrizeBreakup)
router.delete('/admin/league/:id/prize-breakup/:pid/v1', validateAdmin('LEAGUE', 'W'), leagueServices.deletePrizeBreakup)

module.exports = router
