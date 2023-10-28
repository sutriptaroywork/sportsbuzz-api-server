const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const MatchModel = require('../match/model')
const adminAuthServices = require('../admin/auth/services')

const store = {}

describe('scorePoint Routes', () => {
  before(async () => {
    const [entitiMatchData, footballMatchData, sportradarMatchData] = await Promise.all([
      MatchModel.findOne({ eProvider: 'ENTITYSPORT' }, { _id: 1 }).lean(),
      MatchModel.findOne({ eProvider: 'ENTITYSPORT', eCategory: 'FOOTBALL' }, { _id: 1 }).lean(),
      MatchModel.findOne({ eProvider: 'SPORTSRADAR' }, { _id: 1 }).lean()
    ])
    store.ID = undefined
    store.entityMatchID = entitiMatchData._id
    store.iFootBallMatchId = footballMatchData._id
    store.sportradarMatchID = sportradarMatchData._id
    store.wId = '5f7f0fd9b18344309eb41138'
    store.token = await adminAuthServices.getAdminToken()
  })

  describe('/GET match list', () => {
    it('Should be get Match list', (done) => {
      request(server)
        .get('/api/admin/match/list/v1?start=0&limit=10&sort=dCreatedAt&order=asc&sportsType=cricket')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.match))
          store.ID = res.body.data[0].results[0]._id
          done()
        })
    })
  })

  describe('/GET Score Points from third party', () => {
    it('Should be get score points from entity sport', (done) => {
      request(server)
        .post(`/api/admin/score-point/${store.entityMatchID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cscorePoint))
          done()
        })
    })

    it('Should be get score points from sport radar', (done) => {
      request(server)
        .post(`/api/admin/score-point/${store.sportradarMatchID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cscorePoint))
          done()
        })
    })
  })

  describe('/POST create a score points of one match', () => {
    it('should be create a score points of match', (done) => {
      request(server)
        .post(`/api/admin/score-point/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cscorePoint))
          done()
        })
    })

    it('should not be create a score points of match', (done) => {
      request(server)
        .post(`/api/admin/score-point/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.match))
          done()
        })
    })
  })

  describe('/GET Score Points from third party for football', () => {
    it('Should be get score points of football from entity sport', (done) => {
      request(server)
        .post(`/api/admin/score-point/football/${store.iFootBallMatchId}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cscorePoint))
          done()
        })
    })
  })

  describe('/GET score point system', () => {
    it('Should be get score point system', (done) => {
      request(server)
        .get('/api/admin/score-point/v1?eFormat=ODI')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpoints))
          if (res.body.data && res.body.data[0]) {
            store.iScorePointId = res.body.data[0]._id
            store.sName = res.body.data[0].sName
            store.nPoint = res.body.data[0].nPoint
          }
          done()
        })
    })
  })

  describe('/GET single score point', () => {
    it('Should be get single point', (done) => {
      request(server)
        .get(`/api/admin/score-point/${store.iScorePointId}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpoints))
          done()
        })
    })

    it('Should not be get single point because invalid id', (done) => {
      request(server)
        .get(`/api/admin/score-point/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cpoints))
          done()
        })
    })
  })

  describe('/PUT update single score point', () => {
    it('Should be get update point system', (done) => {
      const data = {
        sName: store.sName,
        nPoint: store.nPoint
      }
      request(server)
        .put(`/api/admin/score-point/${store.iScorePointId}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cpoints))
          done()
        })
    })

    it('Should not be update single point because invalid id', (done) => {
      request(server)
        .get(`/api/admin/score-point/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cpoints))
          done()
        })
    })
  })
})
