const { body, oneOf } = require('express-validator')
const { dashboardKeys } = require('../../data')

const updateDashboard = [
  body('sKey').not().isEmpty().toUpperCase().isIn(dashboardKeys),
  oneOf([
    body('aDay').custom((value, { req }) => {
      if (!value.length) {
        throw new Error()
      }
      return true
    }),
    body('aMonth').custom((value, { req }) => {
      if (!value.length) {
        throw new Error()
      }
      return true
    }),
    body('aYear').custom((value, { req }) => {
      if (!value.length) {
        throw new Error()
      }
      return true
    })
  ])
]

module.exports = {
  updateDashboard
}
