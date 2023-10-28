const { body } = require('express-validator')

const validateAppDownloadData = [
  body('iAppId').not().isEmpty()
]

module.exports = {
  validateAppDownloadData
}
