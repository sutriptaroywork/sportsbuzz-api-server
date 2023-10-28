/* eslint-disable indent */
const request = require('supertest')
const { describe, it, before } = require('mocha')
const moment = require('moment')
const expect = require('expect')
const { messages, status } = require('../../helper/api.responses')
const server = require('../../index')
const userAuthServices = require('../user/auth/services')

const store = {}

describe('User League Routes', () => {
  before(async () => {
    const internalUserData = await userAuthServices.getUserToken('INTERNAL')
    const internalUserToken = internalUserData.Authorization
    store.internalUserToken = internalUserToken
    store.matchID = undefined
    store.leagueID = undefined
    store.matchLeagueID = undefined
    store.MatchPlayerList = []
    store.matchPendingID = undefined
    store.matchDetails = {}
    store.teamPlayers = {}
    store.teamAPlayers = {}
    store.teamBPlayers = {}
    store.matchLeagueDetails = {}
    store.createdTeamID = undefined
    store.createdSecondTeamID = undefined
    store.UserTeamID = undefined
    store.userTeam = []
    store.wId = '5f7f0fd9b18344309eb41138'
    store.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI1ZjNmOTVjOTU4NzlkMDM0ODQxOTQ4YWMiLCJpYXQiOjE2MTIxNTkwODgsImV4cCI6MTYxOTkzNTA4OH0.rcli1DlxqTAiMEUZSpEXwo8robb1HJfeEm0_56gcbFk'
    store.userToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI1ZmM3NzQ3NmFiYWI4MDBkMDRiZjA1OGMiLCJpYXQiOjE2MDY5MDcwNDAsImV4cCI6MTYxNDY4MzA0MH0.uwvCRR9eYkkAfp6jU2qlonZt1N0juSQSlCCIbfTOywo'
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
          store.matchtwoID = res.body.data[0].results[1]._id
          store.matchDetails = res.body.data[0].results[0]
          store.matchtwoIDDetails = res.body.data[0].results[1]
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

    it('Should be updated match details', (done) => {
      request(server)
        .put(`/api/admin/match/${store.matchtwoID}/v1`)
        .set('Authorization', store.token)
        .send({
          sName: `${store.matchtwoIDDetails.sName}`,
          sKey: `${store.matchtwoIDDetails.sKey}`,
          eFormat: `${store.matchtwoIDDetails.eFormat}`,
          sSeasonKey: `${store.matchtwoIDDetails.sSeasonKey}`,
          dStartDate: `${store.matchtwoIDDetails.dStartDate}`,
          eCategory: `${store.matchtwoIDDetails.eCategory}`,
          eStatus: 'U',
          iHomeTeamId: `${store.matchtwoIDDetails.oHomeTeam.iTeamId}`,
          iAwayTeamId: `${store.matchtwoIDDetails.oAwayTeam.iTeamId}`
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.match))
          done()
        })
    })

    // it('Should be get Upcoming cricket match list', (done) => {
    //   request(server)
    //     .get('/api/user/match/list/v1?sportsType=cricket')
    //     .set('Authorization', store.token)
    //     .expect(status.OK)
    //     .end(function(err, res) {
    //       if (err) return done(err)
    //       expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cupcomingMatch))
    //       store.matchID = res.body.data[0]._id
    //       store.matchDetails = res.body.data[0]
    //       done()
    //     })
    // })

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

    it('should be a fetch match-player', (done) => {
      request(server)
        .get(`/api/admin/match-player/cricket/${store.matchtwoID}/v1`)
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

    it('should be a get match player list', (done) => {
      request(server)
        .get(`/api/admin/match-player/list/${store.matchtwoID}/v1?start=0&limit=50`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.matchPlayer))
          store.MatchtwoPlayerList = res.body.data[0].results
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
        sName: `Team${store.captainId.iMatchPlayerId}${store.viceCaptionId.iMatchPlayerId}`
      }
      request(server)
        .post('/api/user/user-team/v1')
        .send(data)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cnewUserTeam))
          store.createdTeamID = res.body.data._id
          done()
        })
    })

    it('should be a Add Seconnd User team', (done) => {
      store.teamPlayers = {}
      store.teamAPlayers = {}
      store.teamBPlayers = {}
      store.userTeam = []
      store.MatchtwoPlayerList.map(player => {
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
        iMatchId: store.matchtwoID,
        aPlayers: store.userTeam,
        iCaptainId: store.captainId.iMatchPlayerId,
        iViceCaptainId: store.viceCaptionId.iMatchPlayerId,
        sName: `Team${store.captainId.iMatchPlayerId}${store.viceCaptionId.iMatchPlayerId}`
      }
      request(server)
        .post('/api/user/user-team/v1')
        .send(data)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cnewUserTeam))
          store.createdSecondTeamID = res.body.data._id
          done()
        })
    })
  })

  describe('/GET Sport wise leagues ', () => {
    it(' should be a list of league sportswise', (done) => {
      request(server)
        .get(`/api/admin/league/v1?sportsType=${store.sportsType}`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cleague))
          store.leagueID = res.body.data[0]._id
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
          iMatchId: store.matchID,
          iLeagueId: [{
            _id: store.leagueID
          }]
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cnewMatchLeague))
          done()
        })
    })
  })

  describe('/GET user MatchLeague', () => {
    it('Should be get User Match League', (done) => {
      request(server)
        .get(`/api/user/match-league/${store.matchID}/list/v1`)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cupcomingLeague))
          store.matchLeagueID = res.body.data[0]._id
          store.matchLeagueDetails = res.body.data[0]
          done()
        })
    })
  })

  describe('/GET user-league list', () => {
    it('Should be get League list', (done) => {
      request(server)
        .get(`/api/admin/user-league/list/${store.matchLeagueID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cuserLeague))
          done()
        })
    })
  })

  describe('/GET user user teams list', () => {
    it(' should be a list of user joined data', (done) => {
      request(server)
        .get(`/api/user/user-team/teams/${store.matchID}/v1`)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cuserTeams))
          const array = res.body.data
          const randomTeam = array[Math.floor(Math.random() * array.length)]
          store.UserTeamID = randomTeam._id
          done()
        })
    })
  })

    describe('/GET user joined league list', () => {
      it(' should be a list of user joined data', (done) => {
        request(server)
          .get(`/api/user/user-league/join/${store.matchID}/v1`)
          .set('Authorization', store.userToken)
          .expect(status.OK)
          .end(function(err, res) {
            if (err) return done(err)
            expect(res.body.data).toBeA('array')
            expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cuserJoinLeague))
            done()
          })
      })
    })

    describe('/GET user joined league list', () => {
      it(' should be a list of user joined data', (done) => {
        request(server)
          .get(`/api/user/user-league/join/${store.matchID}/v1`)
          .set('Authorization', store.userToken)
          .expect(status.OK)
          .end(function(err, res) {
            if (err) return done(err)
            expect(res.body.data).toBeA('array')
            expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cuserJoinLeague))
            done()
          })
      })
    })

    describe('/POST create a user team to join league', () => {
      it('Internal user should not be a joined public league', (done) => {
        const data = {
          iMatchLeagueId: store.matchLeagueID,
          aUserTeamId: ['6139bb7387be331288230375'],
          bPrivateLeague: false,
          sShareCode: '',
          sPromo: ''
        }
        request(server)
          .post('/api/user/user-league/join-league/v2')
          .send(data)
          .set('Authorization', store.internalUserToken)
          .expect(status.BadRequest)
          .end(function (err, res) {
            if (err) return done(err)
            expect(res.body.message).toMatch(messages.English.public_league_join_err)
            done()
          })
      })
      it('should be a joined league', (done) => {
        const data = {
          iUserTeamId: store.createdTeamID,
          iMatchLeagueId: store.matchLeagueID
        }
        request(server)
          .post('/api/user/user-league/join-league/v1')
          .send(data)
          .set('Authorization', store.userToken)
          .expect(status.OK)
          .end(function(err, res) {
            if (err) return done(err)
            expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cuserJoined))
            done()
          })
      })

      it('should not be a joined league because match league is not defind', (done) => {
        const data = {
          iUserTeamId: store.createdTeamID,
          iMatchLeagueId: store.wId
        }
        request(server)
          .post('/api/user/user-league/join-league/v1')
          .send(data)
          .set('Authorization', store.userToken)
          .expect(status.NotFound)
          .end(function(err, res) {
            if (err) return done(err)
            expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cmatchLeague))
            done()
          })
      })

      it('should not be a joined league because same team is already Joined', (done) => {
        const data = {
          iUserTeamId: store.createdTeamID,
          iMatchLeagueId: store.matchLeagueID
        }
        request(server)
          .post('/api/user/user-league/join-league/v1')
          .send(data)
          .set('Authorization', store.userToken)
          .expect(status.BadRequest)
          .end(function(err, res) {
            if (err) return done(err)
            expect(res.body.message).toMatch(messages.English.user_already_joined)
            done()
          })
      })

      it('should be a list of userteams of match', (done) => {
        request(server)
          .get(`/api/user/user-team/teams/${store.matchID}/v1`)
          .set('Authorization', store.userToken)
          .expect(status.OK)
          .end(function(err, res) {
            if (err) return done(err)
            expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cuserTeams))
            store.userTeam1 = res.body.data.length >= 2 ? res.body.data[0]._id : ' '
            store.userTeam2 = res.body.data.length >= 2 ? res.body.data[1]._id : ' '
            done()
          })
      })

      it('should not be a joined league ', (done) => {
        const data = {
          iUserTeamId: store.createdSecondTeamID,
          iMatchLeagueId: store.matchLeagueID
        }
        request(server)
          .post('/api/user/user-league/join-league/v1')
          .send(data)
          .set('Authorization', store.userToken)
          .expect(status.BadRequest)
          .end(function(err, res) {
            if (err) return done(err)
            expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cteam))
            done()
          })
      })

      it('should not be a joined league because match league is not defind', (done) => {
        const data = {
          iUserTeamId: store.createdTeamID,
          iMatchLeagueId: store.wId
        }
        request(server)
          .post('/api/user/user-league/join-league/v1')
          .send(data)
          .set('Authorization', store.userToken)
          .expect(status.NotFound)
          .end(function(err, res) {
            if (err) return done(err)
            expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cmatchLeague))
            done()
          })
      })

      it('should be a multientry or not ', (done) => {
        const data = {
          iUserTeamId: store.userTeam1,
          iMatchLeagueId: store.matchLeagueID
        }
        request(server)
          .post('/api/user/user-league/join-league/v1')
          .send(data)
          .set('Authorization', store.userToken)
          .expect(status.BadRequest)
          .end(function(err, res) {
            if (err) return done(err)
            if (store.matchLeagueDetails.bMultipleEntry !== true) {
              expect(res.body.message).toMatch(messages.English.multiple_join_err)
            }
            done()
          })
      })
  })
})
