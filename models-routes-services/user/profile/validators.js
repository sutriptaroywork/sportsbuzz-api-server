const { query, body } = require('express-validator')
const { status } = require('../../../data')
const { PAGINATION_LIMIT } = require('../../../config/common')

const states = [
  query('eStatus').optional().toUpperCase().isIn(status)
]

const cities = [
  query('nStateId').not().isEmpty()
]
const updateProfile = [
  body('sName').optional().escape()
]

const listV2 = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

const adminRecommendation = [
  query('nLimit').optional().isInt({ max: PAGINATION_LIMIT })
]

module.exports = { states, cities, updateProfile, listV2, adminRecommendation }
