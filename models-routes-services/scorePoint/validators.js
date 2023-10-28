const { query } = require('express-validator')
const { format } = require('../../data')

const getScorePoints = [
  query('eFormat').not().isEmpty().toUpperCase().isIn(format)
]

module.exports = {
  getScorePoints
}
