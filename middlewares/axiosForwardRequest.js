const axios = require('axios')
const { catchError } = require('../helper/utilities.services')

const USE_NOTIFICATION_MICROSERVICE = true
/**
 * forward request completely
 * @param {*} req request object
 * @param {*} res response object
 * @param {*} next next function
 * @returns void
 */
const forwardRequest = (baseURL) => {
  console.log('NOTIFICATION MS:', baseURL, USE_NOTIFICATION_MICROSERVICE)
  return async (req, res, next) => {
    try {
      if (!USE_NOTIFICATION_MICROSERVICE) {
        // go to next function
        return next()
      }
      const { method, originalUrl, body, headers } = req
      const axiosRequest = await axios({
        baseURL,
        method,
        url: originalUrl,
        data: body,
        headers
      })
      // console.log(axiosRequest.data)
      res.send(axiosRequest.data)
    } catch (error) {
      console.log('forwardRequest error', error?.config?.url)
      if (error.isAxiosError && error.response) {
        res.status(error.response.status).send(error.response.data)
      } else {
        return catchError('Forward Request Error', error, req, res)
      }
    }
  }
}

module.exports = {
  forwardRequest
}
