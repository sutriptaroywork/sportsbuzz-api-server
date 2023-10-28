const router = require('express').Router()
const myMatchesServices = require('./services')
const validators = require('./validators')
const { isUserAuthenticated } = require('../../middlewares/middleware')

router.get('/user/my-matches/list/v4', validators.myMatchesValidator, isUserAuthenticated, myMatchesServices.myMatchesListV4)

module.exports = router
