const router = require('express').Router()
const SeriesLeaderBoardServices = require('./services')
const validators = require('./validators')
const { validateAdmin, validate, setLanguage, isUserAuthenticated } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

router.post('/admin/series-leaderboard/v1', validators.addSeriesLeaderBoard, validateAdmin('SERIES_LEADERBOARD', 'W'), SeriesLeaderBoardServices.add)
router.get('/admin/series-leaderboard/list/v1', validators.adminSeriesLeaderBoardList, validateAdmin('SERIES_LEADERBOARD', 'R'), SeriesLeaderBoardServices.adminList)
router.get('/admin/series-leaderboard/:id/v1', validateAdmin('SERIES_LEADERBOARD', 'R'), SeriesLeaderBoardServices.get)
router.put('/admin/series-leaderboard/:id/v1', validators.editSeriesLeaderBoard, validateAdmin('SERIES_LEADERBOARD', 'W'), SeriesLeaderBoardServices.update)
router.get('/admin/series-leaderboard/v1', validators.adminListSeriesLeaderBoard, validate, SeriesLeaderBoardServices.adminListId)
router.delete('/admin/series-leaderboard/:id/v1', validateAdmin('SERIES_LEADERBOARD', 'W'), SeriesLeaderBoardServices.remove)

router.post('/user/series-leaderboard/v1', validators.userListSeriesLeaderBoard, validate, SeriesLeaderBoardServices.list)

router.post('/admin/series-leaderboard-category/pre-signed-url/v1', validators.categoryTemplateGetSignedUrl, validateAdmin('SERIES_LEADERBOARD', 'W'), SeriesLeaderBoardServices.getSignedUrlCategory)
router.post('/admin/series-leaderboard-category/:id/v1', validators.addSeriesCategory, validateAdmin('SERIES_LEADERBOARD', 'W'), SeriesLeaderBoardServices.addCategory)
router.get('/admin/series-leaderboard-category/:id/v1', validateAdmin('SERIES_LEADERBOARD', 'R'), SeriesLeaderBoardServices.getCategory)
router.post('/admin/series-leaderboard-category/:id/price-breakup/v1', validators.addSeriesPrizeBreakup, validateAdmin('SERIES_LEADERBOARD', 'W'), SeriesLeaderBoardServices.addSeriesPriceBreakup)
router.get('/admin/series-leaderboard-category/:id/price-breakup/v1', validateAdmin('SERIES_LEADERBOARD', 'R'), SeriesLeaderBoardServices.listPriceBreakup)
router.get('/admin/series-leaderboard-category/:id/price-breakup/:pid/v1', validateAdmin('SERIES_LEADERBOARD', 'R'), SeriesLeaderBoardServices.getPriceBreakup)
router.put('/admin/series-leaderboard-category/:id/price-breakup/:pid/v1', validators.updateSeriesPrizeBreakup, validateAdmin('SERIES_LEADERBOARD', 'W'), SeriesLeaderBoardServices.updatePriceBreakup)
router.delete('/admin/series-leaderboard-category/:id/prize-breakup/:pid/v1', validateAdmin('SERIES_LEADERBOARD', 'W'), SeriesLeaderBoardServices.removePrizeBreakup)

router.get('/admin/series-leaderboard-category-list/:id/v1', validateAdmin('SERIES_LEADERBOARD', 'R'), SeriesLeaderBoardServices.listCategory)
router.put('/admin/series-leaderboard-category/:id/v1', validators.updateSeriesCategory, validateAdmin('SERIES_LEADERBOARD', 'W'), SeriesLeaderBoardServices.updateCategory)
router.delete('/admin/series-leaderboard-category/:id/v1', validators.removeCategory, validateAdmin('SERIES_LEADERBOARD', 'W'), SeriesLeaderBoardServices.removeCategory)

router.get('/user/series-leaderboard-category/:id/v1', setLanguage, cacheRoute(120), SeriesLeaderBoardServices.getCategory)
router.get('/user/series-leaderboard-category-list/:id/v1', setLanguage, cacheRoute(120), SeriesLeaderBoardServices.userListCategory)

router.get('/admin/series-leaderboard-categories-template/list/v1', validateAdmin('SERIES_LEADERBOARD', 'R'), SeriesLeaderBoardServices.listCategoryTemplate)
router.get('/admin/series-leaderboard-categories-template/v1', validateAdmin('SERIES_LEADERBOARD', 'R'), SeriesLeaderBoardServices.getIdCategoryTemplate)

router.get('/admin/series-leaderboard-calculate-ranks/:id/v1', validateAdmin('SERIES_LEADERBOARD', 'W'), SeriesLeaderBoardServices.calculateRankV2)
router.get('/user/series-leaderboard-get-myrank/:id/v1', isUserAuthenticated, SeriesLeaderBoardServices.getMyRank)
router.get('/user/series-leaderboard-get-allrank/:id/v1', validators.getAllRankV2, setLanguage, cacheRoute(120), SeriesLeaderBoardServices.getAllRankV2)
router.get('/user/series-leaderboard-get-allrank/:id/v2', validators.getAllRankV2, setLanguage, cacheRoute(120), SeriesLeaderBoardServices.getAllRankV2)

router.get('/admin/series-leaderboard-price-calculation/:id/v1', validateAdmin('SERIES_LEADERBOARD', 'W'), SeriesLeaderBoardServices.seriesCategoryPrizeDistribution)
router.get('/admin/series-leaderboard-win-price-distribution/:id/v1', validateAdmin('SERIES_LEADERBOARD', 'W'), SeriesLeaderBoardServices.winDistributionBySeriesCategory)

router.get('/admin/series-leaderboard-get-allrank/:id/v1', validators.getAllRankV2, validateAdmin('SERIES_LEADERBOARD', 'R'), SeriesLeaderBoardServices.getAllRankV2)
router.get('/admin/final-counts/:id/v1', validateAdmin('SERIES_LEADERBOARD', 'R'), SeriesLeaderBoardServices.getFinalSeriesCount)

module.exports = router
