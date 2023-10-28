const { body } = require('express-validator')
const { popupAdsType, popupAdsPlatform, status } = require('../../data')

const adminAddAds = [
  body('sImage').not().isEmpty(),
  body('eType').not().isEmpty().toUpperCase().isIn(popupAdsType),
  body('ePlatform').not().isEmpty().toUpperCase().isIn(popupAdsPlatform),
  body('eStatus').not().isEmpty().toUpperCase().isIn(status)
]

const adminUpdateAds = [
  body('sImage').not().isEmpty(),
  body('eType').not().isEmpty().toUpperCase().isIn(popupAdsType),
  body('ePlatform').not().isEmpty().toUpperCase().isIn(popupAdsPlatform),
  body('eStatus').not().isEmpty().toUpperCase().isIn(status)
]

const getSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

module.exports = {
  adminAddAds,
  adminUpdateAds,
  getSignedUrl
}
