const { body } = require('express-validator')
const { status } = require('../../data')

const adminAddOffers = [
  body('sTitle').not().isEmpty(),
  body('sDescription').not().isEmpty(),
  body('sDetail').not().isEmpty(),
  body('eStatus').not().isEmpty().toUpperCase().isIn(status)
]

const adminGetOfferSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

module.exports = {
  adminAddOffers,
  adminGetOfferSignedUrl
}
