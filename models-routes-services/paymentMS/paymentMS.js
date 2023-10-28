/* eslint-disable camelcase */
const axios = require('axios')
const config = require('../../config/config')
const { catchError } = require('../../helper/utilities.services')
const { messages, jsonStatus } = require('../../helper/api.responses')

const { paymentGetaways } = require('../../data')
const { JUSPAY_ENUMS } = require('../../enums/juspayEnums/juspayEnums')
const UserDepositService = require('../userDeposit/services')
const UserDepositModel = require('../userDeposit/model')

class PaymentMicroservice {
  async generatePayment(req, res) {
    try {
      const { nAmount, sPromocode, eType = 'CASHFREE' } = req.body
      const payload = {
        nAmount,
        sPromocode,
        eType
      }
      console.log('user generate payment :', req.user)
      const { data } = await axios.post(`${config.SB11_BACKEND_MS_PAYMENT_SERVICE}/payment/create`, payload, { headers: { 'Content-Type': 'application/json', Language: 'en', user: JSON.stringify(req.user), userlanguage: req.userLanguage || 'English', Platform: req.header('Platform') } })
      return res.status(jsonStatus.OK).jsonp({ data })
    } catch (error) {
      const { status: errorStatus = '', message: errorMessage = '' } =
            error
      if (!errorStatus) {
        return catchError('UserPayment.create.redirect', error, req, res)
      }
      return res
        .status(errorStatus)
        .jsonp({ status: errorStatus, message: errorMessage })
    }
  }

  async juspayDepositWebhook(req, res) {
    try {
      console.log('juspay webhook capture :', req.body)
      const juspayPayload = req.body

      if (juspayPayload.event_name !== JUSPAY_ENUMS.ORDER_SUCCEEDED) {
        return res.status(jsonStatus.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages.English.error })
      }
      const { order_id, status } = juspayPayload.content.order.txn_detail
      const oDeposit = await UserDepositModel.findOne({
        where: { iOrderId: order_id },
        order: [['id', 'DESC']],
        raw: true
      })
      if (oDeposit.ePaymentStatus === 'S') {
        return res
          .status(jsonStatus.OK)
          .jsonp({ status: jsonStatus.OK, message: messages.English.action_success.replace('##', 'Deposit') })
      }
      const postData = {
        txStatus: status,
        orderId: order_id,
        referenceId: order_id
      }
      const { status: resStatus, message } =
        await UserDepositService.updateBalance(
          postData,
          paymentGetaways.JUSPAY
        )
      if (resStatus && message) {
        if (['A', 'I'].includes(oDeposit?.ePlatform)) {
          return res.status(resStatus).jsonp({ status: resStatus, message })
        }
        return res.status(resStatus).jsonp({ status: resStatus, message })
      }
    } catch (error) {
      return catchError('Juspay.deposit.webhook', error, req, res)
    }
  }

  async juspayDepositWebhookRedirect(req, res) {
    try {
      console.log('juspay webhook capture :', req.body)
      const { data } = await axios.post(`${config.SB11_BACKEND_MS_PAYMENT_SERVICE}/payment/deposit/juspay-webhook`, { ...req.body })
      return res.status(jsonStatus.Create).jsonp(data)
    } catch (error) {
      return catchError('Juspay.deposit.webhook', error, req, res)
    }
  }

  async checkUserDepositStatusRedirect(req, res) {
    try {
      const iUserId = req.user._id.toString()
      const { id: iOrderId } = req.params
      const { gateway } = req.query

      if (gateway === 'JUSPAY') {
        const { data } = await axios.get(`${config.SB11_BACKEND_MS_PAYMENT_SERVICE}/payment/getOrderStatus/order/${iOrderId}`)
        return res.status(jsonStatus.OK).jsonp(data)
      } else if (gateway === 'CASHFREE') {
        const { data } = await axios.get(`${config.SB11_BACKEND_MS_PAYMENT_SERVICE}/payment/user/${iUserId}/deposit/${iOrderId}`)
        return res.status(jsonStatus.OK).jsonp(data)
      }
    } catch (error) {
      return catchError('UserDeposit.checkUserDepositStatusRedirect', error, req, res)
    }
  }

  async getGSTBreakUp(req, res) {
    try {
      const iUserId = req.user._id.toString()
      const { data } = await axios.post(`${config.SB11_BACKEND_MS_PAYMENT_SERVICE}/payment/gst/gst-breakup`, { ...req.body, iUserId })
      return res.status(jsonStatus.Create).jsonp(data)
    } catch (error) {
      return catchError('UserDeposit.checkGSTBreakUp', error, req, res)
    }
  }
}
module.exports = new PaymentMicroservice()
