const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const store = {}
const adminAuthServices = require('../admin/auth/services')

describe('Season Routes', () => {
  before(async () => {
    store.ID = undefined
    store.wID = '5f7f0fd9b18344309eb41138'
    store.adminToken = await adminAuthServices.getAdminToken()
  })

  describe('Admin season operations', () => {
    it('Fetch season list', (done) => {
      request(server)
        .get('/api/admin/season/list/v1?order=desc&start=10&limit=10&sportsType=cricket')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          store.ID = res.body.data[0].results[0]._id
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.season))
          done()
        })
    })

    it('Should fetch season id list', (done) => {
      request(server)
        .get('/api/admin/season-id-list/v1?start=10&limit=30')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.season))
          done()
        })
    })

    it('Should fetch season as per id in url', (done) => {
      request(server)
        .get(`/api/admin/season/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.season))
          done()
        })
    })
    it('Should not fetch season as, id in url does not exist', (done) => {
      request(server)
        .get(`/api/admin/season/${store.wID}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.season))
          done()
        })
    })

    it('Should update season as per id in url', (done) => {
      const data = { sName: 'change-test-season' }
      request(server)
        .put(`/api/admin/season/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.season))
          done()
        })
    })

    it('Should not update season because wrong season id', (done) => {
      const data = { sName: 'change-test-season' }
      request(server)
        .put(`/api/admin/season/${store.wID}/v1`)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.season))
          done()
        })
    })
  })

  describe('Admin season-users operations', () => {
    it('Fetch season-user as per _id of season(in url)', (done) => {
      request(server)
        .get(`/api/admin/season-users/${store.ID}/v1?order=desc`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.season))
          done()
        })
    })
    it('Should not fetch season-user as per _id of season as it does not exist', (done) => {
      request(server)
        .get(`/api/admin/season-users/${store.wID}/v1?order=desc`)
        .set('Authorization', store.adminToken)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.season))
          done()
        })
    })

    it('Should export seasons as per id in url', (done) => {
      request(server)
        .get(`/api/admin/season-users-exports/${store.ID}/v1?order=desc`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.season))
          done()
        })
    })
    it('Should not export season user as invalid id passed in url', (done) => {
      request(server)
        .get(`/api/admin/season-users-exports/${store.wID}/v1?order=desc`)
        .set('Authorization', store.adminToken)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.season))
          done()
        })
    })
  })
})
