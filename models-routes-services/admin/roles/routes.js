const router = require('express').Router()
const roleServices = require('./services')
const validators = require('./validators')
const { validateAdmin } = require('../../../middlewares/middleware')

router.post('/admin/role/v1', validators.roleAdd, validateAdmin('ADMIN_ROLE', 'W'), roleServices.add)

router.get('/admin/role/v1', validateAdmin('ADMIN_ROLE', 'R'), roleServices.list)

router.get('/admin/role/list/v1', validateAdmin('ADMIN_ROLE', 'R'), roleServices.adminList)

router.get('/admin/role/:id/v1', validateAdmin('ADMIN_ROLE', 'R'), roleServices.get)

router.put('/admin/role/:id/v1', validators.roleUpdate, validateAdmin('ADMIN_ROLE', 'W'), roleServices.update)

router.delete('/admin/role/:id/v1', validateAdmin('ADMIN_ROLE', 'W'), roleServices.delete)

module.exports = router
