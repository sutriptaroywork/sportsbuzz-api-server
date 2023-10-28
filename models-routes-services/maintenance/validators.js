const { body } = require('express-validator')

const adminUpdateMode = [
  body('bIsMaintenanceMode').not().isEmpty().isBoolean(),
  body('sMessage').not().isEmpty()
]

module.exports = {
  adminUpdateMode
}
