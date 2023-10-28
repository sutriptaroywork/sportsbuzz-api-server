
/**
 * MatchTeams queue in RabbitMQ
 */
const connectionEvent = require('../../events/connection')
const { kycStatUpdate } = require('../../queue')
const { rabbitMqInstance, getChannel } = require('../connection/amqplib')
const routingQueueKey = 'STAT_KYC'

/**
 * for publishing data
 * @param {object} msg
 */
// const publish = async (msg) => {
//   rabbitMqInstance.publish(getChannel(), routingQueueKey, msg)
// }

/**
 * consuming data, start after all connections established
 */
connectionEvent.on('ready', () => {
  console.log(`#####STARTED CONSUMING ${routingQueueKey} QUEUE#####`)
  rabbitMqInstance.consume(getChannel(), routingQueueKey, kycStatUpdate)
})
