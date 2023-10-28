const router = require('express').Router()
const { isUserAuthenticated, validateAdmin, validateFunctionality } = require('../../middlewares/middleware')
const kycServices = require('./services')
const validators = require('./validators')

// admin
router.get('/admin/kyc-list/v2', validateAdmin('KYC', 'R'), kycServices.searchKycDetails) // pendingKycListV2
router.get('/admin/kyc-list/counts/v2', validateAdmin('KYC', 'R'), kycServices.countKycDetails) // getKycCount

router.post('/admin/kyc/add/:id/v1', validators.userKycAdd, validateAdmin('KYC', 'W'), kycServices.add)
router.post('/admin/kyc/add/:id/v2', validators.userKycAdd, validateAdmin('KYC', 'W'), kycServices.addV2)

router.get('/admin/kyc-info/:id/v1', validateAdmin('KYC', 'R'), kycServices.kycDetails)
router.put('/admin/kyc-status/:id/v1', validators.updateKycStatus, validateAdmin('KYC', 'W'), kycServices.updateKycDetails) // updateKycStatus old
router.post('/admin/pre-signed-url-kyc/v1', validators.getSignedUrlKyc, validateAdmin('KYC', 'R'), kycServices.getSignedUrlKyc)
router.post('/admin/pre-signed-url/:type/v1', validators.getSignedUrl, validateAdmin('KYC', 'W'), kycServices.getSignedUrl)

router.put('/admin/kyc/:id/v1', validators.adminKycUpdate, validateAdmin('KYC', 'W'), kycServices.update)
router.put('/admin/kyc/:id/v2', validators.adminKycUpdate, validateAdmin('KYC', 'W'), kycServices.updateV2)
router.put('/admin/kyc/:id/v3', validators.adminKycUpdate, validateAdmin('KYC', 'W'), kycServices.updateKycDetails) // updateV3

// User
router.post('/user/kyc/add/v1', validators.userKycAdd, isUserAuthenticated, kycServices.add)
router.post('/user/kyc/add/v2', validators.userKycAdd, isUserAuthenticated, kycServices.addV2)

router.post('/user/pre-signed-url/:type/v1', validators.getSignedUrl, isUserAuthenticated, kycServices.getSignedUrl)
router.post('/user/pre-signed-url-kyc/v1', validators.getSignedUrlKyc, isUserAuthenticated, validateFunctionality('USER_KYC_VISIBLE'), kycServices.getSignedUrlKyc)

router.put('/user/kyc/v1', validators.userKycUpdate, isUserAuthenticated, kycServices.update)
router.put('/user/kyc/v2', validators.userKycUpdate, isUserAuthenticated, kycServices.updateV2)

router.get('/user/kyc/v2', isUserAuthenticated, kycServices.getKycDetailsV2)
router.get('/user/kyc/disclaimer/v1', kycServices.getDisclaimer)

// KYC v3 for IDFY verification
router.post('/user/kyc/aadhar-verify/v3', isUserAuthenticated, kycServices.kycAadhaarVerificationV3)
router.post('/user/kyc/pan-verify/v3', isUserAuthenticated, kycServices.kycPanVerificationV3)

// KYC v4 for IDFY verification
router.post('/user/kyc/aadhar-verify/v4', isUserAuthenticated, kycServices.kycAadhaarVarificationV4)
router.post('/user/kyc/pan-verify/v4/:id?', isUserAuthenticated, kycServices.kycPanVerificationV4)

router.post('/user/kyc/aadhar-verify/v5', isUserAuthenticated, kycServices.kycAadhaarVarificationV5)
router.post('/user/kyc/pan-verify/v5', isUserAuthenticated, kycServices.kycPanVarificationV5)
router.post('/user/kyc/penny-drop-verify/v5', isUserAuthenticated, kycServices.kycBankVarification)
module.exports = router
