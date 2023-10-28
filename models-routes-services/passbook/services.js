const UsersModel = require('../user/model')
const PassbookModel = require('../passbook/model')
const UserWithdrawModel = require('../userWithdraw/model')
const { Op, fn, col } = require('sequelize')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, searchValues, defaultSearch, removenull, getPaginationValues2, handleCatchError, dateFormat } = require('../../helper/utilities.services')
const ObjectId = require('mongoose').Types.ObjectId
const UserBalance = require('../userBalance/model')
const MatchModel = require('../match/model')
const { categoryTransactionType } = require('../../data')
const { s3 } = require('../../helper/s3config')
const csv = require('fast-csv')
const TransactionReportModel = require('../passbook/transactionReportModel')
const moment = require('moment')
const config = require('../../config/config')
const axios = require('axios')

class Passbook {
  async list(req, res) {
    try {
      let data = []
      const query = []
      let { nLimit, nOffset, eType, dStartDate, dEndDate } = req.query

      nLimit = parseInt(nLimit) || 20
      nOffset = parseInt(nOffset) || 0

      if (dStartDate && dEndDate) {
        query.push({ dActivityDate: { [Op.gte]: new Date(Number(dStartDate) * 1000) } })
        query.push({ dActivityDate: { [Op.lte]: new Date(Number(dEndDate) * 1000) } })
      }

      if (eType === 'bonus') {
        query.push({ iUserId: req.user._id.toString() })
        query.push({ nBonus: { [Op.gt]: 0 } })
        query.push({
          eTransactionType: {
            [Op.in]:
              ['Cashback-Return', 'Play', 'Play-Return', 'Refer-Bonus', 'Bonus', 'Bonus-Expire', 'Deposit', 'Cashback-Contest', 'Win']
          }
        })

        data = await PassbookModel.findAll({
          where: {
            [Op.and]: query
          },
          attributes: ['id', 'eType', 'nCash', 'nBonus', 'nAmount', 'eTransactionType', 'sRemarks', 'dActivityDate', 'iMatchId', 'iMatchLeagueId', 'iTransactionId', 'iUserLeagueId', 'iSeriesId', 'iCategoryId'],
          order: [['id', 'desc']],
          offset: nOffset,
          limit: nLimit
        })
      } else if (eType === 'cash') {
        query.push({ iUserId: req.user._id.toString() })
        query.push({ [Op.or]: [{ nCash: { [Op.gt]: 0 } }, { eTransactionType: 'Opening' }] })

        data = await PassbookModel.findAll({
          where: {
            [Op.and]: query
          },
          attributes: ['id', 'eType', 'nCash', 'nBonus', 'nAmount', 'eTransactionType', 'sRemarks', 'dActivityDate', 'iMatchId', 'iMatchLeagueId', 'iTransactionId', 'iUserLeagueId', 'iSeriesId', 'iCategoryId'],
          order: [['id', 'desc']],
          offset: nOffset,
          limit: nLimit
        })
      } else if (eType === 'all') {
        query.push({ [Op.and]: [{ iUserId: req.user._id.toString() }, { eTransactionType: { [Op.ne]: 'Loyalty-Point' } }] })
        data = await PassbookModel.findAll({
          where: { [Op.and]: query },
          attributes: ['id', 'eType', 'nCash', 'nBonus', 'nAmount', 'eTransactionType', 'sRemarks', 'dActivityDate', 'iMatchId', 'iMatchLeagueId', 'iTransactionId', 'iUserLeagueId', 'iSeriesId', 'iCategoryId'],
          order: [['id', 'desc']],
          offset: nOffset,
          limit: nLimit
        })
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpassbook), data })
    } catch (error) {
      catchError('Passbook.list', error, req, res)
    }
  }

  async adminListV2(req, res) {
    try {
      let { start = 0, limit = 10, sort = 'dActivityDate', order, search, searchType = 'DEFAULT', datefrom, dateto, particulars, type, id, isFullResponse, eStatus = '', eUserType, sportsType } = req.query

      const orderBy = order && order === 'asc' ? 'ASC' : 'DESC'

      const query = []
      if (datefrom && dateto) {
        query.push({ dActivityDate: { [Op.gte]: new Date(datefrom) } })
        query.push({ dActivityDate: { [Op.lte]: new Date(dateto) } })
      }

      if (eStatus && ['R', 'CMP', 'CNCL'].includes(eStatus.toUpperCase())) {
        query.push({ eStatus: eStatus.toUpperCase() })
      }

      if (id) {
        query.push({ id: Number(id) })
      }
      if (type && ['Dr', 'Cr'].includes(type)) {
        query.push({ eType: type })
      }
      if (particulars) {
        query.push({ eTransactionType: particulars })
      }
      if (sportsType && (particulars ? categoryTransactionType.includes(particulars) : true)) {
        query.push({ eCategory: sportsType })
      }
      if (eUserType && ['U', 'B'].includes(eUserType)) { query.push({ eUserType }) }

      let users = []
      if (search) search = defaultSearch(search)

      if (search) {
        if (searchType === 'PASSBOOK' && isNaN(Number(search))) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].ctransactions), data: { rows: [] } })
        let userQuery = {}

        switch (searchType) {
          case 'NAME':
            userQuery = { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
            break
          case 'USERNAME':
            userQuery = { sUsername: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
            break
          case 'MOBILE':
            userQuery = { sMobNum: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
            break
          case 'PASSBOOK':
            userQuery = {}
            break
          default:
            userQuery = searchValues(search)
            break
        }

        if (ObjectId.isValid(search)) {
          users = await UsersModel.findById(search, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean()
          if (!users) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].ctransactions), data: { rows: [] } })
          users = [users]
        } else {
          users = await UsersModel.find(userQuery, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean()
        }
        if (users.length === 0) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].ctransactions), data: { rows: [] } })
      }

      const userIds = users.map(user => user._id.toString())

      if (search) {
        if (searchType === 'PASSBOOK') {
          query.push({ id: Number(search) })
        } else {
          if (!isNaN(Number(search))) {
            if (users.length) {
              query.push({ [Op.or]: [{ id: { [Op.like]: search + '%' } }, { iUserId: { [Op.in]: userIds } }] })
            } else {
              query.push({ id: { [Op.or]: [{ [Op.like]: search + '%' }] } })
            }
          } else {
            query.push({ iUserId: { [Op.in]: userIds } })
          }
        }
      }

      if ((!datefrom || !dateto) && [true, 'true'].includes(isFullResponse)) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].date_filter_err })
      }

      if (([true, 'true'].includes(isFullResponse))) query.push({ eUserType: 'U' })
      const paginationFields = [true, 'true'].includes(isFullResponse) ? {} : {
        offset: parseInt(start),
        limit: parseInt(limit)
      }

      const data = await PassbookModel.findAll({
        where: {
          [Op.and]: query
        },
        order: [[sort, orderBy]],
        ...paginationFields,
        attributes: ['id', 'iUserId', 'bIsBonusExpired', 'nAmount', 'nBonus', 'nCash', 'eTransactionType', 'iPreviousId', 'iUserLeagueId', 'iMatchId', 'iMatchLeagueId', 'iUserDepositId', 'iWithdrawId', 'sRemarks', 'sCommonRule', 'eType', 'dActivityDate', 'nNewWinningBalance', 'nNewDepositBalance', 'nNewTotalBalance', 'nNewBonus', 'dProcessedDate', 'nWithdrawFee', 'sPromocode', 'eStatus', 'eUserType', 'iTransactionId', 'nLoyaltyPoint', 'eCategory'],
        raw: true
      })

      const passbookData = await addUserFields(data, users)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].ctransactions), data: { rows: passbookData } })
    } catch (error) {
      catchError('Passbook.listV2', error, req, res)
    }
  }

  async getCountsV2(req, res) {
    try {
      let { search, searchType = 'DEFAULT', datefrom, dateto, particulars, type, id, eStatus = '', isFullResponse, eUserType, sportsType } = req.query

      const query = []
      if (datefrom && dateto) {
        query.push({ dActivityDate: { [Op.gte]: new Date(datefrom) } })
        query.push({ dActivityDate: { [Op.lte]: new Date(dateto) } })
      }

      if (eStatus && ['R', 'CMP', 'CNCL'].includes(eStatus.toUpperCase())) {
        query.push({ eStatus: eStatus.toUpperCase() })
      }
      if (id) {
        query.push({ id: Number(id) })
      }
      if (type && ['Dr', 'Cr'].includes(type)) {
        query.push({ eType: type })
      }
      if (particulars) {
        query.push({ eTransactionType: particulars })
      }
      if (sportsType && (particulars ? categoryTransactionType.includes(particulars) : true)) {
        query.push({ eCategory: sportsType })
      }

      if (eUserType && ['U', 'B'].includes(eUserType)) { query.push({ eUserType }) }

      let users = []

      if (search) search = defaultSearch(search)

      if (search) {
        if (searchType === 'PASSBOOK' && isNaN(Number(search))) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].ctransactions), data: { count: 0 } })
        let userQuery = {}

        switch (searchType) {
          case 'NAME':
            userQuery = { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
            break
          case 'USERNAME':
            userQuery = { sUsername: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
            break
          case 'MOBILE':
            userQuery = { sMobNum: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
            break
          case 'PASSBOOK':
            userQuery = {}
            break
          default:
            userQuery = searchValues(search)
            break
        }

        if (ObjectId.isValid(search)) {
          users = await UsersModel.findById(search, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean()
          if (!users) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].ctransactions), data: { count: 0 } })
          users = [users]
        } else {
          users = await UsersModel.find(userQuery, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean()
        }
        if (users.length === 0) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].ctransactions), data: { count: 0 } })
      }

      const userIds = users.map(user => user._id.toString())

      if (search) {
        if (searchType === 'PASSBOOK') {
          query.push({ id: Number(search) })
        } else {
          if (!isNaN(Number(search))) {
            if (users.length) {
              query.push({ [Op.or]: [{ id: { [Op.like]: search + '%' } }, { iUserId: { [Op.in]: userIds } }] })
            } else {
              query.push({ id: { [Op.or]: [{ [Op.like]: search + '%' }] } })
            }
          } else {
            query.push({ iUserId: { [Op.in]: userIds } })
          }
        }
      }
      if (([true, 'true'].includes(isFullResponse))) query.push({ eUserType: 'U' })

      const count = await PassbookModel.count({
        where: {
          [Op.and]: query
        },
        raw: true
      })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', `${messages[req.userLanguage].ctransactions} ${messages[req.userLanguage].cCounts}`), data: { count } })
    } catch (error) {
      catchError('Passbook.getCountsV2', error, req, res)
    }
  }

  async userDetails(req, res) {
    try {
      const { iUserId } = req.params
      const oData = {}
      // passbook include for difference
      const balance = await UserBalance.findOne({ where: { iUserId }, raw: true })
      oData.nCurrentDepositBalance = balance.nCurrentDepositBalance
      // nActualDepositBalance // for cash only -> statistics
      oData.nCurrentWinningBalance = balance.nCurrentWinningBalance
      // nActualWinningBalance -> statistics
      oData.nCurrentBonus = balance.nCurrentBonus
      // nActualBonus // for bonus only -> statistics

      // passbook include for total
      oData.nTotalBonusEarned = balance.nTotalBonusEarned // for bonus only
      // nBonus -> statistics
      oData.nTotalDepositAmount = balance.nTotalDepositAmount // for cash only
      // nDeposits -> statistics
      oData.nTotalWithdrawAmount = balance.nTotalWithdrawAmount // for withdraw only
      // nWithdraw -> statistics
      oData.nTotalWinningAmount = balance.nTotalWinningAmount // for winnings amount only
      // nTotalWinnings -> statistics

      // FOR total played with cash
      const aTotalPlayedCash = await PassbookModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eTransactionType: 'Play', iUserId }, raw: true })
      oData.nTotalPlayedCash = aTotalPlayedCash.length ? Number(parseFloat(!aTotalPlayedCash[0].total ? 0 : aTotalPlayedCash[0].total).toFixed(2)) : 0
      // nTotalPlayedCash -> statistics

      // FOR total played with bonus
      const aTotalPlayedBonus = await PassbookModel.findAll({ attributes: [[fn('sum', col('nBonus')), 'total']], where: { eTransactionType: 'Play', iUserId, nBonus: { [Op.gt]: 0 } }, raw: true })
      oData.nTotalPlayedBonus = aTotalPlayedBonus.length ? Number(parseFloat(!aTotalPlayedBonus[0].total ? 0 : aTotalPlayedBonus[0].total).toFixed(2)) : 0
      // nTotalPlayedBonus -> statistics

      // FOR total play return with cash
      const aTotalPlayReturnCash = await PassbookModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eTransactionType: 'Play-Return', iUserId }, raw: true })
      oData.nTotalPlayReturnCash = aTotalPlayReturnCash.length ? Number(parseFloat(!aTotalPlayReturnCash[0].total ? 0 : aTotalPlayReturnCash[0].total).toFixed(2)) : 0
      // nTotalPlayReturnCash -> statistics
      const aTotalPlayReturnBonus = await PassbookModel.findAll({ attributes: [[fn('sum', col('nBonus')), 'total']], where: { eTransactionType: 'Play-Return', iUserId, nBonus: { [Op.gt]: 0 } }, raw: true })
      oData.nTotalPlayReturnBonus = aTotalPlayReturnBonus.length ? Number(parseFloat(!aTotalPlayReturnBonus[0].total ? 0 : aTotalPlayReturnBonus[0].total).toFixed(2)) : 0
      // nTotalPlayReturnBonus -> statistics

      const oPendingWithdraw = await UserWithdrawModel.findOne({ where: { iUserId, ePaymentStatus: 'P' }, raw: true })
      if (!oPendingWithdraw) {
        oData.nLastPendingWithdraw = 0
        oData.nWinBalanceAtLastPendingWithdraw = 0
      } else {
        const pendingDetails = await PassbookModel.findOne({ where: { iUserId, dCreatedAt: { [Op.lte]: oPendingWithdraw.dCreatedAt } }, order: [['dCreatedAt', 'DESC']], raw: true })
        oData.nLastPendingWithdraw = oPendingWithdraw.nAmount || 0
        oData.nWinBalanceAtLastPendingWithdraw = pendingDetails.nNewWinningBalance || 0
      }
      const aTotalCreatorBonus = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eTransactionType: 'Creator-Bonus', iUserId }, raw: true })
      oData.nTotalCreatorBonus = aTotalCreatorBonus.length ? Number(parseFloat(!aTotalCreatorBonus[0].total ? 0 : aTotalCreatorBonus[0].total).toFixed(2)) : 0
      const aTotalRegisterBonus = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eTransactionType: 'Bonus', iUserId }, raw: true })
      oData.nTotalRegisterBonus = aTotalRegisterBonus.length ? Number(parseFloat(!aTotalRegisterBonus[0].total ? 0 : aTotalRegisterBonus[0].total).toFixed(2)) : 0
      const aTotalReferBonus = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eTransactionType: 'Refer-Bonus', iUserId }, raw: true })
      oData.nTotalReferBonus = aTotalReferBonus.length ? Number(parseFloat(!aTotalReferBonus[0].total ? 0 : aTotalReferBonus[0].total).toFixed(2)) : 0
      const aTotalBonusExpired = await PassbookModel.findAll({ attributes: [[fn('sum', col('nAmount')), 'total']], where: { eTransactionType: 'Bonus-Expire', iUserId }, raw: true })
      oData.nTotalBonusExpired = aTotalBonusExpired.length ? Number(parseFloat(!aTotalBonusExpired[0].total ? 0 : aTotalBonusExpired[0].total).toFixed(2)) : 0
      const aTotalCashbackCash = await PassbookModel.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { eTransactionType: 'Cashback-Contest', iUserId, nCash: { [Op.gt]: 0 } }, raw: true })
      oData.nTotalCashbackCash = aTotalCashbackCash.length ? Number(parseFloat(!aTotalCashbackCash[0].total ? 0 : aTotalCashbackCash[0].total).toFixed(2)) : 0
      // nCashbackCash -> statistics
      const aTotalCashbackBonus = await PassbookModel.findAll({ attributes: [[fn('sum', col('nBonus')), 'total']], where: { eTransactionType: 'Cashback-Contest', iUserId, nBonus: { [Op.gt]: 0 } }, raw: true })
      oData.nTotalCashbackBonus = aTotalCashbackBonus.length ? Number(parseFloat(!aTotalCashbackBonus[0].total ? 0 : aTotalCashbackBonus[0].total).toFixed(2)) : 0
      // nCashbackBonus -> statistics

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpassbook), data: oData })
    } catch (error) {
      catchError('Passbook.userDetails', error, req, res)
    }
  }

  async matchLeagueWiseList(req, res) {
    try {
      const { start = 0, limit = 10, sort = 'dActivityDate', order, search, searchType = 'DEFAULT', datefrom, dateto, particulars, type, id, isFullResponse, eStatus = '', eUserType } = req.query

      const orderBy = order && order === 'asc' ? 'ASC' : 'DESC'

      const query = []
      if (datefrom && dateto) {
        query.push({ dActivityDate: { [Op.gte]: new Date(datefrom) } })
        query.push({ dActivityDate: { [Op.lte]: new Date(dateto) } })
      }

      if (eStatus && ['R', 'CMP', 'CNCL'].includes(eStatus.toUpperCase())) {
        query.push({ eStatus: eStatus.toUpperCase() })
      }

      if (id) {
        query.push({ id: Number(id) })
      }
      if (type && ['Dr', 'Cr'].includes(type)) {
        query.push({ eType: type })
      }
      if (particulars) {
        query.push({ eTransactionType: particulars })
      }

      if (eUserType && ['U', 'B'].includes(eUserType)) { query.push({ eUserType }) }

      let users = []

      if (search) {
        if (searchType === 'PASSBOOK' && isNaN(Number(search))) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].ctransactions), data: { rows: [] } })
        const userQuery = searchValues(search)

        if (ObjectId.isValid(search)) {
          users = await UsersModel.findById(search, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean()
          if (!users) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].ctransactions), data: { rows: [] } })
          users = [users]
        } else {
          users = await UsersModel.find(userQuery, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean()
        }
        if (users.length === 0) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].ctransactions), data: { rows: [] } })
      }

      const userIds = users.map(user => user._id.toString())

      if (search) {
        if (searchType === 'PASSBOOK') {
          query.push({ id: Number(search) })
        } else {
          if (!isNaN(Number(search))) {
            if (users.length) {
              query.push({ [Op.or]: [{ id: { [Op.like]: search + '%' } }, { iUserId: { [Op.in]: userIds } }] })
            } else {
              query.push({ id: { [Op.or]: [{ [Op.like]: search + '%' }] } })
            }
          } else {
            query.push({ iUserId: { [Op.in]: userIds } })
          }
        }
      }

      if ((!datefrom || !dateto) && [true, 'true'].includes(isFullResponse)) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].date_filter_err })
      }

      const paginationFields = [true, 'true'].includes(isFullResponse) ? {} : {
        offset: parseInt(start),
        limit: parseInt(limit)
      }

      const data = await PassbookModel.findAll({
        where: {
          iMatchLeagueId: req.params.id.toString(),
          [Op.and]: query
        },
        order: [[sort, orderBy]],
        ...paginationFields,
        attributes: ['id', 'iUserId', 'bIsBonusExpired', 'nAmount', 'nBonus', 'nCash', 'eTransactionType', 'iPreviousId', 'iUserLeagueId', 'iMatchId', 'iMatchLeagueId', 'iUserDepositId', 'iWithdrawId', 'sRemarks', 'sCommonRule', 'eType', 'dActivityDate', 'nNewWinningBalance', 'nNewDepositBalance', 'nNewTotalBalance', 'nNewBonus', 'dProcessedDate', 'nWithdrawFee', 'sPromocode', 'eStatus', 'eUserType', 'iTransactionId', 'nLoyaltyPoint', 'eCategory'],
        raw: true
      })

      const passbookData = await addUserFields(data, users)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpassbook), data: passbookData })
    } catch (error) {
      catchError('Passbook.matchLeagueWiseList', error, req, res)
    }
  }

  async matchLeagueWiseCount(req, res) {
    try {
      let { search, searchType = 'DEFAULT', datefrom, dateto, particulars, type, id, eStatus = '', eUserType } = req.query

      const query = []
      if (datefrom && dateto) {
        query.push({ dActivityDate: { [Op.gte]: new Date(datefrom) } })
        query.push({ dActivityDate: { [Op.lte]: new Date(dateto) } })
      }

      if (eStatus && ['R', 'CMP', 'CNCL'].includes(eStatus.toUpperCase())) {
        query.push({ eStatus: eStatus.toUpperCase() })
      }
      if (id) {
        query.push({ id: Number(id) })
      }
      if (type && ['Dr', 'Cr'].includes(type)) {
        query.push({ eType: type })
      }
      if (particulars) {
        query.push({ eTransactionType: particulars })
      }

      if (eUserType && ['U', 'B'].includes(eUserType)) { query.push({ eUserType }) }

      let users = []

      if (search) search = defaultSearch(search)

      if (search) {
        if (searchType === 'PASSBOOK' && isNaN(Number(search))) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].ctransactions), data: { count: 0 } })
        let userQuery = {}

        switch (searchType) {
          case 'NAME':
            userQuery = { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
            break
          case 'USERNAME':
            userQuery = { sUsername: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
            break
          case 'MOBILE':
            userQuery = { sMobNum: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
            break
          case 'PASSBOOK':
            userQuery = {}
            break
          default:
            userQuery = searchValues(search)
        }

        if (ObjectId.isValid(search)) {
          users = await UsersModel.findById(search, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean()
          if (!users) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].ctransactions), data: { count: 0 } })
          users = [users]
        } else {
          users = await UsersModel.find(userQuery, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean()
        }
        if (users.length === 0) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].ctransactions), data: { count: 0 } })
      }

      const userIds = users.map(user => user._id.toString())

      if (search) {
        if (searchType === 'PASSBOOK') {
          query.push({ id: Number(search) })
        } else {
          if (!isNaN(Number(search))) {
            if (users.length) {
              query.push({ [Op.or]: [{ id: { [Op.like]: search + '%' } }, { iUserId: { [Op.in]: userIds } }] })
            } else {
              query.push({ id: { [Op.or]: [{ [Op.like]: search + '%' }] } })
            }
          } else {
            query.push({ iUserId: { [Op.in]: userIds } })
          }
        }
      }

      const count = await PassbookModel.count({
        where: {
          iMatchLeagueId: req.params.id.toString(),
          [Op.and]: query
        },
        raw: true
      })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', `${messages[req.userLanguage].ctransactions} ${messages[req.userLanguage].cCounts}`), data: { count } })
    } catch (error) {
      catchError('Passbook.matchLeagueWiseCount', error, req, res)
    }
  }

  async transactionReport(req, res) {
    try {
      const { dDateFrom, dDateTo, eTransactionType, eType, eStatus = '', eCategory, iMatchId, iMatchLeagueId } = req.body

      const iAdminId = req.admin._id
      removenull(req.body)

      if (!iMatchId && (!dDateFrom || !dDateTo)) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].date_filter_err })
      }

      const query = []
      if (dDateFrom && dDateTo) {
        query.push({ dActivityDate: { [Op.gte]: new Date(dDateFrom) } })
        query.push({ dActivityDate: { [Op.lte]: new Date(dDateTo) } })
      }

      if (iMatchId) {
        query.push({ iMatchId })
      }

      if (iMatchLeagueId) {
        query.push({ iMatchLeagueId })
      }

      if (eStatus && ['R', 'CMP', 'CNCL'].includes(eStatus.toUpperCase())) {
        query.push({ eStatus: eStatus.toUpperCase() })
      }

      if (eType && ['Dr', 'Cr'].includes(eType)) {
        query.push({ eType })
      }

      if (eTransactionType) {
        query.push({ eTransactionType })
      }

      if (eCategory && (eTransactionType ? categoryTransactionType.includes(eTransactionType) : true)) {
        query.push({ eCategory })
      }

      query.push({ eUserType: 'U' })

      const nTotal = await PassbookModel.count({
        where: { [Op.and]: query },
        raw: true
      })

      const report = await TransactionReportModel.create({ ...req.body, nTotal, oFilter: req.body, iAdminId })

      const oData = { iReportId: report._id, query, nTotal }
      generateReport(oData)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].cGenerationProcess.replace('##', messages[req.userLanguage].creport) })
    } catch (error) {
      catchError('Passbook.transactionReport', error, req, res)
    }
  }

  async listTransactionReport(req, res) {
    try {
      const { start, limit, sorting } = getPaginationValues2(req.query)
      const { datefrom, dateto } = req.query

      let query = {}
      query = datefrom && dateto ? { dCreatedAt: { $gte: new Date(datefrom), $lte: new Date(dateto) } } : {}

      const [aData, nTotal] = await Promise.all([
        TransactionReportModel.find(query).sort(sorting).skip(start).limit(limit).lean()
          .populate([{ path: 'iAdminId', select: 'sUsername' }, { path: 'iMatchId', select: 'sName' }, { path: 'iMatchLeagueId', select: 'sName' }]),
        TransactionReportModel.countDocuments(query)
      ])

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].creport), data: { aData, nTotal } })
    } catch (error) {
      catchError('Passbook.listTransactionReport', error, req, res)
    }
  }

  async matchLeagueWiseListRedirect(req, res) {
    try {
      const response = await axios({
        method: 'GET',
        url: `${config.SB11_BACKEND_MS_PAYMENT_SERVICE}/admin/passbooks/matchLeagueList/${req.params.id}`,
        params: { ...req.query }
      })
      return res.status(status.OK).jsonp(response?.data)
    } catch (error) {
      catchError('Passbook.matchLeagueWiseList.redirect', error, req, res)
    }
  }

  async matchLeagueWiseCountRedirect(req, res) {
    try {
      const response = await axios({
        method: 'GET',
        url: `${config.SB11_BACKEND_MS_PAYMENT_SERVICE}/admin/passbooks/matchLeagueCount/${req.params.id}`,
        params: { ...req.query }
      })
      return res.status(status.OK).jsonp(response?.data)
    } catch (error) {
      catchError('Passbook.matchLeagueWiseCount.redirect', error, req, res)
    }
  }
}

module.exports = new Passbook()
async function addUserFields(passbook, users = []) {
  let data
  const oUser = {}
  const oMatch = {}

  data = users
  const matchIds = passbook.map((p) => ObjectId(p.iMatchId))
  const aMatchIds = []
  const passbookIds = passbook.map((p) => ObjectId(p.iUserId))
  matchIds.forEach((id, i) => matchIds[i] && aMatchIds.push(id))
  const [usersData, matchesData] = await Promise.all([
    UsersModel.find({ _id: { $in: passbookIds } }, { sMobNum: 1, sEmail: 1, sUsername: 1 }).lean(),
    MatchModel.find({ _id: { $in: aMatchIds } }, { sName: 1, dStartDate: 1 }).lean()
  ])

  data = Array.isArray(usersData) ? usersData : []
  if (data.length) data.forEach((usr, i) => { oUser[usr._id.toString()] = i })

  const matchData = Array.isArray(matchesData) ? matchesData : []
  if (matchData.length) matchesData.forEach((match, i) => { oMatch[match._id.toString()] = i })

  return passbook.map(p => {
    // const user = data.find(u => u._id.toString() === p.iUserId.toString())
    const user = (typeof oUser[p.iUserId.toString()] === 'number') ? { ...data[oUser[p.iUserId.toString()]] } : {}
    let sMatchName = ''
    let dMatchStartDate = ''
    if (p.iMatchId && matchData && matchData.length) {
      // const match = matchData.find(u => u._id.toString() === p.iMatchId.toString())
      const match = (typeof oMatch[p.iMatchId.toString()] === 'number') ? { ...matchData[oMatch[p.iMatchId.toString()]] } : {}
      if (match && match.sName) sMatchName = match.sName
      if (match && match.dStartDate) dMatchStartDate = match.dStartDate
    }
    return { ...p, ...user, _id: undefined, sMatchName, dMatchStartDate }
  })
}

async function generateReport(data) {
  try {
    const { iReportId, query, nTotal } = data

    const nLimit = 5000
    let nSkip = 0
    const sort = 'id'
    const orderBy = 'ASC'

    const csvStream = csv.format({ headers: true, quoteHeaders: true })

    const params = {
      Bucket: config.S3_BUCKET_NAME,
      Key: config.s3TransactionReport + `${iReportId}.csv`,
      ContentType: 'text/csv',
      Body: csvStream,
      ContentDisposition: 'filename=Transaction Report.csv'
    }
    s3.upload(params, async function (err, data) {
      if (err) return handleCatchError(err)
      await TransactionReportModel.updateOne({ _id: iReportId }, { sReportUrl: data.Key, eStatus: 'S' }, { readPreference: 'primary' })
    })

    while (nSkip < nTotal) {
      const data = await PassbookModel.findAll({
        where: { [Op.and]: query },
        attributes: ['id', 'iUserId', 'nAmount', 'nBonus', 'nCash', 'eTransactionType', 'iUserLeagueId', 'iMatchId', 'iMatchLeagueId', 'eType', 'dActivityDate', 'nNewTotalBalance', 'nNewBonus', 'sPromocode', 'eStatus', 'eUserType', 'iTransactionId', 'nLoyaltyPoint', 'eCategory'],
        order: [[sort, orderBy]],
        limit: nLimit,
        offset: nSkip,
        raw: true
      })

      const aPassBookData = await addUserFields(data)

      const aFields = ['ID', 'Username', 'Match Type', 'Email', 'Mobile No', 'Cash', 'Bonus', 'Amount', 'Loyalty Point', 'Available Total Balance', 'Available Bonus', 'Promocode', 'Type', 'Transaction Type', 'Transaction ID', 'Match', 'Match Date & Time', 'Request Date']

      for (const oPassBook of aPassBookData) {
        oPassBook.dMatchStartDate = oPassBook?.dMatchStartDate ? dateFormat(oPassBook.dMatchStartDate) : ''
        oPassBook.dActivityDate = oPassBook?.dActivityDate ? dateFormat(oPassBook.dActivityDate) : ''
        const oData = { ID: 'id', Username: 'sUsername', 'Match Type': 'eCategory', Email: 'sEmail', 'Mobile No': 'sMobNum', Cash: 'nCash', Bonus: 'nBonus', Amount: 'nAmount', 'Loyalty Point': 'nLoyaltyPoint', 'Available Total Balance': 'nNewTotalBalance', 'Available Bonus': 'nNewBonus', Promocode: 'sPromocode', Type: 'eType', 'Transaction Type': 'eTransactionType', 'Transaction ID': 'iTransactionId', Match: 'sMatchName', 'Match Date & Time': 'dMatchStartDate', 'Request Date': 'dActivityDate' }

        const oPassBookRow = aFields.reduce((oRow, sField) => {
          oRow[sField] = oPassBook[oData[sField]]
          return oRow
        }, {})

        csvStream.write(oPassBookRow)
      }
      nSkip += nLimit
    }
    csvStream.end()
  } catch (error) {
    handleCatchError(error)
  }
}
