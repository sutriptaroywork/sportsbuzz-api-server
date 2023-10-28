const { body } = require('express-validator')
const { status } = require('../../data')

const adminAddCMS = [
  body('sTitle').not().isEmpty(),
  body('sSlug').not().isEmpty(),
  body('sContent').not().isEmpty(),
  body('nPriority').not().isEmpty().isInt(),
  body('eStatus').not().isEmpty().toUpperCase().isIn(status)
]

const adminUpdateCMS = [
  body('sTitle').not().isEmpty(),
  body('sSlug').not().isEmpty(),
  body('sContent').not().isEmpty(),
  body('nPriority').not().isEmpty().isInt(),
  body('eStatus').not().isEmpty().toUpperCase().isIn(status)
]

const adminAddCSS = [
  body('sTitle').not().isEmpty(),
  body('sContent').not().isEmpty()
]

module.exports = {
  adminAddCMS,
  adminUpdateCMS,
  adminAddCSS
}
