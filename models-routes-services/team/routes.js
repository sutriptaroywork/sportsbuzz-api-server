const router = require('express').Router()
const teamServices = require('./services')
const validators = require('./validators')
const { validateAdmin } = require('../../middlewares/middleware')

router.get('/admin/team/list/v1', validators.adminTeamsValidator, validateAdmin('TEAM', 'R'), teamServices.list)
router.get('/admin/team/counts/v1', validators.adminTeamCounts, validateAdmin('TEAM', 'R'), teamServices.getCounts)
router.get('/admin/team/team-list/v1', validators.adminTeamsValidator, validateAdmin('TEAM', 'R'), teamServices.teamList)
router.get('/admin/team/:id/v1', validateAdmin('TEAM', 'R'), teamServices.get)
router.post('/admin/team/pre-signed-url/v1', validators.adminTeamGetPreSignedUrl, validateAdmin('TEAM', 'W'), teamServices.getSignedUrl)
router.post('/admin/team/add/v1', validators.adminAddTeam, validateAdmin('TEAM', 'W'), teamServices.addTeam)
router.put('/admin/team/:id/v1', validators.adminUpdateTeamsValidator, validateAdmin('TEAM', 'W'), teamServices.update)

module.exports = router
