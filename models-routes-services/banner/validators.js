const { body, oneOf } = require('express-validator')
const { bannerType, status, bannerScreen, bannerPlace } = require('../../data')

const adminAddBanner = [
  body('sImage').not().isEmpty(),
  body('eType').not().isEmpty().toUpperCase().isIn(bannerType),
  body('eStatus').not().isEmpty().toUpperCase().isIn(status),
  body('ePlace').not().isEmpty().toUpperCase().isIn(bannerPlace),
  oneOf([
    body('sLink').not().isEmpty(),
    body('eScreen').not().isEmpty().toUpperCase().isIn(bannerScreen),
    body('eType').not().isEmpty().toUpperCase().isIn('CR')
  ])
]

const adminUpdateBanner = [
  body('sImage').not().isEmpty(),
  body('eType').not().isEmpty().toUpperCase().isIn(bannerType),
  body('eStatus').not().isEmpty().toUpperCase().isIn(status),
  body('ePlace').not().isEmpty().toUpperCase().isIn(bannerPlace),
  oneOf([
    body('sLink').not().isEmpty(),
    body('eScreen').not().isEmpty().toUpperCase().isIn(bannerScreen),
    body('eType').not().isEmpty().toUpperCase().isIn('CR')
  ])
]

const getSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

module.exports = {
  adminAddBanner,
  adminUpdateBanner,
  getSignedUrl
}
