const { check } = require('express-validator')

const loadLeaderboard = [
  check('matchId').not().isEmpty()
]

module.exports = {
  loadLeaderboard
}
