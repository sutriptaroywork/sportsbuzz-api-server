const { body, oneOf } = require('express-validator')

const adminDeposit = [
  body('iUserId').not().isEmpty(),
  oneOf([
    body('nCash').not().isEmpty().isNumeric(),
    body('nBonus').not().isEmpty().isNumeric()
  ])
]

module.exports = {
  adminDeposit
}
