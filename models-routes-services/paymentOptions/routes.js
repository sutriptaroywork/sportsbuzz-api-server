const router = require('express').Router()
const paymentOptionServices = require('./services')
const validators = require('./validators')
const { cacheRoute } = require('../../helper/redis')
const { validateAdmin, setLanguage } = require('../../middlewares/middleware')

router.get('/user/payment-option/list/v2', setLanguage, cacheRoute(60), paymentOptionServices.listV2)

// admin
router.get('/admin/payment-option/list/v1', validateAdmin('PAYMENT_OPTION', 'R'), paymentOptionServices.adminList)
router.get('/admin/payment-option/:id/v1', validateAdmin('PAYMENT_OPTION', 'R'), paymentOptionServices.get)
router.post('/admin/payment-option/add/v1', validators.adminAddPaymentOption, validateAdmin('PAYMENT_OPTION', 'W'), paymentOptionServices.add)
router.post('/admin/payment-option/pre-signed-url/v1', validators.adminGetPaymentOptionSignedUrl, validateAdmin('PAYMENT_OPTION', 'W'), paymentOptionServices.getSignedUrl)
router.put('/admin/payment-option/:id/v1', validators.adminUpdatePaymentOption, validateAdmin('PAYMENT_OPTION', 'W'), paymentOptionServices.update)

module.exports = router
