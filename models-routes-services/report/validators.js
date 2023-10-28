const { body, query } = require('express-validator')
const { reportsKeys, sportsReportsKeys, category, userType, filterReportKeys, appPlatform } = require('../../data')

const checkReport = [
  body('eKey').not().isEmpty().isIn(reportsKeys),
  body('eType').not().isEmpty().toUpperCase().isIn(userType)
]

const validateReportData = [
  body('eKey').not().isEmpty().isIn(sportsReportsKeys),
  body('eCategory').not().isEmpty().toUpperCase().isIn(category),
  body('eType').not().isEmpty().toUpperCase().isIn(userType)
]

const validateData = [
  query('eType').not().isEmpty().toUpperCase().isIn(userType),
  query('dStartDate').not().isEmpty(),
  query('dEndDate').not().isEmpty(),
  query('eKey').not().isEmpty().toUpperCase().isIn(filterReportKeys)
]

const validateAppReportData = [
  body('eKey').not().isEmpty().isIn(sportsReportsKeys),
  body('ePlatform').not().isEmpty().toUpperCase().isIn(appPlatform),
  body('eType').not().isEmpty().toUpperCase().isIn(userType)
]
module.exports = {
  checkReport,
  validateReportData,
  validateData,
  validateAppReportData
}
