const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../../index')
const { messages, status } = require('../../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../../admin/auth/services')
const userAuthServices = require('../../user/auth/services')

const store = {}

describe('Banner Stats Routes', () => {
  before(async () => {
    const adminToken = await adminAuthServices.getAdminToken()
    const userData = await userAuthServices.getUserToken()
    const userToken = userData.Authorization
    store.ID = undefined
    store.adminToken = adminToken
    store.userToken = userToken
  })

  describe('/GET admin side banner list', () => {
    it('Should be fetch banner list', (done) => {
      request(server)
        .get('/api/admin/banner/list/v1')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.banner))
          store.ID = res.body.data[0].results[0]._id
          done()
        })
    })
  })

  describe('/POST User side log banner stats', () => {
    it('Should be log banner stats', (done) => {
      request(server)
        .post(`/api/user/banner/log/${store.ID}/v1`)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cbannerLog))
          done()
        })
    })
  })

  describe('/GET admin side banner stats', () => {
    it('Should be fetch banner stats', (done) => {
      request(server)
        .get(`/api/admin/banner/stats/${store.ID}/v2`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cbannerStatistic))
          done()
        })
    })
  })
})
