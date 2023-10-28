const { body, oneOf, param } = require('express-validator')

const adminDeposit = [
  body('iUserId').not().isEmpty(),
  oneOf([
    body('nCash').not().isEmpty().isNumeric(),
    body('nBonus').not().isEmpty().isNumeric()
  ]),
  body('eType').not().isEmpty().isIn(['deposit', 'winning']),
  body('sPassword').not().isEmpty()
]

const userDeposit = [
  body('ePaymentGateway').not().isEmpty(),
  body('nAmount').not().isEmpty()
]

const userDepositStatus = [
  param('id').not().isEmpty()
]

const depositBreakUp = [
  body('nAmount').not().isEmpty().isNumeric()
]

module.exports = {
  adminDeposit,
  userDeposit,
  userDepositStatus,
  depositBreakUp
}
