const router = require('express').Router()
const settingServices = require('./services')
const validators = require('./validators')
const { validateAdmin } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

router.post('/admin/setting/v1', validators.adminAddSetting, validateAdmin('SETTING', 'W'), settingServices.add)
router.get('/admin/setting/list/v1', validators.list, validateAdmin('SETTING', 'R'), settingServices.list)
router.get('/admin/setting/:id/v1', validateAdmin('SETTING', 'R'), settingServices.get)
router.put('/admin/setting/:id/v1', validators.adminUpdateSetting, validateAdmin('SETTING', 'W'), settingServices.update)

router.get('/user/setting/fix-deposit/v1', cacheRoute(60), settingServices.getFixDepositSetting)

router.get('/user/setting/:type/v1', cacheRoute(60), settingServices.getDepositWithdrawSettingByType)
router.get('/user/setting/:type/v2', cacheRoute(60), settingServices.getDepositWithdrawSettingByTypeV2)

router.get('/admin/currency/v1', validateAdmin('SETTING', 'R'), settingServices.getCurrency)
router.post('/admin/currency/v1', validators.adminUpdateCurrency, validateAdmin('SETTING', 'W'), settingServices.updateCurrency)

router.get('/user/currency/v1', cacheRoute(60), settingServices.getCurrency)

router.get('/admin/side-background/:key/v1', validateAdmin('SETTING', 'R'), settingServices.getSideBackground)
router.post('/admin/side-background/v1', validators.adminUpdateSiteBackground, validateAdmin('SETTING', 'W'), settingServices.updateSideBackground)
router.post('/admin/side-background/pre-signed-url/v1', validators.getSignedUrl, validateAdmin('SETTING', 'W'), settingServices.getSignedUrl)
router.get('/admin/setting-validation/:key/v1', validateAdmin('SETTING', 'R'), settingServices.getSettingByKeyAdmin)

router.get('/user/side-background/v1', cacheRoute(60), settingServices.getUserSideBackground)

module.exports = router
