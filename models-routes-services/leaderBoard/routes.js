const router = require('express').Router()
const LeaderBoardServices = require('./services')
const { isUserAuthenticated, setLanguage, validateAdmin } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')
const validators = require('./validators')

router.get('/user/leaderboard/my-teams/:id/v2', isUserAuthenticated, LeaderBoardServices.userTeamListV2)

router.get('/user/leaderboard/list/:id/v2', validators.teamList, setLanguage, cacheRoute(5), LeaderBoardServices.allTeamListV2)

router.get('/admin/leaderboard/list/:id/v1', validators.teamList, setLanguage, cacheRoute(5), validateAdmin('USERLEAGUE', 'R'), LeaderBoardServices.adminTeamList)

module.exports = router
