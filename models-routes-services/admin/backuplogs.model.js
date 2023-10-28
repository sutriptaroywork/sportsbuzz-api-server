const mongoose = require('mongoose')
const { AdminsDBConnect } = require('../../database/mongoose')
const Schema = mongoose.Schema

const BackupAdminLogs = new Schema({
  _id: { type: Schema.Types.ObjectId },
  eKey: { type: String },
  iUserId: { type: Schema.Types.ObjectId },
  oOldFields: { type: Object },
  oNewFields: { type: Object },
  oDetails: { type: Object },
  sIP: { type: String },
  iAdminId: { type: Schema.Types.ObjectId },
  sExternalId: { type: String },
  dCreatedAt: { type: Date },
  dUpdatedAt: { type: Date },
  __v: { type: Number }
}, { timestamps: false, _id: false, versionKey: false })

module.exports = AdminsDBConnect.model('backupadminlogs', BackupAdminLogs)
