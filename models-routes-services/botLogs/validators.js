const { query } = require('express-validator')
const { PAGINATION_LIMIT } = require('../../config/common')

const getContestLogs = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

module.exports = { getContestLogs }
