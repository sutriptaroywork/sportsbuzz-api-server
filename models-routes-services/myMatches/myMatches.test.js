const request = require('supertest')
const { describe, before, it } = require('mocha')
const expect = require('expect')
const { messages, status } = require('../../helper/api.responses')
const server = require('../../index')
const userAuthServices = require('../user/auth/services')

const store = {}

describe('User League Routes', () => {
  before(async() => {
    store.wId = '5f7f0fd9b18344309eb41138'
    const userData = await userAuthServices.getUserToken()
    store.userToken = userData
    store.sportsType = 'cricket'
  })

  describe('/GET list of upcoming matches', () => {
    it('Should be add cricket match', (done) => {
      request(server)
        .get(`/api/user/my-matches/list/v1?sportsType=${store.sportsType}&type=U`)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cmyMatch))
          done()
        })
    })
  })
})
