const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')
const userAuthServices = require('../user/auth/services')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const store = {}

describe('MatchLeague routes', () => {
  before(async() => {
    store.token = await adminAuthServices.getAdminToken()
    const userData = await userAuthServices.getUserToken()
    store.userToken = userData
    store.iMatchId = ''
    store.iLeagueId = ''
    store.wID = ObjectId()
  })

  describe('/GET match list', () => {
    it('Should be get Match list', (done) => {
      request(server)
        .get('/api/admin/match/list/v1?start=0&limit=10&sort=sName&sportsType=cricket')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.match))
          store.iMatchId = res.body.data[0].results[0]._id
          done()
        })
    })
    it('Should be get completed Match list', (done) => {
      request(server)
        .get('/api/admin/match/list/v1?start=0&limit=10&sort=sName&sportsType=cricket&filter=cmp')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.match))
          store.iMatchIdCmp = res.body.data[0].results[0]._id
          done()
        })
    })
  })
  describe('/GET league list', () => {
    it('Should be get league list', (done) => {
      request(server)
        .get('/api/admin/league/list/v1?start=0&limit=10&sort=dCreatedAt&order=des&searchField=&search=&searchCategory=&sportsType=CRICKET')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cleague))
          store.iLeagueId = res.body.data[0].results[0]._id
          done()
        })
    })
  })

  describe('/POST MatchLeague add', () => {
    it('Should be add MatchLeague', (done) => {
      request(server)
        .post('/api/admin/match-league/v1')
        .set('Authorization', store.token)
        .send({
          iMatchId: store.iMatchId,
          iLeagueId: [{
            _id: store.iLeagueId
          }]
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cnewMatchLeague))
          done()
        })
    })

    it('Should not add MatchLeague', (done) => {
      request(server)
        .post('/api/admin/match-league/v1')
        .set('Authorization', store.token)
        .send({
          iMatchId: store.iLeagueId,
          iLeagueId: [store.iLeagueId]
        })
        .expect(status.NotFound)
        .end(done)
    })
  })

  describe('/GET MatchLeague list', () => {
    it('Should be get League list', (done) => {
      request(server)
        .get(`/api/admin/match-league/${store.iMatchId}/list/v1?sportsType=cricket`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cmatchLeague))
          store.iMatchLeagueId = res.body.data[0].results[0]._id
          done()
        })
    })
  })

  describe('/GET MatchLeague ', () => {
    it('Should be get single MatchLeague', (done) => {
      request(server)
        .get(`/api/admin/match-league/${store.iMatchId}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cmatchLeague))
          done()
        })
    })
  })

  describe('/GET Match league Cashback Details list', () => {
    it('Should be get Cashback Details list', (done) => {
      request(server)
        .get(`/api/admin/match-league/${store.iMatchLeagueId}/cashback-details/v2?search=tes`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.data.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cmatchLeague))
          done()
        })
    })

    it('Should not be get Cashback Details list', (done) => {
      request(server)
        .get(`/api/admin/match-league/${store.wID}/cashback-details/v2?search=`)
        .set('Authorization', store.token)
        .expect(status.BadRequest)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cmatchLeague))
          done()
        })
    })
  })

  describe('/GET Check Fair Play Details', () => {
    it('Should be Check Fair Play Details for specific Match League', (done) => {
      request(server)
        .get(`/api/admin/check-fair-play/${store.iMatchLeagueId}/v1?sType=MATCH_LEAGUE`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.successfully.replace('##', messages.English.processFairPlay))
          done()
        })
    })

    it('Should be Check Fair Play Details for specific Match', (done) => {
      request(server)
        .get(`/api/admin/check-fair-play/${store.iMatchIdCmp}/v1?sType=MATCH`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.successfully.replace('##', messages.English.processFairPlay))
          done()
        })
    })

    it('Should not be Check Fair Play Details for specific Match League', (done) => {
      request(server)
        .get(`/api/admin/check-fair-play/${store.wID}/v1?sType=MATCH_LEAGUE`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cmatchLeague))
          done()
        })
    })

    it('Should not be Check Fair Play Details for specific Match', (done) => {
      request(server)
        .get(`/api/admin/check-fair-play/${store.wID}/v1?sType=MATCH`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.match))
          done()
        })
    })

    it('Should not be Check Fair Play Details for specific Match', (done) => {
      request(server)
        .get(`/api/admin/check-fair-play/${store.iMatchId}/v1?sType=MATCH`)
        .set('Authorization', store.token)
        .expect(status.BadRequest)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.match_not_started)
          done()
        })
    })
  })

  describe('/GET Admin: single MatchLeague', () => {
    it('Should be get single MatchLeague', (done) => {
      request(server)
        .get(`/api/admin/single-match-league/${store.iMatchLeagueId}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cmatchLeague))
          done()
        })
    })

    it('Should not be get single MatchLeague', (done) => {
      request(server)
        .get(`/api/admin/single-match-league/${store.wID}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cmatchLeague))
          done()
        })
    })
  })

  describe('/GET Admin: upcoming MatchLeague', () => {
    it('Should be get upcoming MatchLeague', (done) => {
      request(server)
        .get(`/api/admin/upcoming-match-league/${store.iMatchId}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cmatchLeague))
          done()
        })
    })

    it('Should not be get upcoming MatchLeague', (done) => {
      request(server)
        .get(`/api/admin/upcoming-match-league/${store.wID}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cmatchLeague))
          done()
        })
    })
  })

  describe('/GET Admin: final league count', () => {
    it('Should be get final league count', (done) => {
      request(server)
        .get(`/api/admin/final-league-count/${store.iMatchId}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cmatchLeague))
          done()
        })
    })
  })

  describe('/GET Admin: match league report', () => {
    it('Should be get match league report', (done) => {
      request(server)
        .get(`/api/admin/final-league-count/${store.iMatchId}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cmatchLeague))
          done()
        })
    })
  })

  describe('/GET Admin: get process count', () => {
    it('Should be get process count', (done) => {
      request(server)
        .get(`/api/admin/match-league/${store.iMatchLeagueId}/get-process-count/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cmatchLeague))
          done()
        })
    })
  })

  describe('/PUT Admin: bot create enable in match league', () => {
    it('Should be update MatchLeague for bot create', (done) => {
      const data = { bBotCreate: true }
      request(server)
        .put(`/api/admin/match-league/bot-create/${store.iMatchLeagueId}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cmatchLeague))
          done()
        })
    })

    it('Should not be update match league for bot create because id is invalid', (done) => {
      const data = { bBotCreate: true }
      request(server)
        .put(`/api/admin/match-league/bot-create/${store.wID}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cmatchLeague))
          done()
        })
    })
  })

  describe('/GET Admin: get promo code usage of match league ', () => {
    it('Should be get promo code usage', (done) => {
      request(server)
        .get(`/api/admin/match-league/${store.iMatchLeagueId}/promo-usage/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cmatchLeague))
          done()
        })
    })
  })

  describe('/GET User: MatchLeague for user', () => {
    it('Should be get single MatchLeague', (done) => {
      request(server)
        .get(`/api/user/match-league/${store.iMatchLeagueId}/v1`)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cmatchLeague))
          done()
        })
    })

    it('Should not get MatchLeague', (done) => {
      request(server)
        .get(`/api/user/match-league/${store.iMatchId}/v1`)
        .set('Authorization', store.userToken)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cmatchLeague))
          done()
        })
    })
  })

  describe('/GET User: upcoming MatchLeague list', () => {
    it('Should be get upcoming MatchLeague list', (done) => {
      request(server)
        .get(`/api/user/match-league/${store.iMatchId}/list/v2`)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cupcomingLeague))
          done()
        })
    })
  })
})
