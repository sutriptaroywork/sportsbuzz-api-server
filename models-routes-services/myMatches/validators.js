const { query } = require('express-validator')
const { PAGINATION_LIMIT } = require('../../config/common')

const myMatchesValidator = [
  query('sportsType').not().isEmpty(),
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

module.exports = {
  myMatchesValidator
}
