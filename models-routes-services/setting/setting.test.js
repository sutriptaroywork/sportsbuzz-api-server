const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')

const store = {}

describe('Setting Routes', () => {
  before(async() => {
    store.ID = undefined
    store.wID = '5f7f0fd9b18344309eb41138'

    store.adminToken = await adminAuthServices.getAdminToken()
  })

  describe('/POST Admin settings', () => {
    it('Should be add settings in user', (done) => {
      request(server)
        .post('/api/admin/setting/v1')
        .set('Authorization', store.adminToken)
        .send({
          sTitle: 'test setting',
          sKey: 'TESTS' + Date.now(),
          nMax: 100,
          nMin: 10
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          store.ID = res.body.data._id
          store.sKey = res.body.data.sKey
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cnewSetting))
          done()
        })
    })

    it('Should not be add settings in user', (done) => {
      request(server)
        .post('/api/admin/setting/v1')
        .set('Authorization', store.adminToken)
        .send({
          sTitle: 'test setting',
          sKey: 'TEST',
          nMax: 100,
          nMin: 10
        })
        .expect(status.ResourceExist)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.cvalidationSetting))
          done()
        })
    })
  })

  describe('/GET Admin settings', () => {
    it('Should be list settings in user', (done) => {
      request(server)
        .get('/api/admin/setting/list/v1?start=5&limit=5')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.csetting))
          done()
        })
    })
  })

  describe('/GET Admin settings', () => {
    it('Should be get settings in user', (done) => {
      request(server)
        .get(`/api/admin/setting/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.csetting))
          done()
        })
    })

    it('Should not be get settings in user', (done) => {
      request(server)
        .get(`/api/admin/setting/${store.wID}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.csetting))
          done()
        })
    })
  })

  describe('/PUT Admin settings', () => {
    it('Should be update settings in user', (done) => {
      request(server)
        .put(`/api/admin/setting/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .send({
          sKey: store.sKey,
          nMax: 50,
          nMin: 10
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.csetting))
          done()
        })
    })

    it('Should not be update settings in user', (done) => {
      request(server)
        .put(`/api/admin/setting/${store.wID}/v1`)
        .set('Authorization', store.adminToken)
        .send({
          sKey: store.sKey + 'test',
          nMax: 50,
          nMin: 10
        })
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.csetting))
          done()
        })
    })
  })

  describe('/POST Admin Currency logo add/update', () => {
    it('Should be add/update currency logo', (done) => {
      request(server)
        .post('/api/admin/currency/v1')
        .set('Authorization', store.adminToken)
        .send({
          sTitle: 'India',
          sShortName: 'IND',
          sLogo: '₹'
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.currency))
          done()
        })
    })
  })

  describe('/GET Admin Currency logo', () => {
    it('Should be get Admin Currency logo', (done) => {
      request(server)
        .get('/api/admin/currency/v1')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.currency))
          done()
        })
    })
  })

  describe('/GET User Currency logo', () => {
    it('Should be get User Currency logo', (done) => {
      request(server)
        .get('/api/user/currency/v1')
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.currency))
          done()
        })
    })
  })
  describe('/GET User setting', () => {
    it('Should fetch the setting as per type', (done) => {
      const type = 'Deposit'
      // type can be deposit, withdraw, PrivateLeague
      request(server)
        .get(`/api/user/setting/${type}/v1`)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          if (type === 'PrivateLeague') {
            expect(res.body.data.oSize).toBeA('object')
            expect(res.body.data.oPrize).toBeA('object')
            expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.csetting))
          } else {
            expect(res.body.data).toBeA('object')
            expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.csetting))
          }
          done()
        })
    })
    it('Should fetch the setting as per type', (done) => {
      const type = 'Deposit'
      // type can be deposit, withdraw, PrivateLeague
      request(server)
        .get(`/api/user/setting/${type}/v2`)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          if (type === 'PrivateLeague') {
            expect(res.body.data.oSize).toBeA('object')
            expect(res.body.data.oPrize).toBeA('object')
            expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.csetting))
          } else {
            expect(res.body.data).toBeA('object')
            expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.csetting))
          }
          done()
        })
    })
  })

  describe('/POST Admin Side Background add/update', () => {
    it('Should be add/update Side Background', (done) => {
      request(server)
        .post('/api/admin/side-background/v1')
        .set('Authorization', store.adminToken)
        .send({
          sImage: 'site-background/1632374821842_banner1.jpg',
          sKey: 'IMG'
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.sideBackground))
          done()
        })
    })
    it('Should fetch side background as per key send in url', (done) => {
      request(server)
        .get(`/api/admin/side-background/${store.sKey}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.sideBackground))
          done()
        })
    })
  })

  describe('/GET User Side Background', () => {
    it('Should be get Side Background', (done) => {
      request(server)
        .get('/api/user/side-background/v1')
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.sideBackground))
          done()
        })
    })
  })

  describe('/POST Pre-signed url for Background', () => {
    it('should be a pre-signed url of Background image', (done) => {
      const data = {
        sFileName: 'img.jpg',
        sContentType: 'image/jpeg'
      }
      request(server)
        .post('/api/admin/side-background/pre-signed-url/v1')
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          done()
        })
    })
  })
  describe('/GET Admin setting validation as per url params fetch', () => {
    it('Should fetch admin setting validation', (done) => {
      request(server)
        .get(`/api/admin/setting-validation/${store.sKey}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.csetting))
          done()
        })
    })
  })
})
