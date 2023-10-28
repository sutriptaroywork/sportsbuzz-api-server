const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')

const store = {}

describe('Version Management routes', () => {
  before(async () => {
    store.ID = undefined
    store.wId = '61b7538be93d171e9f30fbef'
    store.adminToken = await adminAuthServices.getAdminToken()
    store.platform = 'A'
  })

  describe('/Post Add version', () => {
    it('Should be add version', (done) => {
      const data = {
        sName: 'New-version-bhavin',
        sDescription: 'This version will be just for testing',
        eType: 'A',
        sVersion: '1.0.0',
        sUrl: 'https://www.url.com'
      }
      request(server)
        .post('/api/admin/version/add/v1')
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          store.ID = res.body.data._id
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.newVersion))
          done()
        })
    })

    it('Should not add version because url is invalid', (done) => {
      const data = {
        sName: 'New',
        sDescription: 'This version will add 12th man feture',
        eType: 'A',
        sVersion: '2.0',
        sUrl: 'url/urlcom'
      }
      request(server)
        .post('/api/admin/version/add/v1')
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.url))
          done()
        })
    })
    it('Should not add version because insufficant data', (done) => {
      const data = {
        sName: 'New'
      }
      request(server)
        .post('/api/admin/version/add/v1')
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.status).toMatch('422')
          done()
        })
    })
  })

  describe('/Get Get version details', () => {
    it('Should be send notification to single user', (done) => {
      request(server)
        .get(`/api/admin/version/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.version))
          done()
        })
    })
  })

  describe('/Put update version details', () => {
    it('Should get notification unread count', (done) => {
      const data = {
        sName: 'New-test-version-bhavin-one-modified',
        sDescription: 'This version will be just test one',
        eType: 'A',
        sVersion: '4.0',
        sUrl: 'https://www.url.com'
      }
      request(server)
        .put(`/api/admin/version/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.versionDetails))
          done()
        })
    })
    it('Should not update version because id passed in url is invalid/not exists', (done) => {
      const data = {
        sName: 'New',
        sDescription: 'This version will add 12th man feture',
        eType: 'A',
        sVersion: '2.0'
      }
      request(server)
        .put(`/api/admin/version/${store.wId}/v1`)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.version))
          done()
        })
    })
  })

  describe('/Get List of version for admin', () => {
    it('Should be get list of Version', (done) => {
      request(server)
        .get('/api/admin/version/list/v1?order=desc&search=v')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end((err, res) => {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.version))
          done()
        })
    })
  })

  describe('/Get User: get version', () => {
    it('Should be get version', (done) => {
      request(server)
        .get('/api/user/version/v1')
        .set('Platform', store.platform)
        .expect(status.OK)
        .end((err, res) => {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.version))
          done()
        })
    })
  })

  describe('/DELETE delete version', () => {
    it('Should be delete version', (done) => {
      request(server)
        .delete(`/api/admin/version/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end((err, res) => {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.del_success.replace('##', messages.English.version))
          done()
        })
    })

    it('Should not be delete version', (done) => {
      request(server)
        .delete(`/api/admin/version/${store.wId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.version))
          done()
        })
    })
  })
})
