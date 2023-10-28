const { body } = require('express-validator')

const adminAddPayoutOption = [
  body('sTitle').not().isEmpty(),
  body('eType').not().isEmpty(),
  body('eKey').not().isEmpty()
]

const adminGetPayoutOptionSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

const adminUpdatePayoutOption = [
  body('sTitle').not().isEmpty(),
  body('eType').not().isEmpty(),
  body('eKey').not().isEmpty()
]

module.exports = {
  adminAddPayoutOption,
  adminGetPayoutOptionSignedUrl,
  adminUpdatePayoutOption
}
