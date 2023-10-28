const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')
const userAuthServices = require('../user/auth/services')
const { testCasesDefault } = require('../../config/testCases.js')

const store = {}

describe('UserWithdraw Routes', () => {
  before(async () => {
    const adminToken = await adminAuthServices.getAdminToken()
    const userData = await userAuthServices.getUserToken()
    const userToken = userData.Authorization
    const internalUserData = await userAuthServices.getUserToken('INTERNAL')
    const internalUserToken = internalUserData.Authorization
    store.ID = undefined
    store.wID = '5f7f0fd9b18344309eb41138'
    store.adminToken = adminToken
    store.userToken = userToken
    store.internalUserToken = internalUserToken
    store.iUserId = userData.data._id
    store.sPassword = testCasesDefault.credentialPassword
  })

  describe('/POST Admin withdraw', () => {
    it('Should be add withdraw in user', (done) => {
      request(server)
        .post('/api/admin/withdraw/v1')
        .set('Authorization', store.adminToken)
        .send({
          iUserId: store.iUserId,
          eType: 'winning',
          nAmount: 15,
          sPassword: store.sPassword
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.successfully.replace('##', messages.English.withdraw))
          done()
        })
    })

    it('Should not be add withdraw in user', (done) => {
      request(server)
        .post('/api/admin/withdraw/v1')
        .set('Authorization', store.adminToken)
        .send({
          iUserId: store.iUserId,
          eType: 'withdraw',
          nAmount: 25
        })
        .expect(status.UnprocessableEntity)
        .end(function(err, res) {
          if (err) return done(err)
          done()
        })
    })
  })

  describe('/POST user withdraw', () => {
    it('Should be add user withdraw', (done) => {
      request(server)
        .post('/api/user/withdraw/v1')
        .set('Authorization', store.userToken)
        .send({
          nAmount: 25,
          ePaymentGateway: 'PAYTM'
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.withdraw))
          done()
        })
    })

    it('Should not be add user withdraw - Internal User', (done) => {
      request(server)
        .post('/api/user/withdraw/v1')
        .set('Authorization', store.internalUserToken)
        .send({
          nAmount: 25,
          ePaymentGateway: 'PAYTM'
        })
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.withdraw_not_permited.replace('##', messages.English.internal_user))
          done()
        })
    })

    it('Should not be add user withdraw', (done) => {
      request(server)
        .post('/api/user/withdraw/v1')
        .set('Authorization', store.userToken)
        .send({
          nAmount: 10,
          ePaymentGateway: 'PAYTM'
        })
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.cPendingWithdraw))
          done()
        })
    })

    it('Should not be add user withdraw', (done) => {
      request(server)
        .post('/api/user/withdraw/v1')
        .set('Authorization', store.userToken)
        .send({
          nAmount: 5,
          ePaymentGateway: 'PAYTM'
        })
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.min_err.replace('##', messages.English.withdraw).replace('#', '10'))
          done()
        })
    })

    it('Should not be add user withdraw', (done) => {
      request(server)
        .post('/api/user/withdraw/v1')
        .set('Authorization', store.userToken)
        .send({
          nAmount: 5500,
          ePaymentGateway: 'PAYTM'
        })
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.max_err.replace('##', messages.English.withdraw).replace('#', '5000'))
          done()
        })
    })

    it('Should not be add user withdraw', (done) => {
      request(server)
        .post('/api/user/withdraw/v1')
        .set('Authorization', store.userToken)
        .send({
          nAmount: 10,
          ePaymentGateway: 'PAYTM'
        })
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.email_verify_err)
          done()
        })
    })
  })

  describe('/POST process withdraw', () => {
    it('Should be process withdraw for user', (done) => {
      request(server)
        .post('/api/admin/withdraw/3/v1')
        .set('Authorization', store.adminToken)
        .send({
          ePaymentStatus: 'S'
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.withdraw))
          done()
        })
    })
  })

  describe('/GET list withdraw to admin', () => {
    it('Should be list withdraw of user', (done) => {
      request(server)
        .get('/api/admin/withdraw/list/v1?start=10&limit=5&status=S')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.withdraw))
          done()
        })
    })
  })
})
