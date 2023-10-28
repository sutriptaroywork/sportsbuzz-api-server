const axios = require('axios')
const crypto = require('crypto')
const qs = require('querystring')
const UsersModel = require('../user/model')
const config = require('../../config/config')
const { catchError, pick, handleCatchError } = require('../../helper/utilities.services')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const UserDepositService = require('../userDeposit/services')
const BackendSDK = require('../../helper/third-party-cred/amazonPay/PWAINBackendSDK')
const IpnHandler = require('../../helper/third-party-cred/amazonPay/ipnhandler')
const { CASHFREE_ORDERID_PREFIX } = require('./../../config/common')
const PaymentOptionModel = require('../paymentOptions/model')
const { queuePush } = require('../../helper/redis')
const { getOrderPaymentStatus } = require('./common')
const UserDepositModel = require('../userDeposit/model')

const amazonConfig = {
  merchant_id: config.AMAZONPAY_MERCHANT_ID,
  access_key: config.AMAZONPAY_ACCESS_KEY,
  secret_key: config.AMAZONPAY_SECRET_KEY,
  base_url: 'amazonpay.amazon.in',
  sandbox: true
}
const client = new BackendSDK(amazonConfig)
const transactionLogQueue = require('../../rabbitmq/queue/transactionLogQueue')
class UserPayment {
  async createOrder(req, res) {
    try {
      const ePlatform = req.header('Platform')
      if (!ePlatform) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].fields_missing.replace('##', messages[req.userLanguage].cPlatformHeaders) })
      }
      if (!['A', 'I', 'W'].includes(ePlatform)) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cPlatformHeaders) })
      }

      const { eType, nAmount, sPromocode } = req.body
      const payload = { ePaymentGateway: eType, nAmount, sPromocode }

      const data = await PaymentOptionModel.countDocuments({ eKey: eType, bEnable: true })
      if (!data) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].error_with.replace('##', messages[req.userLanguage].cpaymentOption) })

      const iUserId = req.user._id.toString()
      const user = await UsersModel.findById(iUserId, { sEmail: 1, sMobNum: 1, bIsInternalAccount: 1, sName: 1, _id: 1, eType: 1 }).lean()
      if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

      req.user = user

      await UserDepositService.validateDepositRateLimit(iUserId, req.userLanguage)

      const { data: userDeposit } = await UserDepositService.createDeposit(payload, req.user)

      if (user.bIsInternalAccount === true) {
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].deposit_success, data: { bIsInternalUserDeposit: true } })
      }

      // Here,in iOrderId we are passing iOrderId to avoid conflicts in dev and stag env
      req.body.iOrderId = userDeposit.iOrderId
      user.sEmail = !user.sEmail ? config.CASHFREE_MAIL_DEFAULT_ACCOUNT : user.sEmail
      if (['CASHFREE', 'CASHFREE_UPI'].includes(eType)) {
        req.body = pick(req.body, ['iOrderId', 'nAmount'])
        const { iOrderId: orderId, nAmount: orderAmount } = req.body
        const cashFreePayload = {
          orderId: `${orderId}`,
          orderAmount: `${orderAmount}`,
          orderCurrency: 'INR',
          customerEmail: user.sEmail,
          customerPhone: user.sMobNum,
          returnUrl: `${config.DEPLOY_HOST_URL}/api/admin/payment/return-url/v1`,
          notifyUrl: `${config.DEPLOY_HOST_URL}/api/admin/payment/notify-url/v1`
        }
        if (['A', 'I'].includes(ePlatform)) delete cashFreePayload.returnUrl
        const response = await cashFreePayment(cashFreePayload, ePlatform)
        const { result = {} } = response

        const { orderId: iOrderId, orderAmount: nOrderAmount, orderCurrency: sOrderCurrency, customerEmail: sCustEmail, customerPhone: sCustPhone, notifyUrl: sNotifyUrl, returnUrl: sReturnUrl } = cashFreePayload

        const logData = { iUserId, iDepositId: userDeposit.id, iOrderId: userDeposit.iOrderId, ePlatform, eGateway: eType, eType: 'D', oBody: req.body, oReq: cashFreePayload, oRes: result }
        // await queuePush('TransactionLog', logData)
        transactionLogQueue.publish(logData)

        if (result.paymentLink || result.cftoken) {
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', `${(ePlatform === 'A' || ePlatform === 'I') ? messages[req.userLanguage].cCashFreePaymentToken : messages[req.userLanguage].cCashFreePaymentLink}`), data: { ...result, iOrderId, nOrderAmount, sOrderCurrency, sCustEmail, sCustName: user.sName, sCustPhone, sNotifyUrl, sReturnUrl } })
        }

        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].error_with.replace('##', `${(ePlatform === 'A' || ePlatform === 'I') ? messages[req.userLanguage].cCashFreePaymentToken : messages[req.userLanguage].cCashFreePaymentLink}`) })
      } else if (eType === 'AMAZON') {
        const { iOrderId, nAmount } = req.body

        if (ePlatform === 'W') {
          const payload = {
            sellerOrderId: `${iOrderId}`,
            orderTotalAmount: `${nAmount}`,
            orderTotalCurrencyCode: 'INR',
            isSandbox: true
          }

          // const returnUrl = `${config.DEPLOY_HOST_URL}/api/admin/payment/amazon-return-url/v1`
          const returnUrl = 'https://node.11wickets.com/node_application_public/post/payment/status/amazon'

          const amazonPayPaymentUrl = client.getProcessPaymentUrl(payload, returnUrl)
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cAmazonPaymentLink), data: { amazonPayPaymentUrl, iOrderId: iOrderId } })
        } else if (ePlatform === 'A' || ePlatform === 'I') {
          const responseMap = {
            sellerOrderId: `${iOrderId}`,
            orderTotalAmount: `${nAmount}`,
            orderTotalCurrencyCode: 'INR',
            operationName: 'SIGN_AND_ENCRYPT_GET_CHARGE_STATUS_REQUEST',
            isSandbox: true
          }

          const response = client.generateSignatureAndEncrypt(responseMap)
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cAmazonPaymentToken), data: { response, iOrderId: iOrderId } })
        }
      } else {
        return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cPaymentGateway) })
      }
    } catch (error) {
      const { status: errorStatus = '', message: errorMessage = '' } = error
      if (!errorStatus) { return catchError('UserPayment.create', error, req, res) }
      return res.status(errorStatus).jsonp({ status: errorStatus, message: errorMessage })
    }
  }

  async returnUrl(req, res) {
    try {
      const postData = req.body
      const { orderId, orderAmount, referenceId, txStatus, paymentMode, txMsg, txTime, signature } = postData

      const ePaymentGateway = 'CASHFREE'
      const iDepositId = (orderId && orderId.toString().includes(CASHFREE_ORDERID_PREFIX)) ? Number(orderId.toString().replaceAll(CASHFREE_ORDERID_PREFIX, '')) : Number(orderId)

      const logData = { iDepositId, iTransactionId: referenceId, eGateway: ePaymentGateway, eType: 'D', oReq: { sInfo: `${ePaymentGateway} payment gateway web-hook(v1) event called.` }, oRes: postData }
      // await queuePush('TransactionLog', logData)
      transactionLogQueue.publish(logData)

      const signatureData = orderId + orderAmount + referenceId + txStatus + paymentMode + txMsg + txTime

      if (!signatureData) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].action_success.replace('##', messages[req.userLanguage].cresponseGet) })

      const Hmac = crypto.createHmac('sha256', config.CASHFREE_SECRETKEY)
      const expectedSignature = Hmac.update(signatureData).digest('base64')

      if (signature !== expectedSignature) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].action_success.replace('##', messages[req.userLanguage].cresponseGet) })

      const { status: resStatus, message } = await UserDepositService.updateBalance(postData, ePaymentGateway)
      if (resStatus && message) return res.redirect(config.CASHFREE_RETURN_URL)
    } catch (error) {
      console.log('returnUrl :: ', req.body.orderId)
      return catchError('UserPayment.verify', error, req, res)
    }
  }

  async amazonReturnUrl(req, res) {
    try {
      const responseMap = {}

      for (const propName in req.query) {
        responseMap[propName] = req.query[propName]
      }

      const response = client.verifySignature(responseMap)
      if (response) {
        const ePaymentGateway = 'AMAZON'
        const { status, message } = await UserDepositService.updateBalance(response, ePaymentGateway)
        if (status && message) { return res.status(status).jsonp({ status, message }) }
      } else {
        // cancel
      }
    } catch (error) {
      return catchError('UserPayment.amazonReturnUrl', error, req, res)
    }
  }

  async verifyOrder(req, res) {
    try {
      const postData = req.body
      const { orderId, orderAmount, referenceId, txStatus, paymentMode, txMsg, txTime, signature } = postData

      const ePaymentGateway = 'CASHFREE'
      const iDepositId = (orderId && orderId.toString().includes(CASHFREE_ORDERID_PREFIX)) ? Number(orderId.toString().replaceAll(CASHFREE_ORDERID_PREFIX, '')) : Number(orderId)

      const logData = { iDepositId, iTransactionId: referenceId, eGateway: ePaymentGateway, eType: 'D', oReq: { sInfo: `${ePaymentGateway} payment gateway webhook(v1) event called.` }, oRes: postData }
      // await queuePush('TransactionLog', logData)
      transactionLogQueue.publish(logData)

      const signatureData = orderId + orderAmount + referenceId + txStatus + paymentMode + txMsg + txTime
      if (!signatureData) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].action_success.replace('##', messages[req.userLanguage].cresponseGet) })

      const Hmac = crypto.createHmac('sha256', config.CASHFREE_SECRETKEY)
      const expectedSignature = Hmac.update(signatureData).digest('base64')

      if (signature !== expectedSignature) return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].action_success.replace('##', messages[req.userLanguage].cresponseGet) })

      const { status: resStatus, message } = await UserDepositService.updateBalance(postData, ePaymentGateway)
      if (resStatus && message) return res.status(resStatus).jsonp({ status: resStatus, message })
    } catch (error) {
      return catchError('UserPayment.verify', error, req, res)
    }
  }

  async verifyAppPayment(req, res) {
    try {
      const postData = req.body
      const { orderId, orderAmount, referenceId, txStatus, paymentMode, txMsg, txTime, signature } = postData

      const ePaymentGateway = 'CASHFREE'
      const iDepositId = orderId.toString().includes(CASHFREE_ORDERID_PREFIX) ? Number(orderId.toString().replaceAll(CASHFREE_ORDERID_PREFIX, '')) : Number(orderId)

      const logData = { iDepositId, iTransactionId: referenceId, eGateway: ePaymentGateway, eType: 'D', oRes: postData }
      // await queuePush('TransactionLog', logData)
      transactionLogQueue.publish(logData)

      const Hmac = crypto.createHmac('sha256', config.CASHFREE_SECRETKEY)
      const signatureData = orderId + orderAmount + referenceId + txStatus + paymentMode + txMsg + txTime
      const expectedSignature = Hmac.update(signatureData).digest('base64')

      if (signature === expectedSignature) {
        const { status, message } = await UserDepositService.updateBalance(postData, ePaymentGateway)
        if (status && message) { return res.status(status).jsonp({ status, message }) }
      } else {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid_signature })
      }
    } catch (error) {
      return catchError('UserPayment.verifyPayment', error, req, res)
    }
  }

  async amazonPayWebhook(req, res) {
    try {
      if (req.headers['content-type'].includes('text/plain')) {
        req.body = JSON.parse(req.body.toString())
      }
      // eslint-disable-next-line no-unused-vars
      const ipn = new IpnHandler(req.body, async (error, result) => {
        if (result.SellerId === config.AMAZONPAY_MERCHANT_ID) {
          handleCatchError(error)
          if (result && result.NotificationType && result.NotificationType === 'OrderReferenceNotification' && result.NotificationData.ChargeTransactionNotification && result.NotificationData.ChargeTransactionNotification.ChargeTransactionDetails) {
            const chargeDetails = result.NotificationData.ChargeTransactionNotification.ChargeTransactionDetails
            const id = chargeDetails.SellerReferenceId

            console.log('***********************', id)
            if (chargeDetails.Status.State === 'Completed') {
              const ePaymentGateway = 'AMAZON'
              const { status, message } = await UserDepositService.updateBalance(chargeDetails, ePaymentGateway)
              if (status && message) { return res.status(status).jsonp({ status, message }) }
            } else {
              // CANCEL ORDER
            }
          }
        }
      })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].action_success.replace('##', messages[req.userLanguage].cresponseGet) })
    } catch (error) {
      return catchError('UserPayment.verify', error, req, res)
    }
  }

  async amazonPayChargeStatus(req, res) {
    try {
      const responseMap = {}

      for (const propName in req.query) {
        responseMap[propName] = req.query[propName]
      }
      responseMap.operationName = 'SIGN_AND_ENCRYPT_GET_CHARGE_STATUS_REQUEST'
      const response = client.generateSignatureAndEncrypt(responseMap)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cAmazonPayment), data: response })
    } catch (error) {
      return catchError('UserPayment.amazonPayChargeStatus', error, req, res)
    }
  }

  async amazonPayVerifySignature(req, res) {
    try {
      const responseMap = {}

      for (const propName in req.query) {
        responseMap[propName] = req.query[propName]
      }
      const response = client.verifySignature(responseMap)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cAmazonPayment), data: response })
    } catch (error) {
      return catchError('UserPayment.amazonPayVerifySignature', error, req, res)
    }
  }

  async amazonPayProcessCharge(req, res) {
    try {
      const responseMap = {}

      for (const propName in req.query) {
        responseMap[propName] = req.query[propName]
      }
      const response = client.generateSignatureAndEncrypt(responseMap)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cAmazonPayment), data: response })
    } catch (error) {
      return catchError('UserPayment.amazonPayProcessCharge', error, req, res)
    }
  }

  async generatePayment(req, res) {
    try {
      const ePlatform = req.header('Platform')
      if (!ePlatform) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].fields_missing.replace('##', messages[req.userLanguage].cPlatformHeaders) })
      }
      if (!['A', 'I', 'W'].includes(ePlatform)) {
        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].cPlatformHeaders) })
      }

      let { eType, nAmount, sPromocode } = req.body
      nAmount = Number(nAmount).toFixed(2)

      const payload = { ePaymentGateway: eType, nAmount, sPromocode, ePlatform }

      const data = await PaymentOptionModel.countDocuments({ eKey: eType, bEnable: true })
      if (!data) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].error_with.replace('##', messages[req.userLanguage].cpaymentOption) })

      const iUserId = req.user._id.toString()
      const user = await UsersModel.findOne({ _id: iUserId }, { sEmail: 1, sMobNum: 1, bIsInternalAccount: 1, sName: 1, _id: 1, eType: 1 }).lean()
      if (!user) return res.status(status.Unauthorized).jsonp({ status: jsonStatus.Unauthorized, message: messages[req.userLanguage].err_unauthorized })

      req.user = user

      await UserDepositService.validateDepositRateLimit(iUserId, req.userLanguage)

      const { data: userDeposit } = await UserDepositService.createDeposit(payload, req.user)

      if (user.bIsInternalAccount === true) {
        return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].deposit_success, data: { bIsInternalUserDeposit: true } })
      }

      // Here,in iOrderId we are passing iOrderId to avoid conflicts in dev and stag env
      req.body.iOrderId = userDeposit.iOrderId
      user.sEmail = !user.sEmail ? config.CASHFREE_MAIL_DEFAULT_ACCOUNT : user.sEmail
      if (['CASHFREE', 'CASHFREE_UPI'].includes(eType)) {
        req.body = pick(req.body, ['iOrderId', 'nAmount'])
        const { iOrderId: orderId, nAmount } = req.body
        let cashFreePayload
        const sNotifyUrl = `${config.DEPLOY_HOST_URL}/api/admin/payment/notify-url/v2`
        const sReturnUrl = ['A', 'I', 'W'].includes(ePlatform) ? `${config.DEPLOY_HOST_URL}/api/admin/payment/return-url/v2?order_id={order_id}` : `${config.DEPLOY_HOST_URL}/api/admin/payment/return-url/v2?link_id={link_id}`
        const iOrderId = ['A', 'I', 'W'].includes(ePlatform) ? `${orderId}` : undefined
        const nOrderAmount = nAmount
        const sOrderCurrency = 'INR'

        if (['A', 'I', 'W'].includes(ePlatform)) {
          cashFreePayload = {
            customer_details: {
              customer_id: user._id.toString(),
              customer_email: user.sEmail || 'user@sportsbuzz11.com',
              customer_phone: user.sMobNum
            },
            order_meta: {
              return_url: sReturnUrl,
              notify_url: sNotifyUrl
            },
            order_id: `${orderId}`,
            order_amount: nOrderAmount,
            order_currency: sOrderCurrency
          }
          if (['A', 'I'].includes(ePlatform)) delete cashFreePayload.order_meta.return_url
        } else {
          cashFreePayload = {
            customer_details: {
              customer_phone: user.sMobNum
            },
            link_notify: {
              send_sms: true
            },
            link_meta: {
              notify_url: sNotifyUrl,
              return_url: sReturnUrl
            },
            link_id: `${orderId}`,
            link_amount: nOrderAmount,
            link_currency: sOrderCurrency,
            link_purpose: 'Payment for Deposit'
          }
          if (eType === 'CASHFREE_UPI') cashFreePayload.link_meta.upi_intent = true
        }
        const response = await cashFreePaymentV2(cashFreePayload, ePlatform)
        const { result = {} } = response

        // const { customer_details: oCustomer, order_meta: { notify_url: sNotifyUrl, return_url: sReturnUrl }, order_id: iOrderId, order_amount: nOrderAmount, order_currency: sOrderCurrency } = cashFreePayload
        const { customer_details: oCustomer } = cashFreePayload
        const { customer_id: sCustId, customer_email: sCustEmail, customer_phone: sCustPhone } = oCustomer

        const logData = { iUserId, iDepositId: userDeposit.id, iOrderId: userDeposit.iOrderId, ePlatform, eGateway: eType, eType: 'D', oBody: req.body, oReq: cashFreePayload, oRes: result }
        // await queuePush('TransactionLog', logData)
        transactionLogQueue.publish(logData)

        if (result.link_url || result.payment_session_id) {
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', `${(ePlatform === 'A' || ePlatform === 'I') ? messages[req.userLanguage].cCashFreePaymentToken : messages[req.userLanguage].cCashFreePaymentLink}`), data: { ...result, cf_order_id: null, iOrderId, nOrderAmount, sOrderCurrency, sCustId, sCustEmail, sCustName: user.sName, sCustPhone, sNotifyUrl, sReturnUrl } })
        }

        return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].error_with.replace('##', `${(ePlatform === 'A' || ePlatform === 'I') ? messages[req.userLanguage].cCashFreePaymentToken : messages[req.userLanguage].cCashFreePaymentLink}`) })
      } else if (eType === 'AMAZON') {
        const { iOrderId, nAmount } = req.body

        if (ePlatform === 'W') {
          const payload = {
            sellerOrderId: `${iOrderId}`,
            orderTotalAmount: `${nAmount}`,
            orderTotalCurrencyCode: 'INR',
            isSandbox: true
          }

          // const returnUrl = `${config.DEPLOY_HOST_URL}/api/admin/payment/amazon-return-url/v1`
          const returnUrl = 'https://node.11wickets.com/node_application_public/post/payment/status/amazon'

          const amazonPayPaymentUrl = client.getProcessPaymentUrl(payload, returnUrl)
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cAmazonPaymentLink), data: { amazonPayPaymentUrl, iOrderId: iOrderId } })
        } else if (ePlatform === 'A' || ePlatform === 'I') {
          const responseMap = {
            sellerOrderId: `${iOrderId}`,
            orderTotalAmount: `${nAmount}`,
            orderTotalCurrencyCode: 'INR',
            operationName: 'SIGN_AND_ENCRYPT_GET_CHARGE_STATUS_REQUEST',
            isSandbox: true
          }

          const response = client.generateSignatureAndEncrypt(responseMap)
          return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cAmazonPaymentToken), data: { response, iOrderId: iOrderId } })
        }
      } else {
        return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cPaymentGateway) })
      }
    } catch (error) {
      const { status: errorStatus = '', message: errorMessage = '' } = error
      if (!errorStatus) { return catchError('UserPayment.create', error, req, res) }
      return res.status(errorStatus).jsonp({ status: errorStatus, message: errorMessage })
    }
  }

  async verifyOrderV2(req, res) {
    try {
      const postData = req.body
      const { data = {} } = postData
      if (!data) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].error })
      const { order = '', payment = '' } = data
      // console.log({ postData })
      const { order_id: orderId = '' } = order
      const { payment_status: paymentStatus, cf_payment_id: iTransactionId } = payment

      const oDeposit = await UserDepositModel.findOne({ where: { iOrderId: orderId }, order: [['id', 'DESC']], raw: true })
      if (!oDeposit) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_found.replace('##', messages[req.userLanguage].cDeposit) })

      const logData = { iDepositId: oDeposit.id || '', iOrderId: oDeposit.iOrderId || orderId, iTransactionId, eGateway: oDeposit.ePaymentGateway, eType: 'D', oReq: { sInfo: `${oDeposit.ePaymentGateway} payment gateway webhook(v2) event called.` }, oRes: postData }
      // await queuePush('TransactionLog', logData)
      transactionLogQueue.publish(logData)

      const updateData = { txStatus: (paymentStatus === 'USER_DROPPED') ? 'FAILED' : paymentStatus, orderId, referenceId: iTransactionId }
      const { status: resStatus, message } = await UserDepositService.updateBalance(updateData, oDeposit.ePaymentGateway)
      if (resStatus && message) return res.status(resStatus).jsonp({ status: resStatus, message })
    } catch (error) {
      return catchError('UserPayment.verifyOrderV2', error, req, res)
    }
  }

  async returnUrlV2(req, res) {
    try {
      const postData = req.query
      console.log('returnUrlV2 req.query ', req.query)
      const orderId = postData.link_id ? postData.link_id : postData.order_id

      // const ePaymentGateway = 'CASHFREE'

      const oDeposit = await UserDepositModel.findOne({ where: { iOrderId: orderId }, order: [['id', 'DESC']], raw: true })
      if (oDeposit.ePaymentStatus === 'S') return res.redirect(config.CASHFREE_RETURN_URL)

      const logData = { iDepositId: oDeposit.id, iOrderId: oDeposit.iOrderId || orderId, eGateway: oDeposit.ePaymentGateway, eType: 'D', oReq: { sInfo: `${oDeposit.ePaymentGateway} payment gateway web-hook(v2) event called.` }, oRes: postData }
      // await queuePush('TransactionLog', logData)
      transactionLogQueue.publish(logData)

      const response = await getOrderPaymentStatus({ iDepositId: oDeposit.id, orderId })

      const { isSuccess, result = {} } = response

      if (isSuccess) {
        const postData = { txStatus: result.order_status, orderId, referenceId: result.cf_order_id }
        const { status: resStatus, message } = await UserDepositService.updateBalance(postData, oDeposit.ePaymentGateway)
        if (resStatus && message) {
          if (['A', 'I'].includes(oDeposit?.ePlatform)) {
            config.CASHFREE_RETURN_URL = undefined
            // return res.redirect(config.CASHFREE_RETURN_URL)
          }
          return res.redirect(config.CASHFREE_RETURN_URL)
        }
      } else {
        return res.redirect(config.CASHFREE_RETURN_URL)
      }
    } catch (error) {
      return catchError('UserPayment.returnUrlV2', error, req, res)
    }
  }
}

function cashFreePayment(payload, ePlatform) {
  return new Promise((resolve, reject) => {
    if (ePlatform === 'A' || ePlatform === 'I') {
      axios.post(`${config.CASHFREE_URL}/api/v2/cftoken/order`, JSON.stringify(payload), { headers: { 'Content-Type': 'application/json', 'x-client-id': config.CASHFREE_APPID, 'x-client-secret': config.CASHFREE_SECRETKEY } })
        .then(res => {
          resolve({ result: res ? res.data : '' })
        })
        .catch(err => {
          const res = { status: err.response.status, message: err.response.data }
          reject(res)
        })
    } else {
      payload.appId = config.CASHFREE_APPID
      payload.secretKey = config.CASHFREE_SECRETKEY
      axios.post(`${config.CASHFREE_URL}/api/v1/order/create`, qs.stringify(payload), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
        .then(res => {
          resolve({ result: res ? res.data : '' })
        })
        .catch(err => {
          const res = { status: err.response.status, message: err.response.data }
          reject(res)
        })
    }
  })
}

// Cashfree v3 stable API used.
function cashFreePaymentV2(payload, ePlatform) {
  return new Promise((resolve, reject) => {
    if (['A', 'I', 'W'].includes(ePlatform)) {
      return axios.post(`${config.CASHFREE_STABLE_URL}/orders`, JSON.stringify(payload), { headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'x-client-id': config.CASHFREE_APPID, 'x-client-secret': config.CASHFREE_SECRETKEY, 'x-api-version': '2022-09-01' } })
        .then(res => resolve({ result: res ? res.data : '' }))
        .catch(err => {
          const res = { status: err.response.status, message: err.response.data }
          reject(res)
        })
    } else {
      return axios.post(`${config.CASHFREE_STABLE_URL}/links`, JSON.stringify(payload), { headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'x-client-id': config.CASHFREE_APPID, 'x-client-secret': config.CASHFREE_SECRETKEY, 'x-api-version': '2022-09-01' } })
        .then(res => resolve({ result: res ? res.data : '' }))
        .catch(err => {
          const res = { status: err.response.status, message: err.response.data }
          reject(res)
        })
    }
  })
}

module.exports = new UserPayment()
