const router = require('express').Router()
const userAuthServices = require('./services')
const validators = require('./validators')
const { validate, isUserAuthenticated, decrypt, changeDeviceTokenField } = require('../../../middlewares/middleware')

router.post('/user/auth/register/v1', validators.register, validate, userAuthServices.register) // deprecated

router.post('/user/subscribe-push-token/v1', isUserAuthenticated, userAuthServices.subscribePushToken)

router.post('/user/auth/check-exist/v1', validators.checkExist, validate, userAuthServices.checkExist) // Web app used
router.post('/user/auth/check-exist/v2', validators.checkExistV2, validate, userAuthServices.checkExistence) // Native app used

router.post('/user/auth/login/v1', validators.login, validate, userAuthServices.login) // deprecated

router.post('/user/auth/send-otp/v1', validators.sendOTP, validate, userAuthServices.sendOTP)
router.post('/user/auth/verify-otp/v1', validators.verifyOTP, validate, userAuthServices.verifyOTP) // deprecated

router.post('/user/auth/reset-password/v1', validators.resetPassword, validate, userAuthServices.resetPassword) // deprecated
router.post('/user/auth/reset-password/v3', validators.resetPassword, validate, userAuthServices.resetPasswordV3) // strong password validation

router.post('/user/auth/change-password/v1', validators.changePassword, isUserAuthenticated, userAuthServices.changePassword) // deprecated
router.post('/user/auth/change-password/v3', validators.changePassword, isUserAuthenticated, userAuthServices.changePasswordV3) // strong password validation

router.put('/user/auth/logout/v1', isUserAuthenticated, userAuthServices.logout)

router.post('/user/auth/validate-token/v1', validators.validateToken, isUserAuthenticated, userAuthServices.validateToken) // check on - in used or not

router.post('/user/auth/social-login/v1', validators.socialLogin, validate, userAuthServices.socialLogin) // Web app used

router.post('/user/auth/register/v2', validators.register, validate, decrypt, userAuthServices.register) // deprecated
router.post('/user/auth/login/v2', validators.login, validate, decrypt, userAuthServices.login)
router.post('/user/auth/reset-password/v2', validators.resetPassword, validate, decrypt, userAuthServices.resetPassword)
router.post('/user/auth/change-password/v2', validators.changePassword, isUserAuthenticated, decrypt, userAuthServices.changePassword)

router.post('/user/auth/register/v3', validators.registerV3, validate, changeDeviceTokenField, userAuthServices.register) // deprecated
router.post('/user/auth/register/v4', validators.registerV3, validate, changeDeviceTokenField, userAuthServices.registerV4) // strong password validation

router.post('/user/auth/verify-otp/v2', validators.verifyOTPV2, validate, changeDeviceTokenField, userAuthServices.verifyOTPV2)
router.post('/user/auth/login/v3', validators.loginV3, validate, changeDeviceTokenField, userAuthServices.login)
router.post('/user/auth/validate-token/v2', validators.validateTokenV2, isUserAuthenticated, changeDeviceTokenField, userAuthServices.validateToken)
router.post('/user/auth/social-login/v2', validators.socialLoginV2, validate, changeDeviceTokenField, userAuthServices.socialLogin) // Native app used

router.post('/user/auth/send-otp/v2', validators.sendOTPV2, validate, userAuthServices.sendOTPV2)
router.post('/user/auth/verify-otp/v3', validators.verifyOTPV3, validate, userAuthServices.verifyOTPV3)
router.post('/user/auth/register/v5', validators.registerV5, validate, userAuthServices.registerV5)
router.post('/user/auth/social-login/v3', validators.socialLogin, validate, userAuthServices.socialLoginV3)

router.post('/user/app-download-link/v1', validators.downloadLink, validate, userAuthServices.getAppDownloadLink)
router.put('/user/ad-id/v1', isUserAuthenticated, userAuthServices.addAdId)

module.exports = router
