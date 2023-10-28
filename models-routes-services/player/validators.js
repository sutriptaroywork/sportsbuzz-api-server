const { query, body } = require('express-validator')
const { role } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')

const adminPlayerList = [
  query('sportsType').not().isEmpty(),
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

const adminPlayerCount = [
  query('sportsType').not().isEmpty()
]

const adminAddPlayer = [
  body('sKey').not().isEmpty(),
  body('sName').not().isEmpty(),
  body('nFantasyCredit').not().isEmpty().isNumeric(),
  body('eRole').not().isEmpty().toUpperCase().isIn(role),
  body('sportsType').not().isEmpty()
]

const adminPlayerGetSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

const adminPlayerUpdate = [
  body('sportsType').not().isEmpty()
]

module.exports = {
  adminPlayerList,
  adminAddPlayer,
  adminPlayerGetSignedUrl,
  adminPlayerUpdate,
  adminPlayerCount
}
