const router = require('express').Router()
const reportServices = require('./services')
const { validateAdmin, validateRoute } = require('../../middlewares/middleware')
const validators = require('./validators')

router.post('/admin/report/:id/v1', validateAdmin('REPORT', 'W'), reportServices.matchReport)

router.put('/admin/update-report/:id/v1', validateAdmin('REPORT', 'W'), reportServices.updateMatchReport)

router.get('/admin/report/:id/v1', validateAdmin('REPORT', 'R'), reportServices.get)

router.get('/admin/reports/v1', validateAdmin('REPORT', 'R'), reportServices.fetchReport)

router.put('/admin/user-reports/v1', validators.checkReport, validateAdmin('REPORT', 'R'), reportServices.fetchUserReport)
router.put('/admin/play-reports/:id/v1', validators.validateReportData, validateAdmin('REPORT', 'W'), reportServices.playReport)
router.put('/admin/play-return-reports/:id/v1', validators.validateReportData, validateAdmin('REPORT', 'W'), reportServices.playReturnReport)
router.put('/admin/cashback-reports/:id/v1', validators.validateReportData, validateAdmin('REPORT', 'W'), reportServices.cashbackReport)
router.put('/admin/cashback-return-reports/:id/v1', validators.validateReportData, validateAdmin('REPORT', 'W'), reportServices.cashbackReturnReport)
router.put('/admin/wins-reports/:id/v1', validators.validateReportData, validateAdmin('REPORT', 'W'), reportServices.fetchWinReport)
router.put('/admin/wins-return-reports/:id/v1', validators.validateReportData, validateAdmin('REPORT', 'W'), reportServices.fetchWinReturnReport)
router.put('/admin/creator-bonus/:id/v1', validators.validateReportData, validateAdmin('REPORT', 'W'), reportServices.creatorBonusReport)
router.put('/admin/creator-bonus-return/:id/v1', validators.validateReportData, validateAdmin('REPORT', 'W'), reportServices.creatorBonusReturnReport)
router.put('/admin/userteam-reports/:id/v1', validators.validateReportData, validateAdmin('REPORT', 'W'), reportServices.fetchTeamReport)
router.put('/admin/league-participants-reports/:id/v1', validators.validateReportData, validateAdmin('REPORT', 'W'), reportServices.fetchParticipantReport)
router.put('/admin/private-league-reports/:id/v1', validators.validateReportData, validateAdmin('REPORT', 'W'), reportServices.fetchPrivateLeagueReport)
router.put('/admin/app-download-reports/:id/v1', validators.validateAppReportData, validateAdmin('REPORT', 'W'), reportServices.fetchAppDownloadReport)

router.get('/admin/filter-reports/v1', validators.validateData, validateAdmin('REPORT', 'R'), reportServices.fetchfilterReport)

router.post('/admin/user-revenue/v1', validateRoute, reportServices.getUserRevenue)

module.exports = router
