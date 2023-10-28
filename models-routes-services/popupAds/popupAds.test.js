const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const expect = require('expect')
const { messages, status } = require('../../helper/api.responses')
const adminAuthServices = require('../admin/auth/services')
const { isUrl } = require('../../helper/utilities.services')
const store = {}

describe('Popup Ads Routes', () => {
  before(async () => {
    store.userToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2MGU2ZGFhYjg0N2M1OTIzOWMyYTdiZmYiLCJpYXQiOjE2MzA1NjY0MzcsImV4cCI6MTYzODM0MjQzN30.hIxL6RExLBhsi3zqVOar1eXwRPoUKqUP2e_gciJMWcA'
    store.token = await adminAuthServices.getAdminToken()
    store.ID = '62162dd232990e83a8a484ac'
    store.wID = '61bc6457d84eabca5d65226e'
  })
  describe('/POST Add popupAds', () => {
    it('should be a create a popupAds ', (done) => {
      const data = {
        sImage: 'popupAds/1630990370136_FileToUpload-1604656454593.jpg',
        eType: 'I',
        eStatus: 'N',
        ePlatform: 'ALL',
        iMatchId: '61baeca9c213ef6d8cdf6445',
        iMatchLeagueId: '61bc6457d84eabca5d65226e',
        eCategory: 'CRICKET'
      }
      request(server)
        .post('/api/admin/popupAds/add/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.newPopupAds))
          store.ID = res.body.data._id
          done()
        })
    })

    it('should not create popupAds because match id not found', (done) => {
      const data = {
        sImage: 'popupAds/1630990370136_FileToUpload-1604656454593.jpg',
        eType: 'I',
        eStatus: 'Y',
        ePlatform: 'ALL'
      }
      request(server)
        .post('/api/admin/popupAds/add/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.match_not_upcoming)
          done()
        })
    })

    it('should not create popupAds because league does not exist', (done) => {
      const data = {
        sImage: 'popupAds/1630990370136_FileToUpload-1604656454593.jpg',
        eType: 'I',
        eStatus: 'Y',
        ePlatform: 'ALL',
        iMatchId: '61baeca9c213ef6d8cdf6445',
        iMatchLeagueId: '6135b6d855e8c41f14f49c72',
        eCategory: 'CRICKET'
      }
      request(server)
        .post('/api/admin/popupAds/add/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cmatchLeague))
          done()
        })
    })

    it('should not create popupAds because link is not present in data(as per eType link is required)', (done) => {
      const data = {
        sImage: 'popupAds/1630990370136_FileToUpload-1604656454593.jpg',
        eType: 'E',
        eStatus: 'Y',
        ePlatform: 'ALL'
      }
      request(server)
        .post('/api/admin/popupAds/add/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          if (data.eType === 'E' && data.sLink && !isUrl(data.sLink)) {
            expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.link))
          } else if (data.eType === 'E' && !data.sLink) {
            expect(res.body.message).toMatch(messages.English.fields_missing.replace('##', messages.English.link))
          }
          done()
        })
    })

    it('should not create popupAds because link is invalid', (done) => {
      const data = {
        sImage: 'popupAds/1630990370136_FileToUpload-1604656454593.jpg',
        eType: 'E',
        eStatus: 'Y',
        ePlatform: 'ALL',
        sLink: 'google.com'
      }
      request(server)
        .post('/api/admin/popupAds/add/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          if (data.eType === 'E' && !isUrl(data.sLink)) {
            expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.link))
          } else if (data.eType === 'E' && !data.sLink) {
            expect(res.body.message).toMatch(messages.English.fields_missing.replace('##', messages.English.link))
          }
          done()
        })
    })
  })

  describe('get list of popupAds', () => {
    it('should be a get list of popupAds', (done) => {
      request(server)
        .get('/api/admin/popupAds/list/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.popupAds))
          done()
        })
    })
  })

  describe('get a details of one popupAd', () => {
    it('should be a get details of popupAd', (done) => {
      request(server)
        .get(`/api/admin/popupAds/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.popupAds))
          done()
        })
    })

    it('should not be a get details of popupAds', (done) => {
      request(server)
        .get(`/api/admin/popupAds/${store.wID}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.popupAds))
          done()
        })
    })
  })

  describe('post a pre-signed url inside a popupAds', () => {
    it('should be a pre-signed url of popupAds image', (done) => {
      const data = {
        sFileName: 'FileToUpload-1604656454593.jpg',
        sContentType: 'jpg'
      }
      request(server)
        .post('/api/admin/popupAds/pre-signed-url/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          done()
        })
    })
  })

  describe('/PUT update popupAds', () => {
    it('should be a update a popupAds ', (done) => {
      const data = {
        sTitle: 'PopUp Ads Test',
        sImage: 'popupAds/1630990370136_FileToUpload-1604656454593.jpg',
        eType: 'I',
        eStatus: 'Y',
        ePlatform: 'ALL',
        iMatchId: '61baeca9c213ef6d8cdf6445',
        iMatchLeagueId: '61bc6457d84eabca5d65226e',
        eCategory: 'CRICKET'
      }
      request(server)
        .put(`/api/admin/popupAds/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.popupAdsDetails))
          done()
        })
    })
    it('should not update a popupAd because match does not exist', (done) => {
      const data = {
        sTitle: 'PopUp Ads Test',
        sImage: 'popupAds/1630990370136_FileToUpload-1604656454593.jpg',
        eType: 'I',
        eStatus: 'Y',
        ePlatform: 'ALL',
        iMatchId: '621628e037c29de0fd692168',
        iMatchLeagueId: '61bc6457d84eabca5d65226e',
        eCategory: 'CRICKET'
      }
      request(server)
        .put(`/api/admin/popupAds/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.match_not_upcoming)
          done()
        })
    })
    it('should not create popupAds because league does not exist', (done) => {
      const data = {
        sImage: 'popupAds/1630990370136_FileToUpload-1604656454593.jpg',
        eType: 'I',
        eStatus: 'Y',
        ePlatform: 'ALL',
        iMatchId: '61baeca9c213ef6d8cdf6445',
        iMatchLeagueId: '6135b6d855e8c41f14f49c72',
        eCategory: 'CRICKET'
      }
      request(server)
        .put(`/api/admin/popupAds/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cmatchLeague))
          done()
        })
    })
    it('should not update a popupAds because wID does not exist', (done) => {
      const data = {
        sTitle: 'PopUp Ads Test',
        sImage: 'popupAds/1630990370136_FileToUpload-1604656454593.jpg',
        eType: 'I',
        eStatus: 'Y',
        ePlatform: 'ALL',
        iMatchId: '61baeca9c213ef6d8cdf6445',
        iMatchLeagueId: '61bc6457d84eabca5d65226e',
        eCategory: 'CRICKET'
      }
      request(server)
        .put(`/api/admin/popupAds/${store.wID}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.popupAds))
          done()
        })
    })

    it('should not update a popupAds because invalid link(sLink)', (done) => {
      const data = {
        sImage: 'popupAds/1630990370136_FileToUpload-1604656454593.jpg',
        eType: 'E',
        eStatus: 'Y',
        ePlatform: 'ALL',
        sLink: 'google.com'
      }
      request(server)
        .put(`/api/admin/popupAds/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          if (data.eType === 'E' && data.sLink && !isUrl(data.sLink)) {
            expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.link))
          } else if (data.eType === 'E' && !data.sLink) {
            expect(res.body.message).toMatch(messages.English.fields_missing.replace('##', messages.English.link))
          }
          done()
        })
    })
  })

  describe('/DELETE delete popupAds', () => {
    it('should delete a popupAds ', (done) => {
      request(server)
        .delete(`/api/admin/popupAds/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.del_success.replace('##', messages.English.popupAds))
          done()
        })
    })

    it('should not delete a popupAds ', (done) => {
      request(server)
        .delete(`/api/admin/popupAds/${store.wID}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.popupAds))
          done()
        })
    })
  })

  describe('get list of popupAds for user', () => {
    it('should be a get list of popupAds for user', (done) => {
      request(server)
        .get('/api/user/popupAds/list/v1')
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.popupAds))
          done()
        })
    })
  })
})
