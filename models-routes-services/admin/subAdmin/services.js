const AdminModel = require('../model')
const RolesModel = require('../roles/model')
const { decryption } = require('../../../middlewares/middleware')
const bcrypt = require('bcryptjs')
const saltRounds = 1
const salt = bcrypt.genSaltSync(saltRounds)
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { removenull, catchError, pick, checkAlphanumeric, getIp, validateMobile, defaultSearch } = require('../../../helper/utilities.services')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const MatchModel = require('../../match/model')
const adminLogQueue = require('../../../rabbitmq/queue/adminLogQueue')
const AdminLogModel = require('../logs.model')

class SubAdmin {
  async get(req, res) {
    try {
      const data = await AdminModel.findOne({ _id: ObjectId(req.params.id), eType: 'SUB' }, { sName: 1, sUsername: 1, eStatus: 1, sEmail: 1, sMobNum: 1, aPermissions: 1, iRoleId: 1 }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].subAdmin) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].subAdmin), data })
    } catch (error) {
      return catchError('SubAdmin.get', error, req, res)
    }
  }

  async list(req, res) {
    try {
      let { start = 0, limit = 10, order, search } = req.query
      const orderBy = order && order === 'asc' ? 1 : -1
      const sorting = { dCreatedAt: orderBy }

      let query = {}
      if (search) {
        search = defaultSearch(search)
        query = {
          $or: [
            { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } },
            { sEmail: { $regex: new RegExp('^.*' + search + '.*', 'i') } },
            { sMobNum: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
          ]
        }
      }
      query = { ...query, eType: 'SUB' }

      const list = await AdminModel
        .find(query, {
          sName: 1,
          sUsername: 1,
          sEmail: 1,
          sMobNum: 1,
          aPermissions: 1,
          iRoleId: 1,
          eStatus: 1,
          dCreatedAt: 1
        })
        .sort(sorting)
        .skip(Number(start))
        .limit(Number(limit))
        .lean()

      const total = await AdminModel.countDocuments({ ...query })

      const data = [{ total, results: list }]
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].subAdmin), data })
    } catch (error) {
      return catchError('SubAdmin.list', error, req, res)
    }
  }

  // async adminLog(req, res, logData) { // method no longer in Use
  //   try {
  //     await AdminLogModel.create({ ...logData })
  //   } catch (error) {
  //     return catchError('AdminLog.create', error, req, res)
  //   }
  // }
  /**
   * This api is deprecated, use updateV3 instead.
   * It'll update the Sub Admin details like to assign a new role, update the username, etc.
   * @returns Success or Failure messages according to the validation mismatch or match.
   */
  async updateV2(req, res) {
    try {
      const { sUsername, sEmail, sMobNum, iRoleId, eStatus } = req.body

      req.body = pick(req.body, ['iRoleId', 'sName', 'sUsername', 'sEmail', 'sMobNum', 'eStatus'])
      removenull(req.body)
      if (eStatus) req.body.eStatus = eStatus

      if (!checkAlphanumeric(sUsername)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].must_alpha_num })

      if (validateMobile(sMobNum)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].mobileNumber) })

      const role = await RolesModel.findOne({ _id: ObjectId(iRoleId), eStatus: 'Y' }).lean()
      if (!role) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].role) })

      const oOldFields = await AdminModel.findById(req.params.id, { iRoleId: 1, eStatus: 1, sName: 1, sUsername: 1, sEmail: 1, sMobNum: 1, aPermissions: 1, _id: 0 }).lean()

      const adminExist = await AdminModel.findOne({ $or: [{ sEmail }, { sMobNum }, { sUsername }], _id: { $ne: req.params.id } })
      if (adminExist && adminExist.sUsername === sUsername) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].username) })
      if (adminExist && adminExist.sMobNum === sMobNum) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].mobileNumber) })
      if (adminExist && adminExist.sEmail === sEmail) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].email) })

      const data = await AdminModel.findOneAndUpdate({ _id: ObjectId(req.params.id), eType: 'SUB' }, { ...req.body }, { new: false, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].subAdmin) })

      // Log the record for future purpose to know which admin has update sub admin details.
      const { _id: iAdminId } = req.admin
      const oNewFields = { ...oOldFields, ...req.body }
      const logData = { oOldFields, oNewFields, iAdminId: ObjectId(iAdminId), sIP: getIp(req), eKey: 'SUB' }
      // await this.adminLog(req, res, logData)
      adminLogQueue.publish(logData)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].subAdmin), data })
    } catch (error) {
      return catchError('AdminAuth.update', error, req, res)
    }
  }

  /**
   * It'll update the Sub Admin details like to assign a new role, update the username, etc.
   * @returns Success or Failure messages according to the validation mismatch or match.
   */
  async updateV3(req, res) {
    try {
      const subadmin = await AdminModel.findOne({ _id: ObjectId(req.params.id) })

      const { sUsername, sEmail, sMobNum, iRoleId, eStatus, sPassword } = req.body

      req.body = pick(req.body, ['iRoleId', 'sName', 'sUsername', 'sEmail', 'sMobNum', 'sPassword', 'eStatus'])
      removenull(req.body)

      if (eStatus) req.body.eStatus = eStatus

      if (sPassword) {
        req.body.sPassword = bcrypt.hashSync(sPassword, salt)
      }

      if (bcrypt.compareSync(sPassword, subadmin.sPassword)) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].old_new_field_same.replace('##', messages[req.userLanguage].password) })
      }

      if (!checkAlphanumeric(sUsername)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].must_alpha_num })

      if (validateMobile(sMobNum)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].mobileNumber) })

      const role = await RolesModel.findOne({ _id: ObjectId(iRoleId), eStatus: 'Y' }).lean()
      if (!role) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].role) })

      const oOldFields = await AdminModel.findById(req.params.id, { iRoleId: 1, eStatus: 1, sName: 1, sUsername: 1, sEmail: 1, sMobNum: 1, aPermissions: 1, _id: 0 }).lean()

      const adminExist = await AdminModel.findOne({ $or: [{ sEmail }, { sMobNum }, { sUsername }], _id: { $ne: req.params.id } })
      if (adminExist && adminExist.sUsername === sUsername) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].username) })
      if (adminExist && adminExist.sMobNum === sMobNum) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].mobileNumber) })
      if (adminExist && adminExist.sEmail === sEmail) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].email) })

      const data = await AdminModel.findOneAndUpdate({ _id: ObjectId(req.params.id), eType: 'SUB' }, { ...req.body }, { new: false, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].subAdmin) })

      // Log the record for future purpose to know which admin has update sub admin details.
      const { _id: iAdminId } = req.admin
      const oNewFields = { ...oOldFields, ...req.body }
      const logData = { oOldFields, oNewFields, iAdminId: ObjectId(iAdminId), sIP: getIp(req), eKey: 'SUB' }
      // await this.adminLog(req, res, logData)
      adminLogQueue.publish(logData)
      AdminModel.filterData(data)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].subAdmin), data })
    } catch (error) {
      return catchError('AdminAuth.update', error, req, res)
    }
  }

  /*
   *   It'll list logs of which super admin has create or update sub admin.
   */
  async AdminLogs(req, res) {
    try {
      const { start = 0, limit = 10, order, search, operation, datefrom, dateto, iAdminId } = req.query
      const orderBy = order && order === 'asc' ? 1 : -1
      const sorting = { dCreatedAt: orderBy }

      let query = iAdminId ? { iAdminId: ObjectId(iAdminId) } : {}
      query = operation ? { ...query, eKey: operation.toUpperCase() } : query
      query = datefrom && dateto ? { ...query, dCreatedAt: { $gte: (datefrom), $lte: (dateto) } } : query

      let list = []

      if (search) {
        const userQuery = await getQueryValues(operation, search)

        query = { ...query, ...userQuery }
        list = await AdminLogModel
          .find(query, {
            eKey: 1,
            iUserId: 1,
            'oOldFields.sName': 1,
            'oOldFields.iMatchId': 1,
            oDetails: 1,
            sIP: 1,
            iAdminId: 1,
            dCreatedAt: 1
          })
          .sort(sorting)
          .skip(Number(start))
          .limit(Number(limit))
          .populate('oMatch', ['sName'])
          .populate('iAdminId', ['sName', 'sUsername', 'sEmail', 'sProPic', 'eStatus', 'dLoginAt', 'eType'])
          .populate('iUserId', ['sName', 'sUsername', 'sEmail', 'sProPic', 'eType'])
          .lean()
      } else {
        list = await AdminLogModel
          .find(query, {
            eKey: 1,
            iUserId: 1,
            'oOldFields.sName': 1,
            'oOldFields.iMatchId': 1,
            oDetails: 1,
            sIP: 1,
            iAdminId: 1,
            dCreatedAt: 1
          })
          .sort(sorting)
          .skip(Number(start))
          .limit(Number(limit))
          .populate('oMatch', ['sName'])
          .populate('iAdminId', ['sName', 'sUsername', 'sEmail', 'sProPic', 'eStatus', 'dLoginAt', 'eType'])
          .populate('iUserId', ['sName', 'sUsername', 'sEmail', 'sProPic', 'eType'])
          .lean()
      }

      for (const log of list) {
        const { eKey, oOldFields, oNewFields } = log
        if (eKey === 'BD') {
          // Here eKey = BD means, Bank Details
          if (oNewFields) {
            const { sAccountNo: newAc } = oNewFields
            log.oNewFields.sAccountNo = decryption(newAc)
          }
          if (oOldFields) {
            const { sAccountNo: oldAc } = oOldFields
            // We'll store encrypted bank account no. in our db. so, for that reason we'll need to decrypt to show admin
            log.oOldFields.sAccountNo = decryption(oldAc)
          }
        }
      }

      const total = await AdminLogModel.countDocuments(query)

      const data = [{ total, results: list }]
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cAdminlog), data })
    } catch (error) {
      return catchError('SubAdmin.AdminLogs', error, req, res)
    }
  }

  async getAdminLog(req, res) {//Service Moved To LOGS_MS
    try {
      const logs = await AdminLogModel.findOne({ _id: ObjectId(req.params.id) },
        { eKey: 1, oOldFields: 1, oNewFields: 1 })
        .populate('iAdminId', ['sName', 'sUsername', 'sEmail', 'sProPic', 'eStatus', 'dLoginAt', 'eType'])
        .populate('iUserId', ['sName', 'sUsername', 'sEmail', 'sProPic', 'eType'])
        .populate('oMatch', ['sName'])
        .lean()

      if (logs.eKey === 'BD') {
        const { oOldFields, oNewFields } = logs

        // Here eKey = BD means, Bank Details
        if (oNewFields) {
          const { sAccountNo: newAc } = oNewFields
          logs.oNewFields.sAccountNo = decryption(newAc)
        }
        if (oOldFields) {
          const { sAccountNo: oldAc } = oOldFields
          // We'll store encrypted bank account no. in our db. so, for that reason we'll need to decrypt to show admin
          logs.oOldFields.sAccountNo = decryption(oldAc)
        }
      }

      const data = logs

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cAdminlog), data })
    } catch (error) {
      return catchError('SubAdmin.getAdminLog', error, req, res)
    }
  }

  async getAdminIds(req, res) {
    try {
      const data = await AdminModel.find({}, { _id: 1, sName: 1, sUsername: 1 }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].subAdmin), data })
    } catch (error) {
      return catchError('SubAdmin.get', error, req, res)
    }
  }
}

async function getQueryValues(operation, search) {
  let query = {}
  let commonQuery = {}

  if (search) search = defaultSearch(search)

  if (ObjectId.isValid(search) && new ObjectId(search).toString() === search) {
    commonQuery = { ...query, iUserId: ObjectId(search) }
  } else {
    commonQuery = { ...query, 'oOldFields.sName': { $regex: new RegExp('^.*' + search + '.*', 'i') } }
  }

  if (search) {
    switch (operation) {
      case 'CR':
        query = {
          $or: [
            { ...query, 'oOldFields.sRuleName': { $regex: new RegExp('^.*' + search + '.*', 'i') } },
            { ...query, 'oOldFields.eRule': { $regex: new RegExp('^.*' + search + '.*', 'i') } }
          ]
        }
        break

      case 'S':
        query = {
          $or: [
            { ...query, 'oOldFields.sTitle': { $regex: new RegExp('^.*' + search + '.*', 'i') } },
            { ...query, 'oOldFields.sKey': { $regex: new RegExp('^.*' + search + '.*', 'i') } }]
        }
        break

      case 'L':
        query = {
          $or: [
            { ...query, 'oOldFields.sName': { $regex: new RegExp('^.*' + search + '.*', 'i') } },
            { ...query, 'oOldFields.sLeagueCategory': { $regex: new RegExp('^.*' + search + '.*', 'i') } },
            { ...query, 'oOldFields.sFilterCategory': { $regex: new RegExp('^.*' + search + '.*', 'i') } }
          ]
        }
        break
      case 'PC':
        query = {
          $or: [
            { ...query, 'oNewFields.sName': { $regex: new RegExp('^.*' + search + '.*', 'i') } },
            { ...query, 'oNewFields.sCode': { $regex: new RegExp('^.*' + search + '.*', 'i') } }
          ]
        }
        break

      case 'ML':
      case 'MP':
        if (['ML', 'MP'].includes(operation)) {
          const matches = await MatchModel.find({ sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } }, { _id: 1, sName: 1 }).lean()

          if (matches.length) {
            const matchIds = matches.map(match => match._id)
            query = {
              ...query,
              $or: [
                { 'oOldFields.sName': { $regex: new RegExp('^.*' + search + '.*', 'i') } },
                { 'oNewFields.sName': { $regex: new RegExp('^.*' + search + '.*', 'i') } },
                { 'oOldFields.iMatchId': { $in: matchIds } }
              ]
            }
          }
        }
        break

      default:
        query = commonQuery
    }
  }
  return query
}

module.exports = new SubAdmin()
