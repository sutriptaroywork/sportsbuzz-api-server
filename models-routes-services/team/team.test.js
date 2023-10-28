const request = require('supertest')
const { describe, it, before } = require('mocha')
const expect = require('expect')
const { messages, status } = require('../../helper/api.responses')
const server = require('../../index')
const adminAuthServices = require('../admin/auth/services')

const store = {}

/**
 * Authorization token
 */

describe('Team routes', () => {
  before(async() => {
    const adminToken = await adminAuthServices.getAdminToken()
    store.ID = undefined
    store.wId = '5f7f0fd9b18344309eb41138'
    store.token = adminToken
  })
  const randomNumber = Math.floor(Math.random() * 111111)
  /**
   * Fetch list by sports type
   */
  describe('/GET list by sports type', () => {
    it('Should be fetch list', (done) => {
      request(server)
        .get('/api/admin/team/list/v1?start=0&limit=5&sportsType=cricket')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cteam))
          done()
        })
    })

    it('Should not be fetch list because sportsType params value does not exist', (done) => {
      request(server)
        .get('/api/admin/team/list/v1?start=0&limit=5&sort&order&search=&sportsType')
        .set('Authorization', store.token)
        .expect(status.UnprocessableEntity)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
    it('Should fetch team count for admin', (done) => {
      request(server)
        .get('/api/admin/team/counts/v1?sportsType=cricket')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', `${messages.English.cteam} ${messages.English.cCounts}`))
          done()
        })
    })
  })

  /**
   * Fetch team list
   */
  describe('/GET team list by sports type', () => {
    it('Should be get team list', (done) => {
      request(server)
        .get('/api/admin/team/team-list/v1?sportsType=cricket')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cteam))
          done()
        })
    })

    it('Should not be get team list because sportsType params value does not exist', (done) => {
      request(server)
        .get('/api/admin/team/team-list/v1?sportsType')
        .set('Authorization', store.token)
        .expect(status.UnprocessableEntity)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.errors).toBeA('object')
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  /**
   * Add team
   */
  describe('/POST Add team', () => {
    it('Should be add team', (done) => {
      const teamDetails = {
        sKey: `${randomNumber}`,
        sName: 'India',
        sImage: 'path/img.jpg',
        sportsType: 'cricket',
        sShortName: 'IND'
      }
      request(server)
        .post('/api/admin/team/add/v1')
        .set('Authorization', store.token)
        .send(teamDetails)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cnewTeam))
          store.ID = res.body.data._id
          done()
        })
    })

    it('Should not add team as team exist', (done) => {
      const teamDetails = {
        sKey: `${randomNumber}`,
        sName: 'India',
        sImage: 'path/img.jpg',
        sportsType: 'cricket',
        sShortName: 'IND'
      }
      request(server)
        .post('/api/admin/team/add/v1')
        .set('Authorization', store.token)
        .send(teamDetails)
        .expect(status.ResourceExist)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.cteamKey))
          done()
        })
    })

    it('Should be validation error', (done) => {
      const teamDetails = {
        sName: 'India',
        sImage: 'path/img.jpg',
        sportsType: 'cricket'
      }
      request(server)
        .post('/api/admin/team/add/v1')
        .set('Authorization', store.token)
        .send(teamDetails)
        .expect(status.UnprocessableEntity)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.errors).toBeA('array')
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  /**
   * Fetch details of single team
   */
  describe('/GET single team details', () => {
    it('Should be get single team details', (done) => {
      request(server)
        .get(`/api/admin/team/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cteam))
          done()
        })
    })

    it('Should not be get single team details because match id does not exist', (done) => {
      request(server)
        .get(`/api/admin/team/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cteam))
          done()
        })
    })
  })

  /**
   * Update team details
   */
  describe('/PUT update match details', () => {
    it('Should be update team details', (done) => {
      request(server)
        .put(`/api/admin/team/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send({
          sImage: 'https://yudiz-fantasy-media.s3.ap-south-1.amazonaws.com/teams/1599481762058_player1.jpg',
          sName: 'Northern Knights',
          sportsType: 'cricket',
          sKey: `sk:${randomNumber}`
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cteamDetails))
          done()
        })
    })

    it('Should not be update team details', (done) => {
      request(server)
        .put(`/api/admin/team/${store.wId}/v1`)
        .set('Authorization', store.token)
        .send({
          sImage: 'https://yudiz-fantasy-media.s3.ap-south-1.amazonaws.com/teams/1599481762058_player1.jpg',
          sName: 'Northern Knights',
          sKey: '1234'
        })
        .expect(status.UnprocessableEntity)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  /**
   * Pre-assigned url for teams image
   */
  describe('/POST signed url for teams image', () => {
    it('Should be signed url form teams image', (done) => {
      request(server)
        .post('/api/admin/team/pre-signed-url/v1')
        .set('Authorization', store.token)
        .send({
          sFileName: 'player123.jpg',
          sContentType: 'image/jpeg'
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          done()
        })
    })

    it('Should not be signed url form teams image', (done) => {
      request(server)
        .post('/api/admin/team/pre-signed-url/v1')
        .set('Authorization', store.token)
        .send({
          sFileName: 'player123.jpg'
        })
        .expect(status.UnprocessableEntity)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })

    it('Should not be signed url form teams image', (done) => {
      request(server)
        .post('/api/admin/team/pre-signed-url/v1')
        .set('Authorization', store.token)
        .send({
          sFileName: 'player123.jpg',
          sContentType: 'image/jpg'
        })
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.image))
          done()
        })
    })
  })
})
