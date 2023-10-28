const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { UsersDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const UserModel = require('./model')

const UserSession = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  ePlatform: { type: String, enum: data.platform, required: true }, // A = Android, I = iOS, W = Web, O = Other, AD = Admin
  sDeviceToken: { type: String },
  nLongitude: { type: Number }, // not in used
  nLatitude: { type: Number }, // not in used
  sPushToken: { type: String, trim: true },
  nVersion: { type: Number }, // not in used
  dUpdatedAt: { type: Date },
  dCreatedAt: { type: Date, default: Date.now },
  sExternalId: { type: String }
})
UserSession.index({ iUserId: 1 })

module.exports = UsersDBConnect.model('usersessions', UserSession)
