const { body } = require('express-validator')
const { existingSocialType } = require('../../../data')

const register = [
  body('sUsername').not().isEmpty().escape(),
  body('sEmail').isEmail().not().isEmpty(),
  body('sMobNum').not().isEmpty(),
  body('sCode').not().isEmpty(),
  body('sDeviceToken').not().isEmpty(),
  body('sPassword').not().isEmpty()
]

const checkExist = [
  body('sType').not().isEmpty(),
  body('sValue').not().isEmpty()
]

const checkExistV2 = [
  body('sUsername').not().isEmpty(),
  body('sEmail').not().isEmpty(),
  body('sMobNum').not().isEmpty()
]

const login = [
  body('sLogin').not().isEmpty(),
  body('sPassword').not().isEmpty(),
  body('sDeviceToken').not().isEmpty()
]

const sendOTP = [
  body('sLogin').not().isEmpty(),
  body('sAuth').not().isEmpty(),
  body('sType').not().isEmpty()
]

const verifyOTP = [
  body('sLogin').not().isEmpty(),
  body('sAuth').not().isEmpty(),
  body('sType').not().isEmpty(),
  body('sCode').isNumeric()
]

const resetPassword = [
  body('sLogin').not().isEmpty(),
  body('sAuth').not().isEmpty(),
  body('sType').not().isEmpty(),
  body('sCode').isNumeric(),
  body('sNewPassword').not().isEmpty()
]

const changePassword = [
  body('sOldPassword').not().isEmpty(),
  body('sNewPassword').not().isEmpty()
]

const validateToken = [
  body('sPushToken').not().isEmpty(),
  body('sDeviceToken').not().isEmpty()
]

// const socialLogin = [
//   body('sSocialType').not().isEmpty(),
//   body('sSocialToken').not().isEmpty()
// ]

const socialLogin = [
  body('sPayLoad').not().isEmpty(),
  body('sSignature').not().isEmpty()
]

const validateTokenV2 = [
  body('sPushToken').not().isEmpty()
]

const loginV3 = [
  body('sLogin').not().isEmpty(),
  body('sPassword').not().isEmpty()
]

const registerV3 = [
  body('sUsername').not().isEmpty().escape(),
  body('sEmail').isEmail().not().isEmpty(),
  body('sMobNum').not().isEmpty(),
  body('sCode').not().isEmpty(),
  body('sPassword').not().isEmpty()
]

const verifyOTPV2 = [
  body('sLogin').not().isEmpty(),
  body('sAuth').not().isEmpty(),
  body('sType').not().isEmpty(),
  body('sCode').isNumeric()
]

const socialLoginV2 = [
  body('sSocialType').not().isEmpty(),
  body('sSocialToken').not().isEmpty()
]

const sendOTPV2 = [
  body('sLogin').not().isEmpty()
]

const registerV5 = [
  body('sLogin').not().isEmpty(),
  body('sName').not().isEmpty().escape(),
  body('sSocialType').optional().toUpperCase().isIn(existingSocialType)
]

const verifyOTPV3 = [
  body('sLogin').not().isEmpty(),
  body('sCode').isNumeric()
]

const downloadLink = [
  body('sPhone').not().isEmpty()
]
module.exports = {
  register,
  checkExist,
  login,
  sendOTP,
  verifyOTP,
  resetPassword,
  changePassword,
  validateToken,
  socialLogin,
  checkExistV2,
  validateTokenV2,
  loginV3,
  registerV3,
  verifyOTPV2,
  socialLoginV2,
  sendOTPV2,
  registerV5,
  verifyOTPV3,
  downloadLink
}
