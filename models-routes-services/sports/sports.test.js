const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')

const store = {}

describe('sport Routes', () => {
  before(async () => {
    store.ID = undefined
    store.wId = '607d11da4deb8e05865a4581'
    store.token = await adminAuthServices.getAdminToken()
  })

  describe('/POST Add sport', () => {
    it('Should be add sport', (done) => {
      const sport = {
        sName: 'BASEBALL test' + Date.now(),
        sKey: 'BASEBALL' + Date.now(),
        oRule: {
          nTotalPlayers: '12',
          nMaxPlayerOneTeam: '19'
        }
      }
      request(server)
        .post('/api/admin/sport/v1')
        .set('Authorization', store.token)
        .send(sport)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cnewSport))
          store.ID = res.body.data._id
          done()
        })
    })

    it('Should not be add sport', (done) => {
      const sport = {
        sName: 'CRICKET',
        sKey: 'CRIC'
      }
      request(server)
        .post('/api/admin/sport/v1')
        .set('Authorization', store.token)
        .send(sport)
        .expect(status.ResourceExist)
        .end(function(err, res) {
          if (err) done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.csport))
          done()
        })
    })
  })

  describe('/GET sport list', () => {
    it('Should be fetch sport list', (done) => {
      request(server)
        .get('/api/admin/sport/list/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.csport))
          done()
        })
    })
  })

  describe('/PUT Update a Sport', () => {
    it('Should be update sport', (done) => {
      const sport = {
        sName: 'BASEBALL',
        sKey: 'BASEBALL' + Date.now()
      }
      request(server)
        .put(`/api/admin/sport/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(sport)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.csport))
          store.ID = res.body.data._id
          done()
        })
    })

    it('Should not be update sport', (done) => {
      const sport = {
        sName: 'BASEBALL',
        sKey: 'CRIC'
      }
      request(server)
        .put(`/api/admin/sport/${store.wId}/v1`)
        .set('Authorization', store.token)
        .send(sport)
        .expect(status.ResourceExist)
        .end(function(err, res) {
          if (err) done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.csport))
          done()
        })
    })
  })

  describe('/GET get particular a Sport', () => {
    it('Should be fetch particular sport', (done) => {
      request(server)
        .get(`/api/admin/sport/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.csport))
          done()
        })
    })

    it('Should not be fetch particular sport', (done) => {
      request(server)
        .get(`/api/admin/sport/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.csport))
          done()
        })
    })
  })

  describe('Active sports api', () => {
    it('fetch active-sports', (done) => {
      request(server)
        .get('/api/admin/match/active-sports/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cactiveSports))
          done()
        })
    })
    it('fetch active-sports v2', (done) => {
      request(server)
        .get('/api/user/match/active-sports/v2')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cactiveSports))
          done()
        })
    })
  })
})
