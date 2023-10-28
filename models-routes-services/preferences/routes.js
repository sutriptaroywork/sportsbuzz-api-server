const router = require('express').Router()
const preferenceServices = require('./services')
const { isUserAuthenticated, validateAdmin } = require('../../middlewares/middleware')

// remover add preference add when user register
router.post('/admin/preferences/add/v1', validateAdmin('PREFERENCES', 'W'), preferenceServices.add)
router.put('/admin/preferences/:id/v1', validateAdmin('PREFERENCES', 'W'), preferenceServices.update)
router.get('/admin/preferences/:id/v1', validateAdmin('PREFERENCES', 'R'), preferenceServices.get)

router.get('/user/preferences/v1', isUserAuthenticated, preferenceServices.get)
router.put('/user/preferences/v1', isUserAuthenticated, preferenceServices.update)

module.exports = router
