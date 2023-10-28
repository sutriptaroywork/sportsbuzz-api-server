const router = require('express').Router()
const userDepositServices = require('./services')
const validators = require('./validators')
const paymentMicroservice = require('../paymentMS/paymentMS')

const { validateAdmin, isUserAuthenticated, decrypt, isAdminAuthenticatedToDeposit } = require('../../middlewares/middleware')

router.post('/admin/deposit/v1', validators.adminDeposit, isAdminAuthenticatedToDeposit, userDepositServices.adminDeposit) // Internally bot service used purpose
router.post('/admin/deposit/v2', validators.adminDeposit, validateAdmin('DEPOSIT', 'W'), decrypt, userDepositServices.adminDeposit)
router.post('/admin/deposit/:id/v1', validateAdmin('DEPOSIT', 'W'), userDepositServices.processDeposit)
router.get('/admin/deposit/list/v1', validateAdmin('DEPOSIT', 'R'), userDepositServices.adminList)
router.get('/admin/deposit/counts/v1', validateAdmin('DEPOSIT', 'R'), userDepositServices.getCounts)

router.post('/user/deposit/v1', validators.userDeposit, isUserAuthenticated, userDepositServices.userDeposit.bind(userDepositServices))
router.get('/user/deposit-status/:id/v1', validators.userDepositStatus, isUserAuthenticated, userDepositServices.checkUserDepositStatus.bind(userDepositServices))
router.get('/user/deposit-status/:id/v2', validators.userDepositStatus, isUserAuthenticated, paymentMicroservice.checkUserDepositStatusRedirect)

// New GST Routes
router.post('/user/gst/gst-breakup/v1', validators.depositBreakUp, isUserAuthenticated, paymentMicroservice.getGSTBreakUp)
module.exports = router
