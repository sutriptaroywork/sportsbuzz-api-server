const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { UsersDBConnect } = require('../../../database/mongoose')
const { bankStatus } = require('../../../data')
const UserModel = require('../model')

const BankDetails = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel, unique: true },
  sBankName: { type: String, required: true, trim: true },
  sBranchName: { type: String, required: true, trim: true },
  sAccountHolderName: { type: String, required: true, trim: true },
  sAccountNo: { type: String, required: true, trim: true, unique: true },
  sIFSC: { type: String, required: true, trim: true },
  eStatus: { type: String, enum: bankStatus, default: 'P' }, // P = Pending, A = Accepted, R = Rejected
  sRejectReason: { type: String },
  bIsBankApproved: { type: Boolean, default: true },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

BankDetails.index({ iUserId: 1 })

module.exports = UsersDBConnect.model('bankdetails', BankDetails)
