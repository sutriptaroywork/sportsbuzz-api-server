const router = require('express').Router()
const userWithdrawServices = require('./services')
const {
  validateAdmin,
  isUserAuthenticated,
  decrypt,
  isBlockedByAdmin
} = require('../../middlewares/middleware')
const validators = require('./validators')

router.get(
  '/admin/withdraw/list/v1',
  validateAdmin('WITHDRAW', 'R'),
  userWithdrawServices.adminList
)
router.get(
  '/admin/withdraw/counts/v1',
  validateAdmin('WITHDRAW', 'R'),
  userWithdrawServices.getCounts
)
router.post(
  '/admin/withdraw/cashfree-webhook/v1',
  userWithdrawServices.cashfreeWebhook
)
router.post(
  '/admin/withdraw/:id/v1',
  validateAdmin('WITHDRAW', 'W'),
  userWithdrawServices.processWithdrawV2
)
router.post(
  '/admin/withdraw/v1',
  validators.adminWithdraw,
  validateAdmin('WITHDRAW', 'W'),
  userWithdrawServices.adminWithdraw
)
router.post(
  '/admin/withdraw/v2',
  validators.adminWithdraw,
  validateAdmin('WITHDRAW', 'W'),
  decrypt,
  userWithdrawServices.adminWithdraw
)

router.post(
  '/user/withdraw/:id/v2',
  isUserAuthenticated,
  isBlockedByAdmin,
  userWithdrawServices.addV3.bind(userWithdrawServices)
)
router.get(
  '/user/withdraw-request/v2',
  isUserAuthenticated,
  userWithdrawServices.checkWithdrawRequestV2
)
router.get(
  '/user/withdraw/cancel/:iWithdrawId/v2',
  isUserAuthenticated,
  userWithdrawServices.userCancelWithdraw
)

router.get(
  '/admin/withdraw/is-debugger-mismatch/:iUserId',
  isUserAuthenticated,
  userWithdrawServices.isDebuggerMismatchOfWithdrawId
)

module.exports = router
