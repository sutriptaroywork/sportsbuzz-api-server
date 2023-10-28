const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')

const store = {}

/**
 * Authorization token
 */

describe('Player routes', () => {
  before(async () => {
    const adminToken = await adminAuthServices.getAdminToken()
    store.token = adminToken
    store.ID = undefined
    store.wId = '5f7f0fd9b18344309eb41138'
  })
  const randomNumber = Math.floor(Math.random() * 111111)

  /**
   * Fetch list of players
   */
  describe('/GET list of players', () => {
    it('Should be fetch players list', (done) => {
      request(server)
        .get('/api/admin/player/list/v1?start=0&limit=5&sportsType=cricket')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cplayer))
          done()
        })
    })

    it('Should not be fetch players list', (done) => {
      request(server)
        .get('/api/admin/player/list/v1?start=0&limit=5&sort&order&search=&sportsType')
        .set('Authorization', store.token)
        .expect(status.UnprocessableEntity)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })

    it('Should fetch player count', (done) => {
      request(server)
        .get('/api/admin/player/counts/v1?sportsType=cricket&eProvider=ENTITYSPORT')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', `${messages.English.cplayer} ${messages.English.cCounts}`))
          done()
        })
    })
    it('Should not fetch player count because sportsType must be sent in query params', (done) => {
      request(server)
        .get('/api/admin/player/counts/v1')
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
   * Add player details
   */
  describe('/POST add player details', () => {
    it('Should be add details of player', (done) => {
      const playerDetails = {
        sKey: `${randomNumber}TEST`,
        sName: 'testing',
        sImage: 'path/img.jpg',
        nFantasyCredit: '8',
        eRole: 'BATS',
        sportsType: 'cricket'
      }
      request(server)
        .post('/api/admin/player/add/v1')
        .set('Authorization', store.token)
        .send(playerDetails)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cnewPlayer))
          store.ID = res.body.data._id
          done()
        })
    })

    it('Should not be Add Player', (done) => {
      const playerDetails = {
        sKey: `${randomNumber}TEST`,
        sName: 'testing',
        sImage: 'path/img.jpg',
        nFantasyCredit: '8',
        eRole: 'BATS',
        sportsType: 'cricket'
      }
      request(server)
        .post('/api/admin/player/add/v1')
        .set('Authorization', store.token)
        .send(playerDetails)
        .expect(status.ResourceExist)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.cplayerKey))
          done()
        })
    })

    it('Should be not found player role', (done) => {
      const playerDetails = {
        sKey: '56',
        sName: 'Ind',
        sImage: 'path/img.jpg',
        nFantasyCredit: '8',
        eRole: 'CT',
        sportsType: 'cricket'
      }
      request(server)
        .post('/api/admin/player/add/v1')
        .set('Authorization', store.token)
        .send(playerDetails)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cplayerRole))
          done()
        })
    })
  })

  /**
   * Fetch player details
   */
  describe('/GET player details', () => {
    it('Should be fetch player details', (done) => {
      request(server)
        .get(`/api/admin/player/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cplayer))
          done()
        })
    })

    it('Should not be fetch player details', (done) => {
      request(server)
        .get(`/api/admin/player/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cplayer))
          done()
        })
    })
  })

  /**
   * Update player details
   */
  describe('/PUT change player details', () => {
    it('Should be update player details', (done) => {
      request(server)
        .put(`/api/admin/player/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send({
          sImage: 'https://yudiz-fantasy-media.s3.ap-south-1.amazonaws.com/players/1599482641032_player.jpg',
          sName: 'eleven',
          sportsType: 'cricket'
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cplayer))
          done()
        })
    })

    it('Should not be update player details', (done) => {
      request(server)
        .put(`/api/admin/player/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send({
          sImage: 'https://yudiz-fantasy-media.s3.ap-south-1.amazonaws.com/players/1599482641032_player.jpg',
          sName: 'eleven'
        })
        .expect(status.UnprocessableEntity)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })

    it('Should not be update player details', (done) => {
      request(server)
        .put(`/api/admin/player/${store.wId}/v1`)
        .set('Authorization', store.token)
        .send({
          sImage: 'https://yudiz-fantasy-media.s3.ap-south-1.amazonaws.com/players/1599482641032_player.jpg',
          sName: 'eleven',
          sportsType: 'cricket'
        })
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cplayer))
          done()
        })
    })
  })

  /**
   * Pre-assigned url for player image
   */
  describe('/POST signed url for player image', () => {
    it('Should be signed url form player image', (done) => {
      request(server)
        .post('/api/admin/player/pre-signed-url/v1')
        .set('Authorization', store.token)
        .send({
          sFileName: 'player.jpg',
          sContentType: 'image/jpeg'
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          done()
        })
    })

    it('Should not be signed url form player image', (done) => {
      request(server)
        .post('/api/admin/player/pre-signed-url/v1')
        .set('Authorization', store.token)
        .send({
          sFileName: 'player.jpg'
        })
        .expect(status.UnprocessableEntity)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })

    it('Should not be signed url form player image because invalid content type', (done) => {
      request(server)
        .post('/api/admin/player/pre-signed-url/v1')
        .set('Authorization', store.token)
        .send({
          sFileName: 'player.jpg',
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
