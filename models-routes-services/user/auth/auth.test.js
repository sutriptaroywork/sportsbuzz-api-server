const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../../index')
const expect = require('expect')
const { messages, status } = require('../../../helper/api.responses')
const { encryption, randomStr } = require('../../../helper/utilities.services')

let routes = {}
const store = {}

describe('User Auth management routes', () => {
  before(() => {
    routes = {
      register: '/api/user/auth/register/v1',
      checkExist: '/api/user/auth/check-exist/v1',
      login: '/api/user/auth/login/v1',
      sendOtp: '/api/user/auth/send-otp/v1',
      verifyOtp: '/api/user/auth/verify-otp/v1',
      resetPassword: '/api/user/auth/reset-password/v1',
      changePassword: '/api/user/auth/change-password/v1',
      logout: '/api/user/auth/logout/v1', // put
      validateToken: '/api/user/auth/validate-token/v1'
    }
    store.token = undefined
    store.email = `${randomStr(10, 'private')}@test.com`
    store.mobile = randomStr(10, 'otp')
    store.username = randomStr(10, 'referral')
  })

  describe('/Post Send otp', () => {
    it('should send otp for register test case ', (done) => {
      const data = {
        sLogin: store.mobile,
        sType: 'M',
        sAuth: 'R',
        sDeviceToken: 'test'
      }
      request(server)
        .post(routes.sendOtp)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.OTP_sent_succ)
          done()
        })
    })
  })

  describe('/Post Verify otp', () => {
    it('should be Verify otp for verify Mobile for register', (done) => {
      const data = {
        sLogin: store.mobile,
        sType: 'M',
        sAuth: 'R',
        sCode: 1234
      }
      request(server)
        .post('/api/user/auth/verify-otp/v2')
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.verification_success)
          done()
        })
    })
  })

  describe('/POST create user', () => {
    it('should not be create user because otp not verified', (done) => {
      const data = {
        sEmail: 'sahithgarg4@mail.com',
        sMobNum: '9147526212',
        sName: 'wic801',
        sPassword: 'Test@1234',
        sUsername: 'sahithgarg4',
        sCode: '1234',
        sDeviceToken: 'd7dwf51sw4ds8sd848sxhsftlsz'
      }
      request(server)
        .post(routes.register)
        .send(data)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.went_wrong_with.replace('##', messages.English.cotpVerification))
          done()
        })
    })

    it('should not be create user because mobile number already exists', (done) => {
      const data = {
        sEmail: 'manan.m@yudiz.in',
        sMobNum: '7878787878',
        sName: 'manan',
        sPassword: 'Test@1234',
        sUsername: 'ravi11',
        sCode: '1234',
        sDeviceToken: 'd7dwf51sw4ds8sd848sxhsftlsz'
      }
      request(server)
        .post(routes.register)
        .send(data)
        .expect(status.ResourceExist)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.mobileNumber))
          done()
        })
    })

    it('should not be create user because email already exists', (done) => {
      const data = {
        sEmail: 'superuser@gmail.com',
        sMobNum: '9879871234',
        sName: 'manan',
        sPassword: 'Test@1234',
        sUsername: 'ravi11',
        sCode: '1234',
        sDeviceToken: 'd7dwf51sw4ds8sd848sxhsftlsz'
      }
      request(server)
        .post(routes.register)
        .send(data)
        .expect(status.ResourceExist)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.email))
          done()
        })
    })

    it('should not be create user because username already exists', (done) => {
      const data = {
        sEmail: 'manan.m@yudiz.in',
        sMobNum: '9879855555',
        sName: 'manan',
        sPassword: 'Test@1234',
        sUsername: 'superuser',
        sCode: '1234',
        sDeviceToken: 'd7dwf51sw4ds8sd848sxhsftlsz'
      }
      request(server)
        .post('/api/user/auth/register/v4')
        .send(data)
        .expect(status.ResourceExist)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.username))
          done()
        })
    })

    it('should be create user', (done) => {
      const data = {
        sEmail: store.email,
        sMobNum: store.mobile,
        sName: 'test',
        sPassword: 'Test@1234',
        sUsername: store.username,
        sCode: '1234',
        sDeviceToken: 'd7dwf51sw4ds8sd848sxhsftlsz'
      }
      request(server)
        .post('/api/user/auth/register/v4')
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.reg_success)
          done()
        })
    })
  })

  describe('POST reset password V3', () => {
    it('should send otp for reset password test case ', (done) => {
      const data = {
        sLogin: store.mobile,
        sType: 'M',
        sAuth: 'F',
        sDeviceToken: 'test'
      }
      request(server)
        .post(routes.sendOtp)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.OTP_sent_succ)
          done()
        })
    })

    it('should be Verify otp for verify Mobile for reset password', (done) => {
      const data = {
        sLogin: store.mobile,
        sType: 'M',
        sAuth: 'F',
        sCode: 1234
      }
      request(server)
        .post('/api/user/auth/verify-otp/v2')
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.verification_success)
          done()
        })
    })
    it('should not be reset password because not strong password', (done) => {
      const data = {
        sCode: '1234',
        sNewPassword: 'test123',
        sLogin: store.mobile,
        sType: 'M',
        sAuth: 'F'
      }
      request(server)
        .post('/api/user/auth/reset-password/v3')
        .send(data)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.invalid_pass.replace('##', messages.English.ssPassword))
          done()
        })
    })

    it('should be reset password', (done) => {
      const data = {
        sCode: '1234',
        sNewPassword: 'Test@123',
        sLogin: store.mobile,
        sType: 'M',
        sAuth: 'F'
      }
      request(server)
        .post('/api/user/auth/reset-password/v3')
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.reset_pass_succ)
          done()
        })
    })
  })

  describe('/POST check email, username and phoneNo is exist', () => {
    it('should check email is not exist ', (done) => {
      const data = {
        sType: 'E',
        sValue: `testuser${Math.floor(Math.random() * 121212)}@gmail.com`
      }
      request(server)
        .post(routes.checkExist)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.email))
          done()
        })
    })

    it('should check username is exist', (done) => {
      const data = {
        sType: 'U',
        sValue: `testuser${Math.floor(Math.random() * 121212)}`
      }
      request(server)
        .post(routes.checkExist)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.username))
          done()
        })
    })

    it('should check mobile no. is exist', (done) => {
      const data = {
        sType: 'M',
        sValue: '9999999999'
      }
      request(server)
        .post(routes.checkExist)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.mobileNumber))
          done()
        })
    })
  })

  describe('/Post Check email, username and phoneNo is exist v2 for native app', () => {
    it('should check email is not exist ', (done) => {
      const data = {
        sEmail: 'superuser@gmail.com',
        sUsername: 'superuser12',
        sMobNum: '7878787879'
      }
      request(server)
        .post('/api/user/auth/check-exist/v2')
        .send(data)
        .expect(status.ResourceExist)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.email))
          done()
        })
    })

    it('should check username is exist', (done) => {
      const data = {
        sEmail: 'superuser12@gmail.com',
        sUsername: 'superuser',
        sMobNum: '7878787879'
      }
      request(server)
        .post('/api/user/auth/check-exist/v2')
        .send(data)
        .expect(status.ResourceExist)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.username))
          done()
        })
    })

    it('should check mobile no. is exist', (done) => {
      const data = {
        sEmail: 'superuser12@gmail.com',
        sUsername: 'superuser12',
        sMobNum: '7878787878'
      }
      request(server)
        .post('/api/user/auth/check-exist/v2')
        .send(data)
        .expect(status.ResourceExist)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.mobileNumber))
          done()
        })
    })
    it('should check user not exist with given data', (done) => {
      const data = {
        sEmail: 'superuser12@gmail.com',
        sUsername: 'superuser12',
        sMobNum: '7878787879'
      }
      request(server)
        .post('/api/user/auth/check-exist/v2')
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.user))
          done()
        })
    })
  })

  describe('/POST login user V2', () => {
    it('should not be login', (done) => {
      const data = {
        sLogin: store.email,
        sPassword: encryption('Test@1234'),
        sDeviceToken: 'f18sdwhn4bfg784xbc5d'
      }
      request(server)
        .post('/api/user/auth/login/v2')
        .send(data)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.auth_failed)
          done()
        })
    })
    it('should be login', (done) => {
      const data = {
        sLogin: store.email,
        sPassword: encryption('Test@123'),
        sDeviceToken: 'f18sdwhn4bfg784xbc5d'
      }
      request(server)
        .post('/api/user/auth/login/v2')
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.OTP_sent_succ)
          if (res.body.Authorization) {
            store.token = res.body.Authorization
          }
          done()
        })
    })
  })

  describe('/Post Verify otp for logIn', () => {
    it('should be Verify otp for login', (done) => {
      const data = {
        sLogin: store.email,
        sType: 'E',
        sAuth: 'L',
        sCode: 1234,
        sDeviceId: 'f18sdwhn4bfg784xbc5d'
      }
      request(server)
        .post('/api/user/auth/verify-otp/v2')
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.verification_success)
          if (res.body.Authorization) {
            store.token = res.body.Authorization
          }
          done()
        })
    })
  })

  describe('POST change password V3', () => {
    it('should not be change password because old password is wrong', (done) => {
      const data = {
        sOldPassword: 'Test@12345',
        sNewPassword: 'Test@123'
      }
      request(server)
        .post('/api/user/auth/change-password/v3')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.wrong_old_field)
          done()
        })
    })

    it('should not be change password because not strong password', (done) => {
      const data = {
        sOldPassword: 'Test@123',
        sNewPassword: 'test123'
      }
      request(server)
        .post('/api/user/auth/change-password/v3')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.invalid_pass.replace('##', messages.English.ssPassword))
          done()
        })
    })
    it('should be change password', (done) => {
      const data = {
        sOldPassword: 'Test@123',
        sNewPassword: 'Test@1234'
      }
      request(server)
        .post('/api/user/auth/change-password/v3')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.password))
          done()
        })
    })
  })

  describe('/POST Validate token V2', () => {
    it('should not be login', (done) => {
      const data = {
        sPushToken: store.token
      }
      request(server)
        .post('/api/user/auth/validate-token/v2')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.action_success.replace('##', messages.English.cvalidate))
          done()
        })
    })
  })
})
