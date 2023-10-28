const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')

const store = {}

describe('UserBalance Routes', () => {
  before(() => {
    store.ID = undefined
    store.wID = '5f7f0fd9b18344309eb41138'
    store.adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI1ZjNmOTVjOTU4NzlkMDM0ODQxOTQ4YWMiLCJpYXQiOjE2MTg4MDc0NzYsImV4cCI6MTYyNjU4MzQ3Nn0.ukxCm3osEsW-wQBz3yzxqFSBExJ7z4GqxpMSBIs5dbg'
    store.userToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2MGU2ZGFhYjg0N2M1OTIzOWMyYTdiZmYiLCJpYXQiOjE2MjU3NDM5MTEsImV4cCI6MTYzMzUxOTkxMX0.5OwwcaVA9-EeD4GiHkqCohNMdV1TvZEEva1AYP-zezg'
    store.iUserId = '60e6daab847c59239c2a7bff'
  })

  describe('/GET list user balance to admin', () => {
    it('Should be list user balance of user', (done) => {
      request(server)
        .get(`/api/admin/balance/${store.iUserId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cBalance))
          done()
        })
    })
  })
})
