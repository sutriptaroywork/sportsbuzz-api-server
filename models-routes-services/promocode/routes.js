const router = require('express').Router()
const promocodeServices = require('./services')
const validators = require('./validators')
const { validateAdmin, isUserAuthenticated, setLanguage } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

router.post('/admin/promocode/v1', validators.addPromoCode, validateAdmin('PROMO', 'W'), promocodeServices.add)
router.put('/admin/promocode/:id/v1', validators.updatePromoCode, validateAdmin('PROMO', 'W'), promocodeServices.update)
router.get('/admin/promocode/list/v1', validators.list, validateAdmin('PROMO', 'R'), promocodeServices.list)
router.get('/admin/promocode/count/v1', validateAdmin('PROMO', 'R'), promocodeServices.getCount)
router.get('/admin/promocode/:id/v1', validateAdmin('PROMO', 'R'), promocodeServices.get)
router.delete('/admin/promocode/:id/v1', validateAdmin('PROMO', 'W'), promocodeServices.remove)

// user

router.get('/user/promocode/list/v1', setLanguage, cacheRoute(10), promocodeServices.userPromocodeList)
router.get('/user/promocode/match/list/:id/v1', setLanguage, cacheRoute(10), promocodeServices.matchPromoList)
router.post('/user/promocode/check/v1', validators.checkPromocode, isUserAuthenticated, promocodeServices.checkPromocode)
router.post('/user/promocode/match/check/v1', validators.checkMatchPromocode, isUserAuthenticated, promocodeServices.checkMatchPromocode.bind(promocodeServices))

module.exports = router
