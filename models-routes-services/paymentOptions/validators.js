const { body } = require('express-validator')

const adminAddPaymentOption = [
  body('sName').not().isEmpty()
]

const adminGetPaymentOptionSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

const adminUpdatePaymentOption = [
  body('sName').not().isEmpty()
]

module.exports = {
  adminAddPaymentOption,
  adminGetPaymentOptionSignedUrl,
  adminUpdatePaymentOption
}
