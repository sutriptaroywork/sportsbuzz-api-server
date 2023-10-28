const { body } = require('express-validator')
const { issueType } = require('../../data')

const userAddComplaint = [
  body('sTitle').not().isEmpty().escape(),
  body('sDescription').not().isEmpty().escape(),
  body('eType').not().isEmpty().toUpperCase().isIn(issueType)
]

const getSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

const adminUpdateStatus = [
  body('eType').not().isEmpty().toUpperCase().isIn(issueType)
]

const userAddContactUs = [
  body('sTitle').not().isEmpty().escape(),
  body('sDescription').not().isEmpty().escape(),
  body('sEmail').isEmail().not().isEmpty().escape()
]

module.exports = {
  userAddComplaint,
  getSignedUrl,
  adminUpdateStatus,
  userAddContactUs
}
