const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const store = {}

describe('Report Routes', () => {
  before(async() => {
    store.ID = '60deb02a790e8f384049b828'
    store.wID = '5f7f0fd9b18344309eb41138'
    store.adminToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI1ZjNmOTVjOTU4NzlkMDM0ODQxOTQ4YWMiLCJpYXQiOjE2MTg4MDc0NzYsImV4cCI6MTYyNjU4MzQ3Nn0.ukxCm3osEsW-wQBz3yzxqFSBExJ7z4GqxpMSBIs5dbg'
    store.userToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2MGU2ZGFhYjg0N2M1OTIzOWMyYTdiZmYiLCJpYXQiOjE2MjU3NDM5MTEsImV4cCI6MTYzMzUxOTkxMX0.5OwwcaVA9-EeD4GiHkqCohNMdV1TvZEEva1AYP-zezg'
    store.iUserId = '60e6daab847c59239c2a7bff'
  })

  describe('/GET match list', () => {
    it('Should get completed match list', async (done) => {
      request(server)
        .get('/api/admin//match/list/v1?start=0&limit=1&sportsType=cricket&filter=cmp')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.match))
          store.iComptedMatchId = res.body.data.length ? res.body.data[0]._id : store.wID
          done()
        })
    })

    it('Should get upcoming match list', async (done) => {
      request(server)
        .get('/api/admin//match/list/v1?start=0&limit=1&sportsType=cricket&filter=u')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.match))
          store.iUpcomingMatchId = res.body.data.length ? res.body.data[0]._id : store.wID
          done()
        })
    })
  })

  describe('/GET Generate match report', () => {
    it('Should generate match report', async (done) => {
      request(server)
        .get(`/api/admin/report/${store.iComptedMatchId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.creport))
          done()
        })
    })
    it('Should not generate match report match not complete', async (done) => {
      request(server)
        .get(`/api/admin/report/${store.iUpcomingMatchId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.match_not_complete.replace('##', messages.English.creport))
          done()
        })
    })
  })

  describe('/GET generalize report list', () => {
    it('Should be get generalize report', (done) => {
      request(server)
        .get('/api/admin/reports/v1')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cgeneralizeReport))
          done()
        })
    })
  })

  describe('/PUT generalize report list', () => {
    it('Should be update generalize report', (done) => {
      request(server)
        .put('/api/admin/user-reports/v1')
        .send({ eKey: 'W' })
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.creport))
          done()
        })
    })
  })

  describe('/PUT generalize report list', () => {
    it('Should be update profit report', (done) => {
      request(server)
        .put(`/api/admin/profit-reports/${store.ID}/v1`)
        .send({ eKey: 'TP', eCategory: 'CRICKET' })
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cprofitReport))
          done()
        })
    })

    it('Should not be update profit report', (done) => {
      request(server)
        .put(`/api/admin/profit-reports/${store.ID}/v1`)
        .send({ eKey: 'TP', eCategory: 'CRICKET' })
        .set('Authorization', store.adminToken)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cprofitReport))
          done()
        })
    })
  })

  describe('/PUT generalize report list', () => {
    it('Should be update turn over report', (done) => {
      request(server)
        .put(`/api/admin/turnover-reports/${store.ID}/v1`)
        .send({ eKey: 'TT', eCategory: 'CRICKET' })
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cturnOverReport))
          done()
        })
    })
  })

  describe('/PUT generalize report list', () => {
    it('Should be update bonus report', (done) => {
      request(server)
        .put(`/api/admin/bonus-reports/${store.ID}/v1`)
        .send({ eKey: 'TB', eCategory: 'CRICKET' })
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cbonusReport))
          done()
        })
    })
  })

  describe('/PUT generalize report list', () => {
    it('Should be update user team report', (done) => {
      request(server)
        .put(`/api/admin/userteam-reports/${store.ID}/v1`)
        .send({ eKey: 'UT', eCategory: 'CRICKET' })
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cTeamsReport))
          done()
        })
    })
  })

  describe('/PUT generalize report list', () => {
    it('Should be update league participants report', (done) => {
      request(server)
        .put(`/api/admin/league-participants-reports/${store.ID}/v1`)
        .send({ eKey: 'LP', eCategory: 'CRICKET' })
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cParticipantReport))
          done()
        })
    })
  })

  describe('/PUT generalize report list', () => {
    it('Should be update wins report', (done) => {
      request(server)
        .put(`/api/admin/wins-reports/${store.ID}/v1`)
        .send({ eKey: 'TW', eCategory: 'CRICKET' })
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cWinReport))
          done()
        })
    })
  })

  describe('/PUT generalize report list', () => {
    it('Should be update cancelled private league report', (done) => {
      request(server)
        .put(`/api/admin/private-league-reports/${store.ID}/v1`)
        .send({ eKey: 'CNCLL', eCategory: 'CRICKET' })
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cPrivateLeagueReport))
          done()
        })
    })
  })

  describe('/PUT generalize report list', () => {
    it('Should be update completed private league report', (done) => {
      request(server)
        .put(`/api/admin/private-league-reports/${store.ID}/v1`)
        .send({ eKey: 'CMPL', eCategory: 'CRICKET' })
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cPrivateLeagueReport))
          done()
        })
    })
  })

  describe('/PUT generalize report list', () => {
    it('Should be update created private league report', (done) => {
      request(server)
        .put(`/api/admin/private-league-reports/${store.ID}/v1`)
        .send({ eKey: 'CL', eCategory: 'CRICKET' })
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cPrivateLeagueReport))
          done()
        })
    })
  })
})
