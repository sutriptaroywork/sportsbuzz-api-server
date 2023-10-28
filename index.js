const express = require('express')

const config = require('./config/config')

const app = express()
global.appRootPath = __dirname

require('./database/mongoose')
require('./rabbitmq/connection/amqplib')

require('./middlewares/index')(app)

require('./middlewares/routes')(app)

const server = app.listen(config.PORT, () => {
  console.log('Magic happens on port new Changes: ' + config.PORT)
})

server.keepAliveTimeout = 31000

module.exports = app
