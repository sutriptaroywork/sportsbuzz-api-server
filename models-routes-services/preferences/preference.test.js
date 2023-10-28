const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const store = {}
let routes = {}
const adminAuthServices = require('../admin/auth/services')
const userAuthServices = require('../user/auth/services')

describe('Preference Routes', () => {
  before(async() => {
    routes = {
      add: '/api/admin/preferences/add/v1',
      get: '/api/admin/preferences/6215d041108b345db785799f/v1',
      update: '/api/admin/preferences/6215d041108b345db785799f/v1',
      userGet: '/api/user/preferences/6215d041108b345db785799f/v1',
      userUpdate: '/api/user/preferences/v1'
    }

    store.ID = undefined
    store.wID = '5f7f0fd9b18344309eb41138'
    store.adminToken = await adminAuthServices.getAdminToken()
    store.userToken = await userAuthServices.getUserToken('INTERNAL')
  })

  describe('/POST Add Preference', () => {
    it('Should be add Preference', (done) => {
      request(server)
        .post(routes.add)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cpreferences))
          done()
        })
    })

    it('Should fetch admin preference', (done) => {
      request(server)
        .get(routes.get)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpreferences))
          done()
        })
    })
    it('Should update admin preference by passing _id of user in url params', (done) => {
      request(server)
        .put(routes.update)
        .set('Authorization', store.adminToken)
        .send({ bEmails: 'false' })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cpreferences))
          done()
        })
    })
  })
  describe('user routes', () => {
    it('Should fetch preference for user as per userid(sent in url params)', (done) => {
      request(server)
        .get(routes.userGet)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpreferences))
          done()
        })
    })
    it('update user preference', (done) => {
      const userPreference = { bSms: true }
      request(server)
        .put(routes.userUpdate)
        .set('Authorization', store.userToken)
        .send(userPreference)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cpreferences))
          done()
        })
    })
  })
})
