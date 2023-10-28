const router = require('express').Router()
const commonRuleServices = require('./services')
const validators = require('./validators')
const { validateAdmin } = require('../../middlewares/middleware')

router.post('/admin/rules/add/v1', validators.adminAddCommonRules, validateAdmin('RULE', 'W'), commonRuleServices.add)

router.get('/admin/rules/v1', validateAdmin('RULE', 'R'), commonRuleServices.list)

router.get('/admin/rules/list/v1', validateAdmin('RULE', 'R'), commonRuleServices.ruleList)

router.get('/admin/rules/:id/v1', validateAdmin('RULE', 'R'), commonRuleServices.get)

router.put('/admin/rules/:id/v1', validators.adminUpdateCommonRules, validateAdmin('RULE', 'W'), commonRuleServices.update)

router.delete('/admin/rules/:id/v1', validateAdmin('RULE', 'W'), commonRuleServices.remove)

router.get('/admin/rules/rewards/list/v1', validateAdmin('RULE', 'R'), commonRuleServices.rewardsRuleList)

module.exports = router
