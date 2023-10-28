const { body } = require('express-validator')

const adminLogin = [
  body('sLogin').not().isEmpty(),
  body('sPassword').not().isEmpty()
]

// Deprecated Validator
const createSubAdmin = [
  body('sName').not().isEmpty(),
  body('sUsername').not().isEmpty(),
  body('sEmail').isEmail().not().isEmpty().escape(),
  body('sMobNum').not().isEmpty(),
  body('sPassword').not().isEmpty(),
  body('aPermissions').not().isEmpty().isArray()
]

const createSubAdminV3 = [
  body('sName').not().isEmpty(),
  body('sUsername').not().isEmpty(),
  body('sEmail').isEmail().not().isEmpty().escape(),
  body('sMobNum').not().isEmpty(),
  body('sPassword').not().isEmpty(),
  body('iRoleId').not().isEmpty()
]

// Not in Used
const sendOTP = [
  body('sLogin').not().isEmpty()
]

// Not in Used
const verifyOTP = [
  body('sLogin').not().isEmpty(),
  body('sAuth').not().isEmpty(),
  body('sType').not().isEmpty(),
  body('sCode').isNumeric()
]

module.exports = {
  adminLogin,
  createSubAdmin,
  sendOTP,
  verifyOTP,
  createSubAdminV3
}
