const router = require('express').Router()
const playerServices = require('./services')
const validators = require('./validators')
const { validateAdmin } = require('../../middlewares/middleware')

router.get('/admin/player/list/v1', validators.adminPlayerList, validateAdmin('PLAYER', 'R'), playerServices.list)
router.get('/admin/player/counts/v1', validators.adminPlayerCount, validateAdmin('PLAYER', 'R'), playerServices.getCounts)
router.get('/admin/player/:id/v1', validateAdmin('PLAYER', 'R'), playerServices.get)
router.post('/admin/player/add/v1', validators.adminAddPlayer, validateAdmin('PLAYER', 'W'), playerServices.addPlayer)
router.post('/admin/player/pre-signed-url/v1', validators.adminPlayerGetSignedUrl, validateAdmin('PLAYER', 'W'), playerServices.getSignedUrl)
router.put('/admin/player/:id/v1', validators.adminPlayerUpdate, validateAdmin('PLAYER', 'W'), playerServices.update)

module.exports = router
