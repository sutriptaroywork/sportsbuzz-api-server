const router = require('express').Router()
const subAdminServices = require('./services')
const validators = require('./validators')
const { validateAdmin, decrypt } = require('../../../middlewares/middleware')
const logMicroService = require('../../logsMicroservice/logsMs')

router.get('/admin/sub-admin/list/v1', validateAdmin('SUBADMIN', 'R'), subAdminServices.list)

router.get('/admin/sub-admin/:id/v1', validateAdmin('SUBADMIN', 'R'), subAdminServices.get)

router.put('/admin/sub-admin/:id/v2', validators.updateSubAdminV2, validateAdmin('SUBADMIN', 'W'), subAdminServices.updateV2.bind(subAdminServices)) // deprecated
router.put('/admin/sub-admin/:id/v3', validators.updateSubAdminV2, validateAdmin('SUBADMIN', 'W'), decrypt, subAdminServices.updateV3.bind(subAdminServices))

router.get('/admin/sub-admin-logs/v1', validateAdmin('SUBADMIN', 'R'), logMicroService.getAdminLogs)
router.get('/admin/sub-admin-ids/v1', validateAdmin('SUBADMIN', 'R'), subAdminServices.getAdminIds)
router.get('/admin/sub-admin-logs/:id/v1', validateAdmin('SUBADMIN', 'R'), logMicroService.getAdminLog)

module.exports = router
