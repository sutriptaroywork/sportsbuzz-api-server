const mongoose = require('mongoose')
const { AdminsDBConnect } = require('../../database/mongoose')
const Schema = mongoose.Schema
const { adminLogKeys } = require('../../data')
const AdminModel = require('./model')
const UserModel = require('../user/model')
const MatchModel = require('../match/model')

const AdminLogs = new Schema({
  eKey: { type: String, trim: true, required: true, enum: adminLogKeys },
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  oOldFields: { type: Object },
  oNewFields: { type: Object },
  oDetails: { type: Object },
  sIP: { type: String },
  iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

AdminLogs.virtual('oMatch', {
  ref: MatchModel,
  localField: 'oOldFields.iMatchId',
  foreignField: '_id',
  justOne: true
})

AdminLogs.index({ eKey: 1, oOldFields: 1, oNewFields: 1 })
AdminLogs.index({ 'oNewFields.iMatchId': 1, dCreatedAt: -1, eKey: 1 })
AdminLogs.index({ 'oOldFields.iMatchId': 1, dCreatedAt: -1, eKey: 1 })
AdminLogs.index({ 'oNewFields._id': 1, dCreatedAt: -1, eKey: 1 })
AdminLogs.index({ 'oOldFields._id': 1, dCreatedAt: -1, eKey: 1 })
AdminLogs.index({ dCreatedAt: -1 })

const AdminLogsModel = AdminsDBConnect.model('adminlogs', AdminLogs)

AdminLogsModel.syncIndexes().then(() => {
  console.log('Admin Logs Model Indexes Synced')
}).catch((err) => {
  console.log('Admin Logs Model Indexes Sync Error', err)
})

module.exports = AdminLogsModel
