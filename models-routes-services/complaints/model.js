const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { UsersDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const UserModel = require('../user/model')

const Complaints = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  sEmail: { type: String, trim: true },
  sTitle: { type: String, trim: true },
  sDescription: { type: String },
  eStatus: { type: String, enum: data.complaintsStatus, default: 'P' }, // // Pending, In-Progress, Declined, Resolved
  eType: { type: String, enum: data.issueType, default: 'F' },
  sImage: { type: String },
  sComment: { type: String, trim: true },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Complaints.index({ iUserId: 1, eType: 1 })

Complaints.statics.filterData = function (complaint) {
  complaint.__v = undefined
  complaint.eStatus = undefined
  complaint.eType = undefined
  complaint.dCreatedAt = undefined
  complaint.dUpdatedAt = undefined
  return complaint
}

module.exports = UsersDBConnect.model('complaints', Complaints)
