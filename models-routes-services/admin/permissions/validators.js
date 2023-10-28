const { body } = require('express-validator')
const { status, adminPermission } = require('../../../data')

const permissionAdd = [
  body('sName').not().isEmpty(),
  body('sKey').not().isEmpty().isIn(adminPermission)
]

const permissionUpdate = [
  body('sName').not().isEmpty(),
  body('sKey').not().isEmpty().isIn(adminPermission),
  body('eStatus').not().isEmpty().toUpperCase().isIn(status)
]

module.exports = {
  permissionAdd,
  permissionUpdate
}
