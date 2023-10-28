'use strict'

const Sequelize = require('sequelize')
const config = require('../config/config')

/**
 * Please add connection count in events/connection file
 */
const connectionEvent = require('../events/connection')

const db = {}

let sequelize
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], {
    host: config.DB_SQL_HOST,
    port: config.DB_SQL_PORT,
    dialect: 'mysql'
  })
} else {
  const poolObj = {
    max: parseInt(config.DB_SQL_MAX_POOLSIZE),
    min: parseInt(config.DB_SQL_MIN_POOLSIZE),
    // acquire: 30000,
    // idle: 10000,
    handleDisconnects: true
  }

  sequelize = new Sequelize(config.DB_SQL_NAME, config.DB_SQL_USER, config.DB_SQL_PASSWORD, {
    host: config.DB_SQL_HOST,
    port: config.DB_SQL_PORT,
    dialect: config.DB_SQL_DIALECT,
    logging: false,
    dialectOptions: { multipleStatements: true },
    replication: {
      read: { host: config.DB_SQL_HOST_REPLICA },
      write: { host: config.DB_SQL_HOST }
    },
    pool: poolObj
  })
  sequelize.authenticate()
    .then(() => {
      console.log('Successfully connected to the SQL database:', config.DB_SQL_NAME)
      connectionEvent.ready('SQL')
    }).catch((err) => {
      console.error('Unable to connect to the database:', err)
    })
}

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db)
  }
})

db.sequelize = sequelize
db.Sequelize = Sequelize
db.DataTypes = Sequelize.DataTypes
db.queryInterface = sequelize.getQueryInterface()

module.exports = db
