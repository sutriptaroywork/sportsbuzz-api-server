const { body, query, param } = require('express-validator')
const { category } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')

const adminAddMatchLeague = [
  body('iMatchId').not().isEmpty(),
  body('iLeagueId').isArray().not().isEmpty()
]

const adminBotCreate = [
  body('bBotCreate').not().isEmpty().isBoolean()
]

const adminMatchLeagueReports = [
  query('dDateFrom').not().isEmpty().isString(),
  query('dDateTo').not().isEmpty().isString(),
  query('eCategory').not().isEmpty().isIn(category).isString()
]

const cashbackDetailsV2 = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]
const matchleagueList = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT }),
  query('eType').optional().isIn(['B', 'CMB'])
]

const adminUpdateLeague = [
  param('id').isMongoId(),
  body('iLeagueCatId').not().isEmpty().isMongoId()
]

module.exports = {
  adminAddMatchLeague,
  adminBotCreate,
  adminMatchLeagueReports,
  cashbackDetailsV2,
  adminUpdateLeague,
  matchleagueList
}
