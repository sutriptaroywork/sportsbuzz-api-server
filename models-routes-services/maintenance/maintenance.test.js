const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')
const userAuthServices = require('../user/auth/services')

const store = {}
let userData = {}
describe('Maintenance Management Routes', () => {
  before(async () => {
    store.adminToken = await adminAuthServices.getAdminToken()
    userData = await userAuthServices.getUserToken()
    store.wID = '5f7f0fd9b18344309eb41138'
  })

  describe('/PUT Update Maintenance Mode', () => {
    it('Should be deactivate Maintenance Mode', (done) => {
      request(server)
        .put('/api/admin/maintenance-mode/v1')
        .set('Authorization', store.adminToken)
        .send({ bIsMaintenanceMode: false, sMessage: 'Unfortunately the site is down for a bit of maintenance right now. But soon we\'ll be up and the sun will shine again.' })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cmaintenance))
          store.ID = res.body.data._id
          done()
        })
    })

    it('Should not be deactivate Maintenance Mode', (done) => {
      request(server)
        .put('/api/admin/maintenance-mode/v1')
        .set('Authorization', store.adminToken)
        .send({ bIsMaintenanceMode: false })
        .expect(status.UnprocessableEntity)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  describe('/GET details of Maintenance Mode', () => {
    it('Should be details of Maintenance Mode', (done) => {
      request(server)
        .get('/api/admin/maintenance-mode/v1')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) { return done(err) }
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cmaintenance))
          done()
        })
    })
  })
  describe('USER : get details of Maintenance Mode', () => {
    it('Should fetch details of Maintenance Mode', (done) => {
      request(server)
        .get('/api/user/maintenance-mode/v1')
        .set('Authorization', userData)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) { return done(err) }
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cmaintenance))
          done()
        })
    })
  })
})
