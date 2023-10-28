const { body } = require('express-validator')
const { paymentGetaways } = require('../../data')

const userPayment = [
  body('nAmount').not().isEmpty().isNumeric(),
  body('eType').not().isEmpty().isIn(paymentGetaways)
]

module.exports = {
  userPayment
}
