const SQLUserLeagueModel = require('../userLeague/userLeagueSqlModel')
const UserBalanceModel = require('./model')
const StatisticsModel = require('../user/statistics/model')
const settingServices = require('../setting/services')
const db = require('../../database/sequelize')
const { Op, literal, Transaction } = require('sequelize')
const PassbookModel = require('../passbook/model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const {
  catchError,
  handleCatchError,
  getStatisticsSportsKey,
  convertToDecimal
} = require('../../helper/utilities.services')
const { checkProcessed, bulkQueuePush } = require('../../helper/redis')
const commonRuleServices = require('../commonRules/services')
const UserLeagueSqlModel = require('../userLeague/userLeagueSqlModel')
const { ObjectId } = require('mongoose').Types
// const { GamesDBConnect } = require('../../database/mongoose')

class UserBalance {
  async adminGet(req, res) {
    try {
      let data = await UserBalanceModel.findOne({
        where: { iUserId: req.params.id },
        raw: true
      })

      const stat = await StatisticsModel.findOne(
        { iUserId: req.params.id },
        { nTotalPlayedCash: 1 }
      ).lean()
      if (!stat) {
        return res
          .status(status.OK)
          .jsonp({
            status: jsonStatus.OK,
            message: messages[req.userLanguage].success.replace(
              '##',
              messages[req.userLanguage].user
            ),
            data
          })
      }

      const { nTotalPlayedCash: nTotalPlayCash } = stat

      data = { ...data, ...stat, nTotalPlayCash }
      delete data.nTotalPlayedCash
      delete data.aTotalMatch
      return res
        .status(status.OK)
        .jsonp({
          status: jsonStatus.OK,
          message: messages[req.userLanguage].success.replace(
            '##',
            messages[req.userLanguage].cBalance
          ),
          data
        })
    } catch (error) {
      return catchError('UserBalance.adminGet', error, req, res)
    }
  }

  // done
  async userPlayDeduction(data, session) {
    return db.sequelize.transaction(
      {
        isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
      },
      async (t) => {
        // const transactionOptions = {
        //   readPreference: 'primary',
        //   readConcern: { level: 'majority' },
        //   writeConcern: { w: 'majority' }
        // }
        // const session = await GamesDBConnect.startSession()
        // session.startTransaction(transactionOptions)

        let {
          iUserId,
          iUserLeagueId,
          iMatchLeagueId,
          iMatchId,
          nPrice,
          nBonusUtil = 0,
          sMatchName,
          sUserName,
          eType,
          sPromocode,
          eCategory,
          bPrivateLeague,
          nJoinPrice,
          nPromoDiscount = 0
        } = data
        iUserId = iUserId.toString()
        iUserLeagueId = iUserLeagueId.toString()
        iMatchId = iMatchId.toString()
        iMatchLeagueId = iMatchLeagueId.toString()
        nBonusUtil = Number(nBonusUtil)

        const leagueJoinAmount = convertToDecimal(nPrice)
        const userBalance = await UserBalanceModel.findOne({
          where: { iUserId },
          plain: true,
          transaction: t,
          lock: true
        })
        if (!userBalance) {
          return { isSuccess: false, nPrice, iUserId }
        }

        const {
          nCurrentWinningBalance,
          nCurrentDepositBalance,
          nCurrentTotalBalance,
          nCurrentBonus
        } = userBalance

        let nActualBonus = 0

        // if user and match contest having bonus then we have to use bonus(in percentage) of user to join contest.
        if (nBonusUtil && nBonusUtil > 0 && nPrice > 0) {
          const nBonus = (nPrice * nBonusUtil) / 100

          if (userBalance.nCurrentBonus - nBonus >= 0) {
            nActualBonus = nBonus
            if (userBalance.nCurrentTotalBalance < nPrice - nBonus) {
              return {
                isSuccess: false,
                nPrice: convertToDecimal(nPrice - nBonus - userBalance.nCurrentTotalBalance),
                nActualBonus: nActualBonus
              }
            }
          } else {
            nActualBonus = userBalance.nCurrentBonus
            if (userBalance.nCurrentTotalBalance < nPrice - userBalance.nCurrentBonus) {
              return {
                isSuccess: false,
                nPrice: convertToDecimal(nPrice - userBalance.nCurrentBonus - userBalance.nCurrentTotalBalance),
                nActualBonus: nActualBonus
              }
            }
          }
        } else if (userBalance.nCurrentTotalBalance < nPrice) {
          return {
            isSuccess: false,
            nPrice: convertToDecimal(nPrice - userBalance.nCurrentTotalBalance),
            nActualBonus: nActualBonus
          }
        }

        nPrice = nActualBonus ? nPrice - nActualBonus : nPrice
        nPrice = convertToDecimal(nPrice)
        nActualBonus = convertToDecimal(nActualBonus)
        let nCash = 0
        let nWin = 0
        let bResetDeposit = false
        // if user having deposit balance less than contest price to join, then we'll check for winning balance.
        if (userBalance.nCurrentDepositBalance < nPrice) {
          if (userBalance.nCurrentDepositBalance < 0) {
            // we'll cut contest join price from winning balance.
            nWin = nPrice
            await UserBalanceModel.update(
              {
                nCurrentWinningBalance: literal(
                  `nCurrentWinningBalance - ${nPrice}`
                ),
                nCurrentTotalBalance: literal(
                  `nCurrentTotalBalance - ${nPrice}`
                ),
                nCurrentBonus: literal(`nCurrentBonus - ${nActualBonus}`)
              },
              { where: { iUserId }, transaction: t, lock: true }
            )
            console.log('UPD IF: Created 181')
          } else {
            bResetDeposit = true
            nWin = nPrice - userBalance.nCurrentDepositBalance
            await UserBalanceModel.update(
              {
                nCurrentDepositBalance: 0,
                nCurrentWinningBalance: literal(
                  `nCurrentWinningBalance - ${nPrice - userBalance.nCurrentDepositBalance
                  }`
                ),
                nCurrentTotalBalance: literal(
                  `nCurrentTotalBalance - ${nPrice}`
                ),
                nCurrentBonus: literal(`nCurrentBonus - ${nActualBonus}`)
              },
              { where: { iUserId }, transaction: t, lock: true }
            )
          }
        } else {
          nCash = nPrice
          await UserBalanceModel.update(
            {
              nCurrentDepositBalance: literal(
                `nCurrentDepositBalance - ${nPrice}`
              ),
              nCurrentTotalBalance: literal(`nCurrentTotalBalance - ${nPrice}`),
              nCurrentBonus: literal(`nCurrentBonus - ${nActualBonus}`)
            },
            { where: { iUserId }, transaction: t, lock: true }
          )
        }

        const sRemarks = sPromocode
          ? `${sUserName} participated in ${sMatchName} with Promocode ${sPromocode}`
          : `${sUserName} participated in ${sMatchName}`
        const passbook = await PassbookModel.create(
          {
            iUserId,
            nAmount: leagueJoinAmount,
            nCash: nPrice,
            nBonus: nActualBonus,
            iUserLeagueId,
            iMatchLeagueId,
            iMatchId,
            eUserType: eType,
            eTransactionType: 'Play',
            eType: 'Dr',
            nOldWinningBalance: nCurrentWinningBalance,
            nOldDepositBalance: nCurrentDepositBalance,
            nOldTotalBalance: nCurrentTotalBalance,
            nOldBonus: nCurrentBonus,
            sRemarks,
            sPromocode,
            eCategory
          },
          { transaction: t, lock: true }
        )

        if (!passbook || (passbook && !passbook.id)) return { isSuccess: false, nPrice: nPrice, nActualBonus: nActualBonus }
        const matchCategory = getStatisticsSportsKey(eCategory)
        let leagueTypeStat
        if (bPrivateLeague) {
          leagueTypeStat = {
            [`${matchCategory}.nJoinPLeague`]: 1,
            [`${matchCategory}.nJoinPLeagueSpend`]: Number(
              parseFloat(leagueJoinAmount).toFixed(2)
            ),
            nTotalPLeagueSpend: Number(parseFloat(leagueJoinAmount).toFixed(2))
          }
        } else {
          leagueTypeStat = {
            [`${matchCategory}.nJoinLeague`]: 1,
            nTotalSpend: Number(parseFloat(nJoinPrice).toFixed(2)),
            nDiscountAmount: Number(parseFloat(nPromoDiscount).toFixed(2))
          }
        }

        let query = {}
        if (!bResetDeposit) {
          leagueTypeStat = {
            ...leagueTypeStat,
            nActualDepositBalance: -Number(parseFloat(nCash).toFixed(2))
          }
        } else {
          query = { $set: { nActualDepositBalance: 0 } }
        }

        // Update UserLeague which we have created outside
        await StatisticsModel.updateOne(
          { iUserId: ObjectId(iUserId) },
          {
            $inc: {
              nTotalJoinLeague: 1,
              [`${matchCategory}.nSpending`]: Number(
                parseFloat(leagueJoinAmount).toFixed(2)
              ),
              [`${matchCategory}.nSpendingCash`]: Number(
                parseFloat(nCash + nWin).toFixed(2)
              ),
              nActualWinningBalance: -Number(parseFloat(nWin).toFixed(2)),
              nActualBonus: -Number(parseFloat(nActualBonus).toFixed(2)),
              nTotalPlayedCash: Number(parseFloat(nPrice).toFixed(2)),
              nTotalPlayedBonus: Number(parseFloat(nActualBonus).toFixed(2)),
              nWinnings: -Number(parseFloat(nWin).toFixed(2)),
              [`${matchCategory}.nSpendingBonus`]: Number(
                parseFloat(nActualBonus).toFixed(2)
              ),
              [`${matchCategory}.nDiscountAmount`]: Number(
                parseFloat(nPromoDiscount).toFixed(2)
              ),
              ...leagueTypeStat
            },
            $addToSet: {
              [`${matchCategory}.aMatchPlayed`]: {
                iMatchId: ObjectId(iMatchId)
              },
              aTotalMatch: { iMatchId: ObjectId(iMatchId) }
            },
            ...query
          },
          { upsert: true }
        )

        return { isSuccess: true, nPrice: nPrice, nActualBonus: nActualBonus }
      }
    )
  }

  // done
  async referBonus(data) {
    try {
      let {
        iUserId,
        rule,
        sUserName,
        eType: eUserType,
        nReferrals,
        iReferById
      } = data
      if (!rule) rule = {}
      let { eType, nAmount, eRule, nExpireDays } = rule

      iUserId = iUserId.toString()
      nAmount = parseFloat(nAmount)
      const dBonusExpiryDate = new Date()
      dBonusExpiryDate.setDate(dBonusExpiryDate.getDate() + nExpireDays)
      dBonusExpiryDate.setUTCHours(23, 59) // 23:59 EOD

      const eTransactionType = eRule === 'RB' ? 'Bonus' : 'Refer-Bonus'

      if (eRule === 'RR' && iReferById) {
        const passbookProcessed = await checkProcessed(
          `referBonus:${iUserId}:${iReferById}`,
          20
        )
        if (passbookProcessed === 'EXIST') return { isSuccess: true }
      }

      return db.sequelize.transaction(
        {
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        },
        async (t) => {
          const userBalance = await UserBalanceModel.findOne({
            where: { iUserId },
            transaction: t,
            lock: true
          })
          const {
            nCurrentWinningBalance = 0,
            nCurrentDepositBalance,
            nCurrentTotalBalance,
            nCurrentBonus
          } = userBalance

          if (eType === 'C') {
            await UserBalanceModel.update(
              {
                nCurrentTotalBalance: literal(
                  `nCurrentTotalBalance + ${nAmount}`
                ),
                nCurrentDepositBalance: literal(
                  `nCurrentDepositBalance + ${nAmount}`
                )
                // nTotalDepositAmount: literal(`nTotalDepositAmount + ${nAmount}`),
                // nTotalDepositCount: literal('nTotalDepositCount + 1')
              },
              { where: { iUserId }, transaction: t, lock: true }
            )
          } else if (eType === 'B') {
            await UserBalanceModel.update(
              {
                nCurrentBonus: literal(`nCurrentBonus + ${nAmount}`),
                nTotalBonusEarned: literal(`nTotalBonusEarned + ${nAmount}`)
              },
              { where: { iUserId }, transaction: t, lock: true }
            )
          }
          let sRemarks
          if (eRule === 'RCB') {
            sRemarks = `${sUserName} get refer code bonus`
          } else if (eRule === 'RR') {
            sRemarks = `${sUserName} get register refer bonus`
          } else {
            sRemarks = `${sUserName} get register bonus`
          }

          // need to update dBonusExpiryDate: 11:59
          await PassbookModel.create(
            {
              iUserId,
              nAmount: nAmount,
              nCash: eType === 'C' ? nAmount : 0,
              nBonus: eType === 'B' ? nAmount : 0,
              eTransactionType,
              eType: 'Cr',
              eUserType,
              nOldWinningBalance: nCurrentWinningBalance,
              nOldDepositBalance: nCurrentDepositBalance,
              nOldTotalBalance: nCurrentTotalBalance,
              nOldBonus: nCurrentBonus,
              dBonusExpiryDate,
              sRemarks,
              sCommonRule: eRule,
              dActivityDate: new Date()
            },
            { transaction: t, lock: true }
          )

          const nCash = eType === 'C' ? nAmount : 0
          // const nCount = eType === 'C' ? 1 : 0
          const nBonus = eType === 'B' ? nAmount : 0
          const isExist = await StatisticsModel.countDocuments({
            iUserId: ObjectId(data.iUserId)
          })

          if (!isExist) {
            await StatisticsModel.create({ iUserId: ObjectId(data.iUserId) })
          }
          await StatisticsModel.updateOne(
            { iUserId: ObjectId(data.iUserId) },
            {
              $inc: {
                nReferrals: !nReferrals ? 0 : 1,
                nActualBonus: Number(parseFloat(nBonus).toFixed(2)),
                nActualDepositBalance: Number(parseFloat(nCash).toFixed(2)),
                // nDeposits: Number(parseFloat(nCash).toFixed(2)),
                nCash: Number(parseFloat(nCash).toFixed(2)),
                nBonus: Number(parseFloat(nBonus).toFixed(2))
                // nDepositCount: nCount
              }
            },
            { upsert: true }
          )

          return { isSuccess: true }
        }
      )
      // if (response.error) throw new Error(response.error)
      // return response
    } catch (error) {
      handleCatchError(error)
      return { isSuccess: false }
    }
  }

  async createAndupdateStatastics (data) {
    data = JSON.parse(data)
    console.log('===============data====>', data)
    const { iUserId, nBonus, nCash } = data
    const isExist = await StatisticsModel.countDocuments({
      iUserId: ObjectId(iUserId)
    })
    if (!isExist) {
      await StatisticsModel.create({ iUserId: ObjectId(iUserId) })
    }
    await StatisticsModel.updateOne(
      { iUserId: ObjectId(iUserId) },
      {
        $inc: {
          nActualBonus: Number(parseFloat(nBonus).toFixed(2)),
          nActualDepositBalance: Number(parseFloat(nCash).toFixed(2)),
          // nDeposits: Number(parseFloat(nCash).toFixed(2)),
          nCash: Number(parseFloat(nCash).toFixed(2)),
          nBonus: Number(parseFloat(nBonus).toFixed(2))
        }
      },
      { upsert: true }
    )
  }

  async bonusExpire() {
    let _dExpiryDate = new Date()
    _dExpiryDate = _dExpiryDate.toISOString().replace('T', ' ').replace('Z', '')
    const symbol = await settingServices.getCurrencySymbol()
    const sRemark = 'Kyc Bonus Expired'
    const procedureArgument = { replacements: { _dExpiryDate, _sRemark: sRemark, _symbol: symbol } }
    await db.sequelize.query('CALL bulkBonusExpireBackUp(:_dExpiryDate, :_sRemark, :_symbol)', procedureArgument)
    // => Need to handle SP response, Also Below Table is SQL temp table UserLeague
    const oUserBonusExpireData = await UserLeagueSqlModel.findAll({ where: { eTransactionType: 'Bonus-Expire' }, attributes: ['id', 'iUserId', 'eTransactionType', 'nFinalAmount'], raw: true })
    const aStatisticsData = []
    const aProceedUsers = []

    for (const userLeague of oUserBonusExpireData) {
      // will push statistic object for specific user
      aStatisticsData.push({
        updateOne: {
          filter: { iUserId: ObjectId(userLeague.iUserId) },
          update: {
            $set: { $inc: { nActualBonus: -(Number(parseFloat(userLeague.nFinalAmount).toFixed(2))), nTotalBonusExpired: Number(parseFloat(userLeague.nFinalAmount).toFixed(2)) } }
          }
        }
      })
      // will push proceeded iUserId entry
      aProceedUsers.push(userLeague.id)
    }

    // Need to update statistics after fetching from userLeague
    await StatisticsModel.bulkWrite(aStatisticsData)
    await UserLeagueSqlModel.destroy({ where: { id: { [Op.in]: aProceedUsers } } })
  }

  // done
  /**
   *
   * @param { Object } data
   */
  async userPlayReturn(data) {
    try {
      let { iMatchId, iMatchLeagueId, userLeagues, eCategory } = data
      console.log('inside userPlayReturn....', iMatchId, iMatchLeagueId)

      const oUserLeagues = {}
      const oPlayedUserLeagues = {}
      const aPlayReturnQueue = []

      iMatchLeagueId = iMatchLeagueId.toString()
      iMatchId = iMatchId.toString()
      const userLeagueId = userLeagues.map(({ _id }) => _id.toString())

      const matchCategory = getStatisticsSportsKey(eCategory)

      const [playReturnPassBooks, playPassBooks] = await Promise.all([
        PassbookModel.findAll({
          where: { eTransactionType: 'Play-Return', iUserLeagueId: { [Op.in]: userLeagueId } },
          attributes: ['iUserLeagueId'],
          raw: true
        }),
        PassbookModel.findAll({
          where: { eTransactionType: 'Play', iUserLeagueId: { [Op.in]: userLeagueId } },
          attributes: ['nAmount', 'nBonus', 'nCash', 'nOldDepositBalance', 'nNewDepositBalance', 'nOldWinningBalance', 'nNewWinningBalance', 'iUserLeagueId'],
          raw: true
        })
      ])
      playReturnPassBooks.forEach((pbk, i) => { oUserLeagues[pbk.iUserLeagueId] = i })
      playPassBooks.forEach((pbk, i) => { oPlayedUserLeagues[pbk.iUserLeagueId] = i })

      const aUserLeagueData = []
      const aStatisticUpdate = []

      console.time(`${iMatchLeagueId} Play Return`)
      for (const ul of userLeagues) {
        let {
          iUserId,
          _id: iUserLeagueId,
          sMatchName,
          sUserName,
          eType
        } = ul
        iUserId = iUserId.toString()
        iUserLeagueId = iUserLeagueId.toString()

        if (eType === 'U') aPlayReturnQueue.push(iUserId)

        const isExist = oUserLeagues[iUserLeagueId.toString()] ? playReturnPassBooks[oUserLeagues[iUserLeagueId.toString()]] : false
        if (!isExist) {
          const passBook = (typeof oPlayedUserLeagues[iUserLeagueId.toString()] === 'number') ? playPassBooks[oPlayedUserLeagues[iUserLeagueId.toString()]] : false
          if (passBook) {
            aUserLeagueData.push({
              iMatchLeagueId,
              iUserLeagueId,
              iMatchId,
              eUserType: (eType === 'U') ? 'U' : 'B',
              iUserId,
              sMatchName,
              sUserName,
              eCategory,
              eTransactionType: 'Play'
            })
            const {
              nAmount: passBookAmount,
              nBonus: passBookBonus,
              nCash: passBookCash
            } = passBook
            const statisticObj = {
              nWinnings:
                convertToDecimal(
                  passBook.nOldWinningBalance -
                  passBook.nNewWinningBalance
                ),
              nTotalPlayReturn: convertToDecimal(passBookAmount),
              nTotalPlayReturnBonus: convertToDecimal(passBookBonus),
              nTotalPlayReturnCash: convertToDecimal(passBookCash),
              nActualDepositBalance:
                convertToDecimal(
                  passBook.nOldDepositBalance -
                  passBook.nNewDepositBalance
                ),
              nActualWinningBalance:
                convertToDecimal(
                  passBook.nOldWinningBalance -
                  passBook.nNewWinningBalance
                ),
              nActualBonus: convertToDecimal(passBookBonus),
              [`${matchCategory}.nPlayReturn`]: convertToDecimal(passBookAmount),
              [`${matchCategory}.nSpendingCash`]: -convertToDecimal(passBookCash),
              [`${matchCategory}.nSpendingBonus`]: -convertToDecimal(passBookBonus)
            }
            aStatisticUpdate.push({
              updateOne: {
                filter: { iUserId: ObjectId(iUserId) },
                update: { $inc: statisticObj }
              }
            })
          }
        }
        // await db.sequelize.transaction(
        //   {
        //     isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        //   },
        //   async (t) => {
        //     let {
        //       iUserId,
        //       _id: iUserLeagueId,
        //       sMatchName,
        //       sUserName,
        //       // iMatchId,
        //       // iMatchLeagueId,
        //       eType
        //     } = ul

        //     eType = eType === 'U' ? 'U' : 'B'
        //     iUserId = iUserId.toString()
        //     iUserLeagueId = iUserLeagueId.toString()
        //     // iMatchLeagueId = iMatchLeagueId.toString()
        //     // iMatchId = iMatchId.toString()

        //     const passbookProcessed = await checkProcessed(
        //       `playReturn:${iMatchLeagueId}:${iUserLeagueId}`,
        //       15
        //     )
        //     if (passbookProcessed !== 'EXIST') {
        //       // const isExist = await PassbookModel.findOne({
        //       //   where: {
        //       //     iUserId,
        //       //     eTransactionType: 'Play-Return',
        //       //     iUserLeagueId,
        //       //     iMatchLeagueId,
        //       //     iMatchId
        //       //   },
        //       //   transaction: t,
        //       //   lock: true
        //       // })
        //       const isExist = playReturnPassBooks.find(({ iUserLeagueId: _id }) => _id === iUserLeagueId)
        //       if (!isExist) {
        //         // const [userBalance, passBook] = await Promise.all([
        //         //   UserBalanceModel.findOne({
        //         //     where: { iUserId },
        //         //     transaction: t,
        //         //     lock: true
        //         //   }),
        //         //   PassbookModel.findOne({
        //         //     where: { iUserId, eTransactionType: 'Play', iUserLeagueId },
        //         //     transaction: t,
        //         //     lock: true
        //         //   })
        //         // ])
        //         const passBook = playPassBooks.find(({ iUserLeagueId: _id }) => _id === iUserLeagueId)

        //         if (passBook) {
        //           const userBalance = await UserBalanceModel.findOne({
        //             where: { iUserId },
        //             attributes: [
        //               'nCurrentWinningBalance',
        //               'nCurrentDepositBalance',
        //               'nCurrentTotalBalance',
        //               'nCurrentBonus'
        //             ],
        //             transaction: t,
        //             lock: true
        //           })

        //           const {
        //             nAmount: passBookAmount,
        //             nBonus: passBookBonus,
        //             nCash: passBookCash
        //           } = passBook
        //           const {
        //             nCurrentWinningBalance,
        //             nCurrentDepositBalance,
        //             nCurrentTotalBalance,
        //             nCurrentBonus
        //           } = userBalance

        //           const matchCategory = getStatisticsSportsKey(eCategory)

        //           await Promise.all([
        //             UserBalanceModel.update(
        //               {
        //                 nCurrentDepositBalance: literal(
        //                   `nCurrentDepositBalance + ${passBook.nOldDepositBalance -
        //                   passBook.nNewDepositBalance
        //                   }`
        //                 ),
        //                 nCurrentWinningBalance: literal(
        //                   `nCurrentWinningBalance + ${passBook.nOldWinningBalance -
        //                   passBook.nNewWinningBalance
        //                   }`
        //                 ),
        //                 nCurrentTotalBalance: literal(
        //                   `nCurrentTotalBalance + ${passBookCash}`
        //                 ),
        //                 nCurrentBonus: literal(
        //                   `nCurrentBonus + ${passBookBonus}`
        //                 )
        //               },
        //               { where: { iUserId }, transaction: t, lock: true }
        //             ),
        //             PassbookModel.create(
        //               {
        //                 iUserId,
        //                 nAmount: passBookAmount,
        //                 nCash: passBookCash,
        //                 nBonus: passBookBonus,
        //                 eTransactionType: 'Play-Return',
        //                 eUserType: eType,
        //                 eType: 'Cr',
        //                 iUserLeagueId,
        //                 iMatchLeagueId,
        //                 iMatchId,
        //                 nOldWinningBalance: nCurrentWinningBalance,
        //                 nOldDepositBalance: nCurrentDepositBalance,
        //                 nOldTotalBalance: nCurrentTotalBalance,
        //                 nOldBonus: nCurrentBonus,
        //                 sRemarks: `${sUserName} gets play return from ${sMatchName} (${eCategory})`,
        //                 dActivityDate: new Date()
        //               },
        //               { transaction: t, lock: true }
        //             ),
        //             StatisticsModel.updateOne(
        //               { iUserId: ObjectId(ul.iUserId) },
        //               {
        //                 $inc: {
        //                   nWinnings: Number(
        //                     parseFloat(
        //                       passBook.nOldWinningBalance -
        //                       passBook.nNewWinningBalance
        //                     ).toFixed(2)
        //                   ),
        //                   nTotalPlayReturn: Number(
        //                     parseFloat(passBookAmount).toFixed(2)
        //                   ),
        //                   nTotalPlayReturnBonus: Number(
        //                     parseFloat(passBookBonus).toFixed(2)
        //                   ),
        //                   nTotalPlayReturnCash: Number(
        //                     parseFloat(passBookCash).toFixed(2)
        //                   ),
        //                   nActualDepositBalance: Number(
        //                     parseFloat(
        //                       passBook.nOldDepositBalance -
        //                       passBook.nNewDepositBalance
        //                     ).toFixed(2)
        //                   ),
        //                   nActualWinningBalance: Number(
        //                     parseFloat(
        //                       passBook.nOldWinningBalance -
        //                       passBook.nNewWinningBalance
        //                     ).toFixed(2)
        //                   ),
        //                   nActualBonus: Number(
        //                     parseFloat(passBookBonus).toFixed(2)
        //                   ),
        //                   [`${matchCategory}.nPlayReturn`]: Number(
        //                     parseFloat(passBookAmount).toFixed(2)
        //                   ),
        //                   [`${matchCategory}.nSpendingCash`]: -Number(
        //                     parseFloat(passBookCash).toFixed(2)
        //                   ),
        //                   [`${matchCategory}.nSpendingBonus`]: -Number(
        //                     parseFloat(passBookBonus).toFixed(2)
        //                   )
        //                 }
        //               },
        //               { upsert: true }
        //             ),
        //             queuePush('pushNotification:playReturn', {
        //               _id: ul.iUserId
        //             })
        //           ])
        //         }
        //       }
        //     }
        //   }
        // )
      }

      let result = { isSuccess: true }
      try {
        if (aUserLeagueData && aUserLeagueData.length) {
          const procedureArgument = { replacements: { iId: iMatchLeagueId } }
          await SQLUserLeagueModel.destroy({ where: { iMatchLeagueId, eTransactionType: 'Play' } })
          await SQLUserLeagueModel.bulkCreate(aUserLeagueData)
          await db.sequelize.query('CALL bulkPlayReturn(:iId)', procedureArgument)
          await StatisticsModel.bulkWrite(aStatisticUpdate, { ordered: false })
          await bulkQueuePush('pushNotification:playReturn', aPlayReturnQueue, 1000)
        }
      } catch (error) {
        result = { isSuccess: false }
        handleCatchError(error)
      }
      console.timeEnd(`${iMatchLeagueId} Play Return`)

      return result
    } catch (error) {
      handleCatchError(error)
      return { isSuccess: false }
    }
  }

  /**
   * It will give user contest cashback
   * @param { Object } data
   * @returns { Object } of isSuccess true or false
   */
  async userContestCashback(data) {
    try {
      let {
        nAmount,
        eCashbackType,
        nTeams,
        userLeagues,
        iMatchId,
        iMatchLeagueId,
        eCategory
      } = data
      nAmount = Number(nAmount)

      const bonusExpireDays = await settingServices.findSetting(
        'BonusExpireDays'
      )
      if (!bonusExpireDays) return { isSuccess: false }

      for (const ul of userLeagues) {
        await db.sequelize.transaction(
          {
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
          },
          async (t) => {
            let { _id: iUserId, sUserName, eType } = ul
            iUserId = iUserId.toString()
            iMatchLeagueId = iMatchLeagueId.toString()
            iMatchId = iMatchId.toString()
            let dBonusExpiryDate = null

            const passbookProcessed = await checkProcessed(
              `cashback:${iUserId}:${iMatchLeagueId}`,
              15
            )
            if (passbookProcessed !== 'EXIST') {
              const isProcessed = await PassbookModel.findOne({
                where: {
                  iUserId,
                  eTransactionType: 'Cashback-Contest',
                  iMatchLeagueId,
                  iMatchId
                },
                transaction: t,
                lock: true
              })
              if (!isProcessed) {
                const userBalance = await UserBalanceModel.findOne({
                  where: { iUserId },
                  transaction: t,
                  lock: true
                })
                const {
                  nCurrentWinningBalance = 0,
                  nCurrentDepositBalance = 0,
                  nCurrentTotalBalance = 0,
                  nCurrentBonus = 0
                } = userBalance

                if (eCashbackType === 'C') {
                  await UserBalanceModel.update(
                    {
                      nCurrentTotalBalance: literal(
                        `nCurrentTotalBalance + ${nAmount}`
                      ),
                      // nCurrentWinningBalance: literal(
                      //   `nCurrentWinningBalance + ${nAmount}`
                      // ),
                      // nTotalWinningAmount: literal(
                      //   `nTotalWinningAmount + ${nAmount}`
                      // ),
                      nCurrentDepositBalance: literal(
                        `nCurrentDepositBalance + ${nAmount}`
                      )
                      // nTotalDepositAmount: literal(`nTotalDepositAmount + ${nAmount}`)
                      // nTotalDepositCount: literal('nTotalDepositCount + 1')
                    },
                    { where: { iUserId }, transaction: t, lock: true }
                  )
                } else if (eCashbackType === 'B') {
                  dBonusExpiryDate = new Date()
                  dBonusExpiryDate.setDate(dBonusExpiryDate.getDate() + bonusExpireDays.nMax)
                  dBonusExpiryDate.setUTCHours(23, 59) // 23:59 EOD

                  await UserBalanceModel.update(
                    {
                      nCurrentBonus: literal(`nCurrentBonus + ${nAmount}`),
                      nTotalBonusEarned: literal(
                        `nTotalBonusEarned + ${nAmount}`
                      )
                    },
                    { where: { iUserId }, transaction: t, lock: true }
                  )
                }

                const sRemarks = `${sUserName} got Contest Cashback for Joining with Minimum ${nTeams} Teams`
                await PassbookModel.create(
                  {
                    iUserId,
                    nAmount: nAmount,
                    nCash: eCashbackType === 'C' ? nAmount : 0,
                    nBonus: eCashbackType === 'B' ? nAmount : 0,
                    eTransactionType: 'Cashback-Contest',
                    eUserType: eType,
                    eType: 'Cr',
                    iMatchLeagueId,
                    iMatchId,
                    nOldWinningBalance: nCurrentWinningBalance,
                    nOldDepositBalance: nCurrentDepositBalance,
                    nOldTotalBalance: nCurrentTotalBalance,
                    nOldBonus: nCurrentBonus,
                    dBonusExpiryDate,
                    sRemarks,
                    eCategory,
                    dActivityDate: new Date()
                  },
                  { transaction: t, lock: true }
                )

                const matchCategory = getStatisticsSportsKey(eCategory)
                const nCash = eCashbackType === 'C' ? nAmount : 0
                // const nCount = (eCashbackType === 'C') ? 1 : 0
                const nBonus = eCashbackType === 'B' ? nAmount : 0
                await StatisticsModel.updateOne(
                  { iUserId: ObjectId(ul._id) },
                  {
                    $inc: {
                      nActualBonus: convertToDecimal(nBonus),
                      // nActualWinningBalance: convertToDecimal(nCash),
                      // nWinnings: convertToDecimal(nCash),
                      // nTotalWinnings: convertToDecimal(nCash),
                      nCashbackCash: convertToDecimal(nCash),
                      nCashbackBonus: convertToDecimal(nBonus),
                      nActualDepositBalance: convertToDecimal(nCash),
                      // nDepositCount: nCount,
                      // nDeposits: convertToDecimal(nCash),
                      nCash: convertToDecimal(nCash),
                      nBonus: convertToDecimal(nBonus),
                      [`${matchCategory}.nCashbackCash`]: convertToDecimal(nCash),
                      [`${matchCategory}.nCashbackCashCount`]: 1,
                      [`${matchCategory}.nCashbackBonus`]: convertToDecimal(nBonus),
                      [`${matchCategory}.nCashbackBonusCount`]: 1,
                      [`${matchCategory}.nCashbackAmount`]: convertToDecimal(nAmount),
                      [`${matchCategory}.nCashbackCount`]: 1
                    }
                  },
                  { upsert: true }
                )
              }
            }
          }
        )
      }
      return { isSuccess: true }
    } catch (error) {
      handleCatchError(error)
      return { isSuccess: false }
    }
  }

  // done
  /**
   * It will take returns user contest cashback
   * @param { Object } data
   */
  async userContestCashbackReturn(data) {
    const aProcessedLeagues = []
    let successCount = 0
    const failedCount = 0
    try {
      let {
        nAmount,
        eCashbackType,
        nTeams,
        userLeagues,
        iMatchId,
        iMatchLeagueId,
        eCategory
      } = data
      nAmount = Number(nAmount)

      for (const ul of userLeagues) {
        await db.sequelize.transaction(
          {
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
          },
          async (t) => {
            let { _id: iUserId, sUserName, eType, iLeagueId } = ul
            iUserId = iUserId.toString()
            iMatchLeagueId = iMatchLeagueId.toString()
            iMatchId = iMatchId.toString()

            const passbookProcessed = await checkProcessed(
              `cashbackReturn:${iUserId}:${iMatchLeagueId}`,
              15
            )
            if (passbookProcessed !== 'EXIST') {
              const isProcessed = await PassbookModel.findOne({
                where: {
                  iUserId,
                  eTransactionType: 'Cashback-Return',
                  iMatchLeagueId,
                  iMatchId
                },
                transaction: t,
                lock: true
              })
              if (!isProcessed) {
                const isExist = await PassbookModel.findOne({
                  where: {
                    iUserId,
                    eTransactionType: 'Cashback-Contest',
                    iMatchLeagueId,
                    iMatchId
                  },
                  transaction: t,
                  lock: true
                })
                if (isExist) {
                  const userBalance = await UserBalanceModel.findOne({
                    where: { iUserId },
                    transaction: t,
                    lock: true
                  })
                  const {
                    nCurrentWinningBalance = 0,
                    nCurrentDepositBalance = 0,
                    nCurrentTotalBalance = 0,
                    nCurrentBonus = 0
                  } = userBalance

                  if (eCashbackType === 'C') {
                    await UserBalanceModel.update(
                      {
                        nCurrentTotalBalance: literal(
                          `nCurrentTotalBalance - ${nAmount}`
                        ),
                        // nCurrentWinningBalance: literal(
                        //   `nCurrentWinningBalance - ${nAmount}`
                        // ),
                        nTotalCashbackReturned: literal(
                          `nTotalCashbackReturned + ${nAmount}`
                        ),
                        nCurrentDepositBalance: literal(
                          `nCurrentDepositBalance - ${nAmount}`
                        )
                        // nTotalDepositAmount: literal(`nTotalDepositAmount - ${nAmount}`),
                        // nTotalDepositCount: literal('nTotalDepositCount - 1')
                      },
                      { where: { iUserId }, transaction: t, lock: true }
                    )
                  } else if (eCashbackType === 'B') {
                    await UserBalanceModel.update(
                      {
                        nCurrentBonus: literal(`nCurrentBonus - ${nAmount}`),
                        // nTotalBonusEarned: literal(`nTotalBonusEarned - ${nAmount}`)
                        nTotalBonusReturned: literal(
                          `nTotalBonusReturned + ${nAmount}`
                        )
                      },
                      { where: { iUserId }, transaction: t, lock: true }
                    )
                  }

                  const sRemarks = `${sUserName} got Contest Cashback Return for Joining with Minimum ${nTeams} Teams`
                  await PassbookModel.create(
                    {
                      iUserId,
                      nAmount: nAmount,
                      nCash: eCashbackType === 'C' ? nAmount : 0,
                      nBonus: eCashbackType === 'B' ? nAmount : 0,
                      eTransactionType: 'Cashback-Return',
                      eType: 'Dr',
                      eUserType: eType,
                      iMatchLeagueId,
                      iMatchId,
                      nOldWinningBalance: nCurrentWinningBalance,
                      nOldDepositBalance: nCurrentDepositBalance,
                      nOldTotalBalance: nCurrentTotalBalance,
                      nOldBonus: nCurrentBonus,
                      sRemarks,
                      eCategory,
                      dActivityDate: new Date()
                    },
                    { transaction: t, lock: true }
                  )

                  const matchCategory = getStatisticsSportsKey(eCategory)
                  const nCash = eCashbackType === 'C' ? nAmount : 0
                  // const nCount = (eCashbackType === 'C') ? 1 : 0
                  const nBonus = eCashbackType === 'B' ? nAmount : 0
                  await StatisticsModel.updateOne(
                    { iUserId: ObjectId(ul._id) },
                    {
                      $inc: {
                        nActualBonus: -convertToDecimal(nBonus),
                        nCashbackCash: -convertToDecimal(nCash),
                        nCashbackBonus: -convertToDecimal(nBonus),
                        nActualDepositBalance: -convertToDecimal(nCash),
                        // nActualWinningBalance: -convertToDecimal(nCash),
                        // nWinnings: -convertToDecimal(nCash),
                        nTotalCashbackReturnCash: convertToDecimal(nCash),
                        nTotalCashbackReturnBonus: convertToDecimal(nBonus),
                        // nActualDepositBalance: -(convertToDecimal(nCash)),
                        // nDepositCount: -(nCount),
                        // nDeposits: -(convertToDecimal(nCash)),
                        nCash: -convertToDecimal(nCash),
                        // nBonus: -convertToDecimal(nBonus),
                        [`${matchCategory}.nCashbackAmount`]: -convertToDecimal(nAmount),
                        [`${matchCategory}.nCashbackCount`]: -1,
                        [`${matchCategory}.nCashbackCash`]: -convertToDecimal(nCash),
                        [`${matchCategory}.nCashbackCashCount`]: -1,
                        [`${matchCategory}.nCashbackBonus`]: -convertToDecimal(nBonus),
                        [`${matchCategory}.nCashbackBonusCount`]: -1,
                        [`${matchCategory}.nCashbackReturnCash`]: convertToDecimal(nCash),
                        [`${matchCategory}.nCashbackReturnCashCount`]: 1,
                        [`${matchCategory}.nCashbackReturnBonus`]: convertToDecimal(nBonus),
                        [`${matchCategory}.nCashbackReturnBonusCount`]: 1
                      }
                    },
                    { upsert: true }
                  )
                  // await session.commitTransaction()
                  // session.endSession()
                }
              }
              aProcessedLeagues.push(iLeagueId)
              successCount++
            }
          }
        )
      }
      if (failedCount) {
        console.log(
          `******** userCashbackReturn ********** failed: ${failedCount}, success: ${successCount}`
        )
      }
      return { isSuccess: true, aProcessedLeagues, successCount, failedCount }
    } catch (error) {
      handleCatchError(error)
      return {
        isSuccess: false,
        error,
        aProcessedLeagues,
        successCount,
        failedCount
      }
    }
  }

  /**
   * It will opens account
   * @param { Object } data
   * @returns { Object } of isSuccess true or false
   */
  async openAccount(data) {
    try {
      let { iUserId, sUsername, eType: eUserType } = data

      iUserId = iUserId.toString()

      await db.sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
      }, async (t) => {
        await PassbookModel.create(
          {
            iUserId,
            eUserType,
            eTransactionType: 'Opening',
            eType: 'Cr',
            sRemarks: `${sUsername} Initial Account Opened`,
            dActivityDate: new Date()
          },
          { transaction: t, lock: true }
        )

        await UserBalanceModel.create(
          {
            iUserId,
            eUserType
          },
          { transaction: t, lock: true }
        )
        await StatisticsModel.create({ iUserId: ObjectId(iUserId) })
      })
      return { isSuccess: true }
    } catch (error) {
      handleCatchError(error)
      return { isSuccess: false }
    }
  }

  /**
   * It will revert previously opened account
   * @param { Object } data
   * @returns { Object } of isSuccess true or false
   */
  async revertOpenedAccount(data) {
    try {
      let { iUserId, eType: eUserType } = data

      iUserId = iUserId.toString()

      await db.sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
      }, async (t) => {
        await PassbookModel.destroy(
          {
            where: {
              iUserId,
              eUserType,
              eTransactionType: 'Opening',
              eType: 'Cr'
            }
          },
          { transaction: t, lock: true }
        )

        await UserBalanceModel.destroy(
          {
            where: {
              iUserId,
              eUserType
            }
          },
          { transaction: t, lock: true }
        )
        await StatisticsModel.deleteOne({ iUserId: ObjectId(iUserId) })
      })
      return { isSuccess: true }
    } catch (error) {
      handleCatchError(error)
      return { isSuccess: false }
    }
  }

  // currently in development mode, not in live.
  async winReturn(data) {
    return new Promise((resolve, reject) => {
      try {
        let {
          nPrice = 0,
          iUserId,
          _id,
          sMatchName,
          sUserName,
          iMatchLeagueId,
          iMatchId,
          eType,
          nBonusWin = 0,
          eCategory
        } = data

        eType = eType === 'U' ? 'U' : 'B'
        iUserId = iUserId.toString()
        const iUserLeagueId = _id.toString()
        iMatchId = iMatchId.toString()
        iMatchLeagueId = iMatchLeagueId.toString()
        nPrice = Number(nPrice)

        return db.sequelize.transaction({
          isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
        }, async (t) => {
          const isProcessed = await PassbookModel.findOne({
            where: {
              iUserId,
              eTransactionType: 'Win-Return',
              iUserLeagueId,
              iMatchLeagueId,
              iMatchId
            },
            transaction: t,
            lock: true
          })
          if (!isProcessed) {
            const userBalance = await UserBalanceModel.findOne({
              where: { iUserId }
            })

            const {
              nCurrentWinningBalance,
              nCurrentDepositBalance,
              nCurrentTotalBalance,
              nCurrentBonus
            } = userBalance

            const passBook = await PassbookModel.findOne({
              where: { iUserId, eTransactionType: 'Win', iUserLeagueId },
              transaction: t,
              lock: true
            })

            if (passBook && nPrice > 0) {
              if (userBalance.nCurrentWinningBalance >= nPrice) {
                await UserBalanceModel.update(
                  {
                    nCurrentTotalBalance: literal(
                      `nCurrentTotalBalance - ${nPrice}`
                    ),
                    nCurrentWinningBalance: literal(
                      `nCurrentWinningBalance - ${nPrice}`
                    ),
                    nCurrentBonus: literal(`nCurrentBonus - ${nBonusWin}`),
                    nTotalBonusEarned: literal(
                      `nTotalBonusEarned - ${nBonusWin}`
                    )
                  },
                  {
                    where: { iUserId },
                    transaction: t,
                    lock: true
                  }
                )
              } else if (userBalance.nCurrentTotalBalance >= nPrice) {
                await UserBalanceModel.update(
                  {
                    nCurrentDepositBalance: literal(
                      `nCurrentDepositBalance - ${nPrice - nCurrentWinningBalance
                      }`
                    ),
                    nCurrentTotalBalance: literal(
                      `nCurrentTotalBalance - ${nPrice}`
                    ),
                    nCurrentWinningBalance: 0,
                    nCurrentBonus: literal(`nCurrentBonus - ${nBonusWin}`),
                    nTotalBonusEarned: literal(
                      `nTotalBonusEarned - ${nBonusWin}`
                    )
                  },
                  {
                    where: { iUserId },
                    transaction: t,
                    lock: true
                  }
                )
              } else {
                await UserBalanceModel.update(
                  {
                    nCurrentDepositBalance: literal(
                      `nCurrentDepositBalance - ${nPrice - nCurrentWinningBalance
                      }`
                    ),
                    nCurrentTotalBalance: literal(
                      `nCurrentTotalBalance - ${nPrice}`
                    ),
                    nCurrentWinningBalance: 0,
                    nCurrentBonus: literal(`nCurrentBonus - ${nBonusWin}`),
                    nTotalBonusEarned: literal(
                      `nTotalBonusEarned - ${nBonusWin}`
                    )
                  },
                  {
                    where: { iUserId },
                    transaction: t,
                    lock: true
                  }
                )
              }
            } else if (passBook && nBonusWin > 0) {
              await UserBalanceModel.update(
                {
                  nCurrentBonus: literal(`nCurrentBonus - ${nBonusWin}`),
                  nTotalBonusEarned: literal(
                    `nTotalBonusEarned - ${nBonusWin}`
                  )
                },
                {
                  where: { iUserId },
                  transaction: t,
                  lock: true
                }
              )
            }

            await PassbookModel.create(
              {
                iUserId,
                eTransactionType: 'Win-Return',
                eType: 'Dr',
                eUserType: eType,
                nBonus: nBonusWin,
                nAmount: nPrice + nBonusWin,
                nCash: nPrice,
                iUserLeagueId,
                iMatchId,
                iMatchLeagueId,
                eCategory,
                nOldWinningBalance: nCurrentWinningBalance,
                nOldDepositBalance: nCurrentDepositBalance,
                nOldTotalBalance: nCurrentTotalBalance,
                nOldBonus: nCurrentBonus,
                sRemarks: `${sUserName} win return for ${sMatchName}`,
                dActivityDate: new Date()
              },
              { transaction: t, lock: true }
            )

            await PassbookModel.update(
              {
                bWinReturn: true
              },
              {
                where: {
                  iUserId,
                  eTransactionType: 'Win',
                  iUserLeagueId,
                  iMatchLeagueId,
                  iMatchId
                },
                transaction: t,
                lock: true
              }
            )
          }
          resolve({ isSuccess: true })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  // currently in development mode, not in live.
  async creatorBonusReturn(data) {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          let { iUserId, _id, iMatchId, eCategory } = data
          iUserId = iUserId.toString()
          const iMatchLeagueId = _id.toString()
          iMatchId = iMatchId.toString()

          await db.sequelize.transaction(
            {
              isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
            },
            async (t) => {
              const isProcessed = await PassbookModel.findOne({
                where: {
                  iUserId,
                  eTransactionType: 'Creator-Bonus-Return',
                  iMatchLeagueId,
                  iMatchId
                },
                raw: true,
                transaction: t,
                lock: true
              })
              if (!isProcessed) {
                const isCashbackProcessed = await PassbookModel.findOne({
                  where: {
                    iUserId,
                    eTransactionType: 'Creator-Bonus',
                    iMatchLeagueId,
                    iMatchId
                  },
                  raw: true,
                  transaction: t,
                  lock: true
                })
                if (isCashbackProcessed) {
                  const userBalance = await UserBalanceModel.findOne(
                    { where: { iUserId }, raw: true, transaction: t, lock: true }
                  )
                  const {
                    nCurrentWinningBalance,
                    nCurrentDepositBalance,
                    nCurrentTotalBalance,
                    nCurrentBonus,
                    eUserType
                  } = userBalance
                  const { nAmount } = isCashbackProcessed

                  const lcc = await commonRuleServices.findRule('LCC')
                  // const lcc = await CommonRuleModel.findOne({ eRule: 'LCC', eStatus: 'Y' }, { eType: 1 }).lean()
                  const lccType = lcc && lcc.eType ? lcc.eType : 'C'

                  let sValue = 'WIN'
                  if (lccType === 'D') {
                    sValue = 'DEPOSIT'
                  } else if (lccType === 'B') {
                    sValue = 'BONUS'
                  }

                  let updateBalance = {
                    nCurrentWinningBalance: literal(
                      `nCurrentWinningBalance - ${nAmount}`
                    ),
                    nCurrentTotalBalance: literal(
                      `nCurrentTotalBalance - ${nAmount}`
                    ),
                    nTotalWinningAmount: literal(
                      `nTotalWinningAmount - ${nAmount}`
                    )
                  }

                  let updatePassBook = {
                    iUserId,
                    nAmount: nAmount,
                    eTransactionType: 'Creator-Bonus-Return',
                    eType: 'Dr',
                    eUserType: eUserType,
                    nCash: nAmount,
                    nBonus: 0,
                    iMatchLeagueId,
                    iMatchId,
                    nOldWinningBalance: nCurrentWinningBalance,
                    nOldDepositBalance: nCurrentDepositBalance,
                    nOldTotalBalance: nCurrentTotalBalance,
                    nOldBonus: nCurrentBonus,
                    eCategory,
                    sRemarks:
                      'Your creator bonus cash win for private contest is returned back',
                    dActivityDate: new Date()
                  }

                  if (sValue === 'DEPOSIT') {
                    updateBalance = {
                      nCurrentDepositBalance: literal(
                        `nCurrentDepositBalance - ${nAmount}`
                      ),
                      nCurrentTotalBalance: literal(
                        `nCurrentTotalBalance - ${nAmount}`
                      ),
                      nTotalDepositAmount: literal(
                        `nTotalDepositAmount - ${nAmount}`
                      ),
                      nTotalDepositCount: literal('nTotalDepositCount - 1')
                    }

                    updatePassBook = {
                      iUserId,
                      nAmount: nAmount,
                      eTransactionType: 'Creator-Bonus-Return',
                      eType: 'Dr',
                      eUserType: eUserType,
                      nCash: nAmount,
                      nBonus: 0,
                      iMatchLeagueId,
                      iMatchId,
                      nOldWinningBalance: nCurrentWinningBalance,
                      nOldDepositBalance: nCurrentDepositBalance,
                      nOldTotalBalance: nCurrentTotalBalance,
                      nOldBonus: nCurrentBonus,
                      eCategory,
                      sRemarks:
                        'Your creator bonus cash deposit for private contest is returned back',
                      dActivityDate: new Date()
                    }
                  } else if (sValue === 'BONUS') {
                    updateBalance = {
                      nCurrentBonus: literal(`nCurrentBonus - ${nAmount}`),
                      nTotalBonusEarned: literal(
                        `nTotalBonusEarned - ${nAmount}`
                      )
                    }

                    updatePassBook = {
                      iUserId,
                      nAmount: nAmount,
                      eTransactionType: 'Creator-Bonus-Return',
                      eType: 'Dr',
                      eUserType: eUserType,
                      nCash: 0,
                      nBonus: nAmount,
                      iMatchLeagueId,
                      iMatchId,
                      eCategory,
                      nOldWinningBalance: nCurrentWinningBalance,
                      nOldDepositBalance: nCurrentDepositBalance,
                      nOldTotalBalance: nCurrentTotalBalance,
                      nOldBonus: nCurrentBonus,
                      sRemarks:
                        'Your creator bonus for private contest is returned back',
                      dActivityDate: new Date()
                    }
                  }

                  await UserBalanceModel.update(updateBalance, {
                    where: { iUserId },
                    transaction: t,
                    lock: true
                  })
                  await PassbookModel.create(updatePassBook, {
                    transaction: t,
                    lock: true
                  })
                  await PassbookModel.update(
                    {
                      bCreatorBonusReturn: true
                    },
                    {
                      where: {
                        iUserId,
                        eTransactionType: 'Creator-Bonus',
                        iMatchLeagueId,
                        iMatchId
                      },
                      transaction: t,
                      lock: true
                    }
                  )
                }
                return resolve({ isSuccess: true })
              } else {
                return resolve({ isSuccess: true })
              }
            }
          )
          return resolve({ isSuccess: true })
        } catch (error) {
          handleCatchError(error)
          return resolve({ isSuccess: false, error })
        }
      })()
    })
  }
}

module.exports = new UserBalance()
