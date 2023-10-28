const { query, body, param } = require('express-validator')
const { status, category, leagueRankType } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')

const adminAddLeague = [
  body('sName').trim().not().isEmpty(),
  body('iLeagueCatId').not().isEmpty(),
  body('eCategory').not().isEmpty().toUpperCase().isIn(category),
  body('iFilterCatId').not().isEmpty(),
  body('nMax').not().isEmpty().isInt(),
  body('nMin').not().isEmpty().isInt(),
  body('nPrice').not().isEmpty().isNumeric(),
  body('nTotalPayout').not().isEmpty().isNumeric(),
  body('nPosition').not().isEmpty().isInt(),
  body('nWinnersCount').not().isEmpty().isInt(),
  body('nBonusUtil').not().isEmpty().isNumeric(),
  body('bConfirmLeague').not().isEmpty().isBoolean(),
  body('bMultipleEntry').not().isEmpty().isBoolean(),
  body('bAutoCreate').not().isEmpty().isBoolean(),
  body('bPoolPrize').not().isEmpty().isBoolean(),
  body('bUnlimitedJoin').not().isEmpty().isBoolean(),
  body('eStatus').not().isEmpty().toUpperCase().isIn(status),
  body('bBotCreate').optional().isBoolean(),
  body('nMinTeamCount').optional().isInt(),
  body('nBotsCount').optional().isInt(),
  body('nCopyBotsPerTeam').optional().isInt(),
  body('nSameCopyBotTeam').optional().isInt(),
  body('nAutoFillSpots').optional().isInt()
]

const adminLeagueList = [
  query('sportsType').not().isEmpty(),
  query('sportsType').not().isEmpty(),
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

const adminUpdateLeague = [
  body('eCategory').not().isEmpty().toUpperCase().isIn(category)
]

const adminAddPrizeBreakup = [
  body('nRankFrom').not().isEmpty().isInt(),
  body('nRankTo').not().isEmpty().isInt(),
  body('nPrize').not().isEmpty().isNumeric(),
  body('eRankType').not().isEmpty().toUpperCase().isIn(leagueRankType)
]

const adminGetLeagueSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

const adminUpdatePrizeBreakup = [
  body('nRankFrom').not().isEmpty().isInt(),
  body('nRankTo').not().isEmpty().isInt(),
  body('nPrize').not().isEmpty().isNumeric(),
  body('eRankType').not().isEmpty().toUpperCase().isIn(leagueRankType)
]

const adminCopyLeague = [
  body('eCategory').isArray().not().isEmpty(),
  body('eCategory.*').not().isEmpty().isIn(category)
]

const adminLogsLeague = [
  param('id').isMongoId()
]

const fullLeagueListV2 = [
  query('nLimit').optional().isInt({ max: PAGINATION_LIMIT })
]

module.exports = {
  adminAddLeague,
  adminLeagueList,
  adminUpdateLeague,
  adminAddPrizeBreakup,
  adminGetLeagueSignedUrl,
  adminUpdatePrizeBreakup,
  adminCopyLeague,
  adminLogsLeague,
  fullLeagueListV2
}
