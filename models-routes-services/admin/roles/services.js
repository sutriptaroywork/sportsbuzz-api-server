const RolesModel = require('./model')
const PermissionsModel = require('../permissions/model')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { removenull, catchError, pick, getPaginationValues } = require('../../../helper/utilities.services')

class Role {
  async add(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'aPermissions', 'eStatus'])
      removenull(req.body)
      const { aPermissions } = req.body

      const eKeyArray = aPermissions.map(({ sKey }) => sKey)

      const permissions = await PermissionsModel.find({ eStatus: 'Y' }, { sKey: 1, _id: 0 }).lean()
      if (!permissions.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].permission) })

      //  We'll check that all permission includes in our db are exist inside given role permission.
      const isValid = permissions.every(({ sKey }) => eKeyArray.includes(sKey))
      if (!isValid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].permissions) })

      const data = await RolesModel.create({ ...req.body })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].role), data })
    } catch (error) {
      return catchError('Role.add', error, req, res)
    }
  }

  async adminList(req, res) {
    try {
      let { start, limit, sorting, search } = getPaginationValues(req.query)
      start = parseInt(start)
      limit = parseInt(limit)

      const query = {}
      if (search) query.sName = { $regex: new RegExp('^.*' + search + '.*', 'i') }

      const total = await RolesModel.countDocuments(query)
      const results = await RolesModel.find(query).sort(sorting).skip(start).limit(limit).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].roles), data: { total, results } })
    } catch (error) {
      return catchError('Role.adminList', error, req, res)
    }
  }

  async list(req, res) {
    try {
      const data = await RolesModel.find({ eStatus: 'Y' }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].roles), data })
    } catch (error) {
      return catchError('Role.list', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const data = await RolesModel.findById(req.params.id).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].role) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].role), data })
    } catch (error) {
      return catchError('Role.list', error, req, res)
    }
  }

  async update(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'aPermissions', 'eStatus'])
      const { aPermissions } = req.body

      const eKeyArray = aPermissions.map(({ sKey }) => sKey)

      const permissions = await PermissionsModel.find({ eStatus: 'Y' }, { sKey: 1, _id: 0 }).lean()
      if (!permissions.length) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].role) })

      //  We'll check that all permission includes in our db are exist inside given role permission.
      const isValid = permissions.every(({ sKey }) => eKeyArray.includes(sKey))
      if (!isValid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].roles) })

      const data = await RolesModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].role) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].role), data })
    } catch (error) {
      return catchError('Role.update', error, req, res)
    }
  }

  async delete(req, res) {
    try {
      const data = await RolesModel.findByIdAndDelete(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].role) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].role), data })
    } catch (error) {
      return catchError('Role.delete', error, req, res)
    }
  }
}

module.exports = new Role()
