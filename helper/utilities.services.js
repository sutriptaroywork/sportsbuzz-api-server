/* eslint-disable no-useless-escape */
/* eslint-disable no-prototype-builtins */
/**
 * Utilities Services is for common, simple & reusable methods,
 * @method {removenull} is for removing null key:value pair from the passed object
 * @method {sendmail} is for generating trasport and sending mail with specified mailOptions Object And returns a promise ex: { from:'', to:'',subject: '', html: '' }
 */

const { messages, status, jsonStatus } = require('./api.responses')
const { PUBLIC_KEY, AWS_ACCESS_KEY, AWS_SECRET_KEY, S3_BUCKET_NAME } = require('../config/config')
const axios = require('axios')
const Crypt = require('hybrid-crypto-js').Crypt
const crypt = new Crypt()
const data = require('../data')
const Sentry = require('@sentry/node')
var AWS = require('aws-sdk')
AWS.config.update({ accessKeyId: AWS_ACCESS_KEY, secretAccessKey: AWS_SECRET_KEY, signatureVersion: 'v4', region: 'ap-south-1' })
var s3 = new AWS.S3()
const { getTotalPayoutForLeague } = require('../models-routes-services/league/common')
const { imageFormat } = require('../data')
const { createHash } = require('crypto')

const replaceSensitiveInfo = (body) => {
  let myObj
  if (body?.oOldFields) {
    myObj = body?.oOldFields
    body.oOldFields = hashBody256(myObj)
  }
  if (body?.oNewFields) {
    myObj = body?.oNewFields
    body.oNewFields = hashBody256(myObj)
  }
  if (body?.oReq) {
    const myObj = body.oReq
    body.oReq = hashBody256(myObj)
  }
  if (body?.oRes?.data) {
    const myObj = body.oRes.data
    body.oRes.data = hashBody256(myObj)
  }
  return body
}

const hashBody256 = (body) => {
  for (const key in body) {
    if (['phone', 'bankAccount', 'sMobNum', 'sNo', 'sAccountNo'].includes(key)) {
      const encryptHash = createHash('sha256').update(body[key]).digest('hex')
      body[key] = body[key].replaceAll(body[key], encryptHash)
    }
  }
  return body
}
/**
 * It'll remove all nullish, not defined and blank properties of input object.
 * @param {object}
 */
const removenull = (obj) => {
  for (var propName in obj) {
    if (obj[propName] === null || obj[propName] === undefined || obj[propName] === '') {
      delete obj[propName]
    }
  }
}

const removenullundefined = (object, body) => {
  for (const key of body) {
    object[key] = !body[key] ? null : body[key]
  }
}

const projectionFields = (body) => {
  const projection = {}
  for (var propName in body) {
    if (body[propName] !== null && body[propName] !== undefined) {
      projection[propName] = 1
    }
  }
  return projection
}

const removeDuplicates = (arr) => {
  if (toString.call(arr) === '[object Array]') {
    const uniqueNumbersArray = []
    arr.map(number => {
      if (!uniqueNumbersArray.includes(number)) {
        uniqueNumbersArray.push(number)
      }
    })
    return uniqueNumbersArray
  }
  return []
}

const catchError = (name, error, req, res) => {
  handleCatchError(error, name)
  return res.status(status.InternalServerError).jsonp({
    status: jsonStatus.InternalServerError,
    message: messages[req.userLanguage].error
  })
}

const handleCatchError = (error, name = '') => {
  if (process.env.NODE_ENV === 'production') Sentry.captureMessage(error)
  const { data = undefined, status = undefined } = error.response ?? {}

  if(error?.errorInfo?.code==='messaging/registration-token-not-registered') return console.log(`${name} **********ERROR***********`, 'Token not registered.')
  if (!status) console.log(`${name} **********ERROR***********`, error)
  else console.log(`${name} **********ERROR***********`, { status, data })
}

const pick = (object, keys) => {
  return keys.reduce((obj, key) => {
    if (object && object.hasOwnProperty(key)) {
      obj[key] = object[key]
    }
    return obj
  }, {})
}

const checkAlphanumeric = (input) => {
  var letters = /^[0-9a-zA-Z]+$/
  return !!(input.match(letters))
}

const validatePassword = (pass) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
  return !!(pass.match(regex))
}

const randomStr = (len, type) => {
  let char = ''
  if (type === 'referral' || type === 'private') {
    char = '0123456789abcdefghijkl0123456789mnopqrstuvwxyz0123456789'
  } else if (type === 'otp') {
    char = '0123456789'
  }
  let val = ''
  for (var i = len; i > 0; i--) {
    val += char[Math.floor(Math.random() * char.length)]
  }

  if (val.length === len) {
    return val
  } else {
    randomStr(len, type)
  }
}

const capitalizeString = (val) => {
  var capVal = val.toLowerCase().split(' ')
  for (let i = 0; i < capVal.length; i++) {
    capVal[i] = capVal[i].charAt(0).toUpperCase() + capVal[i].substring(1)
  }
  return capVal.join(' ')
}

const defaultSearch = (val) => {
  let search
  if (val) {
    search = val.replace(/\\/g, '\\\\')
      .replace(/\$/g, '\\$')
      .replace(/\*/g, '\\*')
      .replace(/\+/g, '\\+')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\)/g, '\\)')
      .replace(/\(/g, '\\(')
      .replace(/'/g, '\\\'')
      .replace(/"/g, '\\"')
    return search
  } else {
    return ''
  }
}

const isValidSportsType = (val) => {
  return data.category.find((type) => type === val.toUpperCase())
}

const getPaginationValues = (obj) => {
  let { start = 0, limit = 10, sort = 'dCreatedAt', order, search } = obj

  start = parseInt(start)
  limit = parseInt(limit)

  const orderBy = order && order === 'asc' ? 1 : -1

  const sorting = { [sort]: orderBy }

  if (search) search = defaultSearch(search)

  return { start, limit, sorting, search }
}

const getPaginationValues2 = (obj) => {
  let { start = 0, limit = 10, sort = 'dCreatedAt', order, search } = obj

  const orderBy = order && order === 'asc' ? 1 : -1

  const sorting = { [sort]: orderBy }

  if (search) search = defaultSearch(search)

  return { start, limit, sorting, search }
}

const getStatisticsSportsKey = (categoryName) => {
  if (!data.category.includes(categoryName)) return ''
  return `o${categoryName.charAt(0).toUpperCase()}${categoryName.slice(1).toLowerCase()}`
}

const isUrl = (s) => {
  const regex = new RegExp(/^(ftp|http|https):\/\/[^ "]+$/)
  return s && s.match(regex)
}

const chunk = (array, size) => {
  const result = []
  for (let i = 0; i < array.length; i += size) {
    const chunks = array.slice(i, i + size)
    result.push(chunks)
  }
  return result
}

const pushPayload = ({
  title,
  body,
  token,
  dataPayload = {}
}) => {
  return {
    apns: {
      headers: {
        'apns-priority': '10'
      },
      payload: {
        aps: { sound: 'default' }
      }
    },
    android: {
      priority: 'high'
    },
    notification: {
      title: title,
      body: body
    },
    data: {
      sound: 'default',
      priority: 'high',
      ...dataPayload
    },
    token: token
  }
}

const multiCastPushPayload = ({
  tokens,
  dataCast = {}
}) => {
  return {
    apns: {
      headers: {
        'apns-priority': '10'
      },
      payload: {
        aps: { sound: 'default' }
      }
    },
    android: {
      priority: 'high'
    },
    data: {
      sound: 'default',
      priority: 'high',
      ...dataCast
    },
    tokens: tokens
  }
}

const bunchMultiCastNotification = (tokens, pushData, size = 500) => {
  const result = []
  const tokenChunk = chunk(tokens, size)
  for (const token of tokenChunk) {
    result.push(multiCastPushPayload({
      tokens: token,
      data: pushData
    }))
  }
  return result
}

const replaceText = (str, object) => {
  const stringStartSymbol = '{{'
  const stringEndSymbol = '}}'
  if (isEmptyObject(object)) {
    return str
  }
  for (const txt in object) {
    const msg = stringStartSymbol + txt + stringEndSymbol
    str = str.replace(new RegExp(msg, 'g'), object[txt])
  }
  return str
}

const isEmptyObject = (obj) => {
  let result = false
  if (obj && obj.constructor === Object && Object.keys(obj).length === 0) {
    result = true
  }
  return result
}

const encryption = function (field) {
  const encrypted = crypt.encrypt(PUBLIC_KEY, field)
  return encrypted.toString()
}

const changeObjectKey = function (obj, subKey) {
  const keys = Object.keys(obj)
  const result = {}
  for (const i of keys) {
    const key = i
    result[`${subKey}${key}`] = obj[key]
  }
  return result
}

const sortArray = function (arr, sortBy) {
  arr.sort(function (a, b) {
    let i = 0; let result = 0
    while (i < sortBy.length && result === 0) {
      result = sortBy[i].direction * (a[sortBy[i].prop].toString() < b[sortBy[i].prop].toString() ? -1 : (a[sortBy[i].prop].toString() > b[sortBy[i].prop].toString() ? 1 : 0))
      i++
    }
    return result
  })
  return arr
}

async function validateEmail(email) {
  const sRegexEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/
  return email ? !!(email.match(sRegexEmail)) : false
}
const getIp = function (req) {
  try {
    let ip = req.header('x-forwarded-for') ? req.header('x-forwarded-for').split(',') : []
    ip = ip[0] || req.socket.remoteAddress
    return ip
  } catch (error) {
    handleCatchError(error)
    return req.socket.remoteAddress
  }
}

/**
 * This function will validate mobile number that is 10 digit or not.
 * @param {*} 1234567890 Mobile Number
 * return true if matched result of mobile number otherwise return false.
 */
function validateMobile(mobile) {
  return !mobile.match(/^\d{10}$/)
}

function reomveCountryCode(mobile) {
  return ('/^\+?1|\|1|\D/', '', (mobile))
}
function checkCountryCode(mobile) {
  return /^\+?1|\|1|\D/.test(mobile)
}

function validateIndianNumber(mobile) {
  return /^[6-9]\d{9}$/.test(mobile)
}
const UploadFromUrlToS3 = async (url, destPath) => {
  return new Promise((resolve, reject) => {
    try {
      axios.get(url, { responseType: 'arraybuffer', responseEncoding: 'binary' }).then(async (res) => {
        const objectParams = {
          ContentType: res.headers['content-type'],
          ContentLength: res.headers['content-length'],
          Key: destPath,
          Body: res.data,
          Bucket: S3_BUCKET_NAME
        }
        resolve(s3.putObject(objectParams).promise())
      }).catch(function (err) {
        reject(err)
      })
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * to validate pin code
 * @param  {number} pin
 * @return { boolean }
 */
function validatePIN(pin) {
  return /^\d{6}$/.test(pin)
}

/**
 * to convert string / number to fix length decimal value
 * @param  {number || string} number
 * @param  {number} length=2
 * @return  {number}
 */
const convertToDecimal = (number, length = 2) => Number(parseFloat(number).toFixed(length))

/**
 * To validate IFSC code is in proper format.
 * @param {string} ifsc code
 * @return { boolean }
 */
function validateIFSC(code) {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)
}

/**
 * To format Date in this format dd/mm/yyyy hh:mm AM
 * @param  {date/string} dateVal
 * @return {date/string} formated date
 */
function formatDate(dateVal) {
  if (!dateVal) return ''

  const newDate = new Date(dateVal)

  const sMonth = padValue(newDate.getMonth() + 1)
  const sDay = padValue(newDate.getDate())
  const sYear = newDate.getFullYear()
  let sHour = newDate.getHours()
  const sMinute = padValue(newDate.getMinutes())
  let sAMPM = 'AM'

  const iHourCheck = parseInt(sHour)

  if (iHourCheck > 12) {
    sAMPM = 'PM'
    sHour = iHourCheck - 12
  } else if (iHourCheck === 0) {
    sHour = '12'
  }

  sHour = padValue(sHour)

  return sDay + '/' + sMonth + '/' + sYear + ' ' + sHour + ':' + sMinute + ' ' + sAMPM
}

function padValue(value) {
  return (value < 10) ? '0' + value : value
}

const getUpdatedPrizeBreakupData = (data) => {
  const result = []
  if (Array.isArray(data) && data.length) {
    data.forEach((league) => {
      let { nJoined, nMin, nPrice, nDeductPercent, nMax, eMatchStatus = 'U', nAdminCommission, nCreatorCommission: nCreatorBonus } = league

      // If leagues are pool leagues
      if (league.bPoolPrize && Array.isArray(league.aLeaguePrize) && league.aLeaguePrize.length) {
        // for private +  pool prize
        if (league.bPrivateLeague) {
          const nACommission = ((nJoined * nAdminCommission) / nMax).toFixed(2)
          nAdminCommission = Number(nACommission)

          const nCBonus = ((nJoined * nCreatorBonus) / nMax).toFixed(2)
          nCreatorBonus = Number(nCBonus)

          const newTotalPayout = (nPrice * nJoined) - nAdminCommission - nCreatorBonus

          if (['L', 'I'].includes(eMatchStatus) && !league.bPrizeDone) league.nTotalPayout = newTotalPayout

          league.aLeaguePrize.map(
            ({ nPrize, nRankTo, nRankFrom }, i) => {
              league.aLeaguePrize[i].nPrize = Number((((league.nTotalPayout * nPrize) / 100) / (nRankTo - nRankFrom + 1)).toFixed(2))
            })
        } else {
          // for public +  pool prize
          league.nTotalPayout = getTotalPayoutForLeague(nJoined, nMin, nPrice, nDeductPercent, nMax, eMatchStatus)
          league.aLeaguePrize.map(
            ({ nPrize, nRankTo, nRankFrom }, i) => {
              league.aLeaguePrize[i].nPrize = Number((((league.nTotalPayout * nPrize) / 100) / (nRankTo - nRankFrom + 1)).toFixed(2))
            })
        }
      }
      result.push(league)
    })
  }
  return result
}

function checkValidImageType(sFileName, sContentType) {
  const extension = sFileName.split('.').pop().toLowerCase()
  const valid = imageFormat.find(format => format.extension === extension && format.type === sContentType)
  return !!valid
}

function searchValues(search) {
  let userQuery
  search = defaultSearch(search)
  if (isNaN(Number(search))) {
    userQuery = {
      $or: [
        { sName: { $regex: new RegExp('^.*' + search + '.*', 'i') } },
        { sUsername: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
      ]
    }
  } else {
    userQuery = {
      $or: [
        { sMobNum: { $regex: new RegExp('^.*' + search + '.*', 'i') } }
      ]
    }
  }
  return userQuery
}
const getMatchLeagueStatus = async (matchLeague, uniqueUserJoinCount) => {
  const { nMax, nMin, nJoined, bPoolPrize, bConfirmLeague, bPrivateLeague } = matchLeague

  if (bPrivateLeague) {
    if (bPoolPrize) {
      if (uniqueUserJoinCount < 2) {
        return 'PLAY_RETURN'
      } else {
        return 'LIVE'
      }
    } else {
      if (uniqueUserJoinCount >= 2 && nJoined >= nMax) {
        return 'LIVE'
      } else {
        return 'PLAY_RETURN'
      }
    }
  } else {
    if (bConfirmLeague || bPoolPrize) {
      if (uniqueUserJoinCount < 2 || nMin > nJoined) {
        return 'PLAY_RETURN'
      }
      return 'LIVE'
    } else {
      if (uniqueUserJoinCount < 2 || nJoined < nMax) {
        return 'PLAY_RETURN'
      } else {
        return 'LIVE'
      }
    }
  }
}

const randomBetween = (min, max) => Math.floor(Math.random() * max) + min

/**
 * To Sanitize Search String for Invalid Input.
 * @param {string} sString search string
 * @returns sanitized string
 */
const sanitizeString = (sString) => {
  return sString.replace(/<[^>]*>|[^a-zA-Z0-9,;\-.!?<> ]/g, '')
}
/**
 *
 * @param {Date} date
 * @returns formatted date in timeZone i.e 'Nov 23, 2022, 7:45 PM'
 */
const dateFormat = (date, locales = 'en-US', timeZone = 'Asia/Kolkata') => new Date(date).toLocaleString(locales, {
  timeZone,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric'
})

module.exports = {
  removenull,
  catchError,
  handleCatchError,
  pick,
  checkAlphanumeric,
  randomStr,
  capitalizeString,
  removeDuplicates,
  isUrl,
  isValidSportsType,
  defaultSearch,
  getPaginationValues,
  projectionFields,
  chunk,
  pushPayload,
  multiCastPushPayload,
  bunchMultiCastNotification,
  replaceText,
  encryption,
  isEmptyObject,
  changeObjectKey,
  sortArray,
  validateEmail,
  getPaginationValues2,
  getIp,
  validateMobile,
  validatePassword,
  getStatisticsSportsKey,
  UploadFromUrlToS3,
  validatePIN,
  removenullundefined,
  convertToDecimal,
  validateIFSC,
  formatDate,
  getUpdatedPrizeBreakupData,
  checkValidImageType,
  searchValues,
  getMatchLeagueStatus,
  randomBetween,
  sanitizeString,
  validateIndianNumber,
  reomveCountryCode,
  checkCountryCode,
  replaceSensitiveInfo,
  dateFormat
}
