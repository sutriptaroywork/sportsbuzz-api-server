/**
 * for rabbitmq connection
 */

const RabbitMQConnection = require('@buzzsports/sportsbuzz11-rabbitmq-provider')

const config = require('../../config/config')
const rabbitmqConfig = require('../rabbitmq.config')
const { handleCatchError } = require('../../helper/utilities.services')
const connectionEvent = require('../../events/connection')

// creating rabbitmq connection instance
const instance = new RabbitMQConnection(config.RABBITMQ_URL, rabbitmqConfig.exchangeName, rabbitmqConfig.exchangeType)

let channel

/**
 * creating connection
 * creating channel
 * triggering RabbitMQ ready event
 */
(async () => {
  try {
    const connection = await instance.createConnection()
    console.log('---RabbitMQ Connection Created---')
    channel = await instance.createChannel()
    process.once('SIGINT', async () => {
      console.log('RabbitMQ Graceful shutdown')
      await connection.close()
    })
    connectionEvent.ready('RabbitMQ')
  } catch (e) {
    handleCatchError(e)
  }
})()

// exporting instance and channel
module.exports = {
  rabbitMqInstance: instance,
  getChannel: () => channel
}
