const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../../index')
const { messages, status } = require('../../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../../admin/auth/services')

const store = {}

describe('User Statistics Routes', () => {
  before(async() => {
    store.ID = undefined
    store.wId = '5f7f0fd9b18344309eb41138'
    store.token = await adminAuthServices.getAdminToken()
  })

  describe('/Get User: Users profile list', () => {
    it('should get list of users profile ', (done) => {
      request(server)
        .get('/api/admin/profile/v2')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data.results).toBeA('array')
          store.ID = res.body.data.results[0]._id
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cusers))
          done()
        })
    })
  })

  describe('/Get System user list', () => {
    it('should get list of system users ', (done) => {
      request(server)
        .get('/api/admin/system-user/list/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.csystemUsers))
          store.systemUserId = res.body.data[0].results[0]._id
          done()
        })
    })
  })

  describe('/GET Admin: List of users statistics', () => {
    it('Should be fetch statistics list', (done) => {
      request(server)
        .get(`/api/admin/statistics/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cusers))
          done()
        })
    })
  })

  describe('/GET Admin: leadership board', () => {
    it('Should be fetch leadership board', (done) => {
      request(server)
        .get('/api/admin/leadership-board/v2')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cusers))
          done()
        })
    })
  })

  describe('/POST Admin: add season to leadership board', () => {
    it('Should be add season leadership board', (done) => {
      request(server)
        .post('/api/admin/leadership-board-add-season/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cusers))
          done()
        })
    })
  })

  describe('/GET Admin: system user statistics', () => {
    it('Should be fetch system user statistics', (done) => {
      request(server)
        .get(`/api/admin/system-user/statistics/${store.systemUserId}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cusers))
          done()
        })
    })

    it('Should not be fetch system user statistics', (done) => {
      request(server)
        .get(`/api/admin/system-user/statistics/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.user))
          done()
        })
    })
  })

  describe('/GET User: leadership board', () => {
    it('Should be fetch leadership board', (done) => {
      request(server)
        .get('/api/user/leadership-board/v2')
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cusers))
          done()
        })
    })
  })

  describe('/POST Admin: calculate leadership board', () => {
    it('Should be calculate leadership board', (done) => {
      request(server)
        .post('/api/admin/leadership-board/v2')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cusers))
          done()
        })
    })
  })
})
