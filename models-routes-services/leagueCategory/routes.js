const router = require('express').Router()
const leagueCategoryServices = require('./services')
const validators = require('./validators')
const { validateAdmin } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

router.post('/admin/league-category/v1', validators.adminAddLeagueCategory, validateAdmin('LEAGUE', 'W'), leagueCategoryServices.addLeagueCategory)
router.get('/admin/league-category/v1', validateAdmin('LEAGUE', 'R'), cacheRoute(60), leagueCategoryServices.getCategoryList)
router.get('/admin/league-category/list/v1', validators.list, validateAdmin('LEAGUE', 'R'), leagueCategoryServices.getLeagueCategoryListV1)
router.get('/admin/league-category/:id/v1', validateAdmin('LEAGUE', 'R'), leagueCategoryServices.getLeagueCategoryById)
router.put('/admin/league-category/:id/v1', validateAdmin('LEAGUE', 'W'), leagueCategoryServices.updateLeagueCategory)
router.delete('/admin/league-category/:id/v1', validateAdmin('LEAGUE', 'W'), leagueCategoryServices.deleteLeagueCategory)
router.post('/admin/league-category/pre-signed-url/v1', validators.getSignedUrl, validateAdmin('LEAGUE', 'W'), leagueCategoryServices.getS3SignedUrl)

router.post('/admin/filter-category/v1', validators.adminAddFilterCategory, validateAdmin('LEAGUE', 'W'), leagueCategoryServices.createFilterCategory)
router.get('/admin/filter-category/v1', validateAdmin('LEAGUE', 'R'), cacheRoute(60), leagueCategoryServices.getFilterCategoryV1)
router.get('/admin/filter-category/list/v1', validators.list, validateAdmin('LEAGUE', 'R'), leagueCategoryServices.getFilterCategoryListV1)
router.get('/admin/filter-category/:id/v1', validateAdmin('LEAGUE', 'R'), cacheRoute(60), leagueCategoryServices.getFilterCategoryById)
router.put('/admin/filter-category/:id/v1', validateAdmin('LEAGUE', 'W'), leagueCategoryServices.editFilterCategory)
router.delete('/admin/filter-category/:id/v1', validateAdmin('LEAGUE', 'W'), leagueCategoryServices.deleteFilterCategory)

module.exports = router
