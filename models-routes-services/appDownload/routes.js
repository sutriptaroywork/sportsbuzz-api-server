const router = require('express').Router()
const appDownloadServices = require('./services')
const validators = require('./validators')
const { validate } = require('../../middlewares/middleware')

router.post('/user/app-download/v1', validators.validateAppDownloadData, validate, appDownloadServices.add)

module.exports = router
