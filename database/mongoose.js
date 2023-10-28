const mongoose = require('mongoose')
const { handleCatchError } = require('../helper/utilities.services')

const config = require('../config/config')
const connectionEvent = require('../events/connection');

/**
 * Please add connection count in events/connection file
 */
const GamesDBConnect = connection(config.GAME_DB_URL, parseInt(config.GAME_DB_POOLSIZE), 'Game')
const MatchDBConnect = connection(config.MATCH_DB_URL, parseInt(config.MATCH_DB_POOLSIZE), 'Match')
const FantasyTeamConnect = connection(config.FANTASY_TEAM_DB_URL, parseInt(config.FANTASY_TEAM_DB_POOLSIZE), 'FantasyTeam')
const LeaguesDBConnect = connection(config.LEAGUES_DB_URL, parseInt(config.LEAGUES_DB_POOLSIZE), 'Leagues')
const AdminsDBConnect = connection(config.ADMINS_DB_URL, parseInt(config.ADMINS_DB_POOLSIZE), 'Admins')
const SeriesLBDBConnect = connection(config.SERIES_LB_DB_URL, parseInt(config.SERIES_LB_DB_POOLSIZE), 'Series Leader-Board')
const UsersDBConnect = connection(config.USERS_DB_URL, parseInt(config.USERS_DB_POOLSIZE), 'Users')
const StatisticsDBConnect = connection(config.STATISTICS_DB_URL, parseInt(config.STATISTICS_DB_POOLSIZE), 'Statistics')
const ComplaintsDBConnect = connection(config.COMPLAINS_DB_URL, parseInt(config.COMPLAINS_DB_POOLSIZE), 'Complaints')
const NotificationsDBConnect = connection(config.NOTIFICATION_DB_URL, parseInt(config.NOTIFICATION_DB_POOLSIZE), 'Notifications')
const ReportDBConnect = connection(config.REPORT_DB_URL, parseInt(config.REPORT_DB_POOLSIZE), 'Report')

function connection(DB_URL, maxPoolSize = 10, DB) {
  try {
    let dbConfig = { useNewUrlParser: true, useUnifiedTopology: true, readPreference: 'secondaryPreferred' }
    if (!['dev', 'staging'].includes(process.env.NODE_ENV)) {
      dbConfig = { useNewUrlParser: true, useUnifiedTopology: true, maxPoolSize, readPreference: 'secondaryPreferred' }
    }
    const conn = mongoose.createConnection(DB_URL, dbConfig)
    conn.on('connected', () => {
      console.log(`Connected to ${DB} database...`)
      connectionEvent.ready('MongoDB')
    })
    conn.on('disconnected', () => {
      console.log(`Disconnected to ${DB} database...`);
      // connectionEvent.lost();
    })
    return conn
  } catch (error) {
    handleCatchError(error)
  }
}

// mongoose.set('debug', true)
module.exports = {
  UsersDBConnect,
  LeaguesDBConnect,
  NotificationsDBConnect,
  StatisticsDBConnect,
  ComplaintsDBConnect,
  AdminsDBConnect,
  GamesDBConnect,
  MatchDBConnect,
  FantasyTeamConnect,
  ReportDBConnect,
  SeriesLBDBConnect
}
