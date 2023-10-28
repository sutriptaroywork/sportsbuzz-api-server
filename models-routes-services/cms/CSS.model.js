const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../../database/mongoose')
const { cssTypes } = require('../../data')

const CSS = new Schema({
  sTitle: { type: String, required: true },
  eType: { type: String, enum: cssTypes, default: 'N' },
  sContent: { type: String, required: true }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

CSS.index({ eType: 1 })

module.exports = StatisticsDBConnect.model('css', CSS)
