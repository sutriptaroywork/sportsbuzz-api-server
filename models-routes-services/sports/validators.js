const { body } = require('express-validator')

const adminAddSports = [
  body('sName').not().isEmpty(),
  body('sKey').not().isEmpty()
]

module.exports = {
  adminAddSports
}
