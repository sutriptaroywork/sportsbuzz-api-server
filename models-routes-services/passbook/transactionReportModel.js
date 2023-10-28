const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { ReportDBConnect } = require('../../database/mongoose')
const data = require('../../data')
const AdminModel = require('../admin/model')
const MatchLeagueModel = require('../matchLeague/model')
const MatchModel = require('../match/model')

const TransactionReport = new Schema({
  iAdminId: { type: Schema.Types.ObjectId, ref: AdminModel },
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel },
  iMatchLeagueId: { type: Schema.Types.ObjectId, ref: MatchLeagueModel },
  oFilter: { type: Object },
  sReportUrl: { type: String, trim: true },
  nTotal: { type: Number },
  eStatus: { type: String, enum: data.matchLeagueReportStatus, default: 'P' },
  dDateFrom: { type: Date },
  dDateTo: { type: Date },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

module.exports = ReportDBConnect.model('transactionReport', TransactionReport)
