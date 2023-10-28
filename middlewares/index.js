const express = require('express')
const mongoose = require('mongoose')
const fileUpload = require('express-fileupload')
const path = require('path')
const bodyParser = require('body-parser')
const cors = require('cors')
const cachegoose = require('recachegoose')
const helmet = require('helmet')
const Sentry = require('@sentry/node')
const compression = require('compression')
const hpp = require('hpp')

const config = require('../config/config')
const data = require('../data')

module.exports = (app) => {
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: 'https://ca4d3ad7705241a1acf8de77d9e85113@o4504490770235392.ingest.sentry.io/4504490774757376',
      tracesSampleRate: 1.0
    })
  }
  cachegoose(mongoose, {
    engine: 'redis',
    host: config.REDIS_HOST,
    port: config.REDIS_PORT
  })

  // app.use(morgan('dev'))

  // Using to access form-data
  app.use(fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 }
  }))

  app.use(cors())
  app.use(helmet())
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", config.S3_BUCKET_URL]
      }
    })
  )
  app.disable('x-powered-by')
  app.use(bodyParser.json({ limit: '5mb' }))
  app.use(bodyParser.urlencoded({ limit: '5mb', extended: true }))
  app.use(hpp())

  /* global appRootPath */
  app.use(express.static(path.join(appRootPath, 'public')))
  app.set('view engine', 'ejs')

  app.use(compression({
    filter: function (req, res) {
      if (req.headers['x-no-compression']) {
        // don't compress responses with this request header
        return false
      }
      // fallback to standard filter function
      return compression.filter(req, res)
    }
  }))

  // set language in request object
  app.use((req, res, next) => {
    if (!req.header('Language')) {
      req.userLanguage = 'English'
    } else if ((data.supportedLanguage).indexOf(req.header('Language')) !== -1) {
      req.userLanguage = req.header('Language')
    } else {
      req.userLanguage = 'English'
    }
    next()
  })
}
