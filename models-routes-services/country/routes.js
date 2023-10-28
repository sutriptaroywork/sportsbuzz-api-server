const router = require('express').Router()
const countryServices = require('./services')
const { cacheRoute } = require('../../helper/redis')

router.get('/user/country/v1', cacheRoute(60), countryServices.list)

router.get('/admin/country/v1', countryServices.list)

module.exports = router
