const router = require('express').Router()
const adminOfferServices = require('./services')
const validators = require('./validators')
const { validateAdmin, setLanguage } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

router.get('/user/offer/list/v1', setLanguage, cacheRoute(60), adminOfferServices.list)

// admin
router.get('/admin/offer/list/v1', validateAdmin('OFFER', 'R'), adminOfferServices.adminList)
router.get('/admin/offer/:id/v1', validateAdmin('OFFER', 'R'), adminOfferServices.get)
router.post('/admin/offer/add/v1', validators.adminAddOffers, validateAdmin('OFFER', 'W'), adminOfferServices.add)
router.post('/admin/offer/pre-signed-url/v1', validators.adminGetOfferSignedUrl, validateAdmin('OFFER', 'W'), adminOfferServices.getSignedUrl)
router.put('/admin/offer/:id/v1', validateAdmin('OFFER', 'W'), adminOfferServices.update)
router.delete('/admin/offer/:id/v1', validateAdmin('OFFER', 'W'), adminOfferServices.remove)

module.exports = router
