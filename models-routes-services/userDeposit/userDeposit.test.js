const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')

const store = {}

describe('UserDeposit Routes', () => {
  before(() => {
    store.ID = undefined
    store.wID = '5f7f0fd9b18344309eb41138'
    store.adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2MTEwZmM1Y2YyNjEyYTFmZDhlMjFlYjIiLCJpYXQiOjE2MzA5MzcxNTgsImV4cCI6MTYzODcxMzE1OH0.twYdnvcQSoKhlFIury2zkhlFFJG4ikzE0ccBHQ6R8ac'
    store.userToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2MTE0YjM3ZmFjMDY4MzExNTRkOGQwOTIiLCJpYXQiOjE2MzA5ODg2MzMsImV4cCI6MTYzODc2NDYzM30.8ZhrpLGT_pH2Qi5kQDVjASKTyg5KndS9Pd3Z7PKrr0M'
    store.iUserId = '6114b37fac06831154d8d092'
  })

  describe('/POST Admin deposit', () => {
    it('Should be add deposit in user', (done) => {
      request(server)
        .post('/api/admin/deposit/v1')
        .set('Authorization', store.adminToken)
        .send({
          iUserId: store.iUserId,
          nCash: 50.25,
          eType: 'deposit',
          sPassword: 'fantasy@321'
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.successfully.replace('##', messages.English.cDeposit))
          done()
        })
    })
  })

  describe('/POST user deposit', () => {
    it('Should be add user deposit', (done) => {
      request(server)
        .post('/api/user/deposit/v1')
        .set('Authorization', store.userToken)
        .send({
          nAmount: 25,
          ePaymentGateway: 'PAYTM'
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.successfully.replace('##', messages.English.cDeposit))
          done()
        })
    })

    it('Should not be add user deposit', (done) => {
      request(server)
        .post('/api/user/deposit/v1')
        .set('Authorization', store.userToken)
        .send({
          nAmount: 10,
          ePaymentGateway: 'PAYTM'
        })
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.min_err.replace('##', messages.English.cDeposit).replace('#', '15'))
          done()
        })
    })

    it('Should not be add user deposit', (done) => {
      request(server)
        .post('/api/user/deposit/v1')
        .set('Authorization', store.userToken)
        .send({
          nAmount: 55,
          ePaymentGateway: 'PAYTM'
        })
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.max_err.replace('##', messages.English.cDeposit).replace('#', '50'))
          done()
        })
    })

    it('Should not be add user deposit Too Many Request error', (done) => {
      request(server)
        .post('/api/user/deposit/v1')
        .set('Authorization', store.userToken)
        .send({
          nAmount: 25,
          ePaymentGateway: 'PAYTM'
        })
        .expect(status.TooManyRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.limit_reached.replace('##', messages.English.depositRequest))
          done()
        })
    })
  })

  describe('/POST process deposit', () => {
    it('Should be process deposit for user', (done) => {
      request(server)
        .post('/api/admin/deposit/11/v1')
        .set('Authorization', store.adminToken)
        .send({
          ePaymentStatus: 'A'
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.successfully.replace('##', messages.English.cprocessedDeposit))
          done()
        })
    })
  })

  describe('/GET list deposit to admin', () => {
    it('Should be list deposit of user', (done) => {
      request(server)
        .get('/api/admin/deposit/list/v1?start=10&limit=5&status=S')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cDeposit))
          done()
        })
    })
  })
})
