/**
 * Connection event,
 * if all connections are established then ready event will get triggered
 */
const ReadyEvent = require('@buzzsports/sportsbuzz11-ready-event')

const MONGO_CONNECTION_EVENT = 11
const SQL_CONNECTION_EVENT = 1
const REDIS_CONNECTION_EVENT = 3
const RABBITMQ_CONNECTION_EVENT = 1

const ALL_EVENTS = MONGO_CONNECTION_EVENT + SQL_CONNECTION_EVENT + REDIS_CONNECTION_EVENT + RABBITMQ_CONNECTION_EVENT

const connectionEvent = new ReadyEvent(ALL_EVENTS)

connectionEvent.on('ready', () => {
  console.log('****ALL CONNECTION ESTABLISHED*****')
})
module.exports = connectionEvent
