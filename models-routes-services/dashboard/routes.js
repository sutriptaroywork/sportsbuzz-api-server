const router = require('express').Router()
const dashboardServices = require('./services')
const validators = require('./validators')
const { validateAdmin } = require('../../middlewares/middleware')

router.get('/admin/dashboard/v1', validateAdmin('DASHBOARD', 'R'), dashboardServices.fetchDashboard)

router.put('/admin/register-dashboard/:id/v1', validators.updateDashboard, validateAdmin('DASHBOARD', 'W'), dashboardServices.updateRegisterUserDashboard)
router.put('/admin/deposit-dashboard/:id/v1', validators.updateDashboard, validateAdmin('DASHBOARD', 'W'), dashboardServices.updateDepositDashboard)
router.put('/admin/withdraw-dashboard/:id/v1', validators.updateDashboard, validateAdmin('DASHBOARD', 'W'), dashboardServices.updateWithdrawDashboard)
router.put('/admin/userteam-dashboard/:id/v1', validators.updateDashboard, validateAdmin('DASHBOARD', 'W'), dashboardServices.updateUserTeamDashboard)

module.exports = router
