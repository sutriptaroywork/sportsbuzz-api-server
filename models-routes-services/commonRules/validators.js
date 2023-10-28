const { body } = require('express-validator')
const { commonRule, ruleType, rewardOn } = require('../../data')

const adminAddCommonRules = [
  body('eRule').not().isEmpty().toUpperCase().isIn(commonRule),
  body('nAmount').not().isEmpty().isNumeric(),
  body('eType').not().isEmpty().toUpperCase().isIn(ruleType),
  body('sRewardOn').optional().toUpperCase().isIn(rewardOn)
]

const adminUpdateCommonRules = [
  body('eRule').not().isEmpty().toUpperCase().isIn(commonRule),
  body('nAmount').not().isEmpty().isNumeric(),
  body('eType').not().isEmpty().toUpperCase().isIn(ruleType),
  body('sRewardOn').optional().toUpperCase().isIn(rewardOn)
]

module.exports = {
  adminAddCommonRules,
  adminUpdateCommonRules
}
