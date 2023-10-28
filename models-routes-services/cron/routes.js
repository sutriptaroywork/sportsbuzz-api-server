const router = require('express').Router()
const cronServices = require('./services')
const { setLanguage, validate } = require('../../middlewares/middleware')
const validators = require('./validators')

router.post('/admin/cron/v1', setLanguage, cronServices.calculateMatchPlayerSetBy)

router.post('/admin/cron/match-live/v1', setLanguage, cronServices.matchLive.bind(cronServices))

// Expire bonus which user got. time: run daily (once at 12:01 AM)
router.post('/admin/cron/bonus-expire/v1', setLanguage, cronServices.bonusExpire)

router.get('/admin/cron/leaderboard/v1', setLanguage, cronServices.liveLeaderboard)

router.get('/admin/cron/load-leaderboard/v1', validators.loadLeaderboard, validate, cronServices.loadLeaderboard.bind(cronServices))

router.get('/admin/cron/calculate-season-point/v1', setLanguage, cronServices.calculateSeasonPoint)

// Last Pending Deposit Payment processing every 1 hour...
router.get('/admin/cron/process-payment/v1', setLanguage, cronServices.processDepositPayment)

// remove pending matches(30 day old and team must not formed) time : run daily(once in a day)
router.get('/admin/cron/remove-pending-matches/v1', setLanguage, cronServices.removePendingMatches)

// Last Pending Deposit Payment processing every 10 minutes...
router.get('/admin/cron/process-playreturn/v1', setLanguage, cronServices.processPlayReturn)

// Pending Cashfree Payout processing every 1 hour...
router.get('/admin/cron/process-initiated-payouts/v1', setLanguage, cronServices.processInitiatedPayouts)

// Fix transactions mismatch script for cron
router.get('/admin/cron/fix-statistics/v1', setLanguage, cronServices.fixStatistics)

router.get('/admin/cron/check-live-leagues/v1', setLanguage, cronServices.checkLiveLeagues)

// Future upcoming/pending matches data update at every 30 mins.
router.get('/admin/cron/update-match-data/v1', setLanguage, cronServices.updateMatchData)

// It'll remove api logs for old win distributed matches every week
router.get('/admin/cron/remove-old-apilogs/v1', setLanguage, cronServices.removeOldApiLogs)

// It'll send league reports of a day's matchleagues to client at 2AM everyday
router.get('/admin/cron/report/v1', setLanguage, cronServices.leaguesReport)

router.get('/admin/cron/prepare-autofill-matchleagues/v1', setLanguage, cronServices.prepareAutoFillMatchLeagues)

router.get('/admin/cron/start-autofill-matchleagues/v1', setLanguage, cronServices.autoFillMatchleagues)

// It'll send apps flyer reports of a day's to client at 2AM everyday
router.get('/admin/cron/appsflyer-report/v1', setLanguage, cronServices.appsFlyerReport)
// Fetch Entitysports Playing11 for match only for every 5 mins.
router.get('/admin/cron/match-player/entity-playing-eleven/v1', setLanguage, cronServices.fetchEntitySportLineUpsPlayer)

// send weekly user reports
router.get('/admin/cron/user-reports/v1', setLanguage, cronServices.weeklyMail)

router.get('/admin/cron/match-reports/v1', setLanguage, cronServices.getDailyMatchData)

router.get('/admin/cron/backup-old-adminlogs/v1', setLanguage, cronServices.backupOldAdminLogs)

router.get('/admin/cron/backup-old-botlogs/v1', setLanguage, cronServices.backupOldBotLogs)

// It will add system bots inside Set of REDIS after every 6 Hours
router.get('/admin/cron/fill-system-users/v1', setLanguage, cronServices.fillSetOfSystemUsers)

// It will delete the 15 days older my matches of bots
router.get('/admin/cron/delete-mymatches/v1', setLanguage, cronServices.deleteMyMatches)

router.get('/admin/cron/user-league-report/v1', setLanguage, cronServices.userLeagueReportCsv.bind(cronServices))

// It will delete the 7 days older CopyTeamUpdateLogs
router.get('/admin/cron/delete-cb-updatelogs/v1', setLanguage, cronServices.deleteCopyBotUpdateLogs)

module.exports = router
