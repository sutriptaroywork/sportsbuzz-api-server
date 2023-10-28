const router = require('express').Router()
const MaintenanceServices = require('./services')
const validators = require('./validators')
const { validateAdmin } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

router.get('/admin/maintenance-mode/v1', validateAdmin('MAINTENANCE', 'R'), MaintenanceServices.get)
router.put('/admin/maintenance-mode/v1', validators.adminUpdateMode, validateAdmin('MAINTENANCE', 'W'), MaintenanceServices.update)

router.get('/user/maintenance-mode/v1', cacheRoute(10), MaintenanceServices.getMaintenance)

module.exports = router
