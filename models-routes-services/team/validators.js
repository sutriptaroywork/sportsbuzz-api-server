const { query, body } = require('express-validator')
const { PAGINATION_LIMIT } = require('../../config/common')

const adminTeamsValidator = [
  query('sportsType').not().isEmpty(),
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

const adminTeamCounts = [
  query('sportsType').not().isEmpty()
]

const adminAddTeam = [
  body('sKey').not().isEmpty(),
  body('sName').not().isEmpty(),
  body('sShortName').not().isEmpty(),
  body('sportsType').not().isEmpty()
]
const adminUpdateTeamsValidator = [
  body('sportsType').not().isEmpty()
]
const adminTeamGetPreSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

module.exports = {
  adminTeamsValidator,
  adminAddTeam,
  adminTeamGetPreSignedUrl,
  adminUpdateTeamsValidator,
  adminTeamCounts
}
