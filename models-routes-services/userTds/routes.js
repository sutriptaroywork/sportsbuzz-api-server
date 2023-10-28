const router = require('express').Router()
const { validateAdmin, isUserAuthenticated } = require('../../middlewares/middleware')
const tdsServises = require('./services')
const validators = require('./validators')

// USER
router.post('/user/tds/tds-breakup/v1', validators.userWithdraw, isUserAuthenticated, tdsServises.getTDSBreakUp)
router.get('/user/tds/tds-free-amount/v1', isUserAuthenticated, tdsServises.getTaxFreeAmount)
// ADMIN
router.get('/admin/tds/list/v1', validators.adminList, validateAdmin('TDS', 'R'), tdsServises.adminList)
router.put('/admin/tds/:id/v1', validators.adminUpdateTdsValidator, validateAdmin('TDS', 'W'), tdsServises.update)
router.get('/admin/tds/counts/v1', validateAdmin('TDS', 'R'), tdsServises.getCounts)
router.get('/admin/tds/match-league-tds/:id/v1', validators.adminList, validateAdmin('TDS', 'R'), tdsServises.matchLeagueTdsList)
router.get('/admin/tds/match-league-tds/count/:id/v1', validateAdmin('TDS', 'R'), tdsServises.matchLeagueTdsCount)
router.post('/admin/tds/process-tds/v1', validateAdmin('TDS', 'W'), tdsServises.processTDSEndOfYear)

module.exports = router
