const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { LeaguesDBConnect } = require('../../database/mongoose')

const FilterCategory = new Schema({
  sTitle: { type: String, trim: true, required: true },
  sRemark: { type: String, trim: true },
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

module.exports = LeaguesDBConnect.model('filtercategories', FilterCategory)
