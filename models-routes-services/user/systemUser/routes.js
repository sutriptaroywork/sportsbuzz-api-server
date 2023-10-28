const router = require('express').Router()
const systemUserServices = require('./services')
const { validateAdmin, isAdminAuthenticatedToDeposit } = require('../../../middlewares/middleware')
const validators = require('./validators')

router.get('/admin/system-user/list/v1', validators.list, validateAdmin('SYSTEM_USERS', 'R'), systemUserServices.list)
router.get('/admin/system-user/counts/v1', validateAdmin('SYSTEM_USERS', 'R'), systemUserServices.getCounts)
// router.post('/admin/system-user/v1', validateAdmin('SYSTEM_USERS', 'W'), systemUserServices.add)
// router.post('/admin/system-user/v2', isAdminAuthenticatedToDeposit, systemUserServices.add) // Internally bot service used purpose
router.post('/admin/system-user/v1', validateAdmin('SYSTEM_USERS', 'W'), systemUserServices.addV2)
router.post('/admin/system-user/v2', isAdminAuthenticatedToDeposit, systemUserServices.addV2) // Internally bot service used purpose
router.post('/admin/system-user/add-token/v1', validateAdmin('SYSTEM_USERS', 'W'), systemUserServices.addToken)
router.get('/admin/system-user/v1', validateAdmin('SYSTEM_USERS', 'R'), systemUserServices.get)
router.delete('/admin/system-user/v1', validateAdmin('SYSTEM_USERS', 'W'), systemUserServices.remove)
router.get('/admin/system-user/:id/v1', validateAdmin('SYSTEM_USERS', 'R'), systemUserServices.adminGet)
router.put('/admin/system-user/:id/v1', validateAdmin('SYSTEM_USERS', 'W'), systemUserServices.adminUpdate)

module.exports = router
