const router = require('express').Router()
const payoutOptionServices = require('./services')
const validators = require('./validators')
const { cacheRoute } = require('../../helper/redis')
const { validateAdmin, setLanguage } = require('../../middlewares/middleware')

// user
router.get('/user/payout-option/list/v2', setLanguage, cacheRoute(60), payoutOptionServices.listV2)

// admin
router.get('/admin/payout-option/list/v1', validateAdmin('PAYOUT_OPTION', 'R'), payoutOptionServices.adminList)
router.get('/admin/payout-option/:id/v1', validateAdmin('PAYOUT_OPTION', 'R'), payoutOptionServices.get)
router.post('/admin/payout-option/add/v1', validators.adminAddPayoutOption, validateAdmin('PAYOUT_OPTION', 'W'), payoutOptionServices.add)
router.post('/admin/payout-option/pre-signed-url/v1', validators.adminGetPayoutOptionSignedUrl, validateAdmin('PAYOUT_OPTION', 'W'), payoutOptionServices.getSignedUrl)
router.put('/admin/payout-option/:id/v1', validators.adminUpdatePayoutOption, validateAdmin('PAYOUT_OPTION', 'W'), payoutOptionServices.update)

module.exports = router
