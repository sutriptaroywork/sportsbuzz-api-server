const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../../index')
const { messages, status } = require('../../../helper/api.responses')
const expect = require('expect')
const { randomStr } = require('../../../helper/utilities.services')
const store = {}

describe('Fantasy Post routes', () => {
  before(() => {
    store.ID = '552424'
    store.wId = '6524301222'
    store.userToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2MGU2ZGFhYjg0N2M1OTIzOWMyYTdiZmYiLCJpYXQiOjE2MzA1NjY0MzcsImV4cCI6MTYzODM0MjQzN30.hIxL6RExLBhsi3zqVOar1eXwRPoUKqUP2e_gciJMWcA'
  })

  describe('/GET Fantasy Tips post', () => {
    it('Should be get fantasy post', (done) => {
      request(server)
        .get(`/api/user/predictions/${store.ID}/v1`)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.sfantasyTips))
          done()
        })
    })

    it('Should be get fantasy post for admin', (done) => {
      request(server)
        .get(`/api/admin/predictions/${store.ID}/v1`)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.sfantasyTips))
          done()
        })
    })

    it('Should not be get fantasy post', (done) => {
      const wId = randomStr(6, 'otp')
      request(server)
        .get(`/api/user/predictions/${wId}/v1`)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.sfantasyTips))
          done()
        })
    })
  })
})
