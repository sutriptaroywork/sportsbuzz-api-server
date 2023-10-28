const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { NotificationsDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const UserModel = require('../user/model')
const NotificationTypesModel = require('../notification/notificationtypes.model')
const AdminModel = require('../admin/model')

const Notifications = new Schema({
  iUserId: { type: Schema.Types.ObjectId, ref: UserModel },
  sTitle: { type: String },
  sMessage: { type: String },
  eStatus: { type: Number, enum: data.notificationStatus, default: 0 },
  iType: { type: Schema.Types.ObjectId, ref: NotificationTypesModel },
  dExpTime: { type: Date },
  aReadIds: { type: [Schema.Types.ObjectId], ref: UserModel, default: [] },
  iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Notifications.index({ iUserId: 1, iType: 1, dExpTime: 1 })

Notifications.virtual('oAdminNotification', {
  ref: AdminModel,
  localField: 'iAdminId',
  foreignField: '_id',
  justOne: true
})

Notifications.virtual('oUserNotification', {
  ref: UserModel,
  localField: 'iUserId',
  foreignField: '_id',
  justOne: true
})

module.exports = NotificationsDBConnect.model('notifications', Notifications)
