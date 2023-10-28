const config = require('../config/config')
const { ANDROID_APP_DOWNLOAD_LINK, IOS_APP_DOWNLOAD_LINK } = require('../config/common')
const { smsProvider } = require('../data')
const { handleCatchError } = require('./utilities.services')
const axios = require('axios')

/**
 * to send otp to user from various providers
 * @param  {string} sProvider, SMS provider name
 * @param  {object} => {sPhone, sOTP}
 * sPhone= user's phone number, sOTP= OTP to send on it
 * @return {object} => {isSuccess, message}
 */
const sendOTPFromProvider = async (sProvider, oUser) => {
  try {
    if (!smsProvider.includes(sProvider)) throw new Error(`Provider ${sProvider} does not exist`)
    let data
    if (sProvider === 'MSG91') data = await msg91SendOrVerifyOTP('send', oUser)

    if (!data || !data.isSuccess) return { isSuccess: false }
    return data
  } catch (error) {
    handleCatchError(error)
  }
}

/**
 * to send otp to user from various providers
 * @param  {string} sProvider, SMS provider name
 * @param  {object} => {sPhone, sOTP}
 * sPhone= user's phone number, sOTP= OTP to send on it
 * @return {object} => {isSuccess, message}
 */
const verifyOTPFromProvider = async (sProvider, oUser) => {
  try {
    if (!smsProvider.includes(sProvider)) throw new Error(`Provider ${sProvider} does not exist`)
    let data

    if (sProvider === 'MSG91') data = await msg91SendOrVerifyOTP('verify', oUser)

    if (!data || !data.isSuccess) return { isSuccess: false }
    return data
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false }
  }
}

/**
 * to generate OTP code with dynamic length
 * @param  {number} nLength
 * @return {string} '1234'
 */
const generateOTP = (nLength) => {
  const digits = '0123456789'
  let OTP = ''
  for (let i = 0; i < nLength; i++) {
    OTP += digits[Math.floor(Math.random() * 10)]
  }
  if (Number(OTP).toString().length !== nLength) {
    return generateOTP(nLength)
  }
  return OTP
}

/**
 * to send or verify otp through MSG91 provider
 * @param  {string} sAction
 * @param  {object} => { sPhone, sOTP }
 * @return {object} => {isSuccess, message}
 */
async function msg91SendOrVerifyOTP(sAction = '', oUser) {
  try {
    const { sPhone, sOTP } = oUser
    if (!sPhone || !sOTP || !sAction) throw new Error('Invalid details')

    if (sAction === 'send') {
      try {
        const response = await axios.get('https://api.msg91.com/api/v5/otp', {
          params:
                  {
                    template_id: config.MSG91_TEMPLATE_ID,
                    mobile: `91${sPhone}`,
                    authkey: config.MSG91_AUTH_KEY,
                    otp: sOTP
                  }
        })
        if (!response || response.data.type !== 'success') return { isSuccess: false, message: response.data.message || response.data }
        return { isSuccess: true, message: 'OTP sent successfully!' }
      } catch (error) {
        handleCatchError(error)
      }
    } else if (sAction === 'verify') {
      try {
        const response = await axios.get('https://api.msg91.com/api/v5/otp/verify', {
          params:
                      {
                        mobile: `91${sPhone}`,
                        authkey: config.MSG91_AUTH_KEY,
                        otp: sOTP
                      }
        })
        if (!response || response.data.type !== 'success') return { isSuccess: false, message: response.data.message || response.data }

        const data = response.data && response.data.type === 'success'
          ? { isSuccess: true, message: 'OTP verified successfully!' }
          : { isSuccess: false, message: 'OTP verification failed!' }

        return data
      } catch (error) {
        handleCatchError(error)
      }
    } else {
      return { isSuccess: false, message: 'Invalid action!' }
    }
  } catch (error) {
    handleCatchError(error)
  }
}

async function sendDownLoadLink(oUser) {
  try {
    const { sPhone, ePlatform } = oUser
    if (!sPhone) throw new Error('Invalid details')

    try {
      const response = await axios.get('https://api.msg91.com/api/v5/flow/', {
        params:
        {
          flow_id: config.MSG91_FLOW_ID,
          sender: config.MSG91_SENDER_ID,
          short_url: '1',
          mobiles: sPhone,
          downloadlink: ePlatform === 'A' ? ANDROID_APP_DOWNLOAD_LINK : IOS_APP_DOWNLOAD_LINK
        }
      }, { headers: { 'content-type': 'application/json', authkey: config.MSG91_AUTH_KEY } })
      if (!response || response.data.type !== 'success') return { isSuccess: false, message: response.data.message || response.data }
      return { isSuccess: true, message: 'Download link sent successfully!' }
    } catch (error) {
      handleCatchError(error)
    }
  } catch (error) {
    handleCatchError(error)
  }
}
module.exports = {
  sendOTPFromProvider,
  verifyOTPFromProvider,
  generateOTP,
  sendDownLoadLink
}
