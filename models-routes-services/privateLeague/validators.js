const { body } = require('express-validator')

const calculateEntryFee = [
  body('nTotalPayout').not().isEmpty().isInt(),
  body('nMax').not().isEmpty().isInt()
]

const verifyContestCode = [
  body('iMatchId').not().isEmpty(),
  body('sShareCode').not().isEmpty()
]

const generatePrizeBreakup = [
  body('nMax').not().isEmpty().isInt()
]

const addPrivateLeagueV2 = [
  body('nTotalPayout').not().isEmpty().isInt(),
  body('nMax').not().isEmpty().isInt(),
  body('nPrizeBreakup').not().isEmpty().isInt(),
  body('iMatchId').not().isEmpty(),
  body('sName').not().isEmpty().escape()
]

module.exports = {
  calculateEntryFee,
  verifyContestCode,
  generatePrizeBreakup,
  addPrivateLeagueV2
}
