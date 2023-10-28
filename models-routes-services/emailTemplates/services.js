const EmailTemplateModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, removenull, checkValidImageType, validateEmail } = require('../../helper/utilities.services')
const { sendMail } = require('../../helper/email.service')
const s3 = require('../../helper/s3config')
const { s3EmailTemplates } = require('../../config/config')

class EmailTemplate {
  async add(req, res) {
    try {
      req.body = pick(req.body, ['sSlug', 'sTitle', 'sSubject', 'sContent', 'eStatus', 'sDescription'])
      removenull(req.body)

      let { sSlug } = req.body

      sSlug = sSlug.toLowerCase()

      const exist = await EmailTemplateModel.findOne({ sSlug })
      if (exist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].emailTemplateSlug) })

      const data = await EmailTemplateModel.create({ ...req.body })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].emailTemplate), data })
    } catch (error) {
      return catchError('EmailTemplate.add', error, req, res)
    }
  }

  async list(req, res) {
    try {
      const emailTemplates = await EmailTemplateModel.find().lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].emailTemplates), data: emailTemplates })
    } catch (error) {
      return catchError('EmailTemplate.list', error, req, res)
    }
  }

  async adminGet(req, res) {
    try {
      const data = await EmailTemplateModel.findOne({ sSlug: req.params.sSlug }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].emailTemplate) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].emailTemplate), data })
    } catch (error) {
      return catchError('EmailTemplate.adminGet', error, req, res)
    }
  }

  async update(req, res) {
    try {
      req.body = pick(req.body, ['sSlug', 'sTitle', 'sSubject', 'sContent', 'eStatus', 'sDescription'])
      removenull(req.body)

      req.body.sSlug = req.body.sSlug.toLowerCase()
      const exist = await EmailTemplateModel.findOne({ sSlug: req.body.sSlug, _id: { $ne: req.params.id } })
      if (exist) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].emailTemplateSlug) })

      const data = await EmailTemplateModel.findByIdAndUpdate(req.params.id, { ...req.body, dUpdatedAt: Date.now() }, { new: true, runValidators: true })

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].emailTemplate) })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].emailTemplate), data })
    } catch (error) {
      return catchError('EmailTemplate.update', error, req, res)
    }
  }

  async remove(req, res) {
    try {
      const data = await EmailTemplateModel.findByIdAndDelete(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].emailTemplate) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].emailTemplate), data })
    } catch (error) {
      return catchError('EmailTemplate.remove', error, req, res)
    }
  }

  async send(req, res) {
    try {
      const { sSlug, replaceData, to } = req.body

      const bEmail = await validateEmail(to)
      if (to && bEmail) {
        await sendMail({
          sSlug: sSlug,
          replaceData: replaceData,
          to: to
        })
      }

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].sent_success.replace('##', messages[req.userLanguage].email), data: {} })
    } catch (error) {
      return catchError('EmailTemplate.send', error, req, res)
    }
  }

  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await s3.signedUrl(sFileName, sContentType, s3EmailTemplates)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('EmailTemplate.getSignedUrl', error, req, res)
    }
  }
}

module.exports = new EmailTemplate()
