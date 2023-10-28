const router = require('express').Router()
const userLeagueServices = require('./services')
const validators = require('./validators')
const { validateAdmin, isUserAuthenticated, isBlockedByAdmin } = require('../../middlewares/middleware')

router.post('/user/user-league/join-league/v3', validators.userJoinLeagueV3, isUserAuthenticated, isBlockedByAdmin, userLeagueServices.addV4)

router.get('/user/user-league/join/:id/v1', isUserAuthenticated, userLeagueServices.userJoinLeagueIdList)
router.get('/user/user-league/join-details/:id/v1', isUserAuthenticated, userLeagueServices.joinDetailsInSingleLeague)

router.get('/user/user-league/join-list/:id/v3', isUserAuthenticated, userLeagueServices.userJoinLeagueListV3)

router.put('/user/user-league/switch-team/:id/v1', validators.switchUserTeam, isUserAuthenticated, userLeagueServices.switchUserTeam)

// router.post('/user/user-league/create-userleague/v1', validators.userJoinLeagueV3, isUserAuthenticated, userLeagueServices.createUserLeague) // temp for load test only

// admin
router.get('/admin/user-league/list/:id/v1', validators.list, validateAdmin('USERLEAGUE', 'R'), userLeagueServices.list)
router.post('/admin/user-league/v1', validators.matchWiseUserLeagueList, validateAdmin('USERLEAGUE', 'R'), userLeagueServices.matchWiseUserLeagueList)
router.get('/admin/user-league/extra-win-list/:id/v1', validators.extraWinList, validateAdmin('USERLEAGUE', 'R'), userLeagueServices.extraWinList)
router.get('/admin/user-league/report/:id/v1', validateAdmin('USERLEAGUE', 'W'), userLeagueServices.generateMatchLeagueReportV2)

module.exports = router
