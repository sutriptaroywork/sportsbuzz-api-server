const jwt = require('jsonwebtoken')
const UsersModel = require('../model')
const KycModel = require('../../kyc/model')
const OTPVerificationsModel = require('../otpverifications.model')
const UserSessionModel = require('../userSession.model')
const PreferencesModel = require('../../preferences/model')
const commonRuleServices = require('../../commonRules/services')
const userBalanceServices = require('../../userBalance/services')
const { genDynamicLinkV2 } = require('../../../helper/firebase.services')
const { blackListToken, getRateLimitStatus, checkRateLimitOTP, queuePush, getOTPExpiryStatus } = require('../../../helper/redis')
const axios = require('axios')
const {
  messages,
  status,
  jsonStatus
} = require('../../../helper/api.responses')
const verifier = require('../../../helper/truecaller.services')
const {
  removenull,
  catchError,
  pick,
  checkAlphanumeric,
  randomStr,
  validateEmail,
  getIp,
  validatePassword,
  handleCatchError,
  validateIndianNumber,
  checkCountryCode
} = require('../../../helper/utilities.services')
const config = require('../../../config/config')
const common = require('../../../config/common')
const bcrypt = require('bcryptjs')
const { subscribeUser } = require('../../../helper/firebase.services')
const { OAuth2Client } = require('google-auth-library')
const client = new OAuth2Client(config.GOOGLE_CLIENT_ID_W)
const { testCasesDefault } = require('../../../config/testCases.js')
const cachegoose = require('recachegoose')
const { UsersDBConnect } = require('../../../database/mongoose')
const {
  generateOTP,
  verifyOTPFromProvider,
  sendDownLoadLink
} = require('../../../helper/sms.services')
const mongoose = require('mongoose')
const { SUPER_USER_MOBILE_ENUMS, SUPER_USER_STATIC_OTP } = require('../../../enums/superUserMobileEnums/superUserMobileEnums')
const ObjectId = mongoose.Types.ObjectId
const saltRounds = 1
const salt = bcrypt.genSaltSync(saltRounds)
const { OTP_VERIFICATION_PLATFORM_ENUMS, OTP_VERIFICATION_TYPE_ENUMS } = require('../../../enums/otpVerificationTypeEnums/otpVerificationTypeEnums')
const { USER_TYPE_ENUMS } = require('../../../enums/UserTypeEnums/UserTypeEnums')
const { ENV_TYPE_ENUMS } = require('../../../enums/enviromentTypeEnums/enviromentTypeEnums')
const { PLATFORM_ENUMS } = require('../../../enums/platformEnums/platformEnums')
const userAuthLogQueue = require('../../../rabbitmq/queue/userAuthLogQueue')
class UserAuth {
  // deprecated
  async register(req, res) {
    try {
      req.body = pick(req.body, [
        'sName',
        'sUsername',
        'sEmail',
        'sReferCode',
        'sCode',
        'sMobNum',
        'sPassword',
        'sDeviceToken',
        'sSocialType',
        'sSocialToken',
        'sPushToken'
      ])
      removenull(req.body)

      const {
        sEmail,
        sUsername,
        sMobNum,
        sDeviceToken,
        sName,
        sCode,
        sReferCode,
        sPassword,
        sSocialType,
        sSocialToken,
        sPushToken
      } = req.body
      let oSocial
      let sSocialId
      if (sSocialType && sSocialToken) {
        // Social signup with Google process
        if (sSocialType === 'G') {
          const ticket = await client.verifyIdToken({
            idToken: sSocialToken,
            audience: [config.GOOGLE_CLIENT_ID_W]
          })
          const payload = ticket.getPayload()

          const googleRes = await axios.get(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${sSocialToken}`
          )

          if (payload.sub !== googleRes.data.sub) {
            return res.status(status.BadRequest).jsonp({
              status: jsonStatus.BadRequest,
              message: messages[req.userLanguage].social_auth_failed
            })
          }

          if (googleRes.data.email !== sEmail) {
            return res.status(status.BadRequest).jsonp({
              status: jsonStatus.BadRequest,
              message: messages[req.userLanguage].social_email_error
            })
          }

          sSocialId = googleRes.data.sub
          oSocial = {
            sType: 'G',
            sId: sSocialId,
            sToken: sSocialToken
          }
        } else if (sSocialType === 'F') {
          // Social signup with Facebook process
          const fbRes = await axios.get(
            `https://graph.facebook.com/v3.2/me?access_token=${sSocialToken}&debug=all&fields=id,name,first_name,last_name,email&format=json&method=get&pretty=1`
          )

          if (!fbRes || (fbRes && !fbRes.data.id)) {
            return res.status(status.BadRequest).jsonp({
              status: jsonStatus.BadRequest,
              message: messages[req.userLanguage].social_auth_failed
            })
          }

          if (fbRes.data.email !== sEmail) {
            return res.status(status.BadRequest).jsonp({
              status: jsonStatus.BadRequest,
              message: messages[req.userLanguage].social_email_error
            })
          }

          sSocialId = fbRes.data.id
          oSocial = {
            sType: 'F',
            sId: sSocialId,
            sToken: sSocialToken
          }
        }
      }

      if (oSocial) {
        const socialUser = await UsersModel.findOne(
          { 'oSocial.sId': sSocialId },
          null
        ).lean()
        if (socialUser) {
          return res.status(status.ResourceExist).jsonp({
            status: jsonStatus.ResourceExist,
            message: messages[req.userLanguage].already_exist.replace(
              '##',
              messages[req.userLanguage].user
            )
          })
        }
        req.body.oSocial = oSocial
        req.body.bIsEmailVerified = true
      }

      if (!checkAlphanumeric(sUsername)) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].must_alpha_num
        })
      }
      if (sUsername.length < 5 || sUsername.length > 15) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].invalid.replace(
            '##',
            messages[req.userLanguage].username
          )
        })
      }

      if (sMobNum.length !== 10) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].invalid.replace(
            '##',
            messages[req.userLanguage].mobileNumber
          )
        })
      }
      if (sPassword.length < 5) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].invalid.replace(
            '##',
            messages[req.userLanguage].ssPassword
          )
        })
      }

      const userExist = await UsersModel.findOne(
        { $or: [{ sEmail }, { sMobNum }, { sUsername }] },
        null,
        { readPreference: 'primary' }
      )
      if (userExist && userExist.eType === 'B') {
        return res.status(status.NotFound).jsonp({
          status: jsonStatus.NotFound,
          message: messages[req.userLanguage].user_blocked
        })
      }
      if (userExist && userExist.sUsername === sUsername) {
        return res.status(status.ResourceExist).jsonp({
          status: jsonStatus.ResourceExist,
          message: messages[req.userLanguage].already_exist.replace(
            '##',
            messages[req.userLanguage].username
          )
        })
      }
      if (userExist && userExist.sMobNum === sMobNum) {
        return res.status(status.ResourceExist).jsonp({
          status: jsonStatus.ResourceExist,
          message: messages[req.userLanguage].already_exist.replace(
            '##',
            messages[req.userLanguage].mobileNumber
          )
        })
      }
      if (userExist && userExist.sEmail === sEmail) {
        return res.status(status.ResourceExist).jsonp({
          status: jsonStatus.ResourceExist,
          message: messages[req.userLanguage].already_exist.replace(
            '##',
            messages[req.userLanguage].email
          )
        })
      }

      const isOTPExist = await OTPVerificationsModel.findOne(
        { sLogin: sMobNum, sType: 'M', sAuth: 'R', sCode, bIsVerify: true },
        null,
        { readPreference: 'primary' }
      ).sort({ dCreatedAt: -1 })

      if (!isOTPExist || isOTPExist.sCode !== parseInt(sCode)) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].cotpVerification) }) }

      // If sReferCode is invalid
      let referredBy
      if (sReferCode) {
        referredBy = await UsersModel.findOne({ sReferCode: sReferCode }).lean()
        if (!referredBy) {
          return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].enter_valid_referral_code })
        }
      }

      req.body.bIsMobVerified = true

      const transactionOptions = {
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' }
      }

      const session = await UsersDBConnect.startSession()
      session.startTransaction(transactionOptions)

      let iUserId, eUserType
      try {
        const pp = bcrypt.hashSync(req.body.sPassword, salt)
        const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform'))
          ? req.header('Platform')
          : 'O'
        let user = await UsersModel.create(
          [
            {
              ...req.body,
              sUsername,
              sPassword: pp,
              sReferCode: '',
              ePlatform
            }
          ],
          { session }
        )

        if (Array.isArray(user)) {
          user = user[0]
        }

        iUserId = user._id
        eUserType = user.eType
        await KycModel.create([{ iUserId: user._id }], { session })

        const newToken = {
          sToken: jwt.sign(
            { _id: user._id.toHexString(), eType: user.eType },
            config.JWT_SECRET,
            { expiresIn: config.JWT_VALIDITY }
          )
        }

        user.aJwtTokens.push(newToken)

        const openAccount = await userBalanceServices.openAccount({
          iUserId: user._id,
          sUsername,
          eType: user.eType
        })

        if (openAccount.isSuccess === false) {
          throw new Error(
            messages[req.userLanguage].went_wrong_with.replace(
              '##',
              messages[req.userLanguage].cpassbook
            )
          )
        }

        await PreferencesModel.create([{ iUserId: user._id }], { session })

        let registerReferBonus
        let referCodeBonus
        let registerBonus
        if (referredBy) {
          console.log("I'm Here")
          user.iReferredBy = referredBy._id

          registerReferBonus = await commonRuleServices.findRule('RR')
          referCodeBonus = await commonRuleServices.findRule('RCB')

          // We'll give refer reward from whom refer code through new user registered
          if (registerReferBonus) {
            const { sRewardOn = '' } = registerReferBonus
            if (sRewardOn) {
              if (sRewardOn === 'REGISTER') {
                const refer = await userBalanceServices.referBonus({
                  iUserId: referredBy._id,
                  rule: registerReferBonus,
                  sReferCode: referredBy.sReferCode,
                  sUserName: referredBy.sUsername,
                  eType: referredBy.eType,
                  nReferrals: 1,
                  iReferById: user._id
                })

                if (refer.isSuccess === false) {
                  throw new Error(
                    messages[req.userLanguage].went_wrong_with.replace(
                      '##',
                      messages[req.userLanguage].bonus
                    )
                  )
                }

                // Add Push Notification
                await queuePush('pushNotification:registerReferBonus', {
                  _id: user._id
                })
              }
              user.sReferrerRewardsOn = sRewardOn
            }
          }
          // We'll give refer code bonus to new user because they participate in referral code program
          if (referCodeBonus) {
            const refer = await userBalanceServices.referBonus({
              iUserId: user._id,
              rule: referCodeBonus,
              sReferCode: referredBy.sReferCode,
              sUserName: user.sUsername,
              eType: user.eType
            })
            // const refer = await userBalanceServices.referAddBonus({ iUserId: user._id, rule: referCodeBonus, sReferCode: referredBy.sReferCode, sUserName: user.sUsername, eType: user.eType })

            if (refer.isSuccess === false) {
              throw new Error(
                messages[req.userLanguage].went_wrong_with.replace(
                  '##',
                  messages[req.userLanguage].bonus
                )
              )
            }
            // Add Push Notification
            await queuePush('pushNotification:referCodeBonus', {
              _id: user._id
            })
          }
        } else {
          // We'll give register bonus to all new user who don't register with refer code.
          registerBonus = await commonRuleServices.findRule('RB')
          if (registerBonus) {
            const refer = await userBalanceServices.referBonus({
              iUserId: user._id,
              rule: registerBonus,
              sReferCode: user.sReferCode,
              sUserName: user.sUsername,
              eType: user.eType
            })
            if (refer.isSuccess === false) {
              throw new Error(
                messages[req.userLanguage].went_wrong_with.replace(
                  '##',
                  messages[req.userLanguage].bonus
                )
              )
            }
            // Add Push Notification
            await queuePush('pushNotification:registerBonus', {
              _id: user._id
            })
          }
        }

        user.sReferCode = await genReferCode(sName || sUsername)
        user.sReferLink = await genDynamicLinkV2('share', user.sReferCode)

        await UsersModel.updateOne(
          { _id: ObjectId(user._id) },
          {
            sReferCode: user.sReferCode,
            sReferLink: user.sReferLink,
            sReferrerRewardsOn: user.sReferrerRewardsOn,
            aJwtTokens: user.aJwtTokens,
            iReferredBy: user.iReferredBy
          },
          { session }
        )

        const sFullName = sName ? sName.split(' ') : sUsername

        if (sPushToken) {
          await subscribeUser(sPushToken, ePlatform)
        }

        const logData = { iUserId: user._id, ePlatform, eType: 'R', sDeviceToken, sIpAddress: getIp(req) }
        userAuthLogQueue.publish(logData)
        // await queuePush('AuthLogs', {
        //   iUserId: user._id,
        //   ePlatform,
        //   eType: 'R',
        //   sDeviceToken,
        //   sIpAddress: getIp(req)
        // })
        // To send welcome mail to new user
        await queuePush('SendMail', {
          sSlug: 'welcome-email',
          replaceData: {
            firstName: sFullName[0],
            lastName: sFullName[1] || ''
          },
          to: sEmail
        })

        // need to check
        // await queuePush('SendSms', {
        //   sMobNum
        // })

        await session.commitTransaction()

        UsersModel.filterData(user)

        return res
          .status(status.OK)
          .set('Authorization', newToken.sToken)
          .jsonp({
            status: jsonStatus.OK,
            message: messages[req.userLanguage].reg_success,
            data: user,
            Authorization: newToken.sToken
          })
      } catch (err) {
        if (iUserId && eUserType) {
          await userBalanceServices.revertOpenedAccount({
            iUserId,
            eType: eUserType
          })
        }
        await session.abortTransaction()
        return catchError('UserAuth.register', err, req, res)
      } finally {
        session.endSession()
      }
    } catch (error) {
      return catchError('UserAuth.register', error, req, res)
    }
  }

  async registerV4(req, res) {
    try {
      req.body = pick(req.body, [
        'sName',
        'sUsername',
        'sEmail',
        'sReferCode',
        'sCode',
        'sMobNum',
        'sPassword',
        'sDeviceToken',
        'sSocialType',
        'sSocialToken',
        'sPushToken'
      ])
      removenull(req.body)

      const {
        sEmail,
        sUsername,
        sMobNum,
        sDeviceToken,
        sName,
        sCode,
        sReferCode,
        sPassword,
        sSocialType,
        sSocialToken,
        sPushToken
      } = req.body

      let oSocial
      let sSocialId
      if (sSocialType && sSocialToken) {
        // Social signup with Google process
        if (sSocialType === 'G') {
          const ticket = await client.verifyIdToken({
            idToken: sSocialToken,
            audience: [config.GOOGLE_CLIENT_ID_W]
          })
          const payload = ticket.getPayload()

          const googleRes = await axios.get(
            `https://oauth2.googleapis.com/tokeninfo?id_token=${sSocialToken}`
          )

          if (payload.sub !== googleRes.data.sub) {
            return res.status(status.BadRequest).jsonp({
              status: jsonStatus.BadRequest,
              message: messages[req.userLanguage].social_auth_failed
            })
          }

          if (googleRes.data.email !== sEmail) {
            return res.status(status.BadRequest).jsonp({
              status: jsonStatus.BadRequest,
              message: messages[req.userLanguage].social_email_error
            })
          }

          sSocialId = googleRes.data.sub
          oSocial = {
            sType: 'G',
            sId: sSocialId,
            sToken: sSocialToken
          }
        } else if (sSocialType === 'F') {
          // Social signup with Facebook process
          const fbRes = await axios.get(
            `https://graph.facebook.com/v3.2/me?access_token=${sSocialToken}&debug=all&fields=id,name,first_name,last_name,email&format=json&method=get&pretty=1`
          )

          if (!fbRes || (fbRes && !fbRes.data.id)) {
            return res.status(status.BadRequest).jsonp({
              status: jsonStatus.BadRequest,
              message: messages[req.userLanguage].social_auth_failed
            })
          }

          if (fbRes.data.email !== sEmail) {
            return res.status(status.BadRequest).jsonp({
              status: jsonStatus.BadRequest,
              message: messages[req.userLanguage].social_email_error
            })
          }

          sSocialId = fbRes.data.id
          oSocial = {
            sType: 'F',
            sId: sSocialId,
            sToken: sSocialToken
          }
        }
      }

      if (oSocial) {
        const socialUser = await UsersModel.findOne(
          { 'oSocial.sId': sSocialId },
          null
        ).lean()
        if (socialUser) {
          return res.status(status.ResourceExist).jsonp({
            status: jsonStatus.ResourceExist,
            message: messages[req.userLanguage].already_exist.replace(
              '##',
              messages[req.userLanguage].user
            )
          })
        }
        req.body.oSocial = oSocial
        req.body.bIsEmailVerified = true
      }

      if (!checkAlphanumeric(sUsername)) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].must_alpha_num
        })
      }
      if (sUsername.length < 5 || sUsername.length > 15) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].invalid.replace(
            '##',
            messages[req.userLanguage].username
          )
        })
      }

      if (sMobNum.length !== 10) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].invalid.replace(
            '##',
            messages[req.userLanguage].mobileNumber
          )
        })
      }

      if (!validatePassword(sPassword)) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].invalid_pass
        })
      }

      const userExist = await UsersModel.findOne(
        { $or: [{ sEmail }, { sMobNum }, { sUsername }] },
        null,
        { readPreference: 'primary' }
      )
      if (userExist && userExist.eType === 'B') {
        return res.status(status.NotFound).jsonp({
          status: jsonStatus.NotFound,
          message: messages[req.userLanguage].user_blocked
        })
      }
      if (userExist && userExist.sUsername === sUsername) {
        return res.status(status.ResourceExist).jsonp({
          status: jsonStatus.ResourceExist,
          message: messages[req.userLanguage].already_exist.replace(
            '##',
            messages[req.userLanguage].username
          )
        })
      }
      if (userExist && userExist.sMobNum === sMobNum) {
        return res.status(status.ResourceExist).jsonp({
          status: jsonStatus.ResourceExist,
          message: messages[req.userLanguage].already_exist.replace(
            '##',
            messages[req.userLanguage].mobileNumber
          )
        })
      }
      if (userExist && userExist.sEmail === sEmail) {
        return res.status(status.ResourceExist).jsonp({
          status: jsonStatus.ResourceExist,
          message: messages[req.userLanguage].already_exist.replace(
            '##',
            messages[req.userLanguage].email
          )
        })
      }

      const isOTPExist = await OTPVerificationsModel.findOne(
        { sLogin: sMobNum, sType: 'M', sAuth: 'R', sCode, bIsVerify: true },
        null,
        { readPreference: 'primary' }
      ).sort({ dCreatedAt: -1 })

      if (!isOTPExist || isOTPExist.sCode !== parseInt(sCode)) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].went_wrong_with.replace(
            '##',
            messages[req.userLanguage].cotpVerification
          )
        })
      }
      // If sReferCode is invalid
      let referredBy
      if (sReferCode) {
        referredBy = await UsersModel.findOne({ sReferCode: sReferCode }).lean()
        if (!referredBy) {
          return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].enter_valid_referral_code })
        }
      }
      req.body.bIsMobVerified = true

      const transactionOptions = {
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' }
      }

      const session = await UsersDBConnect.startSession()
      session.startTransaction(transactionOptions)

      let iUserId, eUserType
      try {
        const pp = bcrypt.hashSync(req.body.sPassword, salt)
        const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform'))
          ? req.header('Platform')
          : 'O'
        let user = await UsersModel.create(
          [
            {
              ...req.body,
              sUsername,
              sPassword: pp,
              sReferCode: '',
              ePlatform
            }
          ],
          { session }
        )

        if (Array.isArray(user)) {
          user = user[0]
        }

        await KycModel.create([{ iUserId: user._id }], { session })

        const newToken = {
          sToken: jwt.sign(
            { _id: user._id.toHexString(), eType: user.eType },
            config.JWT_SECRET,
            { expiresIn: config.JWT_VALIDITY }
          ),
          sPushToken
        }

        iUserId = user._id
        eUserType = user.eType
        user.aJwtTokens.push(newToken)

        const openAccount = await userBalanceServices.openAccount({
          iUserId: user._id,
          sUsername,
          eType: user.eType
        })

        if (openAccount.isSuccess === false) {
          throw new Error(
            messages[req.userLanguage].went_wrong_with.replace(
              '##',
              messages[req.userLanguage].cpassbook
            )
          )
        }

        await PreferencesModel.create([{ iUserId: user._id }], { session })

        let registerReferBonus
        let referCodeBonus
        let registerBonus

        if (referredBy) {
          user.iReferredBy = referredBy._id

          registerReferBonus = await commonRuleServices.findRule('RR')
          referCodeBonus = await commonRuleServices.findRule('RCB')

          // We'll give refer reward from whom refer code through new user registered
          if (registerReferBonus) {
            const { sRewardOn = '' } = registerReferBonus
            if (sRewardOn) {
              if (sRewardOn === 'REGISTER') {
                const refer = await userBalanceServices.referBonus({
                  iUserId: referredBy._id,
                  rule: registerReferBonus,
                  sReferCode: referredBy.sReferCode,
                  sUserName: referredBy.sUsername,
                  eType: referredBy.eType,
                  nReferrals: 1,
                  iReferById: user._id
                })

                if (refer.isSuccess === false) {
                  throw new Error(
                    messages[req.userLanguage].went_wrong_with.replace(
                      '##',
                      messages[req.userLanguage].bonus
                    )
                  )
                }

                // Add Push Notification
                await queuePush('pushNotification:registerReferBonus', {
                  _id: user._id
                })
              }
              user.sReferrerRewardsOn = sRewardOn
            }
          }
          // We'll give refer code bonus to new user because they participate in referral code program
          if (referCodeBonus) {
            const refer = await userBalanceServices.referBonus({
              iUserId: user._id,
              rule: referCodeBonus,
              sReferCode: referredBy.sReferCode,
              sUserName: user.sUsername,
              eType: user.eType
            })
            // const refer = await userBalanceServices.referAddBonus({ iUserId: user._id, rule: referCodeBonus, sReferCode: referredBy.sReferCode, sUserName: user.sUsername, eType: user.eType })

            if (refer.isSuccess === false) {
              throw new Error(
                messages[req.userLanguage].went_wrong_with.replace(
                  '##',
                  messages[req.userLanguage].bonus
                )
              )
            }
            // Add Push Notification
            await queuePush('pushNotification:referCodeBonus', {
              _id: user._id
            })
          }
        } else {
          // We'll give register bonus to all new user who don't register with refer code.
          registerBonus = await commonRuleServices.findRule('RB')
          const refer = await userBalanceServices.referBonus({
            iUserId: user._id,
            rule: registerBonus,
            sReferCode: user.sReferCode,
            sUserName: user.sUsername,
            eType: user.eType
          })

          if (refer.isSuccess === false) {
            throw new Error(
              messages[req.userLanguage].went_wrong_with.replace(
                '##',
                messages[req.userLanguage].bonus
              )
            )
          }
          // Add Push Notification
          await queuePush('pushNotification:registerBonus', { _id: user._id })
        }

        user.sReferCode = await genReferCode(sName || sUsername)

        user.sReferLink = await genDynamicLinkV2('share', user.sReferCode)

        await UsersModel.updateOne(
          { _id: ObjectId(user._id) },
          {
            sReferCode: user.sReferCode,
            sReferLink: user.sReferLink,
            sReferrerRewardsOn: user.sReferrerRewardsOn,
            aJwtTokens: user.aJwtTokens,
            iReferredBy: user.iReferredBy
          },
          { session }
        )

        const sFullName = sName ? sName.split(' ') : sUsername

        if (sPushToken) {
          await subscribeUser(sPushToken, ePlatform)
        }

        const logData = { iUserId: user._id, ePlatform, eType: 'R', sDeviceToken, sIpAddress: getIp(req) }
        userAuthLogQueue.publish(logData)
        // await queuePush('AuthLogs', {
        //   iUserId: user._id,
        //   ePlatform,
        //   eType: 'R',
        //   sDeviceToken,
        //   sIpAddress: getIp(req)
        // })
        // To send welcome mail to new user
        await queuePush('SendMail', {
          sSlug: 'welcome-email',
          replaceData: {
            firstName: sFullName[0],
            lastName: sFullName[1] || ''
          },
          to: sEmail
        })

        // need to check
        // await queuePush('SendSms', {
        //   sMobNum
        // })

        await session.commitTransaction()

        UsersModel.filterData(user)

        return res
          .status(status.OK)
          .set('Authorization', newToken.sToken)
          .jsonp({
            status: jsonStatus.OK,
            message: messages[req.userLanguage].reg_success,
            data: user,
            Authorization: newToken.sToken
          })
      } catch (err) {
        if (iUserId && eUserType) {
          await userBalanceServices.revertOpenedAccount({
            iUserId,
            eType: eUserType
          })
        }
        await session.abortTransaction()
        return catchError('UserAuth.register', err, req, res)
      } finally {
        session.endSession()
      }
    } catch (error) {
      return catchError('UserAuth.registerV4', error, req, res)
    }
  }

  async login(req, res) {
    try {
      req.body = pick(req.body, [
        'sLogin',
        'sPassword',
        'sPushToken',
        'sDeviceToken'
      ])
      removenull(req.body)

      let { sLogin, sPushToken, sPassword, sDeviceToken } = req.body
      sLogin = sLogin.toLowerCase().trim()

      const isEmail = await validateEmail(sLogin)
      const query = isEmail ? { sEmail: sLogin } : { sMobNum: sLogin }
      const user = await UsersModel.findOne(query).lean()

      // If user not found or user is blocked or (System)Bot user then we'll give 404 error
      if (!user) {
        return res.status(status.NotFound).jsonp({
          status: jsonStatus.NotFound,
          message: messages[req.userLanguage].auth_failed
        })
      }
      if (user.eStatus === 'N' || user.eType === 'B') {
        return res.status(status.NotFound).jsonp({
          status: jsonStatus.NotFound,
          message: messages[req.userLanguage].user_blocked
        })
      }

      if (!bcrypt.compareSync(sPassword, user.sPassword)) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].auth_failed
        })
      }

      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform'))
        ? req.header('Platform')
        : 'O'

      const systemData = [
        '7878787878',
        'superuser@gmail.com',
        '7676767676',
        'internaluser@gmail.com'
      ]

      const isLoginVerify = user.aDeviceToken.some(
        (deviceToken) => deviceToken === sDeviceToken
      )
      if (!isLoginVerify && sDeviceToken && !systemData.includes(sLogin)) {
        const sCode = config.DEFAULT_OTP
        await OTPVerificationsModel.updateMany(
          { sLogin: sLogin, sType: sType, sAuth: sAuth },
          { $set: { bIsVerify: true } }
        )
        await OTPVerificationsModel.create({
          sLogin,
          sCode,
          sType: isEmail ? 'E' : 'M',
          sAuth: 'L',
          sDeviceToken,
          iUserId: user._id
        })
        return res.status(status.OK).jsonp({
          status: jsonStatus.OK,
          message: messages[req.userLanguage].OTP_sent_succ,
          data: { nOtpSend: true }
        })
      }
      const newToken = {
        sToken: jwt.sign(
          { _id: user._id.toHexString(), eType: user.eType },
          config.JWT_SECRET,
          { expiresIn: config.JWT_VALIDITY }
        ),
        sPushToken
      }

      // User can login in LOGIN_HARD_LIMIT time.
      // for e.g. LOGIN_HARD_LIMIT=5 -> User can login only for 5 times, After that we'll remove first login token from db.
      if (
        user.aJwtTokens.length < config.LOGIN_HARD_LIMIT ||
        config.LOGIN_HARD_LIMIT === 0
      ) {
        user.aJwtTokens.push(newToken)
      } else {
        const removedToken = user.aJwtTokens.splice(0, 1)
        cachegoose.clearCache(`at:${removedToken}`)
        user.aJwtTokens.push(newToken)
      }

      const dLoginAt = new Date()

      // If user allow for push notification then we'll store push notification token in db
      if (sPushToken) {
        subscribeUser(sPushToken, ePlatform)
      }

      const logData = { iUserId: user._id, ePlatform, eType: 'L', sDeviceToken, sIpAddress: getIp(req) }
      userAuthLogQueue.publish(logData)
      // await queuePush('AuthLogs', {
      //   iUserId: user._id,
      //   ePlatform,
      //   eType: 'L',
      //   sDeviceToken,
      //   sIpAddress: getIp(req)
      // })

      await UsersModel.updateOne(
        { _id: ObjectId(user._id) },
        { aJwtTokens: user.aJwtTokens, dLoginAt }
      )
      UsersModel.filterData(user)

      return res.status(status.OK).set('Authorization', newToken.sToken).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].succ_login,
        data: user,
        Authorization: newToken.sToken
      })
    } catch (error) {
      return catchError('UserAuth.login', error, req, res)
    }
  }

  async sendOTP(req, res) {
    try {
      req.body = pick(req.body, ['sLogin', 'sType', 'sAuth'])
      removenull(req.body)

      const { sLogin, sType, sAuth } = req.body
      let sUsername = ''

      if (sAuth === 'R' || sAuth === 'F') {
        const isEmail = await validateEmail(sLogin)
        const query = isEmail ? { sEmail: sLogin } : { sMobNum: sLogin }
        const user = await UsersModel.findOne(query, null, {
          readPreference: 'primary'
        }).lean()

        // Bot user not allowed to send otp.
        if (user && user.eType === 'B') {
          return res.status(status.NotFound).jsonp({
            status: jsonStatus.NotFound,
            message: messages[req.userLanguage].user_blocked
          })
        }
        if (user && sAuth === 'R') {
          return res.status(status.ResourceExist).jsonp({
            status: jsonStatus.ResourceExist,
            message: messages[req.userLanguage].already_exist.replace(
              '##',
              messages[req.userLanguage].user
            )
          })
        }

        if (!user && sAuth === 'F') {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].user_forgot_err
          })
        }
        sUsername = user ? user.sUsername : ''
      }

      if (sAuth === 'V') {
        if (!req.header('Authorization')) {
          return res.status(status.Unauthorized).jsonp({
            status: jsonStatus.Unauthorized,
            message: messages[req.userLanguage].err_unauthorized
          })
        }

        const user = await UsersModel.findByToken(req.header('Authorization'))
        if (!user) {
          return res.status(status.Unauthorized).jsonp({
            status: jsonStatus.Unauthorized,
            message: messages[req.userLanguage].err_unauthorized
          })
        }

        // Internal user not able to change mobile no. or email id
        if (user && user.bIsInternalAccount === true) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].cant_change_mobile_email
          })
        }

        const isEmail = await validateEmail(sLogin)
        const query = isEmail ? { sEmail: sLogin } : { sMobNum: sLogin }
        query._id = { $ne: user._id }
        query.eType = { $ne: 'B' }

        const userExist = await UsersModel.findOne(query, null, {
          readPreference: 'primary'
        })
        if (userExist) {
          return res.status(status.ResourceExist).jsonp({
            status: jsonStatus.ResourceExist,
            message: messages[req.userLanguage].already_exist.replace(
              '##',
              messages[req.userLanguage].user
            )
          })
        }
        sUsername = user.sUsername
      }

      // In production, we'll only allow user to re-send otp after 30 seconds time.
      if (process.env.NODE_ENV === 'production') {
        var d = new Date()
        d.setSeconds(d.getSeconds() - 30)
        const exist = await OTPVerificationsModel.findOne(
          { ...req.body, dCreatedAt: { $gt: d } },
          null,
          { readPreference: 'primary' }
        ).sort({ dCreatedAt: -1 })

        if (exist) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].err_resend_otp.replace(
              '##',
              messages[req.userLanguage].nThirty
            )
          })
        }
      }

      // check rate limit for otp sending from same ip at multiple time. we'll make sure not too many request from same ip will occurs.
      const rateLimit = await checkRateLimitOTP(sLogin, sType, sAuth)
      if (rateLimit === 'LIMIT_REACHED') {
        return res.status(status.TooManyRequest).jsonp({
          status: jsonStatus.TooManyRequest,
          message: messages[req.userLanguage].limit_reached.replace(
            '##',
            messages[req.userLanguage].cotp
          )
        })
      }
      let sCode = config.DEFAULT_OTP
      if (
        ['production', 'staging'].includes(process.env.NODE_ENV) &&
        config.OTP_PROVIDER !== 'TEST'
      ) { sCode = generateOTP(config.OTP_LENGTH) }
      await OTPVerificationsModel.updateMany(
        { sLogin: sLogin, sType: sType, sAuth: sAuth },
        { $set: { bIsVerify: true } }
      )
      await OTPVerificationsModel.create({ ...req.body, sCode })

      // Send mail for forgot password otp code
      if (sType === 'E') {
        await queuePush('SendMail', {
          sSlug: 'forgot-password-email',
          replaceData: {
            email: sUsername,
            otp: sCode,
            from: config.SMTP_FROM
          },
          to: sLogin
        })
      }
      if (
        sType === 'M' &&
        ['production', 'staging'].includes(process.env.NODE_ENV) &&
        config.OTP_PROVIDER !== 'TEST'
      ) {
        await queuePush('sendSms', {
          sProvider: config.OTP_PROVIDER,
          oUser: {
            sPhone: sLogin,
            sOTP: sCode
          }
        })
      }
      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].OTP_sent_succ
      })
    } catch (error) {
      return catchError('UserAuth.sendOTP', error, req, res)
    }
  }

  /**
   * This is deprecated service, no longer in used.
   */
  async verifyOTP(req, res) {
    try {
      let { sLogin, sType, sAuth, sCode, sDeviceToken } = req.body

      if (sAuth === 'L') {
        req.body = pick(req.body, [
          'sLogin',
          'sType',
          'sAuth',
          'sCode',
          'sDeviceToken'
        ])
      } else req.body = pick(req.body, ['sLogin', 'sType', 'sAuth', 'sCode'])

      removenull(req.body)

      sCode = parseInt(sCode)
      if (typeof sCode !== 'number') {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].verify_otp_err
        })
      }

      if (sAuth === 'L' && !sDeviceToken) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].required.replace(
            '##',
            messages[req.userLanguage].cdeviceToken
          )
        })
      }

      const exist = await OTPVerificationsModel.findOne(
        { ...req.body, bIsVerify: false },
        null,
        { readPreference: 'primary' }
      )
        .sort({ dCreatedAt: -1 })
        .lean()
      if (!exist || exist.sCode !== sCode) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].verify_otp_err
        })
      }

      if (sAuth === 'V') {
        if (!req.header('Authorization')) {
          return res.status(status.Unauthorized).jsonp({
            status: jsonStatus.Unauthorized,
            message: messages[req.userLanguage].err_unauthorized
          })
        }

        const user = await UsersModel.findByToken(req.header('Authorization'))

        if (!user) {
          return res.status(status.Unauthorized).jsonp({
            status: jsonStatus.Unauthorized,
            message: messages[req.userLanguage].err_unauthorized
          })
        }

        if (user.bIsInternalAccount === true) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].cant_change_mobile_email
          })
        }

        const isEmail = await validateEmail(sLogin)
        const query = isEmail ? { sEmail: sLogin } : { sMobNum: sLogin }
        query._id = { $ne: user._id }
        query.eType = { $ne: 'B' }

        const userExist = await UsersModel.findOne(query, null, {
          readPreference: 'primary'
        }).lean()
        if (userExist) {
          return res.status(status.ResourceExist).jsonp({
            status: jsonStatus.ResourceExist,
            message: messages[req.userLanguage].already_exist.replace(
              '##',
              messages[req.userLanguage].user
            )
          })
        }

        if (sType === 'E') {
          await UsersModel.updateOne(
            { _id: ObjectId(user._id) },
            { sEmail: sLogin, bIsEmailVerified: true }
          )
        } else if (sType === 'M') {
          await UsersModel.updateOne(
            { _id: ObjectId(user._id) },
            { sMobNum: sLogin, bIsMobVerified: true }
          )
        }
      }

      const user = await OTPVerificationsModel.findByIdAndUpdate(
        exist._id,
        { bIsVerify: true },
        { runValidators: true, readPreference: 'primary' }
      ).lean()

      if (user) {
        await UsersModel.updateOne(
          { _id: ObjectId(user._id) },
          { $addToSet: { aDeviceToken: sDeviceToken } }
        )
      }

      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].verification_success
      })
    } catch (error) {
      return catchError('UserAuth.verifyOTP', error, req, res)
    }
  }

  async verifyOTPV2(req, res) {
    try {
      let { sLogin, sType, sAuth, sCode, sDeviceToken, sPushToken } = req.body

      if (sAuth === 'L') {
        req.body = pick(req.body, [
          'sLogin',
          'sType',
          'sAuth',
          'sCode',
          'sDeviceToken'
        ])
      } else req.body = pick(req.body, ['sLogin', 'sType', 'sAuth', 'sCode'])

      removenull(req.body)

      sCode = parseInt(sCode)
      if (typeof sCode !== 'number') {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].verify_otp_err
        })
      }

      if (sAuth === 'L' && !sDeviceToken) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].required.replace(
            '##',
            messages[req.userLanguage].cdeviceToken
          )
        })
      }

      // check rate limit for otp verify from same ip at multiple time. we'll make sure not too many request from same ip will occurs.
      if (['production', 'staging'].includes(process.env.NODE_ENV)) {
        const rateLimit = await checkRateLimitOTP(sLogin, sType, `${sAuth}-V`)
        // if (rateLimit === 'LIMIT_REACHED') return res.status(status.TooManyRequest).jsonp({ status: jsonStatus.TooManyRequest, message: messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].cotpVerification) })
        if (rateLimit === 'LIMIT_REACHED') {
          return res.status(status.TooManyRequest).jsonp({
            status: jsonStatus.TooManyRequest,
            message: messages[req.userLanguage].otp_limit_reached
          })
        }
      }

      const exist = await OTPVerificationsModel.findOne(
        { ...req.body, bIsVerify: false },
        null,
        { readPreference: 'primary' }
      )
        .sort({ dCreatedAt: -1 })
        .lean()
      if (!exist || exist.sCode !== sCode) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].verify_otp_err
        })
      }

      if (
        sType === 'M' &&
        ['production', 'staging'].includes(process.env.NODE_ENV) &&
        config.OTP_PROVIDER !== 'TEST'
      ) {
        const verifyFromProvider = await verifyOTPFromProvider(
          config.OTP_PROVIDER,
          { sPhone: sLogin, sOTP: sCode }
        )
        if (!verifyFromProvider || !verifyFromProvider.isSuccess) {
          return res.status(status.Unauthorized).jsonp({
            status: jsonStatus.Unauthorized,
            message: messages[req.userLanguage].err_unauthorized
          })
        }
      }

      if (sAuth === 'V') {
        if (!req.header('Authorization')) {
          return res.status(status.Unauthorized).jsonp({
            status: jsonStatus.Unauthorized,
            message: messages[req.userLanguage].err_unauthorized
          })
        }

        const user = await UsersModel.findByToken(req.header('Authorization'))

        if (!user) {
          return res.status(status.Unauthorized).jsonp({
            status: jsonStatus.Unauthorized,
            message: messages[req.userLanguage].err_unauthorized
          })
        }

        if (user.bIsInternalAccount === true) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].cant_change_mobile_email
          })
        }

        const isEmail = await validateEmail(sLogin)
        const query = isEmail ? { sEmail: sLogin } : { sMobNum: sLogin }
        query._id = { $ne: user._id }
        query.eType = { $ne: 'B' }

        const userExist = await UsersModel.findOne(query, null, {
          readPreference: 'primary'
        }).lean()
        if (userExist) {
          return res.status(status.ResourceExist).jsonp({
            status: jsonStatus.ResourceExist,
            message: messages[req.userLanguage].already_exist.replace(
              '##',
              messages[req.userLanguage].user
            )
          })
        }

        if (sType === 'E') {
          await UsersModel.updateOne(
            { _id: ObjectId(user._id) },
            { sEmail: sLogin, bIsEmailVerified: true }
          )
        } else if (sType === 'M') {
          await UsersModel.updateOne(
            { _id: ObjectId(user._id) },
            { sMobNum: sLogin, bIsMobVerified: true }
          )
        }
      }
      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform'))
        ? req.header('Platform')
        : 'O'

      const user = await OTPVerificationsModel.findByIdAndUpdate(
        exist._id,
        { bIsVerify: true },
        { runValidators: true, readPreference: 'primary' }
      ).lean()

      if (user) {
        await UsersModel.updateOne(
          { _id: ObjectId(user.iUserId) },
          { $addToSet: { aDeviceToken: sDeviceToken } }
        )
      }

      if (sAuth === 'L') {
        const userDetails = await UsersModel.findById(user.iUserId, null, {
          readPreference: 'primary'
        }).lean()

        const newToken = {
          sToken: jwt.sign(
            { _id: userDetails._id.toHexString(), eType: user.eType },
            config.JWT_SECRET,
            { expiresIn: config.JWT_VALIDITY }
          ),
          sPushToken
        }

        if (
          userDetails.aJwtTokens.length < config.LOGIN_HARD_LIMIT ||
          config.LOGIN_HARD_LIMIT === 0
        ) {
          userDetails.aJwtTokens.push(newToken)
        } else {
          const removedToken = userDetails.aJwtTokens.splice(0, 1)
          cachegoose.clearCache(`at:${removedToken}`)
          userDetails.aJwtTokens.push(newToken)
        }

        await UsersModel.updateOne(
          { _id: ObjectId(userDetails._id) },
          { aJwtTokens: userDetails.aJwtTokens, dLoginAt: new Date() }
        )

        const logData = { iUserId: userDetails._id, ePlatform, eType: 'L', sDeviceToken, sIpAddress: getIp(req) }
        userAuthLogQueue.publish(logData)
        // await queuePush('AuthLogs', {
        //   iUserId: userDetails._id,
        //   ePlatform,
        //   eType: 'L',
        //   sDeviceToken,
        //   sIpAddress: getIp(req)
        // })

        if (sPushToken) {
          await subscribeUser(sPushToken, ePlatform)
        }
        UsersModel.filterData(userDetails)

        return res
          .status(status.OK)
          .set('Authorization', newToken.sToken)
          .jsonp({
            status: jsonStatus.OK,
            message: messages[req.userLanguage].verification_success,
            data: userDetails,
            Authorization: newToken.sToken
          })
      }
      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].verification_success
      })
    } catch (error) {
      return catchError('UserAuth.verifyOTPV2', error, req, res)
    }
  }

  // deprecated
  async resetPassword(req, res) {
    try {
      req.body = pick(req.body, [
        'sLogin',
        'sType',
        'sAuth',
        'sCode',
        'sNewPassword'
      ])
      removenull(req.body)

      let { sLogin, sType, sAuth, sCode, sNewPassword } = req.body

      sCode = parseInt(sCode)
      if (typeof sCode !== 'number') {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].verify_otp_err
        })
      }

      const exist = await OTPVerificationsModel.findOne(
        { sLogin, sType, sAuth, sCode, bIsVerify: true },
        null,
        { readPreference: 'primary' }
      ).sort({ dCreatedAt: -1 })
      if (!exist || exist.sCode !== sCode) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].verify_otp_err
        })
      }

      const isEmail = await validateEmail(sLogin)
      const query = isEmail ? { sEmail: sLogin } : { sMobNum: sLogin }

      const user = await UsersModel.findOne(query).lean()

      // Bot user and Blocked user can't reset password.
      if (user.eType === 'B') {
        return res.status(status.NotFound).jsonp({
          status: jsonStatus.NotFound,
          message: messages[req.userLanguage].user_blocked
        })
      }
      if (!user) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].not_exist.replace(
            '##',
            messages[req.userLanguage].user
          )
        })
      }

      if (user && user.eStatus === 'B') {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].block_user_err
        })
      }

      await UsersModel.updateOne(
        { _id: ObjectId(user._id) },
        { aJwtTokens: [], sPassword: bcrypt.hashSync(sNewPassword, salt) }
      )
      await exist.remove()

      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform'))
        ? req.header('Platform')
        : 'O'

      const logData = { iUserId: user._id, ePlatform, eType: 'RP', sIpAddress: getIp(req) }
      userAuthLogQueue.publish(logData)
      // await queuePush('AuthLogs', {
      //   iUserId: user._id,
      //   ePlatform,
      //   eType: 'RP',
      //   sIpAddress: getIp(req)
      // })

      // send mail for reset password
      if (sType === 'E') {
        await queuePush('SendMail', {
          sSlug: 'reset-password-email',
          replaceData: {
            sName: user.sName,
            from: config.SMTP_FROM
          },
          to: sLogin
        })
      }

      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].reset_pass_succ
      })
    } catch (error) {
      return catchError('UserAuth.resetPassword', error, req, res)
    }
  }

  async resetPasswordV3(req, res) {
    try {
      req.body = pick(req.body, [
        'sLogin',
        'sType',
        'sAuth',
        'sCode',
        'sNewPassword'
      ])
      removenull(req.body)

      let { sLogin, sType, sAuth, sCode, sNewPassword } = req.body

      sCode = parseInt(sCode)
      if (typeof sCode !== 'number') {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].verify_otp_err
        })
      }

      const exist = await OTPVerificationsModel.findOne(
        { sLogin, sType, sAuth, sCode, bIsVerify: true },
        null,
        { readPreference: 'primary' }
      ).sort({ dCreatedAt: -1 })
      if (!exist || exist.sCode !== sCode) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].verify_otp_err
        })
      }

      if (!validatePassword(sNewPassword)) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].invalid_pass
        })
      }

      const isEmail = await validateEmail(sLogin)
      const query = isEmail ? { sEmail: sLogin } : { sMobNum: sLogin }

      const user = await UsersModel.findOne(query).lean()

      // Bot user and Blocked user can't reset password.
      if (user.eType === 'B') {
        return res.status(status.NotFound).jsonp({
          status: jsonStatus.NotFound,
          message: messages[req.userLanguage].user_blocked
        })
      }
      if (!user) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].not_exist.replace(
            '##',
            messages[req.userLanguage].user
          )
        })
      }

      if (user && user.eStatus === 'B') {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].block_user_err
        })
      }

      await UsersModel.updateOne(
        { _id: ObjectId(user._id) },
        { aJwtTokens: [], sPassword: bcrypt.hashSync(sNewPassword, salt) }
      )
      await exist.remove()

      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform'))
        ? req.header('Platform')
        : 'O'
      const logData = { iUserId: user._id, ePlatform, eType: 'RP', sIpAddress: getIp(req) }
      userAuthLogQueue.publish(logData)
      // await queuePush('AuthLogs', {
      //   iUserId: user._id,
      //   ePlatform,
      //   eType: 'RP',
      //   sIpAddress: getIp(req)
      // })

      // send mail for reset password
      if (sType === 'E') {
        await queuePush('SendMail', {
          sSlug: 'reset-password-email',
          replaceData: {
            sName: user.sName,
            from: config.SMTP_FROM
          },
          to: sLogin
        })
      }

      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].reset_pass_succ
      })
    } catch (error) {
      return catchError('UserAuth.resetPasswordV3', error, req, res)
    }
  }

  async changePassword(req, res) {
    try {
      req.body = pick(req.body, ['sOldPassword', 'sNewPassword'])
      removenull(req.body)

      const { sOldPassword, sNewPassword } = req.body
      const user = await UsersModel.findById(req.user._id).lean()

      if (!bcrypt.compareSync(sOldPassword, user.sPassword)) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].wrong_old_field
        })
      }
      if (sOldPassword === sNewPassword) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].old_new_field_same.replace(
            '##',
            messages[req.userLanguage].sField
          )
        })
      }

      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform'))
        ? req.header('Platform')
        : 'O'

      await UsersModel.updateOne(
        { _id: ObjectId(user._id) },
        {
          dPasswordchangeAt: new Date(),
          sPassword: bcrypt.hashSync(sNewPassword, salt)
        }
      )

      const logData = { iUserId: user._id, ePlatform, eType: 'PC', sIpAddress: getIp(req) }
      userAuthLogQueue.publish(logData)
      // await queuePush('AuthLogs', {
      //   iUserId: user._id,
      //   ePlatform,
      //   eType: 'PC',
      //   sIpAddress: getIp(req)
      // })

      if (user.sEmail) {
        await queuePush('SendMail', {
          sSlug: 'change-password-email',
          replaceData: {
            sName: user.sName,
            from: config.SMTP_FROM
          },
          to: user.sEmail
        })
      }

      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].update_success.replace(
          '##',
          messages[req.userLanguage].password
        )
      })
    } catch (error) {
      return catchError('UserAuth.changePassword', error, req, res)
    }
  }

  async changePasswordV3(req, res) {
    try {
      req.body = pick(req.body, ['sOldPassword', 'sNewPassword'])
      removenull(req.body)

      const { sOldPassword, sNewPassword } = req.body
      const user = await UsersModel.findById(req.user._id).lean()

      if (!bcrypt.compareSync(sOldPassword, user.sPassword)) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].wrong_old_field
        })
      }
      if (sOldPassword === sNewPassword) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].old_new_field_same.replace(
            '##',
            messages[req.userLanguage].sField
          )
        })
      }

      if (!validatePassword(sNewPassword)) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].invalid_pass
        })
      }

      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform'))
        ? req.header('Platform')
        : 'O'

      await UsersModel.updateOne(
        { _id: ObjectId(user._id) },
        {
          dPasswordchangeAt: new Date(),
          sPassword: bcrypt.hashSync(sNewPassword, salt)
        }
      )

      const logData = { iUserId: user._id, ePlatform, eType: 'PC', sIpAddress: getIp(req) }
      userAuthLogQueue.publish(logData)
      // await queuePush('AuthLogs', {
      //   iUserId: user._id,
      //   ePlatform,
      //   eType: 'PC',
      //   sIpAddress: getIp(req)
      // })

      if (user.sEmail) {
        await queuePush('SendMail', {
          sSlug: 'change-password-email',
          replaceData: {
            sName: user.sName,
            from: config.SMTP_FROM
          },
          to: user.sEmail
        })
      }

      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].update_success.replace(
          '##',
          messages[req.userLanguage].password
        )
      })
    } catch (error) {
      return catchError('UserAuth.changePasswordV3', error, req, res)
    }
  }

  async logout(req, res) {
    try {
      const sToken = req.header('Authorization')
      await UsersModel.updateOne(
        { _id: ObjectId(req.user._id) },
        { $pull: { aJwtTokens: { sToken } } }
      )
      blackListToken(sToken)
      // await redisClient.del(`at:${req.header('Authorization')}`)
      cachegoose.clearCache(`at:${sToken}`)
      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].succ_logout
      })
    } catch (error) {
      return catchError('UserAuth.logout', error, req, res)
    }
  }

  async checkExist(req, res) {
    try {
      const { sType, sValue } = req.body
      let exist
      let existVal
      if (sType === 'E') {
        exist = await UsersModel.findOne(
          { sEmail: sValue },
          {},
          { readPreference: 'primary' }
        ).lean()
        existVal = 'Email'
      } else if (sType === 'M') {
        exist = await UsersModel.findOne(
          { sMobNum: sValue },
          {},
          { readPreference: 'primary' }
        ).lean()
        existVal = 'Mobile number'
      } else if (sType === 'U') {
        exist = await UsersModel.findOne(
          { sUsername: sValue },
          {},
          { readPreference: 'primary' }
        ).lean()
        existVal = 'Username'
      } else {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].went_wrong_with.replace(
            '##',
            messages[req.userLanguage].type
          )
        })
      }
      if (exist) {
        if (exist.eType === 'B') {
          return res.status(status.NotFound).jsonp({
            status: jsonStatus.NotFound,
            message: messages[req.userLanguage].user_blocked
          })
        }
        return res.status(status.ResourceExist).jsonp({
          status: jsonStatus.ResourceExist,
          message: messages[req.userLanguage].already_exist.replace(
            '##',
            existVal
          )
        })
      } else {
        return res.status(status.OK).jsonp({
          status: jsonStatus.OK,
          message: messages[req.userLanguage].not_exist.replace('##', existVal)
        })
      }
    } catch (error) {
      return catchError('UserAuth.checkExist', error, req, res)
    }
  }

  async checkExistence(req, res) {
    try {
      const {
        sUsername: sUserName,
        sEmail: sEmailId,
        sMobNum: sPhone
      } = req.body

      const exist = await UsersModel.find(
        {
          $or: [
            { sUsername: sUserName.toLowerCase() },
            { sEmail: sEmailId.toLowerCase() },
            { sMobNum: sPhone }
          ]
        },
        { sUsername: 1, sEmail: 1, sMobNum: 1 },
        { readPreference: 'primary' }
      ).lean()
      if (!exist.length) {
        return res.status(status.OK).jsonp({
          status: jsonStatus.OK,
          message: messages[req.userLanguage].not_exist.replace(
            '##',
            messages[req.userLanguage].user
          )
        })
      }

      const userNameExist = exist.find(
        ({ sUsername }) => sUsername === sUserName.toLowerCase()
      )
      if (userNameExist) {
        return res.status(status.ResourceExist).jsonp({
          status: jsonStatus.ResourceExist,
          message: messages[req.userLanguage].already_exist.replace(
            '##',
            messages[req.userLanguage].username
          ),
          data: { bIsUsernameExist: true }
        })
      }

      const emailExist = exist.find(
        ({ sEmail }) => sEmail === sEmailId.toLowerCase()
      )
      if (emailExist) {
        return res.status(status.ResourceExist).jsonp({
          status: jsonStatus.ResourceExist,
          message: messages[req.userLanguage].already_exist.replace(
            '##',
            messages[req.userLanguage].email
          ),
          data: { bIsEmailExist: true }
        })
      }

      const phoneExist = exist.find(({ sMobNum }) => sMobNum === sPhone)
      if (phoneExist) {
        return res.status(status.ResourceExist).jsonp({
          status: jsonStatus.ResourceExist,
          message: messages[req.userLanguage].already_exist.replace(
            '##',
            messages[req.userLanguage].mobileNumber
          ),
          data: { bIsMobExist: true }
        })
      }
    } catch (error) {
      return catchError('UserAuth.checkExistence', error, req, res)
    }
  }

  async validateToken(req, res) {
    try {
      req.body = pick(req.body, [
        'nLongitude',
        'nLatitude',
        'sPushToken',
        'sDeviceToken',
        'nVersion'
      ])
      removenull(req.body)

      const decoded = jwt.verify(req.body.sPushToken, config.JWT_SECRET)
      const user = await UsersModel.countDocuments({
        _id: ObjectId(decoded._id)
      })

      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform'))
        ? req.header('Platform')
        : 'O'

      await UserSessionModel.create({
        ...req.body,
        ePlatform,
        iUserId: req.user._id
      })

      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].action_success.replace(
          '##',
          messages[req.userLanguage].cvalidate
        ),
        data: { bExist: !!user }
      })
    } catch (error) {
      return catchError('UserAuth.validateToken', error, req, res)
    }
  }

  async socialLogin(req, res) {
    try {
      const { sSocialType, sSocialToken, sPushToken, sDeviceToken } = req.body
      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform'))
        ? req.header('Platform')
        : 'O'

      if (!['G', 'F'].includes(sSocialType)) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].went_wrong_with.replace(
            '##',
            messages[req.userLanguage].csocialType
          )
        })
      }

      let userSocialId
      let userSocialEmail
      let userSocialName

      if (sSocialType === 'G') {
        const ticket = await client.verifyIdToken({
          idToken: sSocialToken,
          audience: [config.GOOGLE_CLIENT_ID_W]
        })
        const payload = ticket.getPayload()

        const googleRes = await axios.get(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${sSocialToken}`
        )

        if (payload.sub !== googleRes.data.sub) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].social_auth_failed
          })
        }

        if (!googleRes || (googleRes && !googleRes.data.sub)) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].social_auth_failed
          })
        }

        userSocialId = googleRes.data.sub
        userSocialEmail = googleRes.data.email
        userSocialName = googleRes.data.name
      } else if (sSocialType === 'F') {
        const fbRes = await axios.get(
          `https://graph.facebook.com/v3.2/me?access_token=${sSocialToken}&debug=all&fields=id,name,first_name,last_name,email&format=json&method=get&pretty=1`
        )

        if (!fbRes || (fbRes && !fbRes.data.id)) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].social_auth_failed
          })
        }

        userSocialId = fbRes.data.id
        userSocialEmail = fbRes.data.email
        userSocialName = fbRes.data.name
      }

      const user = await UsersModel.findOne(
        {
          $or: [{ 'oSocial.sId': userSocialId }, { sEmail: userSocialEmail }],
          eStatus: { $ne: 'D' }
        },
        null,
        { readPreference: 'primary' }
      ).lean()

      if (user && (user.eType === 'B' || user.eStatus === 'N')) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].user_blocked
        })
      }

      if (!user) {
        return res.status(status.NotFound).jsonp({
          status: jsonStatus.NotFound,
          message: messages[req.userLanguage].social_user_not_found,
          data: { sEmail: userSocialEmail, sName: userSocialName }
        })
      }

      const newToken = {
        sToken: jwt.sign(
          { _id: user._id.toHexString(), eType: user.eType },
          config.JWT_SECRET,
          { expiresIn: config.JWT_VALIDITY }
        ),
        sPushToken
      }

      user.oSocial = {
        sType: sSocialType,
        sId: userSocialId,
        sToken: sSocialToken
      }

      // let oldToken = []
      if (
        user.aJwtTokens.length < config.LOGIN_HARD_LIMIT ||
        config.LOGIN_HARD_LIMIT === 0
      ) {
        user.aJwtTokens.push(newToken)
      }
      //  else {
      // oldToken = user.aJwtTokens.splice(0, 1)
      // cachegoose.clearCache(`at:${oldToken}`)
      //   user.aJwtTokens.push(newToken)
      // }

      // oldToken.length && oldToken.map(s => redisClient.del(`at:${s.sToken}`))

      await UsersModel.updateOne(
        { _id: ObjectId(user._id) },
        { aJwtTokens: user.aJwtTokens, oSocial: user.oSocial }
      )

      const logData = { iUserId: user._id, ePlatform, eType: 'L', sDeviceToken, sIpAddress: getIp(req) }
      userAuthLogQueue.publish(logData)
      // await queuePush('AuthLogs', {
      //   iUserId: user._id,
      //   ePlatform,
      //   eType: 'L',
      //   sDeviceToken,
      //   sIpAddress: getIp(req)
      // })
      UsersModel.filterData(user)

      return res.status(status.OK).set('Authorization', newToken.sToken).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].succ_login,
        data: user,
        Authorization: newToken.sToken
      })
    } catch (error) {
      return catchError('UserAuth.socialLogin', error, req, res)
    }
  }

  // For new OTP login flow
  async sendOTPV2(req, res) {
    try {
      let { sAuth, sType } = req.body
      req.body = pick(req.body, ['sLogin', 'sDeviceToken', 'sAuth'])
      const { sLogin, sDeviceToken } = req.body
      sType = sType || OTP_VERIFICATION_PLATFORM_ENUMS.MOBILE

      let user
      if (sAuth !== OTP_VERIFICATION_TYPE_ENUMS.VERIFICATION || sType !== OTP_VERIFICATION_PLATFORM_ENUMS.EMAIL) {
        user = await UsersModel.findOne({ sMobNum: sLogin }, null, {
          readPreference: 'primary'
        }).lean()
        // Bot user not allowed to send otp.
        if (user && user.eType === USER_TYPE_ENUMS.BOT) {
          return res.status(status.NotFound).jsonp({
            status: jsonStatus.NotFound,
            message: messages[req.userLanguage].user_blocked
          })
        }
        if (user && user.eStatus !== 'Y') {
          return res.status(status.NotFound).jsonp({
            status: jsonStatus.NotFound,
            message: messages[req.userLanguage].user_blocked
          })
        }
        sAuth = user ? OTP_VERIFICATION_TYPE_ENUMS.LOGIN : OTP_VERIFICATION_TYPE_ENUMS.REGISTER
      }

      // In production, we'll only allow user to re-send otp after 30 seconds time.
      if (process.env.NODE_ENV === ENV_TYPE_ENUMS.PRODUCTION) {
        const d = new Date()
        d.setSeconds(d.getSeconds() - 30)
        const exist = await OTPVerificationsModel.findOne(
          { ...req.body, dCreatedAt: { $gt: d } },
          null,
          { readPreference: 'primary' }
        ).sort({ dCreatedAt: -1 })

        if (exist) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].err_resend_otp.replace(
              '##',
              messages[req.userLanguage].nThirty
            )
          })
        }
      }

      if (sAuth && sAuth === OTP_VERIFICATION_TYPE_ENUMS.VERIFICATION && sType === OTP_VERIFICATION_PLATFORM_ENUMS.EMAIL) {
        if (!req.header('Authorization')) {
          return res.status(status.Unauthorized).jsonp({
            status: jsonStatus.Unauthorized,
            message: messages[req.userLanguage].err_unauthorized
          })
        }
        user = await UsersModel.findByToken(req.header('Authorization'))

        // Internal user not able to change email id
        if (user && user.bIsInternalAccount === true) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].cant_change_mobile_email
          })
        }

        if (!user) {
          return res.status(status.Unauthorized).jsonp({
            status: jsonStatus.Unauthorized,
            message: messages[req.userLanguage].err_unauthorized
          })
        }

        const isEmail = await validateEmail(sLogin)
        if (!isEmail) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].invalid.replace(
              '##',
              messages[req.userLanguage].email
            )
          })
        }
        const query = { sEmail: sLogin }
        query._id = { $ne: user._id }
        query.eType = { $ne: USER_TYPE_ENUMS.BOT }

        const userExist = await UsersModel.findOne(query, null, {
          readPreference: 'primary'
        })
        if (userExist) {
          return res.status(status.ResourceExist).jsonp({
            status: jsonStatus.ResourceExist,
            message: messages[req.userLanguage].already_exist.replace(
              '##',
              messages[req.userLanguage].user
            )
          })
        }
      }

      // check rate limit for otp sending from same ip at multiple time. we'll make sure not too many request from same ip will occurs.
      if ([ENV_TYPE_ENUMS.PRODUCTION, ENV_TYPE_ENUMS.STAGING].includes(process.env.NODE_ENV)) {
        const [rateLimit, verifyRateLimit] = await Promise.all([
          checkRateLimitOTP(sLogin, sType, sAuth),
          getRateLimitStatus(sLogin, sType, `${sAuth}-V`) // check verify rate limit because if verification limit reached we can not send OTP
        ]) // if (rateLimit === 'LIMIT_REACHED') return res.status(status.TooManyRequest).jsonp({ status: jsonStatus.TooManyRequest, message: messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].cotp) })
        const message = rateLimit === 'LIMIT_REACHED' ? messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].cotp) : messages[req.userLanguage].otp_limit_reached
        if (rateLimit === 'LIMIT_REACHED' || verifyRateLimit === 'LIMIT_REACHED') return res.status(status.TooManyRequest).jsonp({ status: jsonStatus.TooManyRequest, message })
      }

      let sCode = config.DEFAULT_OTP
      if (
        [ENV_TYPE_ENUMS.PRODUCTION, ENV_TYPE_ENUMS.STAGING].includes(process.env.NODE_ENV) &&
        config.OTP_PROVIDER !== ENV_TYPE_ENUMS.TESTING &&
        ![config.TRIAL_USER_NUMBER, config.SB_OPS_TEAM_USER_NUMBER, config.TEST_USER_NUMBER, config.TEST_USER_NUMBER_2].includes(sLogin)) {
        sCode = generateOTP(config.OTP_LENGTH)
      }

      if ([ENV_TYPE_ENUMS.PRODUCTION, ENV_TYPE_ENUMS.STAGING].includes(process.env.NODE_ENV) &&
        sLogin === SUPER_USER_MOBILE_ENUMS.Manjula
      ) {
        sCode = SUPER_USER_STATIC_OTP.Manjula
      }

      await OTPVerificationsModel.updateMany(
        { sLogin: sLogin, sType: sType, sAuth: sAuth },
        { $set: { bIsVerify: true } }
      )
      const oOtpVerification = user
        ? { sLogin, sCode, sAuth, sType, sDeviceToken, iUserId: user._id }
        : { sLogin, sCode, sAuth, sType, sDeviceToken }
      await OTPVerificationsModel.create(oOtpVerification)

      if (
        sType === OTP_VERIFICATION_PLATFORM_ENUMS.MOBILE &&
        [ENV_TYPE_ENUMS.PRODUCTION, ENV_TYPE_ENUMS.STAGING].includes(process.env.NODE_ENV) && config.OTP_PROVIDER !== 'TEST'
      ) {
        if (checkCountryCode(sLogin) || !validateIndianNumber(sLogin)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].mobileNumber) })
        await queuePush('sendSms', {
          sProvider: config.OTP_PROVIDER,
          oUser: {
            sPhone: sLogin,
            sOTP: sCode
          }
        })
      }

      if (sType === OTP_VERIFICATION_PLATFORM_ENUMS.EMAIL && sAuth === OTP_VERIFICATION_TYPE_ENUMS.VERIFICATION) {
        await queuePush('SendMail', {
          sSlug: 'forgot-password-email',
          replaceData: {
            email: user.sUsername,
            otp: sCode,
            from: config.SMTP_FROM
          },
          to: sLogin
        })
      }
      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].OTP_sent_succ
      })
    } catch (error) {
      return catchError('UserAuth.sendOTPV2', error, req, res)
    }
  }

  // for new login flow
  async verifyOTPV3(req, res) {
    try {
      let { sLogin, sCode, sDeviceId, sPushToken, sAuth, sType } = req.body
      removenull(req.body)

      sType = sType || OTP_VERIFICATION_PLATFORM_ENUMS.MOBILE


      sCode = parseInt(sCode)
      if (typeof sCode !== 'number') {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].verify_otp_err
        })
      }

      let userDetails
      if (sAuth !== OTP_VERIFICATION_TYPE_ENUMS.VERIFICATION || sType === OTP_VERIFICATION_PLATFORM_ENUMS.MOBILE) {
        userDetails = await UsersModel.findOne({ sMobNum: sLogin }, null, {
          readPreference: 'primary'
        }).lean()
        sAuth = userDetails ? OTP_VERIFICATION_TYPE_ENUMS.LOGIN : OTP_VERIFICATION_TYPE_ENUMS.REGISTER
      }

      let verificationQuery = { sLogin, sCode, sAuth, sType, bIsVerify: false }
      if ([ENV_TYPE_ENUMS.PRODUCTION, ENV_TYPE_ENUMS.STAGING].includes(process.env.NODE_ENV)) {
        // check rate limit for otp verify from same ip at multiple time. we'll make sure not too many request from same ip will occurs.
        const [rateLimit, expiredOTP] = await Promise.all([
          checkRateLimitOTP(sLogin, sType, `${sAuth}-V`),
          getOTPExpiryStatus(sLogin, sType, sAuth) // check verify rate limit because if verification limit reached we can not send OTP
        ]) // if (rateLimit === 'LIMIT_REACHED') return res.status(status.TooManyRequest).jsonp({ status: jsonStatus.TooManyRequest, message: messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].cotpVerification) })

        const message = rateLimit === 'LIMIT_REACHED' ? messages[req.userLanguage].limit_reached.replace('##', messages[req.userLanguage].cotp) : messages[req.userLanguage].err_otp_expired

        if (rateLimit === 'LIMIT_REACHED' || expiredOTP === 'EXPIRED') {
          return res.status(status.TooManyRequest).jsonp({
            status: jsonStatus.TooManyRequest,
            message
          })
        }

        if (
          sType === OTP_VERIFICATION_PLATFORM_ENUMS.MOBILE &&
          config.OTP_PROVIDER !== ENV_TYPE_ENUMS.TESTING &&
          ![config.TRIAL_USER_NUMBER, config.SB_OPS_TEAM_USER_NUMBER, config.TEST_USER_NUMBER, config.TEST_USER_NUMBER_2].includes(sLogin) &&
          sLogin !== SUPER_USER_MOBILE_ENUMS.Manjula
        ) {
          // we will verify otp from thirf party provider
          if (checkCountryCode(sLogin) || !validateIndianNumber(sLogin)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].mobileNumber) })
          const verifyFromProvider = await verifyOTPFromProvider(
            config.OTP_PROVIDER,
            { sPhone: sLogin, sOTP: sCode }
          )
          if (!verifyFromProvider || !verifyFromProvider.isSuccess) {
            return res.status(status.BadRequest).jsonp({
              status: jsonStatus.BadRequest,
              message: messages[req.userLanguage].verify_otp_err
            })
          }
        }

        // otp lives for only 10 minutes
        const d = new Date()
        d.setMinutes(d.getMinutes() - 10)
        verificationQuery = { ...verificationQuery, dCreatedAt: { $gt: d } }
      }

      const exist = await OTPVerificationsModel.findOne(
        verificationQuery,
        null,
        { readPreference: 'primary' }
      )
        .sort({ dCreatedAt: -1 })
        .lean()
      if (!exist || exist.sCode !== sCode) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].verify_otp_err
        })
      }

      if (sAuth === OTP_VERIFICATION_TYPE_ENUMS.VERIFICATION && sType === OTP_VERIFICATION_PLATFORM_ENUMS.EMAIL) {
        if (!req.header('Authorization')) {
          return res.status(status.Unauthorized).jsonp({
            status: jsonStatus.Unauthorized,
            message: messages[req.userLanguage].err_unauthorized
          })
        }

        const user = await UsersModel.findByToken(req.header('Authorization'))

        if (!user) {
          return res.status(status.Unauthorized).jsonp({
            status: jsonStatus.Unauthorized,
            message: messages[req.userLanguage].err_unauthorized
          })
        }

        if (user.bIsInternalAccount === true) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].cant_change_mobile_email
          })
        }

        const isEmail = await validateEmail(sLogin)
        if (!isEmail) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].invalid.replace(
              '##',
              messages[req.userLanguage].email
            )
          })
        }
        const query = { sEmail: sLogin }
        query._id = { $ne: user._id }
        query.eType = { $ne: USER_TYPE_ENUMS.BOT }

        const userExist = await UsersModel.findOne(query, null, {
          readPreference: 'primary'
        }).lean()
        if (userExist) {
          return res.status(status.ResourceExist).jsonp({
            status: jsonStatus.ResourceExist,
            message: messages[req.userLanguage].already_exist.replace(
              '##',
              messages[req.userLanguage].user
            )
          })
        }

        await UsersModel.updateOne(
          { _id: ObjectId(user._id) },
          { sEmail: sLogin, bIsEmailVerified: true }
        )
      }
      const user = await OTPVerificationsModel.findByIdAndUpdate(
        exist._id,
        { bIsVerify: true },
        { runValidators: true, readPreference: 'primary' }
      ).lean()
      if (user) {
        await UsersModel.updateOne(
          { _id: ObjectId(user.iUserId) },
          { $addToSet: { aDeviceToken: sDeviceId } }
        )
      }

      const ePlatform = [PLATFORM_ENUMS.ANDROID, PLATFORM_ENUMS.IOS, PLATFORM_ENUMS.WEBSITE].includes(req.header('Platform')) //
        ? req.header('Platform')
        : PLATFORM_ENUMS.OTHER

      if (sAuth === OTP_VERIFICATION_TYPE_ENUMS.LOGIN) {
        const newToken = {
          sToken: jwt.sign(
            { _id: userDetails._id.toHexString(), eType: user.eType },
            config.JWT_SECRET,
            { expiresIn: config.JWT_VALIDITY }
          ),
          sPushToken
        }

        if (
          userDetails.aJwtTokens.length < config.LOGIN_HARD_LIMIT ||
          config.LOGIN_HARD_LIMIT === 0
        ) {
          userDetails.aJwtTokens.push(newToken)
        } else {
          const removedToken = userDetails.aJwtTokens.splice(0, 1)
          cachegoose.clearCache(`at:${removedToken}`)
          userDetails.aJwtTokens.push(newToken)
        }

        await UsersModel.updateOne(
          { _id: ObjectId(userDetails._id) },
          { aJwtTokens: userDetails.aJwtTokens, dLoginAt: new Date() }
        )

        const logData = { iUserId: userDetails._id, ePlatform, eType: OTP_VERIFICATION_TYPE_ENUMS.LOGIN, sDeviceToken: sDeviceId, sIpAddress: getIp(req) }
        userAuthLogQueue.publish(logData)
        // await queuePush('AuthLogs', {
        //   iUserId: userDetails._id,
        //   ePlatform,
        //   eType: OTP_VERIFICATION_TYPE_ENUMS.LOGIN,
        //   sDeviceToken: sDeviceId,
        //   sIpAddress: getIp(req)
        // })

        if (sPushToken) {
          await subscribeUser(sPushToken, ePlatform)
        }
        UsersModel.filterData(userDetails)

        return res
          .status(status.OK)
          .set('Authorization', newToken.sToken)
          .jsonp({
            status: jsonStatus.OK,
            message: messages[req.userLanguage].verification_success,
            data: userDetails,
            Authorization: newToken.sToken
          })
      }

      return res.status(status.OK).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].verification_success
      })
    } catch (error) {
      return catchError('UserAuth.verifyOTPV3', error, req, res)
    }
  }

  // register by new otp flow
  async registerV5(req, res) {
    try {
      let {
        sLogin,
        sDeviceId,
        sPushToken,
        sName,
        sReferCode,
        sUsername,
        sEmail,
        sSocialType,
        sSocialToken,
        sPayLoad,
        sSignature,
        sSignatureAlgorithm
      } = req.body
      req.body = pick(req.body, [
        'sName',
        'sEmail',
        'sReferCode',
        'sDeviceId',
        'sPushToken',
        'sUsername',
        'sSocialType',
        'sSocialToken',
        'sPayLoad',
        'sSignature',
        'sSignatureAlgorithm'
      ])
      removenull(req.body)

      let trueRes

      const query = [{ sMobNum: sLogin }]

      if (sUsername) {
        if (!checkAlphanumeric(sUsername)) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].must_alpha_num
          })
        }
        if (sUsername.length < 5 || sUsername.length > 15) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].invalid.replace(
              '##',
              messages[req.userLanguage].username
            )
          })
        }
        query.push({ sUsername })
      }
      if (sEmail) query.push({ sEmail })

      const userExist = await UsersModel.findOne({ $or: query }, null, {
        readPreference: 'primary'
      })
      if (userExist && userExist.eType === 'B') {
        return res.status(status.NotFound).jsonp({
          status: jsonStatus.NotFound,
          message: messages[req.userLanguage].user_blocked
        })
      }
      if (userExist && userExist.sMobNum === sLogin) {
        return res.status(status.ResourceExist).jsonp({
          status: jsonStatus.ResourceExist,
          message: messages[req.userLanguage].already_exist.replace(
            '##',
            messages[req.userLanguage].mobileNumber
          )
        })
      }
      if (userExist && userExist.sUsername === sUsername) {
        return res.status(status.ResourceExist).jsonp({
          status: jsonStatus.ResourceExist,
          message: messages[req.userLanguage].already_exist.replace(
            '##',
            messages[req.userLanguage].username
          )
        })
      }
      if (userExist && userExist.sEmail === sEmail) {
        return res.status(status.ResourceExist).jsonp({
          status: jsonStatus.ResourceExist,
          message: messages[req.userLanguage].already_exist.replace(
            '##',
            messages[req.userLanguage].email
          )
        })
      }
      if (sSocialType) {
        // Social signup with truecaller

        if (sSocialType === 'T') {
          try {
            if (!(sPayLoad || sSignature)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].social_auth_failed })
            const profile = {
              payload: sPayLoad,
              signature: sSignature,
              signatureAlgorithm: sSignatureAlgorithm || 'SHA512withRSA'
            }
            const trueRes = await getVerifyProfile(profile)

            if (!trueRes) {
              return res.status(status.BadRequest).jsonp({
                status: jsonStatus.BadRequest,
                message: messages[req.userLanguage].social_auth_failed
              })
            }
          } catch (error) {
            handleCatchError(error)
            return res.status(status.BadRequest).jsonp({
              status: jsonStatus.BadRequest,
              message: messages[req.userLanguage].social_auth_failed
            })
          }
        }
      }
      if (trueRes) {
        const socialUser = await UsersModel.findOne(
          { sMobNum: sLogin },
          { sMobNum: 1 }
        ).lean()
        if (socialUser) {
          return res.status(status.ResourceExist).jsonp({
            status: jsonStatus.ResourceExist,
            message: messages[req.userLanguage].already_exist.replace(
              '##',
              messages[req.userLanguage].user
            )
          })
        }
        req.body.oSocial = oSocial
        req.body.bIsEmailVerified = true
        oSocial.sType = 'T'

        if (!sName) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].invalid.replace(
              '##',
              messages[req.userLanguage].cName
            )
          })
        }
        if (sLogin.length !== 10) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].invalid.replace(
              '##',
              messages[req.userLanguage].mobileNumber
            )
          })
        }
      }

      const isOTPExist = await OTPVerificationsModel.findOne(
        { sLogin, sType: 'M', sAuth: 'R', bIsVerify: true },
        null,
        { readPreference: 'primary' }
      ).sort({ dCreatedAt: -1 })
      if (!isOTPExist && !sSocialType) {
        return res
          .status(status.BadRequest)
          .jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].went_wrong_with.replace(
              '##',
              messages[req.userLanguage].cotpVerification
            )
          })
      }

      if (config.OTP_PROVIDER !== 'TEST' && (checkCountryCode(sLogin) || !validateIndianNumber(sLogin))) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].mobileNumber) })

      if (!sUsername) {
        const newUsername = await getUniqueUserName(sName)
        if (newUsername instanceof Error) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].invalid.replace(
              '##',
              messages[req.userLanguage].username
            )
          })
        }
        sUsername = newUsername
      }

      // If sReferCode is invalid
      let referredBy
      if (sReferCode) {
        referredBy = await UsersModel.findOne({ sReferCode: sReferCode }).lean()
        if (!referredBy) {
          return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].enter_valid_referral_code })
        }
      }

      req.body.bIsMobVerified = true
      // Start Session on UsersDB
      const transactionOptions = {
        readPreference: 'primary',
        readConcern: { level: 'majority' },
        writeConcern: { w: 'majority' }
      }

      // Generate ReferCode and Link
      const sNewReferCode = await genReferCode(sName || sUsername)
      // const sNewReferCode = await genReferCodeV2();
      const sNewReferLink = await genDynamicLinkV2('share', sNewReferCode)

      const session = await UsersDBConnect.startSession()
      session.startTransaction(transactionOptions)

      let iUserId, eUserType
      try {
        const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform'))
          ? req.header('Platform')
          : 'O'
        const aDeviceToken = sDeviceId ? [sDeviceId] : []

        let user = await UsersModel.create(
          [
            {
              ...req.body,
              sReferCode: sNewReferCode,
              sMobNum: sLogin,
              sUsername,
              aDeviceToken,
              ePlatform,
              sReferLink: sNewReferLink
            }
          ],
          { session }
        )

        if (Array.isArray(user)) {
          user = user[0]
        }

        await KycModel.create([{ iUserId: user._id }], { session })

        const newToken = {
          sToken: jwt.sign(
            { _id: user._id.toHexString(), eType: user.eType },
            config.JWT_SECRET,
            { expiresIn: config.JWT_VALIDITY }
          ),
          sPushToken
        }

        iUserId = user._id
        eUserType = user.eType
        user.aJwtTokens.push(newToken)

        const openAccount = await userBalanceServices.openAccount({
          iUserId: user._id,
          sUsername,
          eType: user.eType
        })

        if (openAccount.isSuccess === false) {
          throw new Error(
            messages[req.userLanguage].went_wrong_with.replace(
              '##',
              messages[req.userLanguage].cpassbook
            )
          )
        }

        await PreferencesModel.create([{ iUserId: user._id }], { session })

        let registerReferBonus
        let referCodeBonus
        let registerBonus

        if (referredBy) {
          user.iReferredBy = referredBy._id
          registerReferBonus = await commonRuleServices.findRule('RR')
          referCodeBonus = await commonRuleServices.findRule('RCB')

          // We'll give refer reward from whom refer code through new user registered
          if (registerReferBonus) {
            const { sRewardOn = '' } = registerReferBonus
            if (sRewardOn) {
              if (sRewardOn === 'REGISTER') {
                const refer = await userBalanceServices.referBonus({
                  iUserId: referredBy._id,
                  rule: registerReferBonus,
                  sReferCode: referredBy.sReferCode,
                  sUserName: referredBy.sUsername,
                  eType: referredBy.eType,
                  nReferrals: 1,
                  iReferById: user._id
                })

                if (refer.isSuccess === false) {
                  throw new Error(
                    messages[req.userLanguage].went_wrong_with.replace(
                      '##',
                      messages[req.userLanguage].bonus
                    )
                  )
                }

                // Add Push Notification
                await queuePush('pushNotification:registerReferBonus', {
                  _id: user._id
                })
              }
              user.sReferrerRewardsOn = sRewardOn
            }
          }
          // We'll give refer code bonus to new user because they participate in referral code program
          if (referCodeBonus) {
            const refer = await userBalanceServices.referBonus({
              iUserId: user._id,
              rule: referCodeBonus,
              sReferCode: referredBy.sReferCode,
              sUserName: user.sUsername,
              eType: user.eType,
              iReferById: referredBy._id
            })
            // const refer = await userBalanceServices.referAddBonus({ iUserId: user._id, rule: referCodeBonus, sReferCode: referredBy.sReferCode, sUserName: user.sUsername, eType: user.eType })

            if (refer.isSuccess === false) {
              throw new Error(
                messages[req.userLanguage].went_wrong_with.replace(
                  '##',
                  messages[req.userLanguage].bonus
                )
              )
            }
            // Add Push Notification
            await queuePush('pushNotification:referCodeBonus', {
              _id: referredBy._id
            })
          }
        } else {
          // We'll give register bonus to all new user who don't register with refer code.
          registerBonus = await commonRuleServices.findRule('RB')
          const refer = await userBalanceServices.referBonus({
            iUserId: user._id,
            rule: registerBonus,
            sReferCode: user.sReferCode,
            sUserName: user.sUsername,
            eType: user.eType
          })

          if (refer.isSuccess === false) {
            throw new Error(
              messages[req.userLanguage].went_wrong_with.replace(
                '##',
                messages[req.userLanguage].bonus
              )
            )
          }
          // Add Push Notification
          await queuePush('pushNotification:registerBonus', { _id: user._id })
        }
        // commit transaction
        await session.commitTransaction()
        await UsersModel.updateOne(
          { _id: ObjectId(user._id) },
          {
            sReferrerRewardsOn: user.sReferrerRewardsOn,
            aJwtTokens: user.aJwtTokens,
            iReferredBy: user.iReferredBy
          }
        )

        if (sPushToken) {
          await subscribeUser(sPushToken, ePlatform)
        }

        const logData = { iUserId: user._id, ePlatform, eType: 'R', sDeviceToken: sDeviceId, sIpAddress: getIp(req) }
        userAuthLogQueue.publish(logData)
        // await queuePush('AuthLogs', {
        //   iUserId: user._id,
        //   ePlatform,
        //   eType: 'R',
        //   sDeviceToken: sDeviceId,
        //   sIpAddress: getIp(req)
        // })

        UsersModel.filterData(user)

        return res
          .status(status.OK)
          .set('Authorization', newToken.sToken)
          .jsonp({
            status: jsonStatus.OK,
            message: messages[req.userLanguage].reg_success,
            data: user,
            Authorization: newToken.sToken
          })
      } catch (err) {
        if (iUserId && eUserType) {
          // await UsersModel.deleteOne({ _id: ObjectId(iUserId) })
          // await KycModel.deleteOne({ iUserId })
          // await PreferencesModel.deleteOne({ iUserId })
          await userBalanceServices.revertOpenedAccount({
            iUserId,
            eType: eUserType
          })
          await session.abortTransaction()
        }
        return catchError('UserAuth.registerV5', err, req, res)
      } finally {
        session.endSession()
      }
    } catch (error) {
      return catchError('UserAuth.registerV5', error, req, res)
    }
  }

  // for new Social login flow without truecaller
  // async socialLoginV3(req, res) {
  //   try {
  //     const { sSocialType, sSocialToken, sPushToken, sDeviceId } = req.body
  //     const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform')) ? req.header('Platform') : 'O'

  //     if (!['T'].includes(sSocialType)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].csocialType) })

  //     let userSocialId
  //     let userSocialName

  //     if (sSocialType === 'T') {
  //       try {
  //         const trueRes = await axios.get('https://profile4-noneu.truecaller.com/v1/default', { headers: { Authorization: `Bearer ${sSocialToken}` } })
  //         if (!trueRes || (trueRes && !trueRes.data.id)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].social_auth_failed })

  //         const { first, last } = trueRes.data.name
  //         userSocialId = trueRes.data.id
  //         userSocialName = first && last ? `${first} ${last}` : ''
  //       } catch (error) {
  //         return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].social_auth_failed })
  //       }
  //     }

  //     const user = await UsersModel.findOne({ 'oSocial.sId': userSocialId, 'oSocial.sType': 'T' }, null, { readPreference: 'primary' }).lean()

  //     if (user && (user.eType === 'B' || user.eStatus === 'N')) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].user_blocked })

  //     if (!user) {
  //       return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].social_user_not_found, data: { sName: userSocialName } })
  //     }

  //     const newToken = {
  //       sToken: jwt.sign({ _id: (user._id).toHexString(), eType: user.eType }, config.JWT_SECRET, { expiresIn: config.JWT_VALIDITY }),
  //       sPushToken
  //     }

  //     user.oSocial = {
  //       sType: sSocialType,
  //       sId: userSocialId,
  //       sToken: sSocialToken
  //     }

  //     // let oldToken = []
  //     if (user.aJwtTokens.length < config.LOGIN_HARD_LIMIT || config.LOGIN_HARD_LIMIT === 0) {
  //       user.aJwtTokens.push(newToken)
  //     }
  //     // else {
  //     //   // oldToken = user.aJwtTokens.splice(0, 1)
  //     //   // cachegoose.clearCache(`at:${oldToken}`)
  //     //   user.aJwtTokens.push(newToken)
  //     // }

  //     // oldToken.length && oldToken.map(s => redisClient.del(`at:${s.sToken}`))

  //     await UsersModel.updateOne({ _id: ObjectId(user._id) }, { aJwtTokens: user.aJwtTokens, oSocial: user.oSocial })

  //     await queuePush('AuthLogs', {
  //       iUserId: user._id, ePlatform, eType: 'L', sDeviceToken: sDeviceId, sIpAddress: getIp(req)
  //     })
  //     UsersModel.filterDataForUser(user)

  //     return res.status(status.OK).set('Authorization', newToken.sToken).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].succ_login, data: user, Authorization: newToken.sToken })
  //   } catch (error) {
  //     return catchError('UserAuth.socialLoginV3', error, req, res)
  //   }
  // }

  // for new login flow
  async socialLoginV3(req, res) {
    try {
      const { sSocialType, sSocialToken, sPushToken, sDeviceId, sLogin, sPayLoad, sSignature, sSignatureAlgorithm } = req.body
      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform'))
        ? req.header('Platform')
        : 'O'

      if (!['T'].includes(sSocialType)) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].went_wrong_with.replace(
            '##',
            messages[req.userLanguage].csocialType
          )
        })
      }

      if (sSocialType === 'T') {
        try {
          const profile = {
            payload: sPayLoad,
            signature: sSignature,
            signatureAlgorithm: sSignatureAlgorithm || 'SHA512withRSA'
          }

          const trueRes = await getVerifyProfile(profile)
        } catch (error) {
          return res.status(status.BadRequest).jsonp({
            status: jsonStatus.BadRequest,
            message: messages[req.userLanguage].social_auth_failed
          })
        }
      }

      const user = await UsersModel.findOne(
        { sMobNum: sLogin, eStatus: { $ne: 'D' } },
        null,
        { readPreference: 'primary' }
      ).lean()

      if (user && (user.eType === 'B' || user.eStatus === 'N')) {
        return res.status(status.BadRequest).jsonp({
          status: jsonStatus.BadRequest,
          message: messages[req.userLanguage].user_blocked
        })
      }

      if (!user) {
        return res.status(status.NotFound).jsonp({
          status: jsonStatus.NotFound,
          message: messages[req.userLanguage].social_user_not_found,
          data: { sName: userSocialName }
        })
      }

      const newToken = {
        sToken: jwt.sign(
          { _id: user._id.toHexString(), eType: user.eType },
          config.JWT_SECRET,
          { expiresIn: config.JWT_VALIDITY }
        ),
        sPushToken
      }

      user.oSocial = {
        sType: sSocialType
      }

      // let oldToken = []
      if (
        user.aJwtTokens.length < config.LOGIN_HARD_LIMIT ||
        config.LOGIN_HARD_LIMIT === 0
      ) {
        user.aJwtTokens.push(newToken)
      }
      // else {
      //   // oldToken = user.aJwtTokens.splice(0, 1)
      //   // cachegoose.clearCache(`at:${oldToken}`)
      //   user.aJwtTokens.push(newToken)
      // }

      // oldToken.length && oldToken.map(s => redisClient.del(`at:${s.sToken}`))

      await UsersModel.updateOne(
        { _id: ObjectId(user._id) },
        { aJwtTokens: user.aJwtTokens, oSocial: user.oSocial }
      )

      const logData = { iUserId: user._id, ePlatform, eType: 'L', sDeviceToken: sDeviceId, sIpAddress: getIp(req) }
      userAuthLogQueue.publish(logData)
      // await queuePush('AuthLogs', {
      //   iUserId: user._id,
      //   ePlatform,
      //   eType: 'L',
      //   sDeviceToken: sDeviceId,
      //   sIpAddress: getIp(req)
      // })
      UsersModel.filterData(user)

      return res.status(status.OK).set('Authorization', newToken.sToken).jsonp({
        status: jsonStatus.OK,
        message: messages[req.userLanguage].succ_login,
        data: user,
        Authorization: newToken.sToken
      })
    } catch (error) {
      return catchError('UserAuth.socialLoginV3', error, req, res)
    }
  }

  async getUserToken(type = '') {
    let response
    let sLogin
    let sPassword
    let sDeviceToken
    if (type && type === 'INTERNAL') {
      sLogin = testCasesDefault.internalUser.sLogin
      sPassword = testCasesDefault.internalUser.sPassword
      sDeviceToken = testCasesDefault.internalUser.sDeviceToken
    } else {
      sLogin = testCasesDefault.user.sLogin
      sPassword = testCasesDefault.user.sPassword
      sDeviceToken = testCasesDefault.user.sDeviceToken
    }
    try {
      const result = await axios.post(
        `${config.DEPLOY_HOST_URL}/api/user/auth/login/v2`,
        { sLogin, sPassword, sDeviceToken }
      )
      response = result.data
    } catch (error) { }
    return response
  }

  async subscribePushToken(req, res) {
    try {
      const { sPushToken } = req.body
      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform')) ? req.header('Platform') : 'O'

      const data = await UsersModel.findOne({ _id: ObjectId(req.user._id) })

      if (data && data.aJwtTokens.length) {
        if (ePlatform === 'W') await subscribeUser(sPushToken, ePlatform)
        for (const d of data.aJwtTokens) {
          if (!d.sPushToken) {
            d.sPushToken = sPushToken
          }
        }
        await data.save()
      }
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].subscribePushToken_success })
    } catch (error) {
      return catchError('UserAuth.subscribePushToken', error, req, res)
    }
  }

  async addAdId(req, res) {
    try {
      const { iAdId } = req.body
      const ePlatform = ['A', 'I', 'W'].includes(req.header('Platform')) ? req.header('Platform') : 'O'

      const data = await UsersModel.findOne({ _id: ObjectId(req.user._id) }).lean()

      await UsersModel.updateOne({ _id: ObjectId(data._id) }, { iAdId })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cAdId) })
    } catch (error) {
      return catchError('UserAuth.subscribePushToken', error, req, res)
    }
  }

  async getAppDownloadLink(req, res) {
    try {
      const { sPhone } = req.body
      const ePlatform = ['A', 'I'].includes(req.header('Platform')) ? req.header('Platform') : 'O'

      const data = await sendDownLoadLink({ sPhone, ePlatform })
      const { isSuccess, message } = data

      if (!isSuccess) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message })
    } catch (error) {
      return catchError('UserAuth.getAppDownloadLink', error, req, res)
    }
  }
}
const genReferCode = (sName) =>
  new Promise((resolve, reject) => {
    const sReferCode = sName
      ? sName.substring(0, common.REFERRAL_CODE_USER_NAME_LENGTH) +
      randomStr(common.REFERRAL_CODE_RANDOM_NUMBER_LENGTH, 'referral')
      : randomStr(common.REFERRAL_CODE_LENGTH, 'referral')

    UsersModel.findOne({ sReferCode })
      .then((codeExist) => {
        if (
          !codeExist &&
          sReferCode.toString().length === common.REFERRAL_CODE_LENGTH
        ) {
          resolve(sReferCode.toUpperCase())
        } else {
          return genReferCode(sName).then(resolve).catch(reject)
        }
      })
      .catch((error) => {
        reject(error)
      })
  })

const genReferCodeV2 = async (sName) => {
  try {
    // const sReferCode = sName
    //   ? sName.substring(0, common.REFERRAL_CODE_USER_NAME_LENGTH) +
    //   randomStr(common.REFERRAL_CODE_RANDOM_NUMBER_LENGTH, "referral")
    //   : randomStr(common.REFERRAL_CODE_LENGTH, "referral");
    const sReferCode = randomStr(common.REFERRAL_CODE_LENGTH, 'referral')
    const codeExist = await UsersModel.countDocuments({ sReferCode })
    if (
      !codeExist &&
      sReferCode.toString().length === common.REFERRAL_CODE_LENGTH
    ) {
      return sReferCode.toUpperCase()
    } else {
      return genReferCodeV2(sName)
    }
  } catch (error) {
    handleCatchError(error)
    return new Error(error)
  }
}

// To get new generated username
const getUniqueUserName = async (sName) => {
  try {
    let sUsername = sName.replace(/\s/g, '').toLowerCase()
    if (sUsername.length > 15) { sUsername = sUsername.slice(0, -(sUsername.length - 15)) }
    if (sUsername.length < 5) {
      const randomNumber = generateOTP(5 - sUsername.length)
      sUsername = sUsername.concat(randomNumber)
    }
    const verified = await checkUserName(sUsername)
    if (verified instanceof Error) { return new Error('Username verification failed!') }
    return verified
  } catch (error) {
    return new Error(error)
  }
}

// To verify if username already exist then increment counter
const checkUserName = async (sUsername) => {
  try {
    const exists = await UsersModel.findOne({ sUsername })
      .select({ sUsername: 1 })
      .lean()
    if (exists) {
      let nDigit = exists.sUsername.match(/\d+/g)
        ? exists.sUsername.match(/\d+/g)[0]
        : 0
      nDigit = Number(nDigit) || 0
      sUsername = exists.sUsername.match(/[a-zA-Z]+/g)[0].concat(nDigit + 1)
      return await checkUserName(sUsername)
    } else {
      return sUsername
    }
  } catch (error) {
    return new Error(error)
  }
}

async function getVerifyProfile(profile) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        verifier.verifyProfile(profile, function (err, res) {
          if (err) {
            reject(err)
          } else {
            resolve(res)
          }
        })
      } catch (error) {
        reject(error)
      }
    })()
  })
}
module.exports = new UserAuth()
