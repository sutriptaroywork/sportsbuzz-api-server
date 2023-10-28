const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const { adminPay } = require('../../data')
const bcrypt = require('bcryptjs')
const saltRounds = 1
const salt = bcrypt.genSaltSync(saltRounds)

const Credential = new Schema({
  eKey: { type: String, enum: adminPay, default: 'PAY', unique: true },
  sPassword: { type: String, trim: true, required: true },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

Credential.index({ eKey: 1 })

module.exports = StatisticsDBConnect.model('credentials', Credential)

Credential.pre('save', function (next) {
  var admin = this

  if (admin.isModified('sPassword')) {
    admin.sPassword = bcrypt.hashSync(admin.sPassword, salt)
  }

  next()
})
