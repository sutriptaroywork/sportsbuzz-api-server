const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { UsersDBConnect } = require('../../database/mongoose')
const { kycStatus } = require('../../data')
const UserModel = require('../user/model')
const AdminModel = require('../admin/model')
const KYC_VERIFIED_TYPE = require('../../enums/kycEnums/kycVerifiedType')

const Kyc = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel, unique: true },
  sIdfyGroupId: { type: String },
  oPan: {
    sNo: { type: String },
    sDateOfBirth: { type: String },
    eStatus: { type: String, enum: kycStatus, default: 'N' }, // P = Pending, A = Accepted, R = Rejected, N = Not uploaded
    sImage: { type: String, trim: true },
    sName: { type: String },
    sRejectReason: { type: String },
    dCreatedAt: { type: Date, default: Date.now },
    dUpdatedAt: { type: Date },
    oVerifiedAt: {
      dActionedAt: { type: Date },
      iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel },
      sIP: { type: String }
    },
    eVerifiedBy: { type: String, enum: [KYC_VERIFIED_TYPE.MANUAL, KYC_VERIFIED_TYPE.IDFY] }
  },
  oAadhaar: {
    nNo: { type: Number },
    sAadharHashedNumber: { type: String },
    sDateOfBirth: { type: String },
    sAadharName: { type: String },
    sFrontImage: { type: String, trim: true },
    sBackImage: { type: String, trim: true },
    eStatus: { type: String, enum: kycStatus, default: 'N' }, // P = Pending, A = Accepted, R = Rejected, N = Not uploaded
    sRejectReason: { type: String },
    dUpdatedAt: { type: Date },
    dCreatedAt: { type: Date, default: Date.now },
    oVerifiedAt: {
      dActionedAt: { type: Date },
      iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel },
      sIP: { type: String }
    },
    sPincode: { type: String },
    sState: { type: String },
    eVerifiedBy: { type: String, enum: [KYC_VERIFIED_TYPE.MANUAL, KYC_VERIFIED_TYPE.IDFY] }
  },
  sMessage: { type: String },
  count: { type: Object },
  consolidated: { type: Boolean, default: false },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })
Kyc.index({ iUserId: 1, 'oAadhaar.eStatus': 1 })
Kyc.index({ iUserId: 1, 'oPan.eStatus': 1 })

module.exports = UsersDBConnect.model('kyc', Kyc)
