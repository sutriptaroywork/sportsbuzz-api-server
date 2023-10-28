const request = require('supertest')
const { describe, it } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')

describe('cron routes', () => {
  describe('/POST cron for calculate MatchPlayer Set By', () => {
    it('should be a cron added data for processing', (done) => {
      request(server)
        .post('/api/admin/cron/v1')
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.matchPlayer))
          done()
        })
    })
  })

  describe('/POST Match-live cron ', () => {
    it('should be cancel match league if not fulfill it\'s criteria', (done) => {
      request(server)
        .post('/api/admin/cron/match-live/v1')
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.matchStatus))
          done()
        })
    })
  })

  describe('/POST Bonus Expire cron ', () => {
    it('should be Expired bonus of all users', (done) => {
      request(server)
        .post('/api/admin/cron/bonus-expire/v1')
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.cBackgroundProcess.replace('##', messages.English.cExpireBonus))
          done()
        })
    })
  })

  describe('/GET Live Leader board cron ', () => {
    it('should be generate score points for all live match', (done) => {
      request(server)
        .get('/api/admin/cron/leaderboard/v1')
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.leaderboard))
          done()
        })
    })
  })
})
