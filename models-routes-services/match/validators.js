const { query, body, param } = require('express-validator')
const { format, category } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')

const upcomingMatchList = [
  query('sportsType').not().isEmpty()
]

const adminMatchList = [
  query('sportsType').not().isEmpty(),
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

const adminMatchCount = [
  query('sportsType').not().isEmpty()
]

const adminAddMatch = [
  body('sName').trim().not().isEmpty(),
  body('eFormat').not().isEmpty().toUpperCase().isIn(format),
  body('sSeasonKey').not().isEmpty(),
  body('dStartDate').not().isEmpty(),
  body('eCategory').not().isEmpty().toUpperCase().isIn(category),
  body('iHomeTeamId').not().isEmpty(),
  body('iAwayTeamId').not().isEmpty()
]

const adminUpdateMatch = [
  param('id').isMongoId(),
  body('sName').trim().not().isEmpty(),
  body('eFormat').not().isEmpty().toUpperCase().isIn(format),
  body('sSeasonKey').not().isEmpty(),
  body('dStartDate').not().isEmpty(),
  body('eCategory').not().isEmpty().toUpperCase().isIn(category),
  body('iHomeTeamId').not().isEmpty(),
  body('iAwayTeamId').not().isEmpty()
]

const adminLineupsOut = [
  param('id').isMongoId(),
  body('bLineupsOut').not().isEmpty().isBoolean()
]

const adminFetchMatches = [
  body('dDate').not().isEmpty()
]

const adminMergeMatches = [
  body('id').not().isEmpty(),
  body('apiMatchId').not().isEmpty(),
  body('aPlayers').isArray().not().isEmpty(),
  body('aPlayers.*.oldId').not().isEmpty(),
  body('aPlayers.*.newId').not().isEmpty()
]

const adminRefreshMatch = [
  param('id').isMongoId()
]

const adminLogsMatch = [
  param('id').isMongoId()
]

const adminGetMatch = [
  param('id').isMongoId()
]

const userGetMatch = [
  param('id').isMongoId()
]
const matchStreamList = [
  query('nLimit').optional().isInt({ max: PAGINATION_LIMIT })
]

const fullList = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

module.exports = {
  upcomingMatchList,
  adminMatchList,
  adminAddMatch,
  adminUpdateMatch,
  adminLineupsOut,
  adminFetchMatches,
  adminMatchCount,
  adminMergeMatches,
  adminRefreshMatch,
  adminLogsMatch,
  adminGetMatch,
  userGetMatch,
  matchStreamList,
  fullList
}
