const router = require('express').Router()
const permissionServices = require('./services')
const validators = require('./validators')
const { validateAdmin } = require('../../../middlewares/middleware')

router.post('/admin/permission/v1', validators.permissionAdd, validateAdmin('PERMISSION', 'W'), permissionServices.add)

router.get('/admin/permission/v1', validateAdmin('PERMISSION', 'R'), permissionServices.list)

router.get('/admin/permission/list/v1', validateAdmin('PERMISSION', 'R'), permissionServices.adminList)

router.get('/admin/permission/:id/v1', validateAdmin('PERMISSION', 'R'), permissionServices.get)

router.put('/admin/permission/:id/v1', validators.permissionUpdate, validateAdmin('PERMISSION', 'W'), permissionServices.update)

module.exports = router
