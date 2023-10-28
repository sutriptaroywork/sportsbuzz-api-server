const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const UserLeagueModel = require('../userLeague/model')
const userAuthServices = require('../user/auth/services')
const store = {}

describe('LeaderBoard Routes', () => {
  before(async() => {
    const userData = await userAuthServices.getUserToken()
    const userToken = userData.Authorization
    const iUserId = userData.data._id
    const data = await UserLeagueModel.find({ iUserId: iUserId }).lean()
    store.iMatchLeagueId = data[0].iMatchLeagueId
    store.ID = undefined
    store.wID = '5f7f0fd9b18344309eb41138'
    store.userToken = userToken
  })

  describe('/GET My team list', () => {
    it('Should be get my team list', (done) => {
      request(server)
        .get(`/api/user/leaderboard/my-teams/${store.iMatchLeagueId}/v2`)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.leaderboard))
          done()
        })
    })
    it('Should be get empty my team list', (done) => {
      request(server)
        .get(`/api/user/leaderboard/my-teams/${store.wID}/v2`)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.data.length).toMatch(0)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.leaderboard))
          done()
        })
    })
  })

  describe('/GET all team list', () => {
    it('Should be get all team list', (done) => {
      request(server)
        .get(`/api/user/leaderboard/list/${store.iMatchLeagueId}/v2`)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.leaderboard))
          done()
        })
    })

    it('Should be get empty team list', (done) => {
      request(server)
        .get(`/api/user/leaderboard/list/${store.wID}/v2`)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.data.length).toMatch(0)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.leaderboard))
          done()
        })
    })
  })
})
