const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { AdminsDBConnect } = require('../../../database/mongoose')
const { status } = require('../../../data')

const Permissions = new Schema({
  sName: { type: String, required: true },
  sKey: { type: String, required: true },
  eStatus: { type: String, enum: status, default: 'Y' },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Permissions.index({ sKey: 1 })

module.exports = AdminsDBConnect.model('permissions', Permissions)
