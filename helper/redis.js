const fs = require('fs')
const Redis = require('ioredis')
const config = require('../config/config')
const { INTERNAL_USERS } = require('../config/common')
const { handleCatchError } = require('./utilities.services')
const sanitizeHtml = require('sanitize-html')
const jwt = require('jsonwebtoken')

/**
 * Please add connection count in events/connection file
 */
const connectionEvent = require('../events/connection')

const redisClient = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD
})

const redisClient2 = new Redis({
  host: config.REDIS_2_HOST,
  port: config.REDIS_2_PORT,
  password: config.REDIS_PASSWORD
})

const redisClient3 = new Redis({
  host: config.REDIS_3_HOST,
  port: config.REDIS_3_PORT,
  password: config.REDIS_PASSWORD
})

redisClient.on('error', function (error) {
  console.log('Error in Redis', error)
  handleCatchError(error)
  process.exit(1)
})

redisClient2.on('error', function (error) {
  console.log('Error in Redis2', error)
  handleCatchError(error)
  process.exit(1)
})

redisClient3.on('error', function (error) {
  console.log('Error in Redis3', error)
  handleCatchError(error)
  process.exit(1)
})

redisClient.on('connect', function () {
  console.log('redis connected')
  connectionEvent.ready('REDIS')
})

redisClient2.on('connect', function () {
  console.log('redis2 connected')
  checkScriptExists('lb.lua', '5b9a4657e92b7ce3a7abe5cbb7441730454eda5e')
  checkScriptExists('getMyTeams.lua', '5111ebb3688a5c52bd02c6df453b42710ede8f94')
  checkScriptExists('getMyTeamsV2.lua', 'fd2b6d7f620fcb29483676a8e70b4c621b35dd14')
  checkScriptExists('getMyTeamsV3.lua', '25cbc9222328bd9b741f0008caa48e6117cf215e')
  checkScriptExists('updateLb.lua', 'f9ab602f06e5b37febb9006a6f697f5339b51d6f')
  connectionEvent.ready('REDIS')
})

redisClient3.on('connect', function () {
  console.log('redis3 connected')
  connectionEvent.ready('REDIS')
})
// const Stampede = require('cache-stampede').redis(redisClient, { retryDelay: 1000, maxRetries: 25 })

const checkScriptExists = async function (scriptName, hash) {
  try {
    const data = await redisClient2.send_command('SCRIPT', ['EXISTS', hash])
    if (!data[0]) {
      const script = fs.readFileSync(`luaScripts/${scriptName}`, 'utf8')
      const loadScript = await redisClient2.send_command('SCRIPT', ['LOAD', script])
      console.log({ loadScript, scriptName })
    }
  } catch (error) {
    handleCatchError(error)
  }
}
module.exports = {
  cacheHTMLRoute: function (duration) {
    return async (req, res, next) => {
      const key = '__express__' + sanitizeHtml(req.originalUrl || req.url)
      // if (process.env.NODE_ENV === 'dev') return next()
      const cachedBody = await redisClient.get(key)
      if (cachedBody) {
        res.setHeader('is-cache', 1)
        res.setHeader('Content-type', 'text/html')
        return res.send(cachedBody)
      } else {
        res.sendResponse = res.send
        res.send = (body) => {
          redisClient.set(key, body, 'EX', duration)
          res.setHeader('Content-type', 'text/html')
          res.sendResponse(body)
        }
        next()
      }
    }
  },
  cacheRoute: function (duration) {
    return async (req, res, next) => {
      const key = '__express__' + sanitizeHtml(req.originalUrl || req.url)
      if (process.env.NODE_ENV === 'dev') return next()

      const cachedBody = await redisClient.get(key)
      if (cachedBody) {
        res.setHeader('is-cache', 1)
        res.setHeader('content-type', 'application/json')
        return res.send(cachedBody)
      } else {
        res.sendResponse = res.send
        res.send = (body) => {
          redisClient.set(key, body, 'EX', duration)
          res.setHeader('content-type', 'application/json')
          res.sendResponse(body)
        }
        next()
      }
    }
  },
  cacheRouteLeague: function (duration) {
    return async (req, res, next) => {
      let key = '__express__' + sanitizeHtml(req.originalUrl || req.url)
      if (req.route.path === '/user/match-league/:id/list/v2') {
        if (INTERNAL_USERS.includes(req.user._id.toString())) {
          key += '_internal'
        }
      }
      const cachedBody = await redisClient.get(key)
      if (cachedBody) {
        res.setHeader('is-cache', 1)
        res.setHeader('content-type', 'application/json')
        return res.send(cachedBody)
      } else {
        res.sendResponse = res.send
        res.send = (body) => {
          redisClient.set(key, body, 'EX', duration)
          res.setHeader('content-type', 'application/json')
          res.sendResponse(body)
        }
        next()
      }
    }
  },
  // cacheRoute: function (duration) {
  //   return async (req, res, next) => {
  //     const key = '__express__' + req.originalUrl || req.url
  //     if (process.env.NODE_ENV === 'dev') return next()
  //     try {
  //       const data = await Stampede.get(key)
  //       res.sendResponse = res.send
  //       res.setHeader('is-cache', 1)
  //       res.setHeader('content-type', 'application/json')
  //       return res.send(data.data)
  //     } catch (error) {
  //       try {
  //         Stampede.cached(key, () => {
  //           return new Promise((resolve, reject) => {
  //             try {
  //               res.sendResponse = res.send
  //               res.send = (body) => {
  //                 res.setHeader('content-type', 'application/json')
  //                 res.sendResponse(body)
  //                 return resolve(body)
  //               }
  //             } catch (error) {
  //               handleCatchError(error)
  //               return reject(error)
  //             }
  //           })
  //         }, { expiry: duration * 1000 })
  //         next()
  //       } catch (error) {
  //         console.log('error', error)
  //         return catchError('cacheRoute', error, req, res)
  //       }
  //     }
  //   }
  // },

  checkRateLimitOTP: function (sLogin, sType, sAuth) {
    return new Promise((resolve, reject) => {
      if (process.env.NODE_ENV === 'dev') resolve()
      if (!sLogin || !sType || !sAuth) resolve()
      redisClient.incr(`rlotp:${sLogin}:${sType}:${sAuth}:${(new Date()).getHours()}`).then(data => {
        if (data > config.MAX_OTP_RETRIES) {
          resolve('LIMIT_REACHED')
        } else {
          redisClient.expire(`rlotp:${sLogin}:${sType}:${sAuth}:${(new Date()).getHours()}`, config.OTP_EXPIRY_TIME).then().catch()
          resolve()
        }
      }).catch(error => {
        handleCatchError(error)
        resolve()
      })
    })
  },

  // It will check only rate limit count if limit is reached returns 'LIMIT_REACHED'
  getRateLimitStatus: function(sLogin, sType, sAuth) {
    return new Promise((resolve, reject) => {
      if (process.env.NODE_ENV === 'dev') resolve()
      if (!sLogin || !sType || !sAuth) resolve()
      redisClient.get(`rlotp:${sLogin}:${sType}:${sAuth}:${(new Date()).getHours()}`).then(data => {
        if (data > config.MAX_OTP_RETRIES) {
          return resolve('LIMIT_REACHED')
        }
        return resolve()
      }).catch(error => {
        handleCatchError(error)
        resolve()
      })
    })
  },
  //  It will check whether sent otp is expired or not
  getOTPExpiryStatus: function (sLogin, sType, sAuth) {
    return new Promise((resolve, reject) => {
      if (process.env.NODE_ENV === 'dev') resolve()
      if (!sLogin || !sType || !sAuth) resolve()
      redisClient.ttl(`rlotp:${sLogin}:${sType}:${sAuth}:${(new Date()).getHours()}`).then(data => {
        if (data <= 0) {
          return resolve('EXPIRED')
        }
        return resolve()
      }).catch(error => {
        handleCatchError(error)
        resolve()
      })
    })
  },

  checkTeamJoined: function (iUserId, iUserTeamId, iMatchLeagueId) {
    return new Promise((resolve, reject) => {
      // if (process.env.NODE_ENV === 'dev') return resolve()
      if (!iUserId || !iUserTeamId) return resolve()
      redisClient.incr(`join:${iUserId}:${iUserTeamId}:${iMatchLeagueId}`).then(data => {
        if (data > 1) {
          console.log(`EXIST:::: join:${iUserId}:${iUserTeamId}:${iMatchLeagueId}`)
          return resolve('EXIST')
        } else {
          redisClient.expire(`join:${iUserId}:${iUserTeamId}:${iMatchLeagueId}`, 5).then().catch()
          return resolve()
        }
      }).catch(error => {
        handleCatchError(error)
        return resolve()
      })
    })
  },

  checkProcessed: function (sKey, nExpire = 15) {
    return new Promise((resolve, reject) => {
      // if (process.env.NODE_ENV === 'dev') return resolve()
      if (!sKey) return resolve()
      redisClient.incr(sKey).then(data => {
        if (data > 1) {
          return resolve('EXIST')
        } else {
          redisClient.expire(sKey, nExpire).then().catch()
          return resolve()
        }
      }).catch(error => {
        handleCatchError(error)
        return resolve()
      })
    })
  },

  checkRateLimit: async function (threshold, path, ip) {
    // return async function (req, res, next) {
    try {
      // if (process.env.NODE_ENV === 'dev') return
      // const ip = getIp(ip)
      const ipLimit = await redisClient.incr(`${path}:${ip}`)

      if (ipLimit > threshold) {
        // return res.status(status.TooManyRequest).jsonp({ status: jsonStatus.TooManyRequest, message: messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].request) })
        return 'LIMIT_REACHED'
      } else {
        const ttl = await redisClient.ttl(`${path}:${ip}`)
        if (ttl === -1) {
          await redisClient.expire(`${path}:${ip}`, 1800)
        }
        // return next()
        return
      }
    } catch (error) {
      handleCatchError(error)
      // return next()
    }
    // }
  },

  blackListToken: function (token) {
    try {
      const sBlackListKey = `BlackListToken:${token}`
      const tokenData = jwt.decode(token, { complete: true })
      const tokenExp = tokenData.payload.exp
      redisClient.setex(sBlackListKey, tokenExp, 0)
    } catch (error) {
      handleCatchError(error)
    }
  },

  addMember: function (memberName, data, ttl) {
    return new Promise((resolve, reject) => {
      (async () => {
        await Promise.all([
          redisClient.sadd(`UserTeam:${memberName}`, data),
          redisClient.expire(`UserTeam:${memberName}`, ttl)
        ])
        return resolve()
      })()
    })
  },

  removeMember: function (memberName, data) {
    return new Promise((resolve, reject) => {
      (async () => {
        await Promise.all([
          redisClient.srem(`UserTeam:${memberName}`, data)
        ])
        return resolve()
      })()
    })
  },

  checkTeamExist: function(memberName, member) {
    return new Promise((resolve, reject) => {
      (async () => {
        const checkLen = await redisClient.scard(`UserTeam:${memberName}`)
        if (checkLen > 121) return resolve('LENGTH_EXCEED') // total captain and viceCaptain switch possibilities is 11^2 = 121
        const bExists = await redisClient.sismember(`UserTeam:${memberName}`, member)
        if (!bExists) return resolve()
        return resolve('EXIST')
      })()
    })
  },

  getPlayerRoles: function(eCategory) {
    return new Promise((resolve, reject) => {
      (async () => {
        const playerRoles = await redisClient.get(`Role:${eCategory}`)
        if (playerRoles) return resolve(JSON.parse(playerRoles))
        else return resolve() // total captain and viceCaptain switch possibilities is 11^2 = 121
      })()
    })
  },
  setPlayerRoles: function(eCategory, data) {
    return new Promise((resolve, reject) => {
      (async () => {
        await redisClient.set(`Role:${eCategory}`, JSON.stringify(data))
        resolve() // total captain and viceCaptain switch possibilities is 11^2 = 121
      })()
    })
  },

  queuePush: function (queueName, data) {
    return redisClient.rpush(queueName, JSON.stringify(data))
  },

  queuePop: function (queueName, data) {
    return redisClient.lpop(queueName)
  },

  bulkQueuePop: function (queueName, limit) {
    return redisClient.lpop(queueName, limit)
  },

  bulkQueuePush: async function (queueName, aData, limit) {
    const aStringData = aData.map(d => JSON.stringify(d))

    while (aStringData.length) {
      await redisClient.rpush(queueName, ...aStringData.splice(0, limit))
    }
  },

  queueLen: function (queueName) {
    return redisClient.llen(queueName)
  },
  checkScriptExists,
  redisClient,
  redisClient2,
  redisClient3
}
