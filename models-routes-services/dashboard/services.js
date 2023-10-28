const DashboardModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError } = require('../../helper/utilities.services')
const UserModel = require('../user/model')
const UserDepositModel = require('../userDeposit/model')
const UserWithdrawModel = require('../userWithdraw/model')
const UserTeamModel = require('../userTeam/model')
const { fn, col, Op } = require('sequelize')
const mongoose = require('mongoose')
const ObjectID = mongoose.Types.ObjectId

class AdminDashboard {
  async fetchDashboard(req, res) {
    try {
      const data = await DashboardModel.find({}).lean()

      if (!data.length) {
        const bulk = [{ sKey: 'RUDW' }, { sKey: 'RUMW' }, { sKey: 'RUYW' }, { sKey: 'UTDW' }, { sKey: 'UTMW' }, { sKey: 'UTYW' }, { sKey: 'DDW' }, { sKey: 'DMW' }, { sKey: 'DYW' }, { sKey: 'WDW' }, { sKey: 'WMW' }, { sKey: 'WYW' }]
        await DashboardModel.create(bulk)
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cDashboard), data })
    } catch (error) {
      catchError('AdminDashboard.fetchDashboard', error, req, res)
    }
  }

  async updateRegisterUserDashboard(req, res) {
    try {
      const { sKey, aDay, aMonth, aYear } = req.body

      if (aDay && aDay.length && aDay.length > 7) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].days_daterange_error })
      if (aMonth && aMonth.length && aMonth.length > 12) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].month_daterange_error })
      if (aYear && aYear.length && aYear.length > 5) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].year_daterange_error })

      const updateField = {}
      if (!['RUDW', 'RUMW', 'RUYW'].includes(sKey)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })

      if (aDay && aDay.length) {
        const aData = await getDateRange(UserModel, aDay, sKey)
        updateField.aData = aData
      }
      if (aMonth && aMonth.length) {
        const aData = await getDateRange(UserModel, aMonth, sKey)
        updateField.aData = aData
      }
      if (aYear && aYear.length) {
        const aData = await getDateRange(UserModel, aYear, sKey)
        updateField.aData = aData
      }

      const data = await DashboardModel.findOneAndUpdate({ sKey, _id: ObjectID(req.params.id) }, updateField, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cRdashboard) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cRdashboard), data })
    } catch (error) {
      return catchError('AdminDashboard.updateRegisterUserDashboard', error, req, res)
    }
  }

  async updateDepositDashboard(req, res) {
    try {
      const { sKey, aDay, aMonth, aYear } = req.body

      if (aDay && aDay.length && aDay.length > 7) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].days_daterange_error })
      if (aMonth && aMonth.length && aMonth.length > 12) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].month_daterange_error })
      if (aYear && aYear.length && aYear.length > 5) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].year_daterange_error })

      const updateField = {}
      if (!['DDW', 'DMW', 'DYW'].includes(sKey)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })

      if (aDay && aDay.length) {
        const aData = await getDateRange(UserDepositModel, aDay, sKey)
        updateField.aData = aData
      }
      if (aMonth && aMonth.length) {
        const aData = await getDateRange(UserDepositModel, aMonth, sKey)
        updateField.aData = aData
      }
      if (aYear && aYear.length) {
        const aData = await getDateRange(UserDepositModel, aYear, sKey)
        updateField.aData = aData
      }

      const data = await DashboardModel.findOneAndUpdate({ sKey, _id: ObjectID(req.params.id) }, updateField, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cDdashboard) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cDdashboard), data })
    } catch (error) {
      return catchError('AdminDashboard.updateDepositDashboard', error, req, res)
    }
  }

  async updateWithdrawDashboard(req, res) {
    try {
      const { sKey, aDay, aMonth, aYear } = req.body

      if (aDay && aDay.length && aDay.length > 7) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].days_daterange_error })
      if (aMonth && aMonth.length && aMonth.length > 12) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].month_daterange_error })
      if (aYear && aYear.length && aYear.length > 5) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].year_daterange_error })

      const updateField = {}
      if (!['WDW', 'WMW', 'WYW'].includes(sKey)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })
      if (aDay && aDay.length) {
        const aData = await getDateRange(UserWithdrawModel, aDay, sKey)
        updateField.aData = aData
      }
      if (aMonth && aMonth.length) {
        const aData = await getDateRange(UserWithdrawModel, aMonth, sKey)
        updateField.aData = aData
      }
      if (aYear && aYear.length) {
        const aData = await getDateRange(UserWithdrawModel, aYear, sKey)
        updateField.aData = aData
      }

      const data = await DashboardModel.findOneAndUpdate({ sKey, _id: ObjectID(req.params.id) }, updateField, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cWdashboard) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cWdashboard), data })
    } catch (error) {
      return catchError('AdminDashboard.updateWithdrawDashboard', error, req, res)
    }
  }

  async updateUserTeamDashboard(req, res) {
    try {
      const { sKey, aDay, aMonth, aYear } = req.body

      if (aDay && aDay.length && aDay.length > 7) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].days_daterange_error })
      if (aMonth && aMonth.length && aMonth.length > 12) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].month_daterange_error })
      if (aYear && aYear.length && aYear.length > 5) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].year_daterange_error })

      const updateField = {}
      if (!['UTDW', 'UTMW', 'UTYW'].includes(sKey)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cKey) })

      if (aDay && aDay.length) {
        const aData = await getDateRange(UserTeamModel, aDay, sKey)
        updateField.aData = aData
      }
      if (aMonth && aMonth.length) {
        const aData = await getDateRange(UserTeamModel, aMonth, sKey)
        updateField.aData = aData
      }
      if (aYear && aYear.length) {
        const aData = await getDateRange(UserTeamModel, aYear, sKey)
        updateField.aData = aData
      }

      const data = await DashboardModel.findOneAndUpdate({ sKey, _id: ObjectID(req.params.id) }, updateField, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cUtdashboard) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cUtdashboard), data })
    } catch (error) {
      return catchError('AdminDashboard.updateUserTeamDashboard', error, req, res)
    }
  }
}

async function getDateRange(Model, aDateRange, sKey) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const aData = []
        for (const date of aDateRange) {
          const { dStart, dEnd } = date
          const contQuery = { dCreatedAt: { $gte: new Date(Number(dStart)), $lte: new Date(Number(dEnd)) } }
          let nValue
          if (['RUDW', 'RUMW', 'RUYW', 'UTDW', 'UTMW', 'UTYW'].includes(sKey)) {
            nValue = await Model.countDocuments(contQuery)
          } else if (['DDW', 'DMW', 'DYW'].includes(sKey)) {
            const nTotalSuccessDeposits = await Model.findAll({ attributes: [[fn('sum', col('nCash')), 'total']], where: { ePaymentStatus: 'S', [Op.and]: [{ dCreatedAt: { [Op.gte]: new Date(Number(dStart)) } }, { dCreatedAt: { [Op.lt]: new Date(Number(dEnd)) } }] }, raw: true })
            nValue = nTotalSuccessDeposits.length ? (!nTotalSuccessDeposits[0].total ? 0 : nTotalSuccessDeposits[0].total) : 0
          } else if (['WDW', 'WMW', 'WYW'].includes(sKey)) {
            const aSuccessWithdrawals = await Model.findAll({ attributes: [['ePaymentGateway', 'eTitle'], [fn('sum', col('nAmount')), 'nValue']], group: 'ePaymentGateway', where: { ePaymentGateway: { [Op.ne]: '' }, [Op.and]: [{ dCreatedAt: { [Op.gte]: new Date(Number(dStart)) } }, { dCreatedAt: { [Op.lte]: new Date(Number(dEnd)) } }], ePaymentStatus: 'S' }, raw: true })
            nValue = aSuccessWithdrawals.length ? aSuccessWithdrawals.reduce((acc, { nValue }) => acc + nValue, 0) : 0
          }
          const results = { nValue, dStartDate: dStart, dEndDate: dEnd }
          aData.push(results)
        }
        resolve(aData)
      } catch (error) {
        // eslint-disable-next-line prefer-promise-reject-errors
        reject()
      }
    })()
  })
}

module.exports = new AdminDashboard()
