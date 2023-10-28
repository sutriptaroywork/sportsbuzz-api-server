const { query } = require('express-validator')
const { PAGINATION_LIMIT } = require('../../config/common')

const teamList = [
  query('nLimit').optional().isInt({ max: PAGINATION_LIMIT })
]

module.exports = { teamList }
