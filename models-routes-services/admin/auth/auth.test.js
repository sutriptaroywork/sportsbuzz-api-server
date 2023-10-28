const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../../index')
const expect = require('expect')
const { messages, status } = require('../../../helper/api.responses')
const { encryption } = require('../../../helper/utilities.services')
const adminAuthServices = require('../auth/services')
const store = {}
const data = {
  aPermissions: [],
  sEmail: 'manan.m@yudiz.in',
  sMobNum: '9574939380',
  sName: 'jbhjbasbbv',
  sPassword: encryption('123456'),
  sUsername: 'ussahnjb'
}

describe('Create a auth routes', () => {
  before(async () => {
    store.subAdminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI1ZmM2M2VkYzFhNTlkMDJlMmM2ZjE4ZTkiLCJpYXQiOjE2MTIyNjA0MjUsImV4cCI6MTYyMDAzNjQyNX0.JXnMg9KdzPXP9v87VfSmPklHi3jW2c8gyzm9ViYoo60'
    const superAdminToken = await adminAuthServices.getAdminToken()
    store.superAdminToken = superAdminToken
    store.ID = undefined
  })

  describe('/GET list of Permission', () => {
    it('should be a get list of Permission', (done) => {
      request(server)
        .get('/api/admin/permission/v1')
        .set('Authorization', store.superAdminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.permissions))
          if (res.body.data) {
            store.aPermissions = res.body.data.map(({ sKey, eStatus }) => ({ sKey, eType: eStatus }))
          }
          done()
        })
    })
  })

  describe('/POST create sub-Admin', () => {
    it('should not be create sub-Admin', (done) => {
      request(server)
        .post('/api/admin/auth/sub-admin/v1')
        .set('Authorization', store.subAdminToken)
        .send(data)
        .expect(status.Unauthorized)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.err_unauthorized)
          done()
        })
    })

    it('should not be create sub-Admin', (done) => {
      data.aPermissions = [{ sKey: 'LOGIN', eType: 'N' }, { sKey: 'SUBADMIN', eType: 'N' }]
      request(server)
        .post('/api/admin/auth/sub-admin/v1')
        .set('Authorization', store.superAdminToken)
        .send(data)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.permissions))
          done()
        })
    })

    it('should not be create sub-Admin', (done) => {
      data.aPermissions = [{ sKey: 'PERMISSION', eType: 'N' }]
      request(server)
        .post('/api/admin/auth/sub-admin/v1')
        .set('Authorization', store.superAdminToken)
        .send(data)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.username))
          done()
        })
    })

    it('should not be create sub-Admin', (done) => {
      data.aPermissions = [{ sKey: 'PERMISSION', eType: 'N' }]
      data.sMobNum = '9879878879'
      request(server)
        .post('/api/admin/auth/sub-admin/v1')
        .set('Authorization', store.superAdminToken)
        .send(data)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.mobileNumber))
          done()
        })
    })

    it('should not be create sub-Admin', (done) => {
      data.aPermissions = [{ sKey: 'PERMISSION', eType: 'N' }]
      data.sEmail = 'ravi@gmail.com'
      request(server)
        .post('/api/admin/auth/sub-admin/v1')
        .set('Authorization', store.superAdminToken)
        .send(data)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.email))
          done()
        })
    })
  })

  describe('/POST login user', () => {
    it('should not be login', (done) => {
      const loginData = {
        sLogin: 'ravi@gmail.com',
        sPassword: 'ravi1234'
      }
      request(server)
        .post('/api/admin/auth/login/v1')
        .send(loginData)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.auth_failed)
          done()
        })
    })

    it('should be login', (done) => {
      const loginpayload = {
        sLogin: '9879879879',
        sPassword: '123456'
      }
      request(server)
        .post('/api/admin/auth/login/v1')
        .send(loginpayload)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.succ_login)
          if (res.body.Authorization) {
            store.subAdminToken = res.body.Authorization
          } else {
            module.exports = 'hello'
          }
          done()
        })
    })

    it('admin should be login v2', (done) => {
      const loginpayload = {
        sLogin: 'superman@gmail.com',
        sPassword: '{"v":"hybrid-crypto-js_0.2.4","iv":"uUcWOt9KIP+Rji5DFYbNwtSLqYslJj+UThLrFV9aceI=","keys":{"7d:36:3b:2f:b6:86:7f:f8:dc:5d:e2:82:3b:85:bc:63:a1:c0:b8:e0":"GLtnAyFyEvO535CVSSv925OkNgJh3PybWLpFlyVi+e2NfsQuwl9QD4vPWf0WKFRV5HpYN8hrU8vP2WZXONS5CXWzbuHEeGjeNh86JeyjacGWk78G5urIXuIWh9DZFh66ktpLnuo91XbFfujgcMOcIlvwneAgC9W7xLL1Pea38rc="},"cipher":"FrkRTyIB8EekSshezkifGA=="}'
      }
      request(server)
        .post('/api/admin/auth/login/v2')
        .send(loginpayload)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.succ_login)
          if (res.body.Authorization) {
            store.subAdminToken = res.body.Authorization
          }
          done()
        })
    })

    it('create sub admin should be login v3', (done) => {
      data.aPermissions = [{ sKey: 'PERMISSION', eType: 'N' }]
      data.sEmail = 'bhavin.v1@gmail.com'
      data.iRoleId = '6214b4e1c6040a3fb50aeef6'
      request(server)
        .post('/api/admin/auth/sub-admin/v3')
        .set('Authorization', store.superAdminToken)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.subAdmin))
          done()
        })
    })
    it('logout admin', (done) => {
      request(server)
        .put('/api/admin/auth/logout/v1')
        .set('Authorization', store.superAdminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.succ_logout)
          done()
        })
    })
  })
})
