const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const userAuthServices = require('../user/auth/services')
const store = {}

describe('Country Routes', () => {
  before(async () => {
    const userToken = await userAuthServices.getUserToken('')
    store.token = userToken
  })
  describe('/GET country list', () => {
    it('Should be fetch country list', (done) => {
      request(server)
        .get('/api/user/country/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.countries))
          done()
        })
    })

    it('Should not be fetch country list', (done) => {
      request(server)
        .get('/api/user/country/v1')
        .expect(status.Unauthorized)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.err_unauthorized)
          done()
        })
    })

    it('Should be fetch country list for admin', (done) => {
      request(server)
        .get('/api/admin/country/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.countries))
          done()
        })
    })
  })
})
