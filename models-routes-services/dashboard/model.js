const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { ReportDBConnect } = require('../../database/mongoose')
const { dashboardKeys } = require('../../data')

const oFields = {
  nValue: { type: Number },
  dStartDate: { type: Date },
  dEndDate: { type: Date }
}

const AdminDashboard = new Schema({
  sKey: { type: String, enum: dashboardKeys, required: true, unique: true },
  aData: [oFields]
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

AdminDashboard.index({ sKey: 1 })

module.exports = ReportDBConnect.model('dashboards', AdminDashboard)
