const UserModel = require('../user/model')
const ComplaintModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, getPaginationValues, checkValidImageType, getIp, handleCatchError } = require('../../helper/utilities.services')
const s3 = require('../../helper/s3config')
const ObjectId = require('mongoose').Types.ObjectId
const { s3Complaint, SMTP_FROM } = require('../../config/config')
const { complaintsStatus, issueType } = require('../../data')
const { queuePush } = require('../../helper/redis')
const adminLogQueue = require('../../rabbitmq/queue/adminLogQueue')
const AdminLogModel = require('../admin/logs.model')
const axios = require('axios')
const FormData = require('form-data')
const config = require('../../config/config')
class Complaint {
  // To add Complaint manually
  async addComplaint(req, res) {
    try {
      const { _id: iUserId } = req.user
      const { eType } = req.body
      req.body = pick(req.body, ['sImage', 'sTitle', 'sDescription', 'eType'])

      const user = await UserModel.countDocuments({ _id: ObjectId(iUserId) })
      if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

      const data = await ComplaintModel.create({ ...req.body, iUserId })

      // For feedback and complaint, we send response message accordingly.
      if (eType === 'F') return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].feedback), data })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].complaints), data })
    } catch (error) {
      catchError('Complaint.addComplaint', error, req, res)
    }
  }

  // To get signedUrl for Complaint image
  async getSignedUrl(req, res) {
    try {
      req.body = pick(req.body, ['sFileName', 'sContentType'])
      const { sFileName, sContentType } = req.body

      const valid = checkValidImageType(sFileName, sContentType)
      if (!valid) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].image) })

      const data = await s3.signedUrl(sFileName, sContentType, s3Complaint)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].presigned_succ, data })
    } catch (error) {
      catchError('Complaint.getSignedUrl', error, req, res)
    }
  }

  // To get details of single Complaint
  async get(req, res) {
    try {
      const { _id: iUserId } = req.user
      const data = await ComplaintModel.findOne({ _id: ObjectId(req.params.id), iUserId }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].complaints) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].complaints), data })
    } catch (error) {
      catchError('Complaint.get', error, req, res)
    }
  }

  // To get List of Complaints with pagination, sorting
  async list(req, res) {
    try {
      const { _id: iUserId } = req.user
      let { nLimit, nOffset } = req.query

      nLimit = parseInt(nLimit) || 10
      nOffset = parseInt(nOffset) || 0
      const data = await ComplaintModel.find({ iUserId }).sort({ dCreatedAt: -1 }).skip(nOffset).limit(nLimit).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].complaints), data: data })
    } catch (error) {
      return catchError('Complaint.list', error, req, res)
    }
  }

  // To delete a complaint by user
  async removeComplaint(req, res) {
    try {
      const { _id: iUserId } = req.user

      const data = await ComplaintModel.findOneAndDelete({ _id: ObjectId(req.params.id), iUserId }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].complaints) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].complaints), data })
    } catch (error) {
      return catchError('Complaint.removeComplaint', error, req, res)
    }
  }

  async updateStatus(req, res) {
    try {
      const { eStatus, sComment, eType } = req.body

      const comp = await ComplaintModel.findOne({ _id: ObjectId(req.params.id), eType }).lean()
      if (!comp) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].complaints) })

      // For Declined complaint we required comment(reason) also.
      if (eStatus === 'D' && !sComment) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].declined_comment.replace('##', messages[req.userLanguage].complaints) })

      const insertObj = eStatus === 'D' ? { eStatus, sComment } : { eStatus }
      const data = await ComplaintModel.findByIdAndUpdate(req.params.id, insertObj, { new: true, runValidators: true }).lean()

      const logData = {
        eKey: 'CF',
        oOldFields: comp,
        oNewFields: data,
        iAdminId: ObjectId(req.admin._id),
        sIp: getIp(req)
      }
      adminLogQueue.publish(logData)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].complaints), data })
    } catch (error) {
      catchError('Complaint.updateStatus', error, req, res)
    }
  }

  async adminList(req, res) {
    try {
      const { type, status: eStatus, datefrom, dateto, iUserId } = req.query
      const { start, limit, sorting } = getPaginationValues(req.query)

      const query = {}
      if (type && issueType.includes(type)) query.eType = type

      if (eStatus && complaintsStatus.includes(eStatus)) query.eStatus = eStatus

      if (datefrom && dateto) {
        query.dCreatedAt = { $gte: datefrom, $lte: dateto }
      }
      if (iUserId) query.iUserId = ObjectId(iUserId)

      const nTotal = await ComplaintModel.countDocuments(query)
      const complainsData = await ComplaintModel.find(query).populate({ path: 'iUserId', select: 'sUsername' }).sort(sorting).skip(start).limit(limit).lean()

      const data = { nTotal, aData: complainsData }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].complaints), data })
    } catch (error) {
      return catchError('Complaint.adminList', error, req, res)
    }
  }

  async adminGet(req, res) {
    try {
      const data = await ComplaintModel.findById(req.params.id).populate('iUserId', ['iStateId', 'iCityId', 'sAddress', 'iCountryId', 'nPinCode', 'sUsername', 'sName', 'sMobNum', 'sEmail']).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].complaints) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].complaints), data })
    } catch (error) {
      catchError('Complaint.adminGet', error, req, res)
    }
  }

  async addContactUs(req, res) {
    try {
      req.body = pick(req.body, ['sEmail', 'sTitle', 'sDescription'])

      let [data] = await Promise.all([
        ComplaintModel.create({ ...req.body, eType: 'CS' }),
        queuePush('SendMail', {
          sSlug: 'contact-us-email',
          to: req.body.sEmail,
          replaceData: ''
        }),
        queuePush('SendMail', {
          sSlug: 'user-inquiry-email',
          replaceData: {
            sTitle: req.body.sTitle,
            sEmail: req.body.sEmail,
            sInquiry: req.body.sDescription
          },
          to: SMTP_FROM
        })
      ])

      data = ComplaintModel.filterData(data)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].thanks_for_contacting, data })
    } catch (error) {
      catchError('Complaint.addContactUs', error, req, res)
    }
  }
}

class FrequentAskedQuestions {
  // User Functions
  async list(req, res) {
    // update KYC-Details [admin]
    try {
      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/user/faq/list/v1`)
      const response = await axios.post(`${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/user/faq/list/v1`, {
        userId: req.user.id,
        ...req.body
      }, {
        headers: { 'Content-Type': 'application/json', Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      console.log(err)
      handleCatchError('ComplaintFeedbackServices.getFAQDetails', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  // Admin Functions
  async adminCreate(req, res) {
    try {
      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/admin/faq/v1`)
      const response = await axios.post(`${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/admin/faq/v1`, {
        iAdminId: req.admin._id,
        ...req.body
      }, {
        headers: { 'Content-Type': 'application/json', Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      console.log(err)
      handleCatchError('ComplaintFeedbackServices.createFAQDetails', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  async adminList(req, res) {
    try {
      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/admin/faq/list/v1`)
      const response = await axios.post(`${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/admin/faq/list/v1`, {
        query: req.query,
        iAdminId: req.admin._id,
        ...req.body
      }, {
        headers: { 'Content-Type': 'application/json', Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      console.log(err)
      handleCatchError('ComplaintFeedbackServices.getFAQDetails List', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  async adminGet(req, res) {
    try {
      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/admin/faq/view/v1`)
      const response = await axios.post(`${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/admin/faq/view/v1`, {
        id: req.params.id,
        iAdminId: req.admin._id,
        ...req.body
      }, {
        headers: { 'Content-Type': 'application/json', Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      console.log(err)
      handleCatchError('ComplaintFeedbackServices.getFAQDetails', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  async adminUpdate(req, res) {
    try {
      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/admin/faq/update/v1`)
      const response = await axios.post(`${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/admin/faq/update/v1`, {
        id: req.params.id,
        iAdminId: req.admin._id,
        ...req.body
      }, {
        headers: { 'Content-Type': 'application/json', Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      console.log(err)
      handleCatchError('ComplaintFeedbackServices.updateFAQDetails', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }

  async adminDelete(req, res) {
    try {
      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/admin/faq/delete/v1`)
      const response = await axios.post(`${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/admin/faq/delete/v1`, {
        id: req.params.id,
        iAdminId: req.admin._id,
        ...req.body
      }, {
        headers: { 'Content-Type': 'application/json', Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      console.log(err)
      handleCatchError('ComplaintFeedbackServices.deleteFAQDetails', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp({
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data?.error || messages[req.userLanguage].error
      })
    }
  }
}

class FreshDesks {
  // User Functions
  async list(req, res) {
    // update KYC-Details [admin]
    try {
      const oUser = await UserModel.findById(req.user?._id, { sEmail: 1 }).lean()
      if (!oUser.sEmail) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].email) })

      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/user/fresh-desk/ticket/list/v1`)
      const response = await axios.post(`${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/user/fresh-desk/ticket/list/v1`, {
        iUserId: req.user?._id,
        sEmail: oUser.sEmail,
        ...req.body
      }, {
        headers: { 'Content-Type': 'application/json', Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      console.log(err?.response?.data)
      handleCatchError('ComplaintFeedbackServices.getFreshDeskTickets', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp(err?.response?.data || {
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data || messages[req.userLanguage].error
      })
    }
  }

  async view(req, res) {
    // update KYC-Details [admin]
    try {
      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/user/fresh-desk/ticket/view/v1`)
      const response = await axios.post(`${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/user/fresh-desk/ticket/view/v1`, {
        iTicketId: req.params.id,
        iUserId: req.user?._id,
        ...req.body
      }, {
        headers: { 'Content-Type': 'application/json', Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      console.log(err?.response?.data)
      handleCatchError('ComplaintFeedbackServices.viewTicket', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp(err?.response?.data || {
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data || messages[req.userLanguage].error
      })
    }
  }

  async create(req, res) {
    // update KYC-Details [admin]
    try {
      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/user/fresh-desk/ticket/create/v1`)
      const oUser = await UserModel.findById(req.user?._id, { sEmail: 1 }).lean()
      if (!oUser.sEmail) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].email) })

    // For Attachments
     // const formData = new FormData()

      // const data = {
      //   sDescription,
      //   sEmail,
      //   sSubject,
      //   nStatus
      // }
      // // // const imageBase64 = file.aAttachments.data.toString('base64')
      // // formData.append('sDescription', sDescription)
      // // formData.append('sEmail', sEmail)
      // // formData.append('sSubject', sSubject)
      // // formData.append('nStatus', nStatus)
      // formData.append('name', 'vaghesh')
      //formData.append('aAttachments', req.files.aAttachments.data)

      // formData.append('data', data)
      // formData.append('iUserId', req.files.aAttachments)
      // // formData.append('iUserId', req.user?._id)
      // console.log(formData)
      const response = await axios.post(`${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/user/fresh-desk/ticket/create/v1`, {
        files: req.files,
        body: req.body
       } /* ,{
         headers: {
          'Content-Type': 'multipart/form-data'
         } 
      } */
     )

      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      console.log(err?.response?.data)
      handleCatchError('ComplaintFeedbackServices.createFreshDeskTicket', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp(err?.response?.data || {
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data || messages[req.userLanguage].error
      })
    }
  }

  async update(req, res) {
    // update KYC-Details [admin]
    try {
      // ? this logs for testing purpose only after sometime it will be removed
      console.log(`url:= ${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/user/fresh-desk/ticket/update/v1`)
      const oUser = await UserModel.findById(req.user?._id, { sEmail: 1 }).lean()
      if (!oUser.sEmail) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].email) })

      const response = await axios.post(`${config.SB11_BACKEND_MS_COMPLAINT_SERVICE}/user/fresh-desk/ticket/update/v1`, {
        body: req.body,
        files: req.files,
        iTicketId: req.params.id
      // }, {
      //   headers: { 'Content-Type': 'multipart/form-data', Language: 'en' }
      })
      return res.status(status.OK).jsonp(response.data)
    } catch (err) {
      console.log(err?.response?.data)
      handleCatchError('ComplaintFeedbackServices.updateFreshDeskTicket', err, req, res)
      return res.status(err?.response?.status || status.InternalServerError).jsonp(err?.response?.data || {
        status: err?.response?.status || status.InternalServerError,
        message: err?.response?.data || messages[req.userLanguage].error
      })
    }
  }
}

module.exports = {
  complaintServices: new Complaint(),
  faqServices: new FrequentAskedQuestions(),
  freshDeskService: new FreshDesks()
}