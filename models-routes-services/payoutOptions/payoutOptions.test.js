const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')
const userAuthServices = require('../user/auth/services')

const store = {}
let userData = {}
describe('payout option Routes', () => {
  before(async () => {
    store.adminToken = await adminAuthServices.getAdminToken()
    userData = await userAuthServices.getUserToken()
    store.wID = '62e2758639093cd5b56632ce'
  })

  describe('/GET  User get payout options', () => {
    it('Should fetch all payout options', (done) => {
      request(server)
        .get('/api/user/payout-option/list/v2')
        .set('Authorization', userData)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpayoutOptions))
          done()
        })
    })
  })

  describe('/GET Admin get details of payout options', () => {
    it('Should fetch the payout options', (done) => {
      request(server)
        .get('/api/admin/payout-option/list/v1')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpayoutOption))
          done()
        })
    })
  })

  describe('/POST admin: add particular payout option details', () => {
    it('Should add payout option', (done) => {
      request(server)
        .post('/api/admin/payout-option/add/v1')
        .set('Authorization', store.adminToken)
        .send({
          sTitle: 'Faster and easy',
          eType: 'INSTANT',
          eKey: 'PAYTM'
        })
        .expect(status.OK)
        .end(function (err, res) {
          if (err) { return done(err) }
          store.pId = res.body.data._id
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.snewPayoutOption))
          done()
        })
    })

    it('Should not add payout option as data is not sufficient', (done) => {
      request(server)
        .post('/api/admin/payout-option/add/v1')
        .set('Authorization', store.adminToken)
        .send({
          sTitle: 'Faster and easy',
          eType: 'INSTANT'
        })
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  describe('/GET admin : particular payout option details', () => {
    it('Should fetch details of particular payout option', (done) => {
      request(server)
        .get(`/api/admin/payout-option/${store.pId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpayoutOption))
          done()
        })
    })

    it('Should not fetch details of particular payout as invalid _id passed', (done) => {
      request(server)
        .get(`/api/admin/payout-option/${store.wID}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cpayoutOption))
          done()
        })
    })
  })

  describe('/POST admin: add pre signed url', () => {
    it('Should add pre signed url', (done) => {
      request(server)
        .post('/api/admin/payout-option/pre-signed-url/v1')
        .set('Authorization', store.adminToken)
        .send({
          sFileName: 'test.jpg',
          sContentType: 'image/jpeg'
        })
        .expect(status.OK)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          done()
        })
    })

    it('Should not add pre signed url', (done) => {
      request(server)
        .post('/api/admin/payout-option/pre-signed-url/v1')
        .set('Authorization', store.adminToken)
        .send({
          sFileName: 'test.jpg'
        })
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  describe('/PUT admin: update payout option', () => {
    it('Should update payout option', (done) => {
      request(server)
        .put(`/api/admin/payout-option/${store.pId}/v1`)
        .set('Authorization', store.adminToken)
        .send({
          sTitle: 'Faster test and easy',
          eType: 'INSTANT',
          eKey: 'CASHFREE'
        })
        .expect(status.OK)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cpayoutOptionDetails))
          done()
        })
    })

    it('Should not update payout option as wID does not exist', (done) => {
      request(server)
        .put(`/api/admin/payout-option/${store.wID}/v1`)
        .set('Authorization', store.adminToken)
        .send({
          sTitle: 'Faster and easy',
          eType: 'INSTANT',
          eKey: 'CASHFREE'
        })
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cpayoutOption))
          done()
        })
    })
  })
})
