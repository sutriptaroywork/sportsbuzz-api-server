
/**
 * MatchTeams queue in RabbitMQ
 */
const connectionEvent = require('../../events/connection')
const { rabbitMqInstance, getChannel } = require('../connection/amqplib')
const { calculateTotalScorePointV2 } = require('../../queue')
const routingQueueKey = 'MatchTeams'

/**
 * for publishing data
 * @param {object} msg
 */
const publish = async (msg) => {
  try {
    rabbitMqInstance.publish(getChannel(), routingQueueKey, msg)
  } catch (error) {
    console.log(error)
  }
}

/**
 * consuming data, start after all connections established
 */
connectionEvent.on('ready', () => {
  console.log(`#####STARTED CONSUMING ${routingQueueKey} QUEUE#####`)
  rabbitMqInstance.consume(getChannel(), routingQueueKey, calculateTotalScorePointV2)
})

module.exports = {
  publish
}
