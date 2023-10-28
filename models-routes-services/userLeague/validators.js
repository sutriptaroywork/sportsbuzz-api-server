const { body, query, param } = require('express-validator')
const { PAGINATION_LIMIT } = require('../../config/common')

const userJoinLeagueV1 = [
  body('iUserTeamId').not().isEmpty(),
  body('iMatchLeagueId').not().isEmpty(),
  body('bPrivateLeague').not().isEmpty().isBoolean()
]

const userJoinLeagueV2 = [
  body('aUserTeamId').not().isEmpty().isArray(),
  body('iMatchLeagueId').not().isEmpty(),
  body('bPrivateLeague').not().isEmpty().isBoolean()
]

const userJoinLeagueV3 = [
  body('aUserTeamId').not().isEmpty().isArray(),
  body('iMatchLeagueId').not().isEmpty()
]

const switchUserTeam = [
  body('iUserTeamId').not().isEmpty()
]

const matchWiseUserLeagueList = [
  body('iUserId').not().isEmpty(),
  body('iMatchId').not().isEmpty()
]
const list = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]
const extraWinList = [
  param('id').not().isEmpty().isMongoId(),
  query('eMatchStatus').not().isEmpty().isIn(['CMP', 'I'])
]
module.exports = {
  userJoinLeagueV1,
  userJoinLeagueV2,
  userJoinLeagueV3,
  switchUserTeam,
  matchWiseUserLeagueList,
  list,
  extraWinList
}
