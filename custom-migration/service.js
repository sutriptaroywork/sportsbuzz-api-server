const MigrationMetaModel = require('./model')
const config = require('../config/config')
const mongoose = require('mongoose')
const { queryInterface, DataTypes } = require('../database/sequelize')
const fs = require('fs')
const files = fs.readdirSync('./migrations')
const { handleCatchError } = require('../helper/utilities.services')
mongoose.connect(config.STATISTICS_DB_URL).then(() => console.log(`Connected to ${config.STATISTICS_DB_URL} database...`)).catch((e) => handleCatchError(e))

/**
 * @params {Object}
 * It'll delete data of migration file from migrationMeta after migration down
 */
async function onDown(data) {
  try {
    await MigrationMetaModel.deleteOne({ sFileName: data.sFileName })
  } catch (e) {
    handleCatchError(e)
  }
}

/**
 * @params {Object}
 * It'll store data of migration file in migrationMeta after migration up
 */
async function onUp(data) {
  try {
    await MigrationMetaModel.create(data)
  } catch (e) {
    handleCatchError(e)
  }
}

function splitDate(file) {
  const year = file.split('-')[0].split('').slice(0, 4).join('')
  const month = file.split('-')[0].split('').slice(4, 6).join('')
  const date = file.split('-')[0].split('').slice(6, 8).join('')
  const hour = file.split('-')[0].split('').slice(8, 10).join('')
  const minute = file.split('-')[0].split('').slice(10, 12).join('')
  const second = file.split('-')[0].split('').slice(12, 14).join('')
  return { year, month, date, hour, minute, second }
}

files.sort((a, b) => {
  const dateOfa = splitDate(a)
  const dateOfb = splitDate(b)
  return new Date(`${dateOfa.year}-${dateOfa.month}-${dateOfa.date}T${dateOfa.hour}:${dateOfa.minute}:${dateOfa.second}`) - new Date(`${dateOfb.year}-${dateOfb.month}-${dateOfb.date}T${dateOfb.hour}:${dateOfb.minute}:${dateOfb.second}`)
})

/**
 * It'll run migration up functions one by one
 */
async function migrationUp() {
  try {
    for (const file of files) {
      const dbFile = await MigrationMetaModel.findOne({ sFileName: file }).select('sFileName -_id').lean()
      if (dbFile && dbFile.sFileName === file) continue
      const migration = require('../migrations/' + file)
      await migration.up(queryInterface, DataTypes).then(async () => await onUp({ sFileName: file }))
      console.log('Migrated...', file)
    }
    process.exit(0)
  } catch (e) {
    handleCatchError(e)
    process.exit(0)
  }
}
/**
 * It'll run migration down functions one by one
 */
async function migrationDown() {
  try {
    for (let i = files.length - 1; i >= 0; i--) {
      const dbFile = await MigrationMetaModel.findOne({ sFileName: files[i] }).select('sFileName -_id').lean()
      if (dbFile && dbFile.sFileName !== files[i]) continue
      const migration = require('../migrations/' + files[i])
      await migration.down(queryInterface, DataTypes).then(async () => await onDown({ sFileName: files[i] }))
      console.log(files[i])
    }
    process.exit(0)
  } catch (e) {
    handleCatchError(e)
    process.exit(0)
  }
}

module.exports = {
  migrationUp,
  migrationDown
}
