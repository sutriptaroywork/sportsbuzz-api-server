const { body, query } = require('express-validator')
const { settingKeys } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')

const adminAddSetting = [
  body('sTitle').not().isEmpty(),
  body('sKey').not().isEmpty(),
  body('nMax').not().isEmpty().isInt(),
  body('nMin').not().isEmpty().isInt()
]

const adminUpdateSetting = [
  body('sKey').not().isEmpty()
]

const adminUpdateCurrency = [
  body('sTitle').not().isEmpty(),
  body('sShortName').not().isEmpty(),
  body('sLogo').not().isEmpty()
]

const adminUpdateSiteBackground = [
  body('sImage').not().isEmpty(),
  body('sKey').not().isEmpty().toUpperCase().isIn(settingKeys)
]

const getSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

const list = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

module.exports = {
  adminAddSetting,
  adminUpdateCurrency,
  adminUpdateSiteBackground,
  getSignedUrl,
  adminUpdateSetting,
  list
}
