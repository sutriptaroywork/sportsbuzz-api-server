const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { StatisticsDBConnect } = require('../database/mongoose')

const MigrationMeta = new Schema({
  sFileName: { type: String },
  dCreatedAt: { type: Date, default: Date.now }
})

module.exports = StatisticsDBConnect.model('migrationMeta', MigrationMeta)
