const router = require('express').Router()
const paymentServices = require('./services')
const validators = require('./validators')
const { isUserAuthenticated, setLanguage } = require('../../middlewares/middleware')
const paymentMicroservice = require('../paymentMS/paymentMS')

router.post('/user/payment/create/v1', isUserAuthenticated, validators.userPayment, paymentMicroservice.generatePayment)
router.post('/admin/payment/notify-url/v1', setLanguage, paymentServices.verifyOrder)
router.post('/admin/payment/return-url/v1', setLanguage, paymentServices.returnUrl)
router.post('/admin/payment/verify-app-payment/v1', setLanguage, paymentServices.verifyAppPayment)

router.post('/user/payment/create/v2', isUserAuthenticated, validators.userPayment, paymentServices.generatePayment)
router.post('/user/payment/create/v3', isUserAuthenticated, validators.userPayment, paymentMicroservice.generatePayment)
router.all('/admin/payment/juspay/webhook', paymentMicroservice.juspayDepositWebhookRedirect)

router.all('/admin/payment/notify-url/v2', paymentServices.verifyOrderV2)
router.all('/admin/payment/return-url/v2', paymentServices.returnUrlV2)

router.all('/admin/payment/amazon-return-url/v1', setLanguage, paymentServices.amazonReturnUrl)

router.all('/admin/payment/amazonepay-webhook', paymentServices.amazonPayWebhook)

router.all('/user/payment/amazonpay-process-charge/v1', isUserAuthenticated, paymentServices.amazonPayProcessCharge)

router.all('/user/payment/amazonpay-charge-status/v1', isUserAuthenticated, paymentServices.amazonPayChargeStatus)

router.all('/user/payment/amazonpay-verify-signature/v1', isUserAuthenticated, paymentServices.amazonPayVerifySignature)

module.exports = router
