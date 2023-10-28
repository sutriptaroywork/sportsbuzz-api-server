const BankModel = require('./model')
const { messages, status, jsonStatus } = require('../../../helper/api.responses')
const { catchError, pick, removenull, projectionFields, encryption, getIp, validateIFSC, replaceSensitiveInfo } = require('../../../helper/utilities.services')
const { decryption } = require('../../../middlewares/middleware')
const mongoose = require('mongoose')
const adminServices = require('../../admin/subAdmin/services')
const { ObjectId } = mongoose.Types
const { validateCashfreeToken, getBenficiaryDetails: getBeneficiaryDetails, removeBeneficiary } = require('../../../queue')
const { ALLOW_BANK_UPDATE } = require('../../../config/config')
const adminLogQueue = require('../../../rabbitmq/queue/adminLogQueue')

class BankDetails {
  async addV2(req, res) {
    try {
      let { sAccountNo, sIFSC } = req.body
      req.body = pick(req.body, ['sBankName', 'sBranchName', 'sAccountHolderName', 'sAccountNo', 'sIFSC'])

      const user = await BankModel.findOne({ iUserId: req.user._id }).lean()
      if (user) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', messages[req.userLanguage].cuserData) })

      if (!validateIFSC(sIFSC)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cIfscCode) })

      sAccountNo = encryption(sAccountNo)

      const response = await removeBeneficiary(req.user._id)
      if (!response.success) throw new Error(response)

      const data = await BankModel.create({ ...req.body, iUserId: req.user._id, eStatus: 'P', sAccountNo })

      // const first = data.sAccountNo.toString().slice(0, 2)
      const last = req.body.sAccountNo.toString().slice(-4)
      data.sAccountNo = 'XXXXXXXXXXX' + last

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cbankDetails), data })
    } catch (error) {
      catchError('BankDetails.addV2', error, req, res)
    }
  }

  async getV2(req, res) {
    try {
      const data = await BankModel.findOne({ iUserId: req.user._id }).lean()
      if (!data) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cbankDetails), data: {} })

      data.sAccountNo = decryption(data.sAccountNo)
      // const first = data.sAccountNo.toString().slice(0, 2)
      const last = data.sAccountNo.toString().slice(-4)
      data.sAccountNo = 'XXXXXXXXXXX' + last

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cbankDetails), data: data })
    } catch (error) {
      return catchError('BankDetails.getV2', error, req, res)
    }
  }

  async adminAddV2(req, res) {
    try {
      const iUserId = req.params.id
      req.body = pick(req.body, ['sBankName', 'sBranchName', 'sAccountHolderName', 'sAccountNo', 'sIFSC', 'bIsBankApproved'])
      removenull(req.body)

      let { sBankName, sBranchName, sAccountHolderName, sAccountNo, sIFSC, bIsBankApproved = false } = req.body

      if (!validateIFSC(sIFSC)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cIfscCode) })

      sAccountNo = encryption(sAccountNo) // account no. encryption

      const { _id: iAdminId } = req.admin

      const response = await removeBeneficiary(iUserId)
      if (!response.success) throw new Error(response)

      const data = await BankModel.create({ iUserId, sBankName, sBranchName, sAccountHolderName, sAccountNo, sIFSC, bIsBankApproved })

      const oNewFields = { sBankName, sBranchName, sAccountHolderName, sAccountNo, sIFSC, bIsBankApproved }
      let logData = { oOldFields: {}, oNewFields, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: ObjectId(iUserId), eKey: 'BD' }
      logData = await replaceSensitiveInfo(logData)
      // await adminServices.adminLog(req, res, logData)
      adminLogQueue.publish(logData)

      const last = req.body.sAccountNo.toString().slice(-4)
      data.sAccountNo = 'XXXXXXXXXXX' + last

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cbankDetails), data })
    } catch (error) {
      return catchError('BankDetails.adminAddV2', error, req, res)
    }
  }

  async adminUpdateV2(req, res) {
    try {
      const iUserId = req.params.id

      req.body = pick(req.body, ['sBankName', 'sBranchName', 'sAccountHolderName', 'sAccountNo', 'sIFSC', 'bIsBankApproved'])
      removenull(req.body)

      const projection = projectionFields(req.body)
      let { sBankName, sBranchName, sAccountHolderName, sAccountNo, sIFSC, bIsBankApproved } = req.body

      if (!validateIFSC(sIFSC)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cIfscCode) })

      sAccountNo = encryption(sAccountNo)

      const oOldFields = await BankModel.findOne({ iUserId: ObjectId(iUserId) }, { ...projection, _id: 0, sAccountNo: 1, sAccountHolderName: 1 }).lean()
      if (!oOldFields) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cuserBankDetails) })
      const { _id: iAdminId } = req.admin

      const data = await BankModel.findOneAndUpdate({ iUserId: ObjectId(iUserId) }, { sBankName, sBranchName, sAccountHolderName: sAccountHolderName, sAccountNo: sAccountNo, sIFSC, bIsBankApproved, eStatus: 'P', sRejectReason: '' }, { runValidators: true, new: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cuserBankDetails) })

      const response = await removeBeneficiary(iUserId)
      if (!response.success) throw new Error(response)

      const oNewFields = { sBankName, sBranchName, sAccountHolderName: sAccountHolderName, sAccountNo, sIFSC, bIsBankApproved }
      let logData = { oOldFields, oNewFields, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: ObjectId(iUserId), eKey: 'BD' }
      logData = await replaceSensitiveInfo(logData)
      // await adminServices.adminLog(req, res, logData)
      adminLogQueue.publish(logData)

      const last = req.body.sAccountNo.toString().slice(-4)
      data.sAccountNo = 'XXXXXXXXXXX' + last

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cbankDetails), data })
    } catch (error) {
      return catchError('UserAdminServices.adminUpdateV2', error, req, res)
    }
  }

  async updateV2(req, res) {
    try {
      const iUserId = req.user._id
      req.body = pick(req.body, ['sBankName', 'sBranchName', 'sAccountHolderName', 'sAccountNo', 'sIFSC'])
      removenull(req.body)

      let { sBankName, sBranchName, sAccountHolderName, sAccountNo, sIFSC } = req.body

      if (!validateIFSC(sIFSC)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cIfscCode) })

      const bank = await BankModel.findOne({ iUserId: ObjectId(iUserId) }, { bIsBankApproved: 1 }).lean()
      // bIsBankApproved flag is for admin allow to user to update bank details or not.
      if (!bank) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cuserBankDetails) })
      if (!bank.bIsBankApproved) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_allow })

      sAccountNo = encryption(sAccountNo)

      const data = await BankModel.findOneAndUpdate({ iUserId: ObjectId(iUserId) }, { sBankName, sBranchName, sAccountHolderName, sAccountNo, sIFSC, eStatus: 'P', sRejectReason: '' }, { runValidators: true, new: true }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cuserBankDetails) })

      const response = await removeBeneficiary(iUserId)
      if (!response.success) throw new Error(response)

      const last = req.body.sAccountNo.toString().slice(-4)
      data.sAccountNo = 'XXXXXXXXXXX' + last

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cbankDetails), data })
    } catch (error) {
      return catchError('UserAdminServices.updateV2', error, req, res)
    }
  }

  async adminGetV2(req, res) {
    try {
      const data = await BankModel.findOne({ iUserId: ObjectId(req.params.id) }).lean()

      if (!data) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cbankDetails), data: { bAllowUpdate: ALLOW_BANK_UPDATE } })
      data.sAccountNo = decryption(data.sAccountNo)

      const last = data.sAccountNo.toString().slice(-4)
      data.sAccountNo = 'XXXXXXXXXXX' + last

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cbankDetails), data: { ...data, bAllowUpdate: ALLOW_BANK_UPDATE } })
    } catch (error) {
      return catchError('BankDetails.adminGetV2', error, req, res)
    }
  }

  async processDetails(req, res) {
    try {
      const iUserId = req.params.id
      const data = await BankModel.findOne({ iUserId }).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cbankDetails) })

      if (data.eStatus !== 'P') return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].bank_already_process.replace('##', messages[req.userLanguage].cbankDetails) })

      const { isVerify } = await validateCashfreeToken()
      let updatedData
      if (isVerify) {
        const { success, message } = await getBeneficiaryDetails(iUserId) // we'll add beneficiary details to cashfree also. cause we'll now allow user to, they can only withdraw into their bank account.
        if (success) {
          updatedData = await BankModel.findOneAndUpdate({ iUserId: ObjectId(iUserId) }, { eStatus: 'A', bIsBankApproved: true }, { runValidators: true, new: true }).lean()
        } else {
          updatedData = await BankModel.findOneAndUpdate({ iUserId: ObjectId(iUserId) }, { eStatus: 'R', bIsBankApproved: false, sRejectReason: message }, { runValidators: true, new: true }).lean()
        }
      }
      updatedData.sAccountNo = decryption(updatedData.sAccountNo)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].successfully.replace('##', messages[req.userLanguage].processBankDetails), data: updatedData })
    } catch (error) {
      return catchError('BankDetails.processDetails', error, req, res)
    }
  }
}

module.exports = new BankDetails()
