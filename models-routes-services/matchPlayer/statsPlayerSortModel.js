const mongoose = require('mongoose')
const Schema = mongoose.Schema
const MatchModel = require('../match/model')
const { MatchDBConnect } = require('../../database/mongoose')

const StatsPlayerSort = new Schema({
  iMatchId: { type: Schema.Types.ObjectId, ref: MatchModel, unique: true },
  players: { type: Object }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

const StatsPlayerSortModel = MatchDBConnect.model('statssortplayers', StatsPlayerSort)

StatsPlayerSortModel.syncIndexes().then(() => {
  console.log('Combination Players Model Indexes Synced')
}).catch((err) => {
  console.log('Combination Players Indexes Sync Error', err)
})

module.exports = StatsPlayerSortModel
