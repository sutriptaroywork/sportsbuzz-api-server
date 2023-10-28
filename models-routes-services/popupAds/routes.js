const router = require('express').Router()
const popupAdsServices = require('./services')
const validators = require('./validators')
const { validateAdmin } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

// admin
router.post('/admin/popupAds/pre-signed-url/v1', validators.getSignedUrl, validateAdmin('POPUP_ADS', 'W'), popupAdsServices.getSignedUrl)
router.get('/admin/popupAds/list/v1', validateAdmin('POPUP_ADS', 'R'), popupAdsServices.adminList)
router.get('/admin/popupAds/:id/v1', validateAdmin('POPUP_ADS', 'R'), popupAdsServices.get)
router.post('/admin/popupAds/add/v1', validators.adminAddAds, validateAdmin('POPUP_ADS', 'W'), popupAdsServices.add)
router.put('/admin/popupAds/:id/v1', validators.adminUpdateAds, validateAdmin('POPUP_ADS', 'W'), popupAdsServices.update)
router.delete('/admin/popupAds/:id/v1', validateAdmin('POPUP_ADS', 'W'), popupAdsServices.remove)

// user
router.get('/user/popupAds/list/v1', cacheRoute(60 * 2), popupAdsServices.list)

module.exports = router
