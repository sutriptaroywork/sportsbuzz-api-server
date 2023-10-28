const { body, query } = require('express-validator')
const { tdsStatus } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')

const adminUpdateTdsValidator = [
  body('eStatus').not().isEmpty().isIn(tdsStatus)
]
const adminList = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

const userWithdraw = [
  body('nAmount').not().isEmpty()
]
module.exports = {
  adminUpdateTdsValidator,
  adminList,
  userWithdraw
}
