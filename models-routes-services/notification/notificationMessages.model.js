const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { NotificationsDBConnect } = require('../../database/mongoose')
const { notificationMessageKeys, notificationPlatform } = require('../../data')

const NotificationMessages = new Schema({
  sHeading: { type: String, require: true },
  sDescription: { type: String, require: true },
  ePlatform: { type: String, enum: notificationPlatform, default: 'ALL' },
  eKey: { type: String, enum: notificationMessageKeys, default: 'PLAY_RETURN' },
  bEnableNotifications: { type: Boolean, default: true },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

module.exports = NotificationsDBConnect.model('notificationmessages', NotificationMessages)
