const { body } = require('express-validator')
const { versionType } = require('../../data')

const addVersionDetails = [
  body('sName').not().isEmpty(),
  body('eType').not().isEmpty().toUpperCase().isIn(versionType),
  body('sVersion').not().isEmpty()
]

module.exports = {
  addVersionDetails
}
