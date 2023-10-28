const { status, jsonStatus } = require('../helper/api.responses')
const { cacheHTMLRoute } = require('../helper/redis')
const scorecardServices = require('../models-routes-services/scorecard/services')
const testQueue = require('../rabbitmq/queue/testQueue');
module.exports = (app) => {
  app.use('/api', [
    require('../models-routes-services/admin/auth/routes'),
    require('../models-routes-services/offers/routes'),
    require('../models-routes-services/cms/routes'),
    require('../models-routes-services/promocode/routes'),
    require('../models-routes-services/banner/routes'),
    require('../models-routes-services/commonRules/routes'),
    require('../models-routes-services/sports/routes'),
    require('../models-routes-services/match/routes'),
    require('../models-routes-services/player/routes'),
    require('../models-routes-services/team/routes'),
    require('../models-routes-services/matchPlayer/routes'),
    require('../models-routes-services/playerRoles/routes'),
    require('../models-routes-services/leagueCategory/routes'),
    require('../models-routes-services/league/routes'),
    require('../models-routes-services/matchLeague/routes'),
    require('../models-routes-services/privateLeague/routes'),
    require('../models-routes-services/userTeam/routes'),
    require('../models-routes-services/userLeague/routes'),
    require('../models-routes-services/scorePoint/routes'),
    require('../models-routes-services/cron/routes'),
    require('../models-routes-services/admin/permissions/routes'),
    require('../models-routes-services/admin/subAdmin/routes'),
    require('../models-routes-services/myMatches/routes'),
    require('../models-routes-services/kyc/routes'),
    require('../models-routes-services/user/bankDetails/routes'),
    require('../models-routes-services/user/auth/routes'),
    require('../models-routes-services/user/statistics/routes'),
    require('../models-routes-services/user/profile/routes'),
    require('../models-routes-services/notification/routes'),
    require('../models-routes-services/paymentOptions/routes'),
    require('../models-routes-services/version/routes'),
    require('../models-routes-services/userDeposit/routes'),
    require('../models-routes-services/passbook/routes'),
    require('../models-routes-services/preferences/routes'),
    require('../models-routes-services/userBalance/routes'),
    require('../models-routes-services/setting/routes'),
    require('../models-routes-services/leaderBoard/routes'),
    require('../models-routes-services/report/routes'),
    require('../models-routes-services/user/systemUser/routes'),
    require('../models-routes-services/userWithdraw/routes'),
    require('../models-routes-services/seriesLeaderBoard/routes'),
    require('../models-routes-services/payment/routes'),
    require('../models-routes-services/maintenance/routes'),
    require('../models-routes-services/emailTemplates/routes'),
    require('../models-routes-services/country/routes'),
    require('../models-routes-services/promocode/statistics/routes'),
    require('../models-routes-services/match/fantasyPosts/routes'),
    require('../models-routes-services/popupAds/routes'),
    require('../models-routes-services/banner/statistics/routes'),
    require('../models-routes-services/complaints/routes'),
    require('../models-routes-services/payoutOptions/routes'),
    require('../models-routes-services/admin/roles/routes'),
    require('../models-routes-services/season/routes'),
    require('../models-routes-services/dashboard/routes'),
    require('../models-routes-services/botLogs/routes'),
    require('../models-routes-services/userTds/routes'),
    require('../models-routes-services/scorecard/routes'),
    require('../models-routes-services/banks/routes'),
    require('../models-routes-services/appDownload/routes'),
    require('../models-routes-services/apiLog/routes')
  ])
  app.get('/health-check', (req, res) => {
    const sDate = new Date().toJSON()
    return res.status(status.OK).jsonp({ status: jsonStatus.OK, sDate })
  })
  app.get('/score-card/:matchId', scorecardServices.viewHTMLScorecard)
  app.get('*', (req, res) => {
    return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound })
  })

  app.post('/rabbitmq-health-check', (req, res) => {
    testQueue.publish(req.body)
    return res.status(status.OK).jsonp({
      status: jsonStatus.OK,
      sDate: new Date()
    })
  })
}
