const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { AdminsDBConnect } = require('../../../database/mongoose')
const { status, adminPermission, adminPermissionType } = require('../../../data')

const Roles = new Schema({
  sName: { type: String, required: true },
  aPermissions: [{
    sKey: { type: String, enum: adminPermission },
    eType: { type: String, enum: adminPermissionType } // R = READ, W = WRITE, N = NONE - Rights
  }],
  eStatus: { type: String, enum: status, default: 'Y' },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Roles.index({ 'aPermissions.sKey': 1 })
Roles.index({ eStatus: 1 })

module.exports = AdminsDBConnect.model('roles', Roles)
