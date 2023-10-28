const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')
const userAuthServices = require('../user/auth/services')

const store = {}

describe('Match routes', () => {
  before(async () => {
    store.ID = '613050fe8ba14b0bd0657c84' // undefined
    store.HomeID = undefined
    store.awayID = undefined
    store.token = await adminAuthServices.getAdminToken()
    store.wId = '62e2541f479a02b559b42450'
    const userData = await userAuthServices.getUserToken()
    store.userToken = userData.Authorization
  })
  const randomNumber = Date.now()

  describe('/Team List and set a Team ids', () => {
    it('Should be get list of teams and set a home and away team id', (done) => {
      request(server)
        .get('/api/admin/team/list/v1?sportsType=cricket')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cteam))
          store.HomeID = res.body.data[0].results[0]._id
          store.awayID = res.body.data[0].results[1]._id
          done()
        })
    })
  })
  /**
   * Add match manually
   */
  describe('/POST add match manually', () => {
    it('Should be create a new match', (done) => {
      const matchDetails = {
        sName: 'INDIA vs DC(TESTING)',
        sKey: `match:sr:${randomNumber}`,
        eFormat: 'T20',
        sSeasonKey: `SeasonKey:${randomNumber}`,
        dStartDate: new Date(),
        eCategory: 'CRICKET',
        oHomeTeamScore: '200',
        iHomeTeamId: `${store.HomeID}`,
        iAwayTeamId: `${store.awayID}`
      }
      request(server)
        .post('/api/admin/match/v1')
        .set('Authorization', store.token)
        .send(matchDetails)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.newMatch))
          store.ID = res.body.data._id
          done()
        })
    })

    it('Should not add match because home team id does not exist', (done) => {
      const matchDetails = {
        sName: 'INDIA vs DC',
        sKey: `sk${randomNumber}`,
        eFormat: 'T20',
        sSeasonKey: `SeasonKey${randomNumber}`,
        dStartDate: '2020-11-11',
        eCategory: 'CRICKET',
        oHomeTeamScore: '200',
        iHomeTeamId: '5f7f0fd9b18344309eb41008',
        iAwayTeamId: `${store.awayID}`
      }
      request(server)
        .post('/api/admin/match/v1')
        .set('Authorization', store.token)
        .send(matchDetails)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.chomeTeam))
          done()
        })
    })

    it('Should not add match because away team id does not exist', (done) => {
      const matchDetails = {
        sName: 'INDIA vs DC',
        sKey: `sk${randomNumber}`,
        eFormat: 'T20',
        sSeasonKey: `SeasonKey${randomNumber}`,
        dStartDate: '2020-11-11',
        eCategory: 'CRICKET',
        oHomeTeamScore: '200',
        iHomeTeamId: `${store.awayID}`,
        iAwayTeamId: '5f7f0fd9b18344309eb41008'
      }
      request(server)
        .post('/api/admin/match/v1')
        .set('Authorization', store.token)
        .send(matchDetails)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cawayTeam))
          done()
        })
    })

    it('Should not add match because home team and away team is same', (done) => {
      const matchDetails = {
        sName: 'INDIA vs DC',
        sKey: `sk${randomNumber}`,
        eFormat: 'T20',
        sSeasonKey: `SeasonKey${randomNumber}`,
        dStartDate: '2020-11-11',
        eCategory: 'CRICKET',
        iHomeTeamId: `${store.HomeID}`,
        iAwayTeamId: `${store.HomeID}`
      }
      request(server)
        .post('/api/admin/match/v1')
        .set('Authorization', store.token)
        .send(matchDetails)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          if (matchDetails.iAwayTeamId === matchDetails.iHomeTeamId) {
            expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.cteam))
          }
          done()
        })
    })
  })

  /**
   * Add cricket match by third party api service
   */
  describe('/POST Add match cricket using third party api', () => {
    it('Should be add cricket match', (done) => {
      request(server)
        .post('/api/admin/match/cricket/v1')
        .set('Authorization', store.token)
        .send({
          dDate: Date.now()
        })
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.newMatch))
          done()
        })
    })

    it('Should be add cricket match from EntitySport', (done) => {
      request(server)
        .post('/api/admin/match/cricket/v1')
        .set('Authorization', store.token)
        .send({
          dDate: Date.now(),
          eProvider: 'ENTITYSPORT'
        })
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.newMatch))
          done()
        })
    })

    it('Should not be add cricket match', (done) => {
      request(server)
        .post('/api/admin/match/cricket/v1')
        .set('Authorization', store.token)
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  /**
   * Add baseball match by third party api service
   */
  // describe('/POST Add match baseball using third party api', () => {
  //   it('Should be add baseball match', (done) => {
  //     request(server)
  //       .post('/api/admin/match/baseball/v1')
  //       .set('Authorization', store.token)
  //       .expect(status.OK)
  //       .end(function (err, res) {
  //         if (err) return done(err)
  //         done()
  //       })
  //   })
  // })

  /**
   * Add football match by third party api service
   */
  describe('/POST Add match football using third party api', () => {
    it('Should be add football match', (done) => {
      request(server)
        .post('/api/admin/match/football/v1')
        .send({
          dDate: Date.now(),
          eProvider: 'ENTITYSPORT'
        })
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          done()
        })
    })
  })

  /**
   * Add kabaddi match by third party api service
   */
  // describe('/POST fetch kabaddi match and store using third party api', () => {
  //   it('Should be add kabaddi match', (done) => {
  //     request(server)
  //       .post('/api/admin/match/kabaddi/v1')
  //       .send({
  //         eProvider: 'ENTITYSPORT'
  //       })
  //       .set('Authorization', store.token)
  //       .expect(status.OK)
  //       .end(function (err, res) {
  //         if (err) return done(err)
  //         expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.newMatch))
  //         done()
  //       })
  //   })
  // })

  describe('/POST fetch kabaddi match and store using third party api,will return no match is scheduled.', () => {
    it('Should be add kabaddi match', (done) => {
      request(server)
        .post('/api/admin/match/kabaddi/v1')
        .send({
          eProvider: 'ENTITYSPORT'
        })
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.no_match_scheduled)
          done()
        })
    })
  })

  /**
   * Add kabaddi match by third party api service
   */
  describe('merge match', () => {
    // it('Should merge matches', (done) => {
    //     request(server)
    //       .post('/api/admin/match/merge/v1')
    //       .send(
    //         {
    //           id: '6201f774f44a35f3f69d3369',
    //           apiMatchId: '6201f774f44a35f3f69d3364',
    //           aPlayers: [{
    //             oldId: '61bc644bd84eabca5d652005',
    //             newId: '6201f781f44a35f3f69d34b1'
    //           }
    //           ]
    //         })
    //       .set('Authorization', store.token)
    //       .expect(status.OK)
    //       .end(function (err, res) {
    //         if (err) return done(err)
    //         expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.newMatch))
    //         done()
    //       })
    //   })
    it('Should not merge matches as data is not sufficant', (done) => {
      request(server)
        .post('/api/admin/match/merge/v1')
        .send({
          id: Date.now()
        })
        .set('Authorization', store.token)
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })

    it('Should not merge matches as apiMatchId is not exist', (done) => {
      request(server)
        .post('/api/admin/match/merge/v1')
        .send({
          apiMatchId: '61e00f4f7de6f3aa7cb56530',
          id: '61baeca9c213ef6d8cdf6440',
          aPlayers: [{
            oldId: '61bc644bd84eabca5d652005',
            newId: '6201f781f44a35f3f69d34b1'
          }]
        })
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.match))
          done()
        })
    })

    it('Should not merge matches as Id is not exist', (done) => {
      request(server)
        .post('/api/admin/match/merge/v1')
        .send({
          apiMatchId: '61e00f4f7de6f3aa7cb56530',
          id: '6204f16c8f537208eb4f9649',
          aPlayers: [{
            oldId: '61bc644bd84eabca5d652005',
            newId: '6201f781f44a35f3f69d34b1'
          }]
        })
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.match))
          done()
        })
    })
  })

  describe('match count', () => {
    it('Should fetch match counts', (done) => {
      request(server)
        .get('/api/admin/match/counts/v1?sportsType=cricket')
        .send()
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', `${messages.English.match} ${messages.English.cCounts}`))
          done()
        })
    })

    it('Should not fetch match counts as sport type is not present is url', (done) => {
      request(server)
        .get('/api/admin/match/counts/v1')
        .set('Authorization', store.token)
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })

    it('Should fetch match counts as per query params', (done) => {
      request(server)
        .get('/api/admin/match/counts/v1?eProvider=SPORTSRADAR&sportsType=cricket')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', `${messages.English.match} ${messages.English.cCounts}`))
          done()
        })
    })
  })
  /**
   * Add basketball match by third party api service
   */
  describe('/POST Add match basketball using third party api', () => {
    it('Should be add basketball match', (done) => {
      request(server)
        .post('/api/admin/match/basketball/v1')
        .send({
          dDate: Date.now()
        })
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(done)
    })
  })

  /**
   * Fetch all match list
   */
  describe('/GET match list', () => {
    it('Should be get Match list', (done) => {
      request(server)
        .get('/api/admin/match/list/v1?start=0&limit=10&sort=sName&order=des&sportsType=cricket')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.match))
          store.apiMatchId = res.body.data[0].results[1]._id
          done()
        })
    })

    it('Should not be get match list', (done) => {
      request(server)
        .get('/api/admin/match/list/v1?start=0&limit=50&sort=sName&order=des&search=IND&sportsType&filter=u')
        .set('Authorization', store.token)
        .expect(status.UnprocessableEntity)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  /**
   * Fetch all match list
   */
  describe('/GET match full list', () => {
    it('Should be get full Match list', (done) => {
      request(server)
        .get('/api/admin/match/full-list/v1?start=0&limit=10&sort=sName&order=des')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.match))
          done()
        })
    })
  })

  /**
   * Fetch upcoming match list
   */
  describe('/GET upcoming match list for users', () => {
    it('Should be get upcoming match list', (done) => {
      request(server)
        .get('/api/user/match/list/v1?sportsType=cricket')
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cupcomingMatch))
          done()
        })
    })
  })

  /**
   * Get Match info for users
   */
  describe('/GET Match info for users', () => {
    it('Should be get upcoming match list', (done) => {
      request(server)
        .get(`/api/user/match/${store.ID}/v1`)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.match))
          done()
        })
    })

    it('Should not get match info', (done) => {
      request(server)
        .get(`/api/user/match/${store.wId}/v1`)
        .set('Authorization', store.userToken)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.match))
          done()
        })
    })
  })
  /**
   * Update match details
   */
  describe('/PUT update match details', () => {
    it('Should be updated match details', (done) => {
      request(server)
        .put(`/api/admin/match/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send({
          sName: 'ENG vs IND',
          sKey: 'sr:match:28268390',
          eFormat: 'ODI',
          sSeasonKey: 'sr:season:85788',
          dStartDate: '2021-09-02T10:00:00.000+00:00',
          eCategory: 'CRICKET',
          iHomeTeamId: store.HomeID,
          iAwayTeamId: store.awayID,
          sFantasyPost: '552424',
          nMaxTeamLimit: 3,
          sSponsoredText: 'OPPO VIVO',
          sStreamUrl: 'https://youtu.be/KaI8Rx6rw1o'
        })
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.match))
          done()
        })
    })

    it('Should not be update match details', (done) => {
      request(server)
        .put(`/api/admin/match/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send({
          sName: 'IND vs PAKistan',
          sKey: `sKey:${randomNumber}`,
          eFormat: 'T20',
          sSeasonKey: `SeasonKey:${randomNumber}`,
          dStartDate: '2020-09-24T22:30:00.000+00:00',
          eCategory: 'CRICKET',
          iHomeTeamId: '5f7f0fd9b18344309eb41008',
          iAwayTeamId: `${store.awayID}`
        })
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.chomeTeam))
          done()
        })
    })
  })

  /**
   * Update bLineUpsOut
   */
  describe('/PUT Update bLineUpsOut', () => {
    it('Should be update bLineUpsOut', (done) => {
      request(server)
        .put(`/api/admin/match/lineups-out/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send({
          bLineupsOut: true
        })
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cmatchLineupsOut))
          done()
        })
    })

    it('Should not be update bLineUpsOut', (done) => {
      request(server)
        .put(`/api/admin/match/lineups-out/${store.wId}/v1`)
        .set('Authorization', store.token)
        .send({
          bLineupsOut: true
        })
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.match))
          done()
        })
    })
  })

  /**
   * Fetch single match
   */
  describe('/GET single match', () => {
    it('Should be get single match', (done) => {
      request(server)
        .get(`/api/admin/match/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.match))
          done()
        })
    })

    it('Should not be get single match', (done) => {
      request(server)
        .get(`/api/admin/match/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.match))
          done()
        })
    })
  })

  describe('/GET Stream', () => {
    it('Should be get stream button', (done) => {
      request(server)
        .get('/api/user/match/stream-button/v1')
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.match))
          done()
        })
    })

    it('Should be get stream list', (done) => {
      request(server)
        .get('/api/user/match/stream-list/CMP/v1')
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.match))
          done()
        })
    })
  })

  describe('/POST refresh match detail using third party api', () => {
    it('Should be refresh match detail', (done) => {
      request(server)
        .post(`/api/admin/match/refresh/${store.apiMatchId}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.refresh_success.replace('##', messages.English.match))
          done()
        })
    })

    it('Should not be refresh match detail', (done) => {
      request(server)
        .post(`/api/admin/match/refresh/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.match))
          done()
        })
    })
  })

  describe('/GET match logs', () => {
    it('Should be get match logs', (done) => {
      request(server)
        .get(`/api/admin/match/logs/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cMatchLogs))
          done()
        })
    })
  })
})
