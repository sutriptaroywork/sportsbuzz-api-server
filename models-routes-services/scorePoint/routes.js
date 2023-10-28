const router = require('express').Router()
const scorePointServices = require('./services')
const validators = require('./validators')
const { validateAdmin, setLanguage } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

router.post('/admin/score-point/:id/v1', validateAdmin('SCORE_POINT', 'W'), scorePointServices.scorePointGenerate)
router.post('/admin/score-point/football/:id/v1', validateAdmin('SCORE_POINT', 'W'), scorePointServices.footballScorePointGenerate)
router.post('/admin/score-point/basketball/:id/v1', validateAdmin('SCORE_POINT', 'W'), scorePointServices.basketballScorePointGenerate)
router.post('/admin/score-point/kabaddi/:id/v1', validateAdmin('SCORE_POINT', 'W'), scorePointServices.kabaddiScorePointGenerate)
router.get('/admin/score-point/v1', validators.getScorePoints, validateAdmin('SCORE_POINT', 'R'), scorePointServices.get)
router.get('/admin/point-system/v1', validateAdmin('SCORE_POINT', 'R'), scorePointServices.getPointSystem)

router.get('/admin/score-point/:id/v1', validateAdmin('SCORE_POINT', 'R'), scorePointServices.getSingle)
router.put('/admin/score-point/:id/v1', validateAdmin('SCORE_POINT', 'W'), scorePointServices.update)

router.get('/user/score-point/v1', validators.getScorePoints, setLanguage, cacheRoute(60), scorePointServices.get)

module.exports = router
