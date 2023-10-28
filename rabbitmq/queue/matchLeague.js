
/**
 * MatchLeague queue in RabbitMQ
 */
const { rabbitMqInstance, getChannel } = require('../connection/amqplib')
const routingQueueKey = 'MatchLeague'

/**
 * for publishing data
 * @param {object} msg
 */
const publish = async (msg) => {
  rabbitMqInstance.publish(getChannel(), routingQueueKey, msg)
}

/**
 * consumer is on another repository
 */

module.exports = {
  publish
}
