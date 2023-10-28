const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const expect = require('expect')
const { status, messages } = require('../../helper/api.responses')
const adminAuthServices = require('../admin/auth/services')
const userAuthServices = require('../user/auth/services')

const store = {}
let routes = {}

describe('Payment routes', () => {
  before(async () => {
    routes = {
      userPaymentOption: '/api/user/payment-option/list/v2',
      list: '/api/admin/payment-option/list/v1?start=10&limit=10&order=desc',
      add: '/api/admin/payment-option/add/v1',
      getSignedUrl: '/api/admin/payment-option/pre-signed-url/v1'
    }
    store.ID = undefined
    store.wId = '5f7f0fd9b18344309eb41138'
    store.adminToken = await adminAuthServices.getAdminToken()
    store.userToken = await userAuthServices.getUserToken()
  })

  describe('/POST Get signed url for payment image', () => {
    it('Should be get signed url', (done) => {
      request(server)
        .post(routes.getSignedUrl)
        .set('Authorization', store.adminToken)
        .send({
          sFileName: 'payment.jpg',
          sContentType: 'image/jpeg'
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          store.imageUrl = res.body.data.sPath
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          done()
        })
    })

    it('Should not get signed url beacuse of insufficant data', (done) => {
      request(server)
        .post(routes.getSignedUrl)
        .set('Authorization', store.adminToken)
        .send({
          sFileName: 'player.jpg'
        })
        .expect(status.UnprocessableEntity)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  describe('/Post Add payment option', () => {
    it('Should add payment option', (done) => {
      const data = {
        sImage: store.imageUrl,
        sName: 'PHONE PAY test bhavin',
        nOrder: '1',
        eKey: 'PAYTM',
        sOffer: ''
      }
      request(server)
        .post(routes.add)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          store.ID = res.body.data._id
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.snewPaymentOption))
          done()
        })
    })
  })

  describe('/Put Update payment option', () => {
    it('update payment option', (done) => {
      const data = {
        sImage: 'payment-option/1611300793592_test4.jpg',
        sName: 'PHONE PAY',
        nOrder: '1',
        sOffer: ''
      }
      request(server)
        .put(`/api/admin/payment-option/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cpaymentOptionDetails))
          done()
        })
    })

    it('Should not update payment option', (done) => {
      const data = {
        sImage: 'payment-option/1611300793592_test4.jpg',
        sName: 'PHONE PAY',
        nOrder: '1',
        eStatus: 'Y',
        sOffer: ''
      }
      request(server)
        .put(`/api/admin/payment-option/${store.wId}/v1`)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cpaymentOption))
          done()
        })
    })
  })

  describe('Admin get payment option', () => {
    it('Should get payment option for admin', (done) => {
      request(server)
        .get(routes.list)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpaymentOption))
          done()
        })
    })

    it('Should get particular payment option', (done) => {
      request(server)
        .get(`/api/admin/payment-option/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpaymentOption))
          done()
        })
    })

    it('Should not get payment option as wId does not exist', (done) => {
      request(server)
        .get(`/api/admin/payment-option/${store.wId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cpaymentOption))
          done()
        })
    })
  })

  describe('/Get payment option list for users', () => {
    // it('Should get payment option list', (done) => {
    //   request(server)
    //     .get(routes.userList)
    //     .expect(status.OK)
    //     .end(function(err, res) {
    //       if (err) return done(err)
    //       expect(res.body.data).toBeA('array')
    //       expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpaymentOptions))
    //       done()
    //     })
    // })
    it('User: Should get payment option list v2', (done) => {
      request(server)
        .get(routes.userPaymentOption)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpaymentOptions))
          done()
        })
    })
  })

  describe('/PUT admin update payment option', () => {
    it('admin: Should not update payment option as id passed in url does not exist', (done) => {
      request(server)
        .put('/api/admin/payment-option/61af2e0b1213e52cef3f7fea/v1')
        .set('Authorization', store.adminToken)
        .send({
          sName: 'test-payment-option'
        })
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cpaymentOption))
          done()
        })
    })
    it('admin: Should update payment option', (done) => {
      request(server)
        .put(`/api/admin/payment-option/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .send({
          sName: 'test-payment-option'
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cpaymentOptionDetails))
          done()
        })
    })
    it('admin: Should not update payment option because insufficant data', (done) => {
      request(server)
        .put(`/api/admin/payment-option/${store.wId}/v1`)
        .set('Authorization', store.adminToken)
        .send({})
        .expect(status.UnprocessableEntity)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })
})
