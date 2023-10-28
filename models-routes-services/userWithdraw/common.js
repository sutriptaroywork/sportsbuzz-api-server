const UserWithdrawModel = require('./model')
const PassbookModel = require('../passbook/model')
const UserBalanceModel = require('../userBalance/model')
const UserTdsModel = require('../userTds/model')
const StatisticsModel = require('../user/statistics/model')
const db = require('../../database/sequelize')
const { Transaction, Op, literal } = require('sequelize')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const { handleCatchError, defaultSearch, convertToDecimal } = require('../../helper/utilities.services')
const UsersModel = require('../user/model')
const { queuePush } = require('../../helper/redis')
const moment = require('moment')
const SettingModel = require('../setting/model')

async function reversedTransaction(data, iWithdrawId) {
  try {
    await db.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    }, async (t) => {
      await UserWithdrawModel.update({ dReversedDate: new Date(), bReversed: true }, { where: { id: iWithdrawId }, transaction: t, lock: true })
    })
    return { isSuccess: true }
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false }
  }
}

async function cancellOrRejectTransaction(data, ePaymentStatus, iWithdrawId) {
  try {
    await db.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    }, async (t) => {
      const withdraw = await UserWithdrawModel.findOne({ where: { id: iWithdrawId, ePaymentStatus: { [Op.notIn]: ['C', 'R'] } }, raw: true, transaction: t, lock: true })

      if (withdraw) {
        const { iUserId, nAmount } = withdraw
        const dProcessedDate = new Date()

        const oldBalance = await UserBalanceModel.findOne({ where: { iUserId }, transaction: t, lock: true })
        const { eUserType, nCurrentBonus: nOldBonus, nCurrentTotalBalance: nOldTotalBalance, nCurrentDepositBalance: nOldDepositBalance, nCurrentWinningBalance: nOldWinningBalance } = oldBalance

        await UserWithdrawModel.update({ ePaymentStatus, iTransactionId: data.referenceId, dProcessedDate }, { where: { id: iWithdrawId }, transaction: t, lock: true })

        let updateStatsObj
        const updateObj = {
          nCurrentTotalBalance: literal(`nCurrentTotalBalance + ${nAmount}`),
          nTotalWithdrawAmount: literal(`nTotalWithdrawAmount - ${nAmount}`),
          nTotalWithdrawCount: literal('nTotalWithdrawCount - 1')
        }
        const passbook = await PassbookModel.findOne({ where: { iUserId, iWithdrawId: iWithdrawId }, transaction: t, lock: true })
        const winDiff = passbook.nOldWinningBalance - passbook.nNewWinningBalance
        const depositDiff = passbook.nOldDepositBalance - passbook.nNewDepositBalance
        if (depositDiff > 0) {
          if (winDiff > 0) {
            updateObj.nCurrentWinningBalance = literal(`nCurrentWinningBalance + ${winDiff}`)
            updateObj.nCurrentDepositBalance = literal(`nCurrentDepositBalance + ${depositDiff}`)
            updateStatsObj = {
              nActualDepositBalance: Number(parseFloat(depositDiff).toFixed(2)),
              nCash: Number(parseFloat(depositDiff).toFixed(2)),
              nActualWinningBalance: Number(parseFloat(winDiff).toFixed(2)),
              nWinnings: Number(parseFloat(winDiff).toFixed(2))
            }
          } else {
            updateObj.nCurrentDepositBalance = literal(`nCurrentDepositBalance + ${nAmount}`)
            updateStatsObj = {
              nActualDepositBalance: Number(parseFloat(nAmount).toFixed(2)),
              nCash: Number(parseFloat(nAmount).toFixed(2))
            }
          }
        } else {
          updateObj.nCurrentWinningBalance = literal(`nCurrentWinningBalance + ${nAmount}`)
          updateStatsObj = {
            nActualWinningBalance: Number(parseFloat(nAmount).toFixed(2)),
            nWinnings: Number(parseFloat(nAmount).toFixed(2))
          }
        }
        updateStatsObj = { ...updateStatsObj, nWithdraw: -(Number(parseFloat(nAmount).toFixed(2))), nWithdrawCount: -1 }

        await UserBalanceModel.update(updateObj,
          {
            where: { iUserId },
            transaction: t,
            lock: true
          })
        await PassbookModel.create({ iUserId, eUserType, nAmount, nCash: nAmount, nOldBonus, nOldTotalBalance, nOldDepositBalance, nOldWinningBalance, eTransactionType: 'Withdraw-Return', iWithdrawId: withdraw.id, eType: 'Cr', sRemarks: 'Withdrawal failed due to server error.', dProcessedDate, eStatus: 'R' }, { transaction: t, lock: true })
        await StatisticsModel.updateOne({ iUserId: ObjectId(iUserId) }, { $inc: updateStatsObj }, { upsert: true })
        if (eUserType === 'U') await queuePush('pushNotification:Withdraw', { iUserId, ePaymentStatus, sPushType: 'Transaction' })
      }
    })
    return { isSuccess: true }
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false }
  }
}

async function successTransaction(data, iWithdrawId) {
  try {
    const { referenceId } = data
    const dProcessedDate = new Date()

    await db.sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
    }, async (t) => {
      const withdraw = await UserWithdrawModel.findOne({ where: { id: iWithdrawId, ePaymentStatus: { [Op.in]: ['P', 'I'] } }, raw: true, transaction: t, lock: true })

      if (withdraw) {
        await UserWithdrawModel.update({ ePaymentStatus: 'S', dProcessedDate, iTransactionId: referenceId }, { where: { id: iWithdrawId }, transaction: t, lock: true })
        await PassbookModel.update({ dProcessedDate }, { where: { iWithdrawId: iWithdrawId.toString() }, transaction: t, lock: true })

        // Fetch TDS BreakUp
        const oData = {
          iUserId: withdraw.iUserId,
          nFinalAmount: withdraw.nAmount
        }
        const { oTDS } = await createTDSEntry(oData, t)
        if (withdraw.eUserType === 'U') {
          const { nTDSAmount, nPercentage, nRequestedAmount } = oTDS
          await queuePush('pushNotification:Withdraw', { iUserId: withdraw.iUserId, ePaymentStatus: 'S', sPushType: 'Transaction' })
          await queuePush('pushNotification:TDS', { iUserId: withdraw.iUserId, ePaymentStatus: 'S', sPushType: 'Transaction', nRequestedAmount, nTDSAmount, nPercentage })
        }
      }
    })
    return { isSuccess: true }
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false }
  }
}
/**
 * Used for getting list for admin withdraw and deposit
 * @param  {enum}  ePaymentStatus = ['P','S','R','C']
 * @param  {enum} ePaymentGateway
 * @param {string} sSearch value for searching
 * @param {string} sFlag = 'D' for deposit ,'W' for withdraw
 * @param {boolean} bReversedFlag ='y','n
 * @return {userQuery, aUsers} {isSuccess, status, message, data}
 */
async function getAdminWithdrawDepositListQuery(ePaymentStatus, ePaymentGateway, sSearch, sFlag, bReversedFlag) {
  const query = []

  if (ePaymentStatus) {
    query.push({ ePaymentStatus })
  }

  if (ePaymentGateway) {
    query.push({ ePaymentGateway })
  }

  if (bReversedFlag && ['y', 'n'].includes(bReversedFlag)) {
    const bReversed = (bReversedFlag === 'y')
    query.push({ bReversed })
  }
  let aUsers = []

  if (sSearch) sSearch = defaultSearch(sSearch)

  if (sSearch && sSearch.length) {
    const aSearchQuery = []
    const nSearchNumber = Number(sSearch)
    if (!isNaN(nSearchNumber)) {
      aUsers = await UsersModel.find({ sMobNum: new RegExp('^.*' + sSearch + '.*', 'i') }, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean()
      const userIds = aUsers.map(user => user._id.toString())

      if (aUsers.length) {
        aSearchQuery.push({
          [Op.or]: [
            { id: { [Op.like]: nSearchNumber + '%' } },
            { iUserId: { [Op.in]: userIds } }
          ]
        })
      } else {
        aSearchQuery.push({ id: nSearchNumber })
      }
    } else {
      aUsers = await UsersModel.find({ $or: [{ sName: new RegExp('^.*' + sSearch + '.*', 'i') }, { sUsername: new RegExp('^.*' + sSearch + '.*', 'i') }] }, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean()
      if (aUsers.length > 0) {
        const userIds = aUsers.map(user => user._id.toString())
        aSearchQuery.push({ iUserId: { [Op.in]: userIds } })
      }
    }
    if (sFlag === 'D') {
      aSearchQuery.push({ iTransactionId: { [Op.like]: sSearch + '%' } })
      aSearchQuery.push({ iOrderId: { [Op.like]: sSearch + '%' } })
    }
    query.push({ [Op.or]: aSearchQuery })
  }
  return { query, aUsers }
}

/**
 * Used for deducting TDS on withdrawal and at EOFY
 * @param  {Object}  Withdrawal Details
 * @return {oTDSBreakUp, oUpdatedWithdrwalData} {isSuccess, status, message, data}
 */

async function getAndProcessTDS(oWithdrawalData) {
  try {
    console.log('=========== TDS PROCESS STARTED ===========')
    // const { iUserId, nFinalAmount: nWithdrawAmount } = oWithdrawalData
    // const {
    //   nCurrentBonus: nOldBonus,
    //   nCurrentTotalBalance: nOldTotalBalance,
    //   nCurrentDepositBalance: nOldDepositBalance,
    //   nCurrentWinningBalance: nOldWinningBalance
    // } = oWithdrawalData.oldBalance

    // Find out taxable amount
    const oTransferData = {
      ...oWithdrawalData,
      oldBalance: {}
    }
    const { isSuccess, oTDS } = await calculateTDS(oWithdrawalData)
    if (!isSuccess) return { isSuccess: true, oTDS, oData: oTransferData }
    const { nAmountAfterTax } = oTDS
    if (nAmountAfterTax <= 0) {
      return { isSuccess: false, isTDS: false, oTDS, oData: oTransferData }
    }

    // const passbook = await PassbookModel.create({
    //   iUserId,
    //   eTransactionType: 'TDS',
    //   eUserType: 'U',
    //   eType: 'Dr',
    //   nAmount: nTDSAmount,
    //   nCash: nTDSAmount,
    //   nOldWinningBalance,
    //   nOldDepositBalance,
    //   nOldTotalBalance,
    //   nOldBonus,
    //   sRemarks: `You have paid ${nTDSAmount} ₹ as TDS on the withdrawal of ${nWithdrawAmount} ₹`,
    //   dActivityDate: new Date()
    // }, { transaction: t, lock: true })

    // await UserTdsModel.create({
    //   iUserId,
    //   nPercentage,
    //   nOriginalAmount: nTaxableAmount,
    //   nAmount: nTDSAmount,
    //   nActualAmount: convertToDecimal(nTaxableAmount - nTDSAmount),
    //   nTaxableAmount,
    //   iPassbookId: passbook.id,
    //   eUserType: 'U',
    //   eStatus: 'A'
    // }, { transaction: t, lock: true })

    oTransferData.nFinalAmount = nAmountAfterTax
    console.log('=========== TDS PROCESS COMPLETED ===========')
    return { isSuccess: true, oTDS, oData: oTransferData }
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false }
  }
}

async function calculateTDS(oData) {
  try {
    const { iUserId, nFinalAmount: nWithdrawAmount } = oData
    // Find out the TDS percentage
    let nPercentage = 0
    const tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }, { nMax: 1 }).lean()
    if (tdsSetting) nPercentage = tdsSetting.nMax

    // Get the Financial Year Start and End Dates
    let FINANCIAL_YEAR_START_DATE = `${new Date().getFullYear()}-04-01`
    if (new Date().getMonth() >= 5 && new Date().getFullYear() === 2023) {
      FINANCIAL_YEAR_START_DATE = `${new Date().getFullYear()}-07-01`
    }
    let FINANCIAL_YEAR_END_DATE = `${new Date().getFullYear() + 1}-03-31`
    FINANCIAL_YEAR_START_DATE = moment(new Date(FINANCIAL_YEAR_START_DATE)).startOf('day').toISOString()
    FINANCIAL_YEAR_END_DATE = moment(new Date(FINANCIAL_YEAR_END_DATE)).endOf('day').toISOString()

    // Find out Taxable amount and TDS breakup
    /*
    New Formula of TDS : A-Total Withdraw amount, B-Total Deposit Amount, C-Opening Balance of Year, D: Already Deducted TDS on Amount
    nTaxableAmount = A - B - C - D
  */
    const oCommonQuery = {
      iUserId,
      dUpdatedAt: { [Op.gte]: new Date(FINANCIAL_YEAR_START_DATE), [Op.lte]: new Date(FINANCIAL_YEAR_END_DATE) }
    }
    // Find out total withdraw, deposit, tds deducted amount and opening balance of year
    const [nTotalWithdrawnAmount, nTotalDepositedAmount, nTotalProcessedAmount] = await Promise.all([
      UserWithdrawModel.sum('nAmount', { where: { ...oCommonQuery, ePaymentStatus: 'S' }, raw: true }),
      PassbookModel.sum('nCash', { where: { ...oCommonQuery, eStatus: 'CMP', eTransactionType: 'Deposit' }, raw: true }),
      UserTdsModel.sum('nOriginalAmount', { where: { ...oCommonQuery, eStatus: 'A' }, raw: true })
    ])
    let nOpeningBalanceOfYear = await PassbookModel.findOne({ where: { iUserId, dUpdatedAt: { [Op.lt]: FINANCIAL_YEAR_START_DATE } }, attributes: ['nNewWinningBalance'], order: [['id', 'desc']], limit: 1, raw: true })
    if (!nOpeningBalanceOfYear || (new Date().getMonth() >= 5 && new Date().getFullYear() === 2023)) nOpeningBalanceOfYear = { nNewWinningBalance: 0 }

    const nActualWithdrawalAmount = Number(nTotalWithdrawnAmount + nWithdrawAmount)
    const nTaxableAmount = convertToDecimal(nActualWithdrawalAmount - nTotalDepositedAmount - nOpeningBalanceOfYear?.nNewWinningBalance - nTotalProcessedAmount) // GOVT. TDS Formula

    const nTDSAmount = convertToDecimal(nTaxableAmount * Number(nPercentage / 100)) // Calculate TDS as per TDS percentage
    const nAmountAfterTax = convertToDecimal(nWithdrawAmount - nTDSAmount)
    const nTaxFreeAmount = convertToDecimal(Number(nTotalDepositedAmount + nOpeningBalanceOfYear?.nNewWinningBalance + nTotalProcessedAmount) - Number(nTotalWithdrawnAmount))

    const oTDSBreakUp = {
      nAmountAfterTax,
      nTotalWithdrawalAmount: nActualWithdrawalAmount || 0,
      nTotalDepositedAmount: nTotalDepositedAmount || 0,
      nOpeningBalanceOfYear: nOpeningBalanceOfYear.nNewWinningBalance || 0,
      nTotalProcessedAmount: nTotalProcessedAmount || 0,
      nTaxableAmount: nTaxableAmount > 0 ? nTaxableAmount : 0,
      nRequestedAmount: nWithdrawAmount,
      nTDSAmount: nTDSAmount > 0 ? nTDSAmount : 0,
      nPercentage,
      nTaxFreeAmount: nTaxFreeAmount || 0,
      dFinancialYear: `${new Date().getFullYear()}-${new Date().getFullYear() % 100 + 1}`,
      bEligible: false
    }

    if (nTaxableAmount <= 0) return { isSuccess: false, oTDS: oTDSBreakUp, oData }
    return { isSuccess: true, oTDS: oTDSBreakUp, oData }
  } catch (error) {
    handleCatchError(error)
  }
}

// This Function will be worked based on NetWinning
async function calculateTDSV1(oData) {
  try {
    const { iUserId, nFinalAmount: nWithdrawAmount } = oData
    // Find out the TDS percentage
    let nPercentage = 0
    const tdsSetting = await SettingModel.findOne({ sKey: 'TDS' }, { nMax: 1 }).lean()
    if (tdsSetting) nPercentage = tdsSetting.nMax

    // Get the Financial Year Start and End Dates
    let FINANCIAL_YEAR_START_DATE = `${new Date().getFullYear()}-04-01`
    if (new Date().getMonth() >= 5 && new Date().getFullYear() === 2023) {
      FINANCIAL_YEAR_START_DATE = `${new Date().getFullYear()}-07-01`
    }
    let FINANCIAL_YEAR_END_DATE = `${new Date().getFullYear() + 1}-03-31`
    FINANCIAL_YEAR_START_DATE = moment(new Date(FINANCIAL_YEAR_START_DATE)).startOf('day').toISOString()
    FINANCIAL_YEAR_END_DATE = moment(new Date(FINANCIAL_YEAR_END_DATE)).endOf('day').toISOString()
    // Find out Taxable amount and TDS breakup
    /*
    New Formula of TDS : A-Total Withdraw amount, B-Total Deposit Amount, C-Opening Balance of Year, D: Already Deducted TDS on Amount
    nTaxableAmount = A - B - C - D
  */
    const oCommonQuery = {
      iUserId,
      dUpdatedAt: { [Op.gte]: new Date(FINANCIAL_YEAR_START_DATE), [Op.lte]: new Date(FINANCIAL_YEAR_END_DATE) }
    }

    // Findout play and win entries
    const [nTotalPlayCashEntries, nTotalPlayBonusEntries, nTotalWinEntries, nTotalProcessedAmount] = await Promise.all([
      PassbookModel.sum('nCash', { where: { ...oCommonQuery, eStatus: 'CMP', eTransactionType: 'Play' } }),
      PassbookModel.sum('nBonus', { where: { ...oCommonQuery, eStatus: 'CMP', eTransactionType: 'Play' } }),
      PassbookModel.sum('nAmount', { where: { ...oCommonQuery, eStatus: 'CMP', eTransactionType: 'Win' } }),
      UserTdsModel.sum('nAmount', { where: { ...oCommonQuery, eStatus: 'A' }, raw: true })
    ])
    console.log(nTotalPlayCashEntries || 0, nTotalPlayBonusEntries, nTotalWinEntries, nTotalProcessedAmount)
    // New Formula: nNetWinning = nTotalWinEntries - (nTotalCash + nTotalBonus)
    // Case 1: if 30 % on NetWinning - Already Paid TDS < 30 % on WithDrawAmount --> Choose Case 1 amount as TDS
    // Case 2: if 30 % on NetWinning - Already Paid TDS > 30 % on WithDrawAmount --> Choose Case 2 amount as TDS

    nPercentage = nPercentage / 100
    const nNetWinning = convertToDecimal(Number(nTotalWinEntries) - (Number(nTotalPlayCashEntries) - Number(nTotalPlayBonusEntries)))
    const nTDSWinning = convertToDecimal(Number(nNetWinning) * Number(nPercentage))
    const nTDSWithdraw = convertToDecimal(Number(nWithdrawAmount) * Number(nPercentage))
    const nTDSAmount = Number(nTDSWinning) < Number(nTDSWithdraw) ? (Number(nTDSWinning) - Number(nTotalProcessedAmount)) : Number(nTDSWithdraw)
    const nAmountAfterTax = convertToDecimal(Number(nWithdrawAmount) - Number(nTDSAmount))
    console.log(nWithdrawAmount, nTDSAmount)
    const oTDSBreakUp = {
      nAmountAfterTax,
      nTotalWithdrawalAmount: 0,
      nTotalDepositedAmount: 0,
      nOpeningBalanceOfYear: 0,
      nTotalProcessedAmount: 0,
      nTaxableAmount: 0,
      nRequestedAmount: nWithdrawAmount,
      nTDSAmount: nTDSAmount > 0 ? nTDSAmount : 0,
      nPercentage,
      nTaxFreeAmount: 0,
      dFinancialYear: `${new Date().getFullYear()}-${new Date().getFullYear() % 100 + 1}`,
      bEligible: false
    }

    return { isSuccess: true, oTDS: oTDSBreakUp, oData }
  } catch (error) {
    handleCatchError(error)
  }
}

async function createTDSEntry(oData, t) {
  try {
    // Fetch User Balance
    const oldBalance = await UserBalanceModel.findOne(
      { where: { iUserId: oData.iUserId.toString() }, transaction: t, lock: true }
    )
    const {
      nCurrentBonus: nOldBonus,
      nCurrentTotalBalance: nOldTotalBalance,
      nCurrentDepositBalance: nOldDepositBalance,
      nCurrentWinningBalance: nOldWinningBalance
    } = oldBalance

    // Calculate And Get TDS breakup
    const { oTDS } = await calculateTDS(oData)
    const { nTDSAmount, nTaxableAmount, nPercentage, nRequestedAmount } = oTDS

    if (nTDSAmount > 0) {
      // Make TDS Entry In Passbook
      const passbook = await PassbookModel.create({
        iUserId: oData.iUserId.toString(),
        eTransactionType: 'TDS',
        eUserType: 'U',
        eType: 'Dr',
        nAmount: nTDSAmount,
        nCash: nTDSAmount,
        nOldWinningBalance,
        nOldDepositBalance,
        nOldTotalBalance,
        nOldBonus,
        sRemarks: `You have paid ${nTDSAmount} ₹ as TDS on the withdrawal of ${nRequestedAmount} ₹`,
        dActivityDate: new Date()
      }, { transaction: t, lock: true })

      // Make TDS Entry In Passbook
      await UserTdsModel.create({
        iUserId: oData.iUserId.toString(),
        nPercentage,
        nOriginalAmount: nTaxableAmount,
        nAmount: nTDSAmount,
        nActualAmount: convertToDecimal(nTaxableAmount - nTDSAmount),
        nWithdrawAmount: nRequestedAmount,
        iPassbookId: passbook.id,
        iTransactionId: passbook.iTransactionId,
        eUserType: 'U',
        eStatus: 'A'
      }, { transaction: t, lock: true })
    }

    return { isSuccess: true, oTDS }
  } catch (error) {
    handleCatchError(error)
  }
}
module.exports = {
  reversedTransaction,
  successTransaction,
  cancellOrRejectTransaction,
  getAdminWithdrawDepositListQuery,
  getAndProcessTDS,
  calculateTDS,
  createTDSEntry
}
