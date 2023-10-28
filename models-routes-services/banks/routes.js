const router = require('express').Router()
const bankServices = require('./services')
const { cacheRoute } = require('../../helper/redis')
const { setLanguage } = require('../../middlewares/middleware')

router.get('/user/bank/v1', setLanguage, cacheRoute(300), bankServices.listBank)

module.exports = router
