const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../../index')
const { messages, status } = require('../../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../../admin/auth/services')

const store = {}

describe('Promocode Stats Routes', () => {
  before(async() => {
    store.ID = undefined
    store.wId = '5f7f0fd9b18344309eb41138'
    store.token = await adminAuthServices.getAdminToken()
  })

  describe('/GET admin side promocode list', () => {
    it('Should be fetch promocode list', (done) => {
      request(server)
        .get('/api/admin/promocode/list/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpromocode))
          store.ID = res.body.data[0].results[0]._id
          done()
        })
    })
  })

  describe('/GET admin side promocode stats', () => {
    it('Should be fetch promocode stats', (done) => {
      request(server)
        .get(`/api/admin/promocode/stats/${store.ID}/v2`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpromocodeStatistic))
          done()
        })
    })
  })
})
