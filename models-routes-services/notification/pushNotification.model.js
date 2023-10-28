const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { NotificationsDBConnect } = require('../../database/mongoose')
const { notificationTopic, notificationStatus } = require('../../data')
const AdminModel = require('../admin/model')

const PushNotification = new Schema({
  sTitle: { type: String, require: true },
  iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel },
  sDescription: { type: String, require: true },
  dScheduleTime: { type: Date },
  ePlatform: { type: String, enum: notificationTopic, default: 'ALL' }, // Notification Type
  eStatus: { type: Number, enum: notificationStatus, default: 1 },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

PushNotification.virtual('oAdmin', {
  ref: AdminModel,
  localField: 'iAdminId',
  foreignField: '_id',
  justOne: true
})

module.exports = NotificationsDBConnect.model('pushNotifications', PushNotification)
