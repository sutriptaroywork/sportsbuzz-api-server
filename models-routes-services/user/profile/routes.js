const router = require('express').Router()
const userServices = require('./services')
const UserMicroService = require('./userMicroService')
const { validateAdmin, isUserAuthenticated, validate } = require('../../../middlewares/middleware')
const { body } = require('express-validator')
// const { cacheRoute } = require('../../../helper/redis')
const validators = require('./validators')

router.get('/admin/profile/v2', validators.listV2, validateAdmin('USERS', 'R'), UserMicroService.getAdminProfilesListV2)
router.get('/admin/profile/counts/v1', validateAdmin('USERS', 'R'), UserMicroService.getAdminCount)

// recommendation of 10 user list
router.get('/admin/user/recommendation/v1', validators.adminRecommendation, UserMicroService.adminRecommendation)

router.get('/admin/profile/:id/v1', validateAdmin('USERS', 'R'), UserMicroService.adminGet)
router.put('/admin/profile/:id/v1', validators.updateProfile, validateAdmin('USERS', 'W'), UserMicroService.adminUpdate)
router.get('/admin/city/v1', validators.listV2, UserMicroService.getCitiesListForAdmin)
router.get('/admin/states/v1', UserMicroService.getAdminStatesList)

router.get('/admin/referred-list/:id/v1', validators.listV2, validateAdmin('USERS', 'R'), UserMicroService.referredByUserList)

router.post('/admin/profile/pre-signed-url/v1', [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
], validateAdmin('USERS', 'W'), userServices.getSignedUrl)

// user
router.get('/user/profile/v2', isUserAuthenticated, UserMicroService.getProfileDetailsV2)
router.get('/user/profile-statistics/v1', isUserAuthenticated, UserMicroService.getStatistic)
router.put('/user/profile/v1', validators.updateProfile, isUserAuthenticated, UserMicroService.updateProfile)

router.post('/user/profile/pre-signed-url/v1', [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
], isUserAuthenticated, userServices.getSignedUrl)

router.get('/user/profile/states/v1', validators.states, validate, UserMicroService.getStatesList)
router.get('/user/profile/cities/v1', validators.cities, validate, UserMicroService.getCitiesList)

module.exports = router
