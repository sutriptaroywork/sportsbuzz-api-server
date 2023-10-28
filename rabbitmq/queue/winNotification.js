
/**
 * MatchTeams queue in RabbitMQ
 */
const connectionEvent = require('../../events/connection')
const { rabbitMqInstance, getChannel } = require('../connection/amqplib')
const { winNotify } = require('../../queue')
const routingQueueKey = 'pushNotification'
/**
 * consuming data, start after all connections established
 */
connectionEvent.on('ready', () => {
  console.log(`#####STARTED CONSUMING ${routingQueueKey} QUEUE#####`)
  rabbitMqInstance.consume(getChannel(), routingQueueKey, winNotify)
})
