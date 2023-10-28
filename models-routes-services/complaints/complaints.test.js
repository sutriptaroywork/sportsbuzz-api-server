const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')
const userAuthServices = require('../user/auth/services')
const store = {}
const userStore = {}
const updateObj = {
  eStatus: 'R'
}

const addComplaints = {
  sTitle: 'test complaintst',
  sDescription: 'HELLO JUST A TESTING',
  eType: 'C'
}
describe('complaints Routes', () => {
  before(async () => {
    store.token = await adminAuthServices.getAdminToken()
    store.ID = undefined
    store.permission = undefined
    store.wID = '5f892aee05b16f154f12b60e'
    const userToken = await userAuthServices.getUserToken('INTERNAL')
    userStore.token = userToken.Authorization
  })

  describe('Admin : GET a particular complaint', () => {
    it('Should return a specific complaint', (done) => {
      request(server)
        .get('/api/admin/complaint/61dfb261387427b392107655/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.complaints))
          done()
        })
    })
  })

  describe('Admin : fetch complaints as per params', () => {
    it('Should return complaintss as per the paramter', (done) => {
      // possible status 'P', 'I', 'D', 'R', possible type C,F
      request(server)
        .get('/api/admin/complaint/v1?status=R&type=C&iUserId=61b32fa62da0f3e9f64b9ac0')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.complaints))
          done()
        })
    })
  })

  describe('Admin : update complaints', () => {
    it('update complaint status', (done) => {
      request(server)
        .put('/api/admin/complaint/61f942987ee81f6cd5c4c55e/v1')
        .set('Authorization', store.token)
        .send(updateObj)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.complaints))
          done()
        })
    })
  })

  describe('Admin : update complaints(provide complaint id which does not exists)', () => {
    it('update complaint status should fail(invalid complaint id)', (done) => {
      request(server)
        .put('/api/admin/complaint/61b0881b0e7f242bd65cad11/v1')
        .set('Authorization', store.token)
        .send(updateObj)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.complaints))
          done()
        })
    })
  })

  describe('user add complaint', () => {
    it('add complaints by user', (done) => {
      request(server)
        .post('/api/user/complaint/v1')
        .set('Authorization', userStore.token)
        .send(addComplaints)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.complaints))
          done()
        })
    })
  })

  describe("user's complaint list", () => {
    it('all complaints of user will be returned', (done) => {
      request(server)
        .get('/api/user/complaint/list/v1')
        .set('Authorization', userStore.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.complaints))
          done()
        })
    })
  })

  describe("user's particular complaint", () => {
    it('particular complaint will be returned(as per the id specified in the url)', (done) => {
      request(server)
        .get('/api/user/complaint/6209ebd11af13ce5922c0664/v1')
        .set('Authorization', userStore.token)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.complaints))
          done()
        })
    })
  })
})
