
/**
 * Test queue in RabbitMQ
 */
const connectionEvent = require('../../events/connection')
const { handleCatchError } = require('../../helper/utilities.services')
const { rabbitMqInstance, getChannel } = require('../connection/amqplib')
const routingQueueKey = 'TestQueue'

/**
 * for publishing data
 * @param {object} msg
 */
const publish = async (msg) => {
  rabbitMqInstance.publish(getChannel(), routingQueueKey, msg)
}

const testCallback = (data) => {
  try {
    console.log('Testing RabbitMQ Queue', JSON.parse(data))
  } catch (e) {
    handleCatchError(e)
  }
}

/**
 * consuming data, start after all connections established
 */
connectionEvent.on('ready', () => {
  console.log(`#####STARTED CONSUMING ${routingQueueKey} QUEUE#####`)
  rabbitMqInstance.consume(getChannel(), routingQueueKey, testCallback)
})

module.exports = {
  publish
}
