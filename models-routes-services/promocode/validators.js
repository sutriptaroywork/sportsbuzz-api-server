const { body, query } = require('express-validator')
const { promocodeTypes } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')

const addPromoCode = [
  body('sName').not().isEmpty(),
  body('sCode').not().isEmpty(),
  body('nAmount').not().isEmpty().isNumeric(),
  body('nMinAmount').custom((value, { req }) => {
    if (req.body.eType === 'DEPOSIT' && !value) {
      throw new Error()
    }
    return true
  }),
  body('nMaxAmount').custom((value, { req }) => {
    if (req.body.eType === 'DEPOSIT' && !value) {
      throw new Error()
    }
    return true
  }),
  body('bIsPercent').not().isEmpty().isBoolean(),
  body('nMaxAllow').not().isEmpty().isInt(),
  body('dStartTime').not().isEmpty(),
  body('dExpireTime').not().isEmpty(),
  body('eType').not().isEmpty().toUpperCase().isIn(promocodeTypes),
  body('aMatches').custom((value, { req }) => {
    if (req.body.eType === 'MATCH' && !value.length) {
      throw new Error()
    }
    return true
  }),
  body('aLeagues').custom((value, { req }) => {
    if (req.body.eType === 'MATCH' && !value.length) {
      throw new Error()
    }
    return true
  })
]

const updatePromoCode = [
  body('bIsPercent').not().isEmpty().isBoolean(),
  body('nAmount').not().isEmpty().isNumeric(),
  body('nMinAmount').custom((value, { req }) => {
    if (req.body.eType === 'DEPOSIT' && !value) {
      throw new Error()
    }
    return true
  }),
  body('nMaxAmount').custom((value, { req }) => {
    if (req.body.eType === 'DEPOSIT' && !value) {
      throw new Error()
    }
    return true
  }),
  body('dStartTime').not().isEmpty(),
  body('dExpireTime').not().isEmpty()
]

const checkPromocode = [
  body('sPromo').not().isEmpty(),
  body('nAmount').not().isEmpty().isNumeric()
]

const checkMatchPromocode = [
  body('sPromo').not().isEmpty(),
  body('iMatchLeagueId').not().isEmpty(),
  body('nTeamCount').optional({ checkFalsy: true }).isInt()
]
const list = [
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]
module.exports = {
  addPromoCode,
  updatePromoCode,
  checkPromocode,
  checkMatchPromocode,
  list
}
