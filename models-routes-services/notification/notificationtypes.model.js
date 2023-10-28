const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { NotificationsDBConnect } = require('../../database/mongoose')

const NotificationTypes = new Schema({
  sHeading: { type: String },
  sDescription: { type: String },
  eStatus: { type: String, enum: ['Y', 'N'], default: 'Y' },
  dUpdatedAt: { type: Date },
  dCreatedAt: { type: Date, default: Date.now },
  sExternalId: { type: String }
})

module.exports = NotificationsDBConnect.model('notificationtypes', NotificationTypes)
