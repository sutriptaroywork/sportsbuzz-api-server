const router = require('express').Router()
const versionServices = require('./services')
const validators = require('./validators')
const { validateAdmin, setLanguage } = require('../../middlewares/middleware')

router.get('/user/version/v1', setLanguage, versionServices.userGet)

router.get('/admin/version/list/v1', validateAdmin('VERSION', 'R'), versionServices.adminList)

router.get('/admin/version/:id/v1', validateAdmin('VERSION', 'R'), versionServices.get)

router.post('/admin/version/add/v1', validators.addVersionDetails, validateAdmin('VERSION', 'W'), versionServices.add)

router.put('/admin/version/:id/v1', validateAdmin('VERSION', 'W'), versionServices.update)

router.delete('/admin/version/:id/v1', validateAdmin('VERSION', 'W'), versionServices.remove)

module.exports = router
