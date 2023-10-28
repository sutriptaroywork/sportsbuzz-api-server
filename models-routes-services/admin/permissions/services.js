const PermissionsModel = require('./model')
const RoleModel = require('../roles/model')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { removenull, catchError, pick } = require('../../../helper/utilities.services')

class Permission {
  async add(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'sKey', 'eStatus'])
      removenull(req.body)
      const { sKey } = req.body
      const permissionExist = await PermissionsModel.findOne({ sKey }).lean()
      if (permissionExist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].permission) })

      const data = await PermissionsModel.create({ ...req.body })

      // We'll update all roles with assigning new permissions of none(Not Read + Not Write) rights
      await RoleModel.updateMany({ }, { $push: { aPermissions: { sKey: sKey, eType: 'N' } } })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].permission), data })
    } catch (error) {
      return catchError('Permission.add', error, req, res)
    }
  }

  async adminList(req, res) {
    try {
      const data = await PermissionsModel.find().lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].permissions), data })
    } catch (error) {
      return catchError('Permission.adminList', error, req, res)
    }
  }

  async list(req, res) {
    try {
      const data = await PermissionsModel.find({ eStatus: 'Y' }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].permissions), data })
    } catch (error) {
      return catchError('Permission.list', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const data = await PermissionsModel.findById(req.params.id).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].permission) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].permissions), data })
    } catch (error) {
      return catchError('Permission.list', error, req, res)
    }
  }

  async update(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'sKey', 'eStatus'])

      const data = await PermissionsModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].permission) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].permission), data })
    } catch (error) {
      return catchError('Permission.update', error, req, res)
    }
  }
}

module.exports = new Permission()
