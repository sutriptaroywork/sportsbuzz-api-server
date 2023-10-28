const CMSModel = require('./model')
const CSSModel = require('./CSS.model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, removenull, defaultSearch } = require('../../helper/utilities.services')

class CMS {
  async add(req, res) {
    try {
      req.body = pick(req.body, ['sSlug', 'sCategory', 'sDescription', 'sTitle', 'sDetails', 'sContent', 'nPriority', 'eStatus'])
      removenull(req.body)

      let { sSlug } = req.body

      sSlug = sSlug.toLowerCase()

      const exist = await CMSModel.findOne({ sSlug })
      if (exist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cmsSlug) })

      const data = await CMSModel.create({ ...req.body })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].content), data })
    } catch (error) {
      return catchError('CMS.add', error, req, res)
    }
  }

  async list(req, res) {
    try {
      let { search } = req.query
      let query = {}

      if (search) {
        search = defaultSearch(search)
        query = search.length ? { sTitle: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}
      }
      const cms = await CMSModel.find(query).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].content), data: cms })
    } catch (error) {
      return catchError('CMS.list', error, req, res)
    }
  }

  async adminGet(req, res) {
    try {
      const data = await CMSModel.findOne({ sSlug: req.params.sSlug }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].content) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].content), data })
    } catch (error) {
      return catchError('CMS.adminGet', error, req, res)
    }
  }

  async update(req, res) {
    try {
      const { sDescription } = req.body
      req.body = pick(req.body, ['sSlug', 'sCategory', 'sTitle', 'sDetails', 'sContent', 'nPriority', 'eStatus'])
      removenull(req.body)
      const { sCategory } = req.body

      req.body.sSlug = req.body.sSlug.toLowerCase()
      const exist = await CMSModel.findOne({ sSlug: req.body.sSlug, _id: { $ne: req.params.id } })
      if (exist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cmsSlug) })

      const data = await CMSModel.findByIdAndUpdate(req.params.id, { ...req.body, sDescription, sCategory, dUpdatedAt: Date.now() }, { new: true, runValidators: true })

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cms) })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cms), data })
    } catch (error) {
      return catchError('CMS.update', error, req, res)
    }
  }

  async remove(req, res) {
    try {
      const data = await CMSModel.findByIdAndDelete(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cms) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].cms), data })
    } catch (error) {
      return catchError('CMS.remove', error, req, res)
    }
  }

  // for user
  async userList(req, res) {
    try {
      const format = req.query.format ? { sCategory: req.query.format } : {}

      const data = await CMSModel.find({ eStatus: 'Y', ...format }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].content), data })
    } catch (error) {
      return catchError('CMS.userList', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const data = await CMSModel.findOne({ sSlug: req.params.sSlug, eStatus: 'Y' }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].content) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].content), data })
    } catch (error) {
      return catchError('CMS.get', error, req, res)
    }
  }

  async addCss(req, res) {
    try {
      req.body = pick(req.body, ['sTitle', 'sContent'])
      removenull(req.body)

      let { eType } = req.params
      eType = eType.toUpperCase()

      if (!['COMMON', 'CONDITION'].includes(eType)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cssType) })
      const exist = await CSSModel.findOne({ eType }).lean()

      let data
      if (exist) {
        data = await CSSModel.findByIdAndUpdate(exist._id, { ...req.body }, { new: true, runValidators: true }).lean()
      } else {
        data = await CSSModel.create({ ...req.body, eType })
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cssStyle), data })
    } catch (error) {
      return catchError('CMS.addCss', error, req, res)
    }
  }

  async updateCss(req, res) {
    try {
      req.body = pick(req.body, ['sTitle', 'sContent'])
      removenull(req.body)

      let { eType } = req.params
      eType = eType.toUpperCase()

      if (!['COMMON', 'CONDITION'].includes(eType)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cssType) })

      const data = await CSSModel.findOneAndUpdate({ eType }, { ...req.body }, { new: true, runValidators: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cssStyle) })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cssStyle), data })
    } catch (error) {
      return catchError('CMS.updateCss', error, req, res)
    }
  }

  async adminGetCss(req, res) {
    try {
      let { eType } = req.params
      eType = eType.toUpperCase()

      if (!['COMMON', 'CONDITION'].includes(eType)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cssType) })
      const data = await CSSModel.findOne({ eType }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cssStyle) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cssStyle), data })
    } catch (error) {
      return catchError('CMS.adminGetCss', error, req, res)
    }
  }

  async getCss(req, res) {
    try {
      let { eType } = req.params
      eType = eType.toUpperCase()

      if (!['COMMON', 'CONDITION'].includes(eType)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cssType) })
      const data = await CSSModel.findOne({ eType }, { sContent: 1, _id: 0 }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cssStyle), data })
    } catch (error) {
      return catchError('CMS.getCss', error, req, res)
    }
  }

  async listCss(req, res) {
    try {
      const data = await CSSModel.find().lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cssStyle), data })
    } catch (error) {
      return catchError('CMS.listCss', error, req, res)
    }
  }
}

module.exports = new CMS()
