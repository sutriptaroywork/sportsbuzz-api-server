const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const expect = require('expect')
const { status, messages } = require('../../helper/api.responses')

const store = {}
let routes = {}
describe('PrivateLeague routes', () => {
  before(() => {
    routes = {
      upcomingMatchList: '/api/user/match/list/v1',
      add: '/api/user/private-league/v2',
      calculateFee: '/api/user/private-league/calculate-fee/v2',
      verifyCode: '/api/user/private-league/verify-code/v1',
      prizeBreakup: '/api/user/private-league/prize-breakup/v2'
    }
    store.ID = undefined
    store.iMatchId = undefined
    store.wId = '624e709b4f9a82074833879d'
    store.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2MjRkNzBmMjFjNDEwODEwN2FjNzgzYzQiLCJlVHlwZSI6IlUiLCJpYXQiOjE2NTExNTI2NjUsImV4cCI6MTY1ODkyODY2NX0.6xTKa0qROCzWfvxdlEz1sAIckqc1XkGk1BYjzvr7mdk'
  })

  describe('/Post calculate Entry fee', () => {
    it('Should be get calculated entry fee', (done) => {
      const data = {
        nMax: 5,
        nTotalPayout: 225
      }
      request(server)
        .post(routes.calculateFee)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.centryFee))
          done()
        })
    })

    it('Should not calculate entry fee', (done) => {
      const data = {
        nMax: 2,
        nTotalPayout: 50,
        bMultipleEntry: true
      }
      request(server)
        .post(routes.calculateFee)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.play_alone_error)
          done()
        })
    })
  })

  describe('/Post Generate prize breakup', () => {
    it('Should get prize breakup', (done) => {
      const data = {
        nMax: 25,
        bPoolPrice: false
      }
      request(server)
        .post(routes.prizeBreakup)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cprizeBreakups))
          done()
        })
    })
  })

  describe('/GET should fetch upcoming match list', () => {
    it('Should be get upcoming match list', (done) => {
      request(server)
        .get(`${routes.upcomingMatchList}?sportsType=cricket`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          store.iMatchId = res.body.data[0]._id
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cupcomingMatch))
          done()
        })
    })
  })

  describe('/Post Add private league', () => {
    it('Should add private league', (done) => {
      const data = {
        nMax: 2,
        iMatchId: store.iMatchId,
        sName: 'private1',
        bMultipleEntry: true,
        bPoolPrice: false,
        nTotalPayout: 200,
        nPrizeBreakup: 5
      }
      request(server)
        .post(routes.add)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          store.sShareCode = res.body.data.sShareCode
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cnewPrivateLeague))
          done()
        })
    })

    it('Should not add private league', (done) => {
      const data = {
        nMax: 10,
        iMatchId: store.wId,
        sName: 'private1',
        bMultipleEntry: true,
        bPoolPrice: false,
        nTotalPayout: 200,
        nPrizeBreakup: 5
      }
      request(server)
        .post(routes.add)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.match_started)
          done()
        })
    })
  })

  describe('/Post verify contest code', () => {
    it('Should verify contest code', (done) => {
      const data = {
        iMatchId: store.iMatchId,
        sShareCode: store.sShareCode
      }
      request(server)
        .post(routes.verifyCode)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cprivateLeague))
          done()
        })
    })

    it('Should not verify contest code', (done) => {
      const data = {
        iMatchId: store.iMatchId,
        sShareCode: 'code'
      }
      request(server)
        .post(routes.verifyCode)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cleague))
          done()
        })
    })

    it('Should not verify contest code', (done) => {
      const data = {
        iMatchId: store.wId,
        sShareCode: store.sShareCode
      }
      request(server)
        .post(routes.verifyCode)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.match_started)
          done()
        })
    })
  })
})
