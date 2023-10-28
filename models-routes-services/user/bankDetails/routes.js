const router = require('express').Router()
const bankDetailsServices = require('./services')
const validators = require('./validators')
const { isUserAuthenticated, validateAdmin } = require('../../../middlewares/middleware')

// admin
router.get('/admin/bank-details/:id/v2', validateAdmin('BANKDETAILS', 'R'), bankDetailsServices.adminGetV2)
router.put('/admin/bank-details/:id/v2', validators.updateBankDetailsV2, validateAdmin('BANKDETAILS', 'W'), bankDetailsServices.adminUpdateV2)
router.post('/admin/bank-details/:id/v2', validators.addBankDetailsV2, validateAdmin('BANKDETAILS', 'W'), bankDetailsServices.adminAddV2)
router.put('/admin/bank-details-processed/:id/v1', validateAdmin('BANKDETAILS', 'W'), bankDetailsServices.processDetails)

// user
router.post('/user/bank-details/v2', validators.addBankDetailsV2, isUserAuthenticated, bankDetailsServices.addV2)
router.put('/user/bank-details/v2', validators.updateBankDetailsV2, isUserAuthenticated, bankDetailsServices.updateV2)
router.get('/user/bank-details/v2', isUserAuthenticated, bankDetailsServices.getV2)

module.exports = router
