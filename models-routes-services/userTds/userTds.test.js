const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')
const userAuthServices = require('../user/auth/services')

const store = {}

describe('UserTds Routes', () => {
  before(async() => {
    store.ID = 1
    store.wID = '5f7f0fd9b18344309eb41138'
    store.adminToken = await adminAuthServices.getAdminToken()
    const userData = await userAuthServices.getUserToken()
    store.userToken = userData.Authorization
    store.iUserId = '6114b37fac06831154d8d092'
  })

  describe('/GET list tds to admin', () => {
    it('Should be list tds of user', (done) => {
      request(server)
        .get('/api/admin/tds/list/v1?start=1&limit=5')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cTds))
          if (res.body.data && res.body.data[0]) store.iMatchLeagueId = res.body.data[0].iMatchLeagueId
          done()
        })
    })
  })

  describe('/PUT Admin tds update', () => {
    it('Should be update tds', (done) => {
      request(server)
        .put(`/api/admin/tds/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .send({
          eStatus: 'A'
        })
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cTds))
          done()
        })
    })

    it('Should not be update tds', (done) => {
      request(server)
        .put('/api/admin/tds/xyz/v1')
        .set('Authorization', store.adminToken)
        .send({
          eStatus: 'P'
        })
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cTds))
          done()
        })
    })
  })

  describe('/GET Admin tds total counts', () => {
    it('Should get tds total counts', (done) => {
      request(server)
        .get('/api/admin/tds/counts/v1')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cCounts))
          done()
        })
    })
  })

  describe('/GET Admin match league wise tds list', () => {
    it('Should get match league wise tds', (done) => {
      request(server)
        .get(`/api/admin/tds/match-league-tds/${store.iMatchLeagueId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cTds))
          done()
        })
    })
  })

  describe('/GET Admin match league tds total counts', () => {
    it('Should get match league tds total counts', (done) => {
      request(server)
        .get(`/api/admin/tds/match-league-tds/count/${store.iMatchLeagueId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cCounts))
          done()
        })
    })
  })
})
