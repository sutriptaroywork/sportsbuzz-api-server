const router = require('express').Router()
const adminAuthServices = require('./services')
const validators = require('./validators')
const { validateAdmin, validate, isAdminAuthenticated, decrypt } = require('../../../middlewares/middleware')

router.post('/admin/auth/login/v1', validators.adminLogin, validate, adminAuthServices.login)
router.post('/admin/auth/login/v2', validators.adminLogin, validate, decrypt, adminAuthServices.login)

router.post('/admin/auth/sub-admin/v1', validators.createSubAdmin, validateAdmin('SUBADMIN', 'W'), adminAuthServices.createSubAdminV3)
router.post('/admin/auth/sub-admin/v3', validators.createSubAdminV3, validateAdmin('SUBADMIN', 'W'), decrypt, adminAuthServices.createSubAdminV3)

router.put('/admin/auth/logout/v1', isAdminAuthenticated, adminAuthServices.logout)

module.exports = router
