const router = require('express').Router()
const cmsServices = require('./services')
const validators = require('./validators')
const { validateAdmin, setLanguage } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

router.get('/user/cms/list/v1', setLanguage, cacheRoute(60), cmsServices.userList)

router.get('/user/cms/:sSlug/v1', setLanguage, cacheRoute(60), cmsServices.get)

// admin
router.post('/admin/cms/add/v1', validators.adminAddCMS, validateAdmin('CMS', 'W'), cmsServices.add)

router.get('/admin/cms/v1', validateAdmin('CMS', 'R'), cmsServices.list)

router.get('/admin/cms/:sSlug/v1', validateAdmin('CMS', 'R'), cmsServices.adminGet)

router.put('/admin/cms/:id/v1', validators.adminUpdateCMS, validateAdmin('CMS', 'W'), cmsServices.update)

router.delete('/admin/cms/:id/v1', validateAdmin('CMS', 'W'), cmsServices.remove)

// CSS routes
router.post('/admin/css/:eType/v1', validateAdmin('CMS', 'W'), cmsServices.addCss)
router.get('/admin/css-list/v1', validateAdmin('CMS', 'R'), cmsServices.listCss)
router.get('/admin/css/:eType/v1', validateAdmin('CMS', 'R'), cmsServices.adminGetCss)
router.put('/admin/css/:eType/v1', validateAdmin('CMS', 'W'), cmsServices.updateCss)

// User
router.get('/user/css/:eType/v1', setLanguage, cacheRoute(60), cmsServices.getCss)

module.exports = router
