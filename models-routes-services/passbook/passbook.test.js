const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')
const userAuthServices = require('../user/auth/services')

const store = {}

describe('Passbook Routes', () => {
  before(async () => {
    const adminToken = await adminAuthServices.getAdminToken()
    const userData = await userAuthServices.getUserToken()
    const userToken = userData.Authorization
    store.ID = undefined
    store.wID = '5f7f0fd9b18344309eb41138'
    store.adminToken = adminToken
    store.userToken = userToken
    store.iUserId = '60e6daab847c59239c2a7bff'
  })

  describe('/GET list passbook to admin', () => {
    it('Should be list passbook of user', (done) => {
      request(server)
        .get('/api/admin/passbook/list/v1?start=0&limit=5')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpassbook))
          done()
        })
    })
  })

  describe('/GET list passbook to user', () => {
    it('Should be list passbook of user', (done) => {
      request(server)
        .get('/api/user/passbook/list/v1?start=0&limit=5')
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpassbook))
          done()
        })
    })
  })
})
