const request = require('supertest')
const { describe, it, before } = require('mocha')
const expect = require('expect')
const server = require('../../index')
const store = {}
const { status } = require('../../helper/api.responses')
const adminAuthServices = require('../admin/auth/services')
const MatchLeagueModel = require('../matchLeague/model')

describe('Botlog Routes', () => {
  before(async () => {
    const matchLeague = await MatchLeagueModel.findOne({}, { _id: 1 }).lean()
    store.token = await adminAuthServices.getAdminToken()
    store.ID = undefined
    store.permission = undefined
    store.wID = '5f892aee05b16f154f12b60e'
    store.iMatchLeagueId = matchLeague._id
  })

  describe('Fetch bot logs', () => {
    it('should fetch bot logs as per params(no parmas provided than it will take default from pagination function)', (done) => {
      request(server)
        .get(`/api/admin/contest-bot-logs/${store.iMatchLeagueId}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('Bot logs fetched successfully')
          done()
        })
    })
  })
  describe('Fetch bot logs(send invalid id in params should return empty array response)', () => {
    it('should fetch bot logs as per params(no parmas provided than it will take default from pagination function)', (done) => {
      request(server)
        .get('/api/admin/contest-bot-logs/61bc6457d84eabca5d631179/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('Bot logs fetched successfully')
          done()
        })
    })
  })
  describe('Fetch bot logs(send start limit and sort in ascending)', () => {
    it('should fetch bot logs as per params(no parmas provided than it will take default from pagination function)', (done) => {
      request(server)
        .get(`/api/admin/contest-bot-logs/${store.iMatchLeagueId}/v1?start=0&limit=10&order=asc`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('Bot logs fetched successfully')
          done()
        })
    })
  })
  describe('Fetch bot logs(send start limit and sort in desc)', () => {
    it('should fetch bot logs as per params(no parmas provided than it will take default from pagination function)', (done) => {
      request(server)
        .get(`/api/admin/contest-bot-logs/${store.iMatchLeagueId}/v1?start=0&limit=2&order=desc`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('Bot logs fetched successfully')
          done()
        })
    })
  })
})
