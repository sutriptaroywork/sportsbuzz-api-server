const { body } = require('express-validator')

const updateBankDetailsV2 = [
  body('sBankName').not().isEmpty().escape(),
  body('sBranchName').not().isEmpty().escape(),
  body('sAccountHolderName').not().isEmpty().escape(),
  body('sAccountNo').not().isEmpty().isNumeric(),
  body('sIFSC').not().isEmpty()
]

const addBankDetailsV2 = [
  body('sBankName').not().isEmpty().escape(),
  body('sBranchName').not().isEmpty().escape(),
  body('sAccountHolderName').not().isEmpty().escape(),
  body('sAccountNo').not().isEmpty().isNumeric(),
  body('sIFSC').not().isEmpty()
]

module.exports = {
  updateBankDetailsV2,
  addBankDetailsV2
}
