const UserLeagueModel = require('../userLeague/model')
const UserTeamModel = require('../userTeam/model')
const MatchLeagueModel = require('../matchLeague/model')
const UsersModel = require('../user/model')
const { Op } = require('sequelize')
const PassbookModel = require('../passbook/model')
const { bAllowDiskUse } = require('../../config/config')

function GetMatchLeagueCount(condition) {
  return MatchLeagueModel.countDocuments(condition)
}

async function generateReport(iMatchId) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        // Private Contest Report procedures.....
        const oPrivate = {}

        oPrivate.nLeague = await GetMatchLeagueCount({ iMatchId, bPrivateLeague: true })
        oPrivate.nCancelLeague = await GetMatchLeagueCount({ iMatchId, bCancelled: true, bPrivateLeague: true })
        oPrivate.nRunLeague = await GetMatchLeagueCount({ iMatchId, bCancelled: false, bPrivateLeague: true })

        const joinTeam = await MatchLeagueModel.aggregate([
          {
            $match: { iMatchId, bPrivateLeague: true }
          },
          {
            $group: {
              _id: null,
              nTeamJoin: { $sum: '$nJoined' }
            }
          }
        ]).allowDiskUse(bAllowDiskUse).exec()

        oPrivate.nTeamJoin = joinTeam.length ? joinTeam[0].nTeamJoin : 0

        const leagueCom = await MatchLeagueModel.aggregate([
          {
            $match: { iMatchId, bPrivateLeague: true, bCancelled: false }
          },
          {
            $group: {
              _id: null,
              nAdminCommission: { $sum: '$nAdminCommission' },
              nCreatorCommission: { $sum: '$nCreatorCommission' }
            }
          }
        ]).allowDiskUse(bAllowDiskUse).exec()

        oPrivate.nAdminCommission = leagueCom.length ? Number(parseFloat(leagueCom[0].nAdminCommission).toFixed(2)) : 0
        oPrivate.nCreatorCommission = leagueCom.length ? Number(parseFloat(leagueCom[0].nCreatorCommission).toFixed(2)) : 0

        const amount = await calculateTurnOver([iMatchId], true)
        const userAmount = amount.filter(({ _id }) => _id === 'U')

        oPrivate.nAmount = userAmount.length ? Number(parseFloat(userAmount[0].nAmount).toFixed(2)) : 0
        oPrivate.nBonus = 0
        oPrivate.nCash = userAmount.length ? Number(parseFloat(userAmount[0].nAmount).toFixed(2)) : 0
        oPrivate.nDistAmount = userAmount.length ? Number(parseFloat(userAmount[0].nDistAmount).toFixed(2)) : 0
        oPrivate.nDistBonus = userAmount.length ? Number(parseFloat(userAmount[0].nDistBonus).toFixed(2)) : 0

        // Public Contest Report procedures.....
        const oPublic = {}

        const cashbackData = await calculateCashback(iMatchId)
        oPublic.nCashbackCash = cashbackData.cashbackCash || 0
        oPublic.nBotCashbackCash = cashbackData.botCashbackCash || 0
        oPublic.nCashbackBonus = cashbackData.cashbackBonus || 0
        oPublic.nBotCashbackBonus = cashbackData.botCashbackBonus || 0

        const cashbackReturnData = await calculateCashbackReturn(iMatchId)
        oPublic.nCashbackReturnCash = cashbackReturnData.cashbackReturnCash || 0
        oPublic.nBotCashbackReturnCash = cashbackReturnData.botCashbackReturnCash || 0
        oPublic.nCashbackReturnBonus = cashbackReturnData.cashbackReturnBonus || 0
        oPublic.nBotCashbackReturnBonus = cashbackReturnData.botCashbackReturnBonus || 0

        oPublic.nLeague = await GetMatchLeagueCount({ iMatchId, bPrivateLeague: false })
        oPublic.nCancelLeague = await GetMatchLeagueCount({ iMatchId, bCancelled: true, bPrivateLeague: false })
        oPublic.nRunLeague = await GetMatchLeagueCount({ iMatchId, bCancelled: false, bPrivateLeague: false })

        const joinTeamPublic = await MatchLeagueModel.aggregate([
          {
            $match: { iMatchId, bPrivateLeague: false }
          },
          {
            $group: {
              _id: null,
              nTeamJoin: { $sum: '$nJoined' }
            }
          }
        ]).allowDiskUse(bAllowDiskUse).exec()
        oPublic.nTeamJoin = joinTeamPublic.length ? joinTeamPublic[0].nTeamJoin : 0

        const amountPublic = await calculateTurnOver([iMatchId], false)
        const userAmountPublic = amountPublic.filter(({ _id }) => _id === 'U')
        const botAmount = amountPublic.filter(({ _id }) => _id !== 'U')

        oPublic.nAmount = userAmountPublic.length ? Number(parseFloat(userAmountPublic[0].nAmount).toFixed(2)) : 0
        oPublic.nBotAmount = botAmount.length ? Number(parseFloat(botAmount[0].nAmount).toFixed(2)) : 0

        oPublic.nDistAmount = userAmountPublic.length ? Number(parseFloat(userAmountPublic[0].nDistAmount).toFixed(2)) : 0
        oPublic.nDistBonus = userAmountPublic.length ? Number(parseFloat(userAmountPublic[0].nDistBonus).toFixed(2)) : 0
        oPublic.nBotDistAmount = botAmount.length ? Number(parseFloat(botAmount[0].nDistAmount).toFixed(2)) : 0
        oPublic.nBotDistBonus = botAmount.length ? Number(parseFloat(botAmount[0].nDistBonus).toFixed(2)) : 0

        oPublic.nPromoDiscount = userAmountPublic.length ? Number(parseFloat(userAmountPublic[0].nPromoDiscount).toFixed(2)) : 0
        oPublic.nBotPromoDiscount = botAmount.length ? Number(parseFloat(botAmount[0].nPromoDiscount).toFixed(2)) : 0

        oPublic.nAmount = Number(parseFloat(oPublic.nAmount - oPublic.nPromoDiscount).toFixed(2))

        oPublic.nBonus = await calculatePublicLeagueBonus([iMatchId], 'U')
        oPublic.nBotBonus = await calculatePublicLeagueBonus([iMatchId], 'B')

        oPublic.nCash = Number(parseFloat(oPublic.nAmount - oPublic.nBonus).toFixed(2))
        oPublic.nBotCash = Number(parseFloat(oPublic.nBotAmount - oPublic.nBotBonus).toFixed(2))

        // oPublic.nProfitWithBonus = oPublic.nAmount - oPublic.nDistAmount
        // oPublic.nProfitWithoutBonus = oPublic.nAmount - (oPublic.nDistAmount + oPublic.nBonus)

        // Total all (Public + Private)contest procedures.....
        const oTotal = {}

        oTotal.nLeague = oPrivate.nLeague + oPublic.nLeague
        oTotal.nCancelLeague = oPrivate.nCancelLeague + oPublic.nCancelLeague
        oTotal.nRunLeague = oPrivate.nRunLeague + oPublic.nRunLeague
        oTotal.nTeamJoin = oPrivate.nTeamJoin + oPublic.nTeamJoin

        oTotal.nAmount = Number(oPrivate.nAmount) + Number(oPublic.nAmount)
        oTotal.nBonus = Number(oPrivate.nBonus) + Number(oPublic.nBonus)
        oTotal.nCash = Number(oPrivate.nCash) + Number(oPublic.nCash)

        oTotal.nDistAmount = Number(oPrivate.nDistAmount) + Number(oPublic.nDistAmount)
        oTotal.nDistBonus = Number(oPrivate.nDistBonus) + Number(oPublic.nDistBonus)
        // oTotal.nProfitWithBonus = oPrivate.nAdminCommission + oPublic.nProfitWithBonus
        // oTotal.nProfitWithoutBonus = oPrivate.nAdminCommission + oPublic.nProfitWithoutBonus
        oTotal.nPromoDiscount = oPublic.nPromoDiscount

        oTotal.nTotalTeam = await UserTeamModel.countDocuments({ iMatchId })
        const users = await UserTeamModel.distinct('iUserId', { iMatchId })
        oTotal.nTotalUserCount = users.length

        // Top 10 Spend User Procedures.....
        const topTenSpendUser = await UserLeagueModel.aggregate([
          {
            $match: {
              iMatchId,
              bCancelled: false
            }
          }, {
            $lookup: {
              from: 'matchleagues',
              localField: 'iMatchLeagueId',
              foreignField: '_id',
              as: 'matchleagues'
            }
          }, {
            $unwind: {
              path: '$matchleagues'
            }
          }, {
            $match: {
              'matchleagues.bCancelled': false
            }
          }, {
            $group: {
              _id: '$iUserId',
              nLeagueJoinAmount: { $sum: '$nPricePaid' },
              nLeagueJoin: { $sum: 1 },
              matchleagues: {
                $push: {
                  $cond: [
                    {
                      $gt: ['$matchleagues.nBonusUtil', 0]
                    },
                    { iUserLeagueId: '$_id' },
                    '$$REMOVE'
                  ]
                }
              }
            }
          }, {
            $sort: { nLeagueJoinAmount: -1 }
          }, {
            $limit: 10
          }
        ]).allowDiskUse(bAllowDiskUse).exec()

        oTotal.aTopSpendUser = []
        for (const topTenSpender of topTenSpendUser) {
          const { _id: iUserId, nLeagueJoinAmount, nLeagueJoin, matchleagues: matchLeagues } = topTenSpender
          const nTeams = await UserTeamModel.countDocuments({ iMatchId, iUserId })

          let nBonusUtil = 0

          for (const matchLeague of matchLeagues) {
            const { iUserLeagueId } = matchLeague
            const passbook = await PassbookModel.findOne({ where: { iUserId: iUserId.toString(), iUserLeagueId: iUserLeagueId.toString() }, plain: true })
            if (!passbook) continue

            nBonusUtil = parseFloat(nBonusUtil + passbook.nBonus)
          }
          const users = await UsersModel.findById(iUserId, { sUsername: 1, sMobNum: 1, sEmail: 1, eType: 1, _id: 0 }).lean()
          oTotal.aTopSpendUser.push({ iUserId, nLeagueJoinAmount, nLeagueJoin, nTeams, nBonusUtil, ...users })
        }

        // Top 10 Earned User Procedures.......
        const topTenEarnedUser = await UserLeagueModel.aggregate([
          {
            $match: {
              iMatchId,
              bCancelled: false
            }
          }, {
            $lookup: {
              from: 'matchleagues',
              localField: 'iMatchLeagueId',
              foreignField: '_id',
              as: 'matchleagues'
            }
          }, {
            $unwind: {
              path: '$matchleagues'
            }
          }, {
            $match: {
              'matchleagues.bCancelled': false,
              nPrice: { $gte: 0 }
            }
          }, {
            $group: {
              _id: '$iUserId',
              nLeagueJoinAmount: { $sum: '$nPricePaid' },
              nLeagueJoin: { $sum: 1 },
              nTotalEarned: { $sum: '$nPrice' },
              matchleagues: {
                $push: {
                  $cond: [
                    {
                      $gt: ['$matchleagues.nBonusUtil', 0]
                    },
                    { iUserLeagueId: '$_id' },
                    '$$REMOVE'
                  ]
                }
              }
            }
          }, {
            $match: {
              nTotalEarned: { $gt: 0 }
            }
          }, {
            $sort: {
              nTotalEarned: -1
            }
          }, {
            $limit: 10
          }
        ]).allowDiskUse(bAllowDiskUse).exec()

        oTotal.aTopEarnedUser = []
        for (const topTenEarner of topTenEarnedUser) {
          const { _id: iUserId, nLeagueJoinAmount, nLeagueJoin, matchleagues: matchLeagues, nTotalEarned } = topTenEarner
          const nTeams = await UserTeamModel.countDocuments({ iMatchId, iUserId })

          let nBonusUtil = 0
          for (const matchLeague of matchLeagues) {
            const { iUserLeagueId } = matchLeague
            const passbook = await PassbookModel.findOne({ where: { iUserId: iUserId.toString(), iUserLeagueId: iUserLeagueId.toString() }, plain: true })
            if (!passbook) continue

            nBonusUtil = parseFloat(nBonusUtil + passbook.nBonus)
          }
          const users = await UsersModel.findById(iUserId, { sUsername: 1, sEmail: 1, sMobNum: 1, eType: 1, _id: 0 }).lean()
          oTotal.aTopEarnedUser.push({ iUserId, nLeagueJoinAmount, nLeagueJoin, nTeams, nBonusUtil, nTotalEarned, ...users })
        }

        // Top 10 Loosed User Procedures........
        const topTenLoosedUser = await UserLeagueModel.aggregate([
          {
            $match: {
              iMatchId,
              bCancelled: false
            }
          }, {
            $lookup: {
              from: 'matchleagues',
              localField: 'iMatchLeagueId',
              foreignField: '_id',
              as: 'matchleagues'
            }
          }, {
            $unwind: {
              path: '$matchleagues'
            }
          }, {
            $match: {
              'matchleagues.bCancelled': false
            }
          }, {
            $group: {
              _id: '$iUserId',
              nLeagueJoinAmount: {
                $sum: '$nPricePaid'
              },
              nLeagueJoin: {
                $sum: 1
              },
              nTotalEarned: {
                $sum: '$nPrice'
              },
              matchleagues: {
                $push: {
                  $cond: [
                    {
                      $gt: ['$matchleagues.nBonusUtil', 0]
                    },
                    { iUserLeagueId: '$_id' },
                    '$$REMOVE'
                  ]
                }
              }
            }
          }, {
            $addFields: {
              nTotalLoss: {
                $subtract: ['$nLeagueJoinAmount', '$nTotalEarned']
              }
            }
          }, {
            $sort: {
              nTotalLoss: -1
            }
          }, {
            $limit: 10
          }
        ]).allowDiskUse(bAllowDiskUse).exec()

        oTotal.aTopLoosedUser = []
        for (const topTenLooser of topTenLoosedUser) {
          const { _id: iUserId, nLeagueJoinAmount, nLeagueJoin, matchleagues: matchLeagues, nTotalLoss } = topTenLooser
          const nTeams = await UserTeamModel.countDocuments({ iMatchId, iUserId })

          let nBonusUtil = 0

          for (const matchLeague of matchLeagues) {
            const { iUserLeagueId } = matchLeague
            const passbook = await PassbookModel.findOne({ where: { iUserId: iUserId.toString(), iUserLeagueId: iUserLeagueId.toString() }, plain: true })
            if (!passbook) continue

            nBonusUtil = parseFloat(nBonusUtil + passbook.nBonus)
          }
          const users = await UsersModel.findById(iUserId, { sUsername: 1, sEmail: 1, sMobNum: 1, eType: 1, _id: 0 }).lean()
          oTotal.aTopLoosedUser.push({ iUserId, nLeagueJoinAmount, nLeagueJoin, nTeams, nBonusUtil, nTotalLoss, ...users })
        }

        oTotal.nCashbackCash = oPublic.nCashbackCash
        oTotal.nBotCashbackCash = oPublic.nBotCashbackCash
        oTotal.nCashbackBonus = oPublic.nCashbackBonus
        oTotal.nBotCashbackBonus = oPublic.nBotCashbackBonus

        oTotal.nCashbackReturnCash = oPublic.nCashbackReturnCash
        oTotal.nBotCashbackReturnCash = oPublic.nBotCashbackReturnCash
        oTotal.nCashbackReturnBonus = oPublic.nCashbackReturnBonus
        oTotal.nBotCashbackReturnBonus = oPublic.nBotCashbackReturnBonus

        const playReturnData = await calculatePlayReturn(iMatchId)
        oTotal.nPlayReturnCash = playReturnData.playReturnCash || 0
        oTotal.nBotPlayReturnCash = playReturnData.botPlayReturnCash || 0
        oTotal.nPlayReturnBonus = playReturnData.playReturnBonus || 0
        oTotal.nBotPlayReturnBonus = playReturnData.botPlayReturnBonus || 0

        resolve({ oTotal, oPublic, oPrivate })
      } catch (error) {
        reject(error)
      }
    })()
  })
}

function calculateTurnOver(matchId, bIsPrivate) {
  return UserLeagueModel.aggregate([
    {
      $match: {
        iMatchId: { $in: matchId },
        bCancelled: false
      }
    }, {
      $lookup: {
        from: 'matchleagues',
        localField: 'iMatchLeagueId',
        foreignField: '_id',
        as: 'matchleagues'
      }
    }, {
      $unwind: {
        path: '$matchleagues'
      }
    }, {
      $match: {
        'matchleagues.bCancelled': false,
        'matchleagues.bPrivateLeague': bIsPrivate
      }
    }, {
      $group: {
        _id: '$eType', // eType change
        nAmount: {
          $sum: '$matchleagues.nPrice'
        },
        nDistBonus: {
          $sum: '$nBonusWin'
        },
        nDistAmount: {
          $sum: '$nPrice'
        },
        nPromoDiscount: {
          $sum: '$nPromoDiscount'
        }
      }
    }
  ]).allowDiskUse(bAllowDiskUse).exec()
}

async function calculatePlayReturn(iMatchId) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const botUsers = { eUserType: 'B', aMatchId: [iMatchId.toString()] }
        const users = { eUserType: 'U', aMatchId: [iMatchId.toString()] }

        const { nCash: playReturnCash, nBonus: playReturnBonus } = await calculatePassbook(users, 'Play-Return')
        const { nCash: botPlayReturnCash, nBonus: botPlayReturnBonus } = await calculatePassbook(botUsers, 'Play-Return')

        resolve({ playReturnCash, playReturnBonus, botPlayReturnCash, botPlayReturnBonus })
      } catch (error) {
        reject(error)
      }
    })()
  })
}

async function calculateCashback(iMatchId) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const botUsers = { eUserType: 'B', aMatchId: [iMatchId.toString()] }
        const users = { eUserType: 'U', aMatchId: [iMatchId.toString()] }

        const { nCash: cashbackCash, nBonus: cashbackBonus } = await calculatePassbook(users, 'Cashback-Contest')
        const { nCash: botCashbackCash, nBonus: botCashbackBonus } = await calculatePassbook(botUsers, 'Cashback-Contest')

        resolve({ cashbackCash, cashbackBonus, botCashbackCash, botCashbackBonus })
      } catch (error) {
        reject(error)
      }
    })()
  })
}

async function calculateCashbackReturn(iMatchId) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const botUsers = { eUserType: 'B', aMatchId: [iMatchId.toString()] }
        const users = { eUserType: 'U', aMatchId: [iMatchId.toString()] }

        const { nCash: cashbackReturnCash, nBonus: cashbackReturnBonus } = await calculatePassbook(users, 'Cashback-Return')
        const { nCash: botCashbackReturnCash, nBonus: botCashbackReturnBonus } = await calculatePassbook(botUsers, 'Cashback-Return')

        resolve({ cashbackReturnCash, cashbackReturnBonus, botCashbackReturnCash, botCashbackReturnBonus })
      } catch (error) {
        reject(error)
      }
    })()
  })
}

async function calculatePublicLeagueBonus(matchId, eType) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        eType = eType !== 'U' ? { $ne: 'U' } : eType
        const matchleagues = await UserLeagueModel.aggregate([
          {
            $match: {
              iMatchId: { $in: matchId },
              bCancelled: false,
              eType // eType change
            }
          }, {
            $lookup: {
              from: 'matchleagues',
              localField: 'iMatchLeagueId',
              foreignField: '_id',
              as: 'matchleagues'
            }
          }, {
            $unwind: {
              path: '$matchleagues'
            }
          }, {
            $match: {
              'matchleagues.bCancelled': false,
              'matchleagues.bPrivateLeague': false,
              'matchleagues.nBonusUtil': { $gt: 0 }
            }
          }, {
            $group: {
              _id: '$iMatchLeagueId',
              userLeagues: {
                $push: {
                  iUserId: '$iUserId',
                  iUserLeagueId: '$_id'
                }
              }
            }
          }
        ]).allowDiskUse(bAllowDiskUse).exec()

        let nBonus = 0
        for (const matchLeague of matchleagues) {
          const { _id, userLeagues = [] } = matchLeague
          if (userLeagues.length) {
            for (const userLeague of userLeagues) {
              const { iUserLeagueId, iUserId } = userLeague
              const passbook = await PassbookModel.findOne({ where: { iUserId: iUserId.toString(), iUserLeagueId: iUserLeagueId.toString(), iMatchLeagueId: _id.toString(), eTransactionType: 'Play' }, plain: true })
              if (!passbook) continue
              nBonus = parseFloat(nBonus + passbook.nBonus)
            }
          }
        }
        resolve(nBonus)
      } catch (error) {
        reject(error)
      }
    })()
  })
}

async function getUserCount(condition) {
  return UsersModel.countDocuments(condition)
}

async function calculatePassbook(users, eTransactionType) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        let { eUserType, aMatchId } = users
        eUserType = eUserType !== 'U' ? { [Op.ne]: 'U' } : eUserType

        let nCash = await PassbookModel.sum('nCash', { where: { eUserType, iMatchId: { [Op.in]: aMatchId }, eTransactionType } })
        let nBonus = await PassbookModel.sum('nBonus', { where: { eUserType, iMatchId: { [Op.in]: aMatchId }, eTransactionType } })

        nBonus = !nBonus ? 0 : nBonus
        nCash = !nCash ? 0 : nCash

        resolve({ nCash: Number(parseFloat(nCash).toFixed(2)), nBonus: Number(parseFloat(nBonus).toFixed(2)) })
      } catch (error) {
        reject(error)
      }
    })()
  })
}

module.exports = {
  generateReport,
  calculateTurnOver,
  getUserCount,
  calculatePassbook,
  calculatePublicLeagueBonus
}
