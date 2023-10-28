const { body, query } = require('express-validator')
const { category, seriesStatus, leagueRankType, seriesLBCategoriesTemplateType } = require('../../data')
const { PAGINATION_LIMIT } = require('../../config/common')

const addSeriesLeaderBoard = [
  body('sName').not().isEmpty(),
  body('eCategory').not().isEmpty().toUpperCase().isIn(category),
  body('eStatus').not().isEmpty().toUpperCase().isIn(seriesStatus)
]

const editSeriesLeaderBoard = [
  body('eCategory').not().isEmpty().toUpperCase().isIn(category)
]

const adminSeriesLeaderBoardList = [
  query('sportsType').not().isEmpty(),
  query('limit').optional().isInt({ max: PAGINATION_LIMIT })
]

const userListSeriesLeaderBoard = [
  body('eCategory').not().isEmpty().toUpperCase().isIn(category),
  body('eCategory').not().isEmpty().toUpperCase().isIn(category),
  body('nLimit').optional().isInt({ max: PAGINATION_LIMIT })
]

const adminListSeriesLeaderBoard = [
  query('sportsType').not().isEmpty().toUpperCase().isIn(category),
  query('sportsType').not().isEmpty().toUpperCase().isIn(category),
  query('nLimit').optional().isInt({ max: PAGINATION_LIMIT })
]

const addSeriesCategory = [
  body('sName').not().isEmpty(),
  body('iCategoryId').not().isEmpty(),
  body('sFirstPrize').not().isEmpty(),
  body('sContent').not().isEmpty(),
  body('nMaxRank').not().isEmpty().isInt(),
  body('nTotalPayout').not().isEmpty().isInt()
]

const addSeriesPrizeBreakup = [
  body('nRankFrom').not().isEmpty().isInt(),
  body('nRankTo').not().isEmpty().isInt(),
  body('nPrize').not().isEmpty().isNumeric(),
  body('eRankType').not().isEmpty().toUpperCase().isIn(leagueRankType)
]

const updateSeriesPrizeBreakup = [
  body('nRankFrom').not().isEmpty().isInt(),
  body('nRankTo').not().isEmpty().isInt(),
  body('nPrize').not().isEmpty().isNumeric(),
  body('eRankType').not().isEmpty().toUpperCase().isIn(leagueRankType)
]

const updateSeriesCategory = [
  body('sFirstPrize').not().isEmpty(),
  body('sContent').not().isEmpty(),
  body('nMaxRank').not().isEmpty().isInt(),
  body('nTotalPayout').not().isEmpty().isInt()
]

const addCategoryTemplate = [
  body('sName').not().isEmpty(),
  body('eType').not().isEmpty().toUpperCase().isIn(seriesLBCategoriesTemplateType),
  body('sColumnText').not().isEmpty()
]
const categoryTemplateGetSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

const removeCategory = [
  body('iCategoryId').not().isEmpty()
]
const getAllRankV2 = [
  query('nLimit').optional().isInt({ max: PAGINATION_LIMIT })
]
module.exports = {
  addSeriesLeaderBoard,
  editSeriesLeaderBoard,
  adminSeriesLeaderBoardList,
  userListSeriesLeaderBoard,
  adminListSeriesLeaderBoard,
  addSeriesCategory,
  updateSeriesCategory,
  addCategoryTemplate,
  categoryTemplateGetSignedUrl,
  removeCategory,
  addSeriesPrizeBreakup,
  updateSeriesPrizeBreakup,
  getAllRankV2
}
