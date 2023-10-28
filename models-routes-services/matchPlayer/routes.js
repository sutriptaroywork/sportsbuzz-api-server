const router = require('express').Router()
const MatchPlayerServices = require('./services')
const validators = require('./validators')
const { validateAdmin, setLanguage } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')

router.get('/user/match-player/:id/v2', setLanguage, cacheRoute(10), MatchPlayerServices.matchPlayerListUserV2)
router.get('/user/match-player-info/:id/v1', setLanguage, cacheRoute(30), MatchPlayerServices.matchPlayerInfo)
router.get('/user/match-player/score-point/:id/v1', setLanguage, cacheRoute(10), MatchPlayerServices.matchPlayerScorePointUser)
router.get('/user/match-player/season-point/:id/v2', setLanguage, cacheRoute(30), MatchPlayerServices.matchPlayerSeasonPointV2)

// admin
router.post('/admin/match-player/v2', validators.adminAddMatchPlayersV2, validateAdmin('MATCHPLAYER', 'R'), MatchPlayerServices.addV2)
router.get('/admin/match-player/score-point/:id/v1', validateAdmin('MATCHPLAYER', 'R'), MatchPlayerServices.scoredPointGet)
router.get('/admin/match-player/:id/v1', validateAdmin('MATCHPLAYER', 'R'), MatchPlayerServices.get)
router.post('/admin/match-player/pre-signed-url/v1', validators.adminMatchPlayerSignedUrl, validateAdmin('MATCHPLAYER', 'W'), MatchPlayerServices.getSignedUrl)
router.put('/admin/match-player/score-point/:id/v1', validators.adminScorePointUpdate, validateAdmin('MATCHPLAYER', 'W'), MatchPlayerServices.scoredPointUpdate)
router.put('/admin/match-player/:id/v1', validators.adminMatchPlayerUpdate, validateAdmin('MATCHPLAYER', 'W'), MatchPlayerServices.update)
router.delete('/admin/match-player/:id/v1', validateAdmin('MATCHPLAYER', 'W'), MatchPlayerServices.remove)
router.delete('/admin/match-player/:id/v2', validators.adminMatchPlayerRemove, validateAdmin('MATCHPLAYER', 'W'), MatchPlayerServices.removeV2)
router.get('/admin/match-player/cricket/:id/v1', validateAdmin('MATCHPLAYER', 'R'), MatchPlayerServices.fetchMatchPlayerCricket)
router.get('/admin/match-player/cricket/playing-eleven/:id/v1', validateAdmin('MATCHPLAYER', 'R'), MatchPlayerServices.fetchPlaying11Cricket)
router.get('/admin/match-player/football/playing-eleven/:id/v1', validateAdmin('MATCHPLAYER', 'R'), MatchPlayerServices.fetchPlaying11Football)
router.get('/admin/match-player/baseball/:id/v1', validateAdmin('MATCHPLAYER', 'R'), MatchPlayerServices.fetchMatchPlayerBaseball)
router.get('/admin/match-player/football/:id/v1', validateAdmin('MATCHPLAYER', 'R'), MatchPlayerServices.fetchMatchPlayerFootball)
router.get('/admin/match-player/basketball/:id/v1', validateAdmin('MATCHPLAYER', 'R'), MatchPlayerServices.fetchMatchPlayerBasketball)
router.get('/admin/match-player/list/:id/v1', validateAdmin('MATCHPLAYER', 'R'), MatchPlayerServices.list)
router.put('/admin/match-player/season-point/:id/v1', validateAdmin('MATCHPLAYER', 'W'), MatchPlayerServices.calculateSeasonPoint)
router.put('/admin/match-player/season-point/v2', validators.calculateSeasonPoint, validateAdmin('MATCHPLAYER', 'W'), MatchPlayerServices.calculateSeasonPointV2)
router.get('/admin/match-player/kabaddi/:id/v1', validateAdmin('MATCHPLAYER', 'R'), MatchPlayerServices.fetchMatchPlayerKabaddi)
router.get('/admin/match-player/kabaddi/starting-seven/:id/v1', validateAdmin('MATCHPLAYER', 'R'), MatchPlayerServices.fetchStarting7Kabaddi)
router.get('/admin/match-player/basketball/starting-five/:id/v1', validateAdmin('MATCHPLAYER', 'R'), MatchPlayerServices.fetchStarting5Basketball)
router.put('/admin/match-player/combination-bot-players/:iMatchId/v1', validators.updateCombinationBotPlayers, validateAdmin('MATCHPLAYER', 'W'), MatchPlayerServices.updateCombinationBotPlayers)
router.get('/admin/match-player/combination-bot-players/:iMatchId/v1', validateAdmin('MATCHPLAYER', 'W'), MatchPlayerServices.getCombinationBotPlayers)
router.post('/admin/match-player/sort-match-players/:iMatchId/v1', validators.sortCombinationPlayer, validateAdmin('MATCHPLAYER', 'W'), MatchPlayerServices.createSortPlayers)

module.exports = router