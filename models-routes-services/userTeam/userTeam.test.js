const request = require('supertest')
const { describe, it, before } = require('mocha')
const expect = require('expect')
const moment = require('moment')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')

const store = {}
describe('UserTeam routes', () => {
  before(() => {
    store.matchID = undefined
    store.teamPlayers = {}
    store.teamAPlayers = {}
    store.teamBPlayers = {}
    store.matchDetails = {}
    store.MatchPlayerList = undefined
    store.createdTeamID = undefined
    store.userTeam = []
    store.wId = '5f7f0fd9b18344309eb41138'
    store.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI1ZjNmOTVjOTU4NzlkMDM0ODQxOTQ4YWMiLCJpYXQiOjE2MTIxNTkwODgsImV4cCI6MTYxOTkzNTA4OH0.rcli1DlxqTAiMEUZSpEXwo8robb1HJfeEm0_56gcbFk'
    store.sportsType = 'cricket'
  })
  var today = new Date()
  const tmrDate = moment(new Date(today.getTime() + (24 * 60 * 60 * 1000))).format('YYYY-MM-DD')

  describe('/GET match list', () => {
    it('Should be add cricket match', (done) => {
      const data = {
        dDate: `${tmrDate}`
      }
      request(server)
        .post('/api/admin/match/cricket/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.newMatch))
          done()
        })
    })

    it('Should be get Match list', (done) => {
      request(server)
        .get(`/api/admin/match/list/v1?start=0&limit=10&sort=sName&sportsType=cricket&dateFilter=${tmrDate}`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.match))
          store.matchID = res.body.data[0].results[0]._id
          store.matchDetails = res.body.data[0].results[0]
          done()
        })
    })

    it('Should be updated match details', (done) => {
      request(server)
        .put(`/api/admin/match/${store.matchID}/v1`)
        .set('Authorization', store.token)
        .send({
          sName: `${store.matchDetails.sName}`,
          sKey: `${store.matchDetails.sKey}`,
          eFormat: `${store.matchDetails.eFormat}`,
          sSeasonKey: `${store.matchDetails.sSeasonKey}`,
          dStartDate: `${store.matchDetails.dStartDate}`,
          eCategory: `${store.matchDetails.eCategory}`,
          eStatus: 'U',
          iHomeTeamId: `${store.matchDetails.oHomeTeam.iTeamId}`,
          iAwayTeamId: `${store.matchDetails.oAwayTeam.iTeamId}`
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.match))
          done()
        })
    })

    it('should be a fetch match-player', (done) => {
      request(server)
        .get(`/api/admin/match-player/cricket/${store.matchID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.newMatchPlayers))
          done()
        })
    })
  })

  describe('/GET match player list ', () => {
    it('should be a get match player list', (done) => {
      request(server)
        .get(`/api/admin/match-player/list/${store.matchID}/v1?start=0&limit=50`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.matchPlayer))
          store.MatchPlayerList = res.body.data[0].results
          done()
        })
    })
  })

  describe('/Get user Team List', () => {
    it('should be a get user Team player list', (done) => {
      request(server)
        .get(`/api/user/user-team/teams/${store.matchID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cuserTeams))
          done()
        })
    })
  })

  describe('/Post Add User Team', () => {
    it('should be a Add User team', (done) => {
      store.MatchPlayerList.map(player => {
        if (!store.teamPlayers[player.sTeamName]) {
          store.teamPlayers[player.sTeamName] = []
        }
        store.teamPlayers[player.sTeamName].push(player)
      })

      const teamNames = Object.keys(store.teamPlayers)
      teamNames.forEach(teamName => {
        if (teamName === teamNames[0]) {
          store.teamPlayers[teamName].map(player => {
            if (!store.teamAPlayers[player.eRole]) {
              store.teamAPlayers[player.eRole] = []
            }
            store.teamAPlayers[player.eRole].push({ iMatchPlayerId: player._id })
          })
        } else {
          store.teamPlayers[teamName].map(player => {
            if (!store.teamBPlayers[player.eRole]) {
              store.teamBPlayers[player.eRole] = []
            }
            store.teamBPlayers[player.eRole].push({ iMatchPlayerId: player._id })
          })
        }
      })

      const teamKeys = Object.keys(store.teamAPlayers)
      teamKeys.forEach(Role => {
        var Array1 = store.teamAPlayers[Role]
        var Array2 = store.teamBPlayers[Role]
        const randomItem1 = Array1[Math.floor(Math.random() * Array1.length)]
        const index = Array1.findIndex((player) => player.iMatchPlayerId === randomItem1.iMatchPlayerId)
        Array1.splice(index, 1)
        const randomItem2 = Array2[Math.floor(Math.random() * Array2.length)]
        const index2 = Array2.findIndex((player) => player.iMatchPlayerId === randomItem2.iMatchPlayerId)
        Array2.splice(index2, 1)
        if (Role === 'BATS' || Role === 'BWL' || Role === 'ALLR') {
          if (Array1.length >= Array2.length) {
            let randomItem3 = Array1[Math.floor(Math.random() * Array1.length)]
            if (randomItem1.iMatchPlayerId === randomItem3.iMatchPlayerId) {
              randomItem3 = Array1[Math.floor(Math.random() * Array1.length)]
            }
            store.userTeam.push(randomItem1, randomItem2, randomItem3)
          } else {
            let randomItem3 = Array2[Math.floor(Math.random() * Array2.length)]
            if (randomItem1.iMatchPlayerId === randomItem3.iMatchPlayerId) {
              randomItem3 = Array1[Math.floor(Math.random() * Array1.length)]
            }
            store.userTeam.push(randomItem1, randomItem2, randomItem3)
          }
        } else {
          store.userTeam.push(randomItem1, randomItem2)
        }
      })

      store.captainId = store.userTeam[Math.floor(Math.random() * store.userTeam.length)]
      store.viceCaptionId = store.userTeam[Math.floor(Math.random() * store.userTeam.length)]
      if (store.captainId === store.viceCaptionId) {
        store.viceCaptionId = store.userTeam[Math.floor(Math.random() * store.userTeam.length)]
      }

      const data = {
        iMatchId: store.matchID,
        aPlayers: store.userTeam,
        iCaptainId: store.captainId.iMatchPlayerId,
        iViceCaptainId: store.viceCaptionId.iMatchPlayerId,
        sName: `Team${store.captainId.iMatchPlayerId}`
      }
      request(server)
        .post('/api/user/user-team/v1')
        .send(data)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cnewUserTeam))
          store.createdTeamID = res.body.data._id
          done()
        })
    })

    it('Should not found a match id', (done) => {
      const data = {
        iMatchId: store.wId,
        aPlayers: store.userTeam,
        iCaptainId: store.captainId.iMatchPlayerId,
        iViceCaptainId: store.viceCaptionId.iMatchPlayerId,
        sName: `Team${store.viceCaptionId.iMatchPlayerId}`
      }
      request(server)
        .post('/api/user/user-team/v1')
        .send(data)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.match))
          done()
        })
    })

    it('Should not add user team because of Caption is not defined', (done) => {
      const data = {
        iMatchId: store.matchID,
        aPlayers: store.userTeam,
        iViceCaptainId: store.viceCaptionId.iMatchPlayerId,
        sName: `Team${store.viceCaptionId.iMatchPlayerId}`
      }
      request(server)
        .post('/api/user/user-team/v1')
        .send(data)
        .set('Authorization', store.token)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.required.replace('##', messages.English.ccaptain))
          done()
        })
    })

    it('Should not add user team because of Vice Caption is not defined', (done) => {
      const data = {
        iMatchId: store.matchID,
        aPlayers: store.userTeam,
        iCaptainId: store.captainId.iMatchPlayerId,
        sName: `Team${store.captainId.iMatchPlayerId}`
      }
      request(server)
        .post('/api/user/user-team/v1')
        .send(data)
        .set('Authorization', store.token)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.required.replace('##', messages.English.cviceCaptain))
          done()
        })
    })

    it('Should not add user team because of caption and vicecaption is not defined', (done) => {
      const data = {
        iMatchId: store.matchID,
        aPlayers: store.userTeam,
        iCaptainId: store.captainId.iMatchPlayerId,
        iViceCaptainId: store.captainId.iMatchPlayerId,
        sName: `Team${store.captainId.iMatchPlayerId}`
      }
      request(server)
        .post('/api/user/user-team/v1')
        .send(data)
        .set('Authorization', store.token)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.same_value_err.replace('##', messages.English.ccaptain).replace('#', messages.English.cviceCaptain))
          done()
        })
    })

    it('Should not add user team because of same team is already exist', (done) => {
      const data = {
        iMatchId: store.matchID,
        aPlayers: store.userTeam,
        iCaptainId: store.captainId.iMatchPlayerId,
        iViceCaptainId: store.viceCaptionId.iMatchPlayerId,
        sName: `Team${store.captainId.iMatchPlayerId}`
      }
      request(server)
        .post('/api/user/user-team/v1')
        .send(data)
        .set('Authorization', store.token)
        .expect(status.ResourceExist)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.cteam))
          done()
        })
    })
  })

  describe('/Put Update a user team', () => {
    it('Should not Update user team because of same team is already exist', (done) => {
      const data = {
        iMatchId: store.matchID,
        aPlayers: store.userTeam,
        iCaptainId: store.captainId.iMatchPlayerId,
        iViceCaptainId: store.viceCaptionId.iMatchPlayerId,
        sName: `Team${store.captainId.iMatchPlayerId}`
      }
      request(server)
        .put(`/api/user/user-team/${store.createdTeamID}/v1`)
        .send(data)
        .set('Authorization', store.token)
        .expect(status.ResourceExist)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.cteam))
          done()
        })
    })

    it('Should be a Update a user team', (done) => {
      store.captainId = store.userTeam[Math.floor(Math.random() * store.userTeam.length)]
      store.viceCaptionId = store.userTeam[Math.floor(Math.random() * store.userTeam.length)]
      if (store.captainId === store.viceCaptionId) {
        store.viceCaptionId = store.userTeam[Math.floor(Math.random() * store.userTeam.length)]
      }
      const data = {
        iMatchId: store.matchID,
        aPlayers: store.userTeam,
        iCaptainId: store.viceCaptionId.iMatchPlayerId,
        iViceCaptainId: store.captainId.iMatchPlayerId,
        sName: `Team${store.viceCaptionId.iMatchPlayerId}`
      }
      request(server)
        .put(`/api/user/user-team/${store.createdTeamID}/v1`)
        .send(data)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cuserTeamDetails))
          done()
        })
    })

    it('Should not Update user team because wrong Id will pass', (done) => {
      const data = {
        iMatchId: store.wId,
        aPlayers: store.userTeam,
        iCaptainId: store.captainId.iMatchPlayerId,
        iViceCaptainId: store.viceCaptionId.iMatchPlayerId,
        sName: `Team${store.captainId.iMatchPlayerId}`
      }
      request(server)
        .put(`/api/user/user-team/${store.createdTeamID}/v1`)
        .send(data)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.match))
          done()
        })
    })

    it('Should not Update user team because Caption is not defined', (done) => {
      const data = {
        iMatchId: store.matchID,
        aPlayers: store.userTeam,
        iViceCaptainId: store.viceCaptionId.iMatchPlayerId,
        sName: `Team${store.captainId.iMatchPlayerId}`
      }
      request(server)
        .put(`/api/user/user-team/${store.createdTeamID}/v1`)
        .send(data)
        .set('Authorization', store.token)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.required.replace('##', messages.English.ccaptain))
          done()
        })
    })

    it('Should not Update user team because Vice-Caption is not defined', (done) => {
      const data = {
        iMatchId: store.matchID,
        aPlayers: store.userTeam,
        iCaptainId: store.captainId.iMatchPlayerId,
        sName: `Team${store.captainId.iMatchPlayerId}`
      }
      request(server)
        .put(`/api/user/user-team/${store.createdTeamID}/v1`)
        .send(data)
        .set('Authorization', store.token)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.required.replace('##', messages.English.cviceCaptain))
          done()
        })
    })

    it('Should not Update user team because Vice-Caption and Caption is same', (done) => {
      const data = {
        iMatchId: store.matchID,
        aPlayers: store.userTeam,
        iCaptainId: store.captainId.iMatchPlayerId,
        iViceCaptainId: store.captainId.iMatchPlayerId,
        sName: `Team${store.captainId.iMatchPlayerId}`
      }
      request(server)
        .put(`/api/user/user-team/${store.createdTeamID}/v1`)
        .send(data)
        .set('Authorization', store.token)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.same_value_err.replace('##', messages.English.ccaptain).replace('#', messages.English.cviceCaptain))
          done()
        })
    })
  })

  describe('/GET user => user team list', () => {
    it('Should be get user team list', (done) => {
      request(server)
        .get(`/api/user/user-team/teams/${store.matchID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cuserTeams))
          done()
        })
    })
  })

  describe('/GET user > user team > team player list', () => {
    it('Should be get user Team Player list', (done) => {
      request(server)
        .get(`/api/user/user-team/team-player/${store.createdTeamID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.teamPlayers))
          done()
        })
    })

    it('Should not be get user Team Player list', (done) => {
      request(server)
        .get(`/api/user/user-team/team-player/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.userTeam))
          done()
        })
    })
  })

  describe('/GET user > user team get the details of user-team', () => {
    it('Should be get the details of user team', (done) => {
      request(server)
        .get(`/api/user/user-team/${store.createdTeamID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.userTeam))
          done()
        })
    })

    it('Should not be get the details of user team', (done) => {
      request(server)
        .get(`/api/user/user-team/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.userTeam))
          done()
        })
    })
  })

  describe('/GET admin side user team list', () => {
    it('Should be get admin side user list', (done) => {
      request(server)
        .get(`/api/admin/user-team/list/${store.matchID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.userTeam))
          done()
        })
    })
  })

  describe('/POST user team list', () => {
    it('Should be get admin side user team list match wise', (done) => {
      request(server)
        .get('/api/admin/user-team/v1')
        .set('Authorization', store.token)
        .send({
          iMatchId: store.matchID,
          iUserId: store.iUserId
        })
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.userTeam))
          done()
        })
    })
  })
})
