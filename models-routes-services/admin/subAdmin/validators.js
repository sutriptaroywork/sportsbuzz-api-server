const { body } = require('express-validator')

// Deprecated Validator
const updateSubAdmin = [
  body('sName').not().isEmpty(),
  body('sUsername').not().isEmpty(),
  body('sEmail').isEmail(),
  body('sMobNum').not().isEmpty(),
  body('aPermissions').not().isEmpty().isArray()
]

const updateSubAdminV2 = [
  body('sName').not().isEmpty(),
  body('sUsername').not().isEmpty(),
  body('sEmail').isEmail().escape(),
  body('sMobNum').not().isEmpty(),
  body('iRoleId').not().isEmpty()
]

module.exports = {
  updateSubAdmin,
  updateSubAdminV2
}
