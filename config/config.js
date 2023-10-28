require('dotenv').config()
console.log(process.env.NODE_ENV)

let environment
if (process.env.NODE_ENV === 'production') {
  environment = require('./production.js')
} else if (process.env.NODE_ENV === 'test') {
  environment = require('./test.js')
} else if (process.env.NODE_ENV === 'staging') {
  environment = require('./staging.js')
} else {
  environment = require('./development.js')
}  

console.log('SQL_DB_URL', environment.DB_SQL_NAME)

module.exports = environment
