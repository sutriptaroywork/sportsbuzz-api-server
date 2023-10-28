const router = require('express').Router()
const bannerServices = require('./services')
const validators = require('./validators')
const { cacheRoute } = require('../../helper/redis')
const { validateAdmin, setLanguage } = require('../../middlewares/middleware')

router.get('/user/banner/list/:place/v1', setLanguage, cacheRoute(60), bannerServices.list)
router.get('/user/get-url/v1', setLanguage, bannerServices.getUrls)

// admin
router.get('/admin/banner/list/v1', validateAdmin('BANNER', 'R'), bannerServices.adminList)
router.get('/admin/banner/:id/v1', validateAdmin('BANNER', 'R'), bannerServices.get)
router.post('/admin/banner/add/v1', validators.adminAddBanner, validateAdmin('BANNER', 'W'), bannerServices.add)
router.post('/admin/banner/pre-signed-url/v1', validators.getSignedUrl, validateAdmin('BANNER', 'W'), bannerServices.getSignedUrl)
router.put('/admin/banner/:id/v1', validators.adminUpdateBanner, validateAdmin('BANNER', 'W'), bannerServices.update)
router.delete('/admin/banner/:id/v1', validateAdmin('BANNER', 'W'), bannerServices.remove)

router.get('/get-url/:type/v1', setLanguage, bannerServices.getUrl)
module.exports = router
