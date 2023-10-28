const router = require('express').Router()
const playerRoleServices = require('./services')
const validators = require('./validators')
const { validateAdmin } = require('../../middlewares/middleware')

router.get('/admin/player-role/v1', validators.getPlayerRole, validateAdmin('ROLES', 'R'), playerRoleServices.getPlayerRole)
router.get('/admin/player-role/:id/v1', validators.getPlayerRole, validateAdmin('ROLES', 'R'), playerRoleServices.get)
router.put('/admin/player-role/:id/v1', validators.updatePlayerRole, validators.getPlayerRole, validateAdmin('ROLES', 'W'), playerRoleServices.update)
router.put('/admin/player-role/:id/v2', validators.updatePlayerRoleV2, validators.getPlayerRole, validateAdmin('ROLES', 'W'), playerRoleServices.updateV2)

module.exports = router
