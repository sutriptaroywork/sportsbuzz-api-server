const { body } = require('express-validator')

const userWithdraw = [
  body('ePaymentGateway').not().isEmpty(),
  body('sInfo').not().isEmpty(),
  body('nAmount').not().isEmpty()
]

const adminWithdraw = [
  body('iUserId').not().isEmpty(),
  body('eType').not().isEmpty().isIn(['withdraw', 'winning']),
  body('nAmount').not().isEmpty(),
  body('sPassword').not().isEmpty()
]

module.exports = {
  userWithdraw,
  adminWithdraw
}
