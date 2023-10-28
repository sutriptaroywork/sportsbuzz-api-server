const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { UsersDBConnect } = require('../../database/mongoose')
const UserModel = require('../user/model')

const Preferences = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel, unique: true },
  bEmails: { type: Boolean, default: true },
  bSms: { type: Boolean, default: true },
  bSound: { type: Boolean, default: true },
  bVibration: { type: Boolean, default: true },
  bPush: { type: Boolean, default: true },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Preferences.index({ iUserId: 1 })

module.exports = UsersDBConnect.model('preferences', Preferences)
