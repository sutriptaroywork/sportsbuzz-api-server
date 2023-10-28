const { body, query } = require('express-validator')
const { PAGINATION_LIMIT } = require('../../config/common')

const adminAddLeagueCategory = [
  body('sTitle').not().isEmpty(),
  body('nPosition').not().isEmpty().isNumeric()
]

const adminAddFilterCategory = [
  body('sTitle').not().isEmpty()
]

const getSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

const list = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

module.exports = {
  adminAddLeagueCategory,
  adminAddFilterCategory,
  getSignedUrl,
  list
}
