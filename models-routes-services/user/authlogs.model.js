const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { UsersDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const UserModel = require('./model')

const AuthLogs = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  ePlatform: { type: String, enum: data.platform, required: true }, // A = Android, I = iOS, W = Web, O = Other, AD = Admin
  eType: { type: String, enum: data.authLogType }, // R = Register, L = Login, PC = Password Change, RP = Reset Password
  sDeviceToken: { type: String },
  sIpAddress: { type: String },
  dUpdatedAt: { type: Date },
  dCreatedAt: { type: Date, default: Date.now },
  sExternalId: { type: String }
})
AuthLogs.index({ iUserId: 1 })

module.exports = UsersDBConnect.model('authlogs', AuthLogs)
