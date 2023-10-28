const VersionModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, getPaginationValues2, isUrl } = require('../../helper/utilities.services')
const { CACHE_1 } = require('../../config/config')

class Version {
  async userGet(req, res) {
    try {
      const ePlatform = req.header('Platform')

      const data = await VersionModel.findOne({ eType: ePlatform }).sort({ dCreatedAt: -1 }).lean().cache(CACHE_1, `version:${ePlatform}`)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].version), data })
    } catch (error) {
      return catchError('Version.userGet', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const ver = await VersionModel.findById(req.params.id).lean()
      if (!ver) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].version) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].version), data: ver })
    } catch (error) {
      return catchError('Version.get', error, req, res)
    }
  }

  async add(req, res) {
    try {
      req.body = pick(req.body, ['sName', 'sDescription', 'eType', 'sVersion', 'sUrl', 'sForceVersion', 'bInAppUpdate'])

      if (req.body.sUrl && !isUrl(req.body.sUrl)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].url) })

      const data = await VersionModel.create({ ...req.body })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].newVersion), data })
    } catch (error) {
      catchError('Version.add', error, req, res)
    }
  }

  async adminList(req, res) {
    try {
      const { start = 0, limit = 10, sorting, search } = getPaginationValues2(req.query)

      const query = search ? { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : { }

      const results = await VersionModel.find(query, {
        sName: 1,
        sDescription: 1,
        eType: 1,
        sUrl: 1,
        sVersion: 1,
        sForceVersion: 1,
        bInAppUpdate: 1,
        dCreatedAt: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()
      const total = await VersionModel.countDocuments({ ...query })

      const data = [{ total, results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].version), data })
    } catch (error) {
      return catchError('Version.list', error, req, res)
    }
  }

  async update(req, res) {
    try {
      const { sType, sDescription, sUrl } = req.body
      req.body = pick(req.body, ['sName', 'sDescription', 'eType', 'sVersion', 'sUrl', 'sForceVersion', 'bInAppUpdate'])

      if (sUrl && !isUrl(sUrl)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].url) })

      const data = await VersionModel.findByIdAndUpdate(req.params.id, { ...req.body, sType, sDescription, sUrl }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].version) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].versionDetails), data })
    } catch (error) {
      catchError('Version.update', error, req, res)
    }
  }

  async remove(req, res) {
    try {
      const ver = await VersionModel.findByIdAndDelete(req.params.id).lean()
      if (!ver) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].version) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].version), data: ver })
    } catch (error) {
      catchError('Version.remove', error, req, res)
    }
  }
}

module.exports = new Version()
