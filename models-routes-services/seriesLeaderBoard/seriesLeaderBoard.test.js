const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')
const userAuthServices = require('../user/auth/services')
const store = {}

describe('Series LeaderBoard Routes', () => {
  before(async() => {
    store.id = '5f7f0fd9b18344309eb41138'
    store.wID = '5f7f0fd9b18344309eb41138'
    store.adminToken = await adminAuthServices.getAdminToken()
  })

  describe('/POST Add Series', () => {
    it('Should add series', (done) => {
      request(server)
        .post('/api/admin/series-leaderboard/v1')
        .set('Authorization', store.adminToken)
        .send({
          sName: 'TEST CASE 2021',
          sInfo: 'info about series',
          eCategory: 'cricket',
          eStatus: 'L'
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cseries))
          done()
        })
    })
  })

  describe('/GET List of series ', () => {
    it('Should be get list series', (done) => {
      request(server)
        .get('/api/admin/series-leaderboard/list/v1?sportsType=CRICKET')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          store.iSeriesLBId = res.body.data[0].results[0]._id
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cseries))
          done()
        })
    })
  })

  describe('/GET get single series', () => {
    it('Should be get series', (done) => {
      request(server)
        .get(`/api/admin/series-leaderboard/${store.iSeriesLBId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cseries))
          done()
        })
    })
  })

  describe('/PUT update single series', () => {
    it('Should be get series', (done) => {
      request(server)
        .put(`/api/admin/series-leaderboard/${store.iSeriesLBId}/v1`)
        .set('Authorization', store.adminToken)
        .send({
          sName: 'TEST-CASES 2021',
          sInfo: 'info about series',
          eCategory: 'cricket',
          eStatus: 'L'
        })
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cseries))
          done()
        })
    })
  })

  describe('/GET User: List of series leader board', () => {
    it('Should be get list of series leader board', (done) => {
      const data = { eCategory: 'CRICKET' }
      request(server)
        .post('/api/user/series-leaderboard/v1')
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cseries))
          done()
        })
    })
  })
})

// Series LeaderBoard Category Template Routes
describe('Series LeaderBoard Category Template Routes', () => {
  before(async() => {
    store.ID = undefined
    store.wID = '5f7f0fd9b18344309eb41138'
    store.adminToken = await adminAuthServices.getAdminToken()
  })

  describe('/GET List of series leaderboard category template', () => {
    it('Should be get all template list', (done) => {
      request(server)
        .get('/api/admin/series-leaderboard-categories-template/list/v1')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cseriesLBCategoriesTemplates))
          done()
        })
    })
  })

  describe('/GET List of name and ID', () => {
    it('Should be get list of name and id', (done) => {
      request(server)
        .get('/api/admin/series-leaderboard-categories-template/v1')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cseriesLBCategoriesTemplates))
          store.iCategoryId = res.body.data[0]._id
          done()
        })
    })
  })
})

describe('Series LeaderBoard Category Routes', () => {
  before(async() => {
    store.ID = undefined
    store.wID = '5f7f0fd9b18344309eb41138'
    store.adminToken = await adminAuthServices.getAdminToken()
  })

  describe('/POST get pre signed url ', () => {
    it('Should be get pre signed url', (done) => {
      const data = {
        sFileName: 'test.jpg',
        sContentType: 'image/jpeg'
      }
      request(server)
        .post('/api/admin/series-leaderboard-category/pre-signed-url/v1')
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          done()
        })
    })
  })

  describe('/POST add series leaderboard category', () => {
    it('Should be add series leaderboard category', (done) => {
      const data = {
        sName: 'TEST', iCategoryId: store.iCategoryId, sFirstPrize: 100, nMaxRank: 10, sContent: 'TEST', nTotalPayout: 1000
      }
      request(server)
        .post(`/api/admin/series-leaderboard-category/${store.iSeriesLBId}/v1`)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cseriesLeaderBoardCategory))
          done()
        })
    })

    it('Should not be add series leaderboard category because invalid category id', (done) => {
      const data = {
        sName: 'TEST', iCategoryId: store.wID, sFirstPrize: 100, nMaxRank: 10, sContent: 'TEST', nTotalPayout: 1000
      }
      request(server)
        .post(`/api/admin/series-leaderboard-category/${store.wID}/v1`)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cTemplate))
          done()
        })
    })
  })

  describe('/GET series leaderboard category list', () => {
    it('Should be get single series leaderboard category', (done) => {
      request(server)
        .get(`/api/admin/series-leaderboard-category-list/${store.iSeriesLBId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cseriesLeaderBoardCategory))
          store.iSeriesCategoryId = res.body.data[0]._id
          done()
        })
    })
  })

  describe('/GET get single series leaderboard category', () => {
    it('Should be get single series leaderboard category', (done) => {
      request(server)
        .get(`/api/admin/series-leaderboard-category/${store.iSeriesCategoryId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cseriesLeaderBoardCategory))
          done()
        })
    })

    it('Should not be get single series leaderboard category', (done) => {
      request(server)
        .get(`/api/admin/series-leaderboard-category/${store.wID}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cseries))
          done()
        })
    })
  })

  describe('/PUT update series leaderboard category', () => {
    it('Should be update series leaderboard category', (done) => {
      const data = {
        sFirstPrize: 100, nMaxRank: 10, sContent: 'TEST Updated', nTotalPayout: 1000
      }
      request(server)
        .put(`/api/admin/series-leaderboard-category/${store.iSeriesCategoryId}/v1`)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cseriesLeaderBoardCategory))
          done()
        })
    })

    it('Should not be update series leaderboard category because invalid category id', (done) => {
      const data = {
        sFirstPrize: 100, nMaxRank: 10, sContent: 'TEST', nTotalPayout: 1000
      }
      request(server)
        .put(`/api/admin/series-leaderboard-category/${store.wID}/v1`)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cseriesLeaderBoardCategory))
          done()
        })
    })
  })

  describe('/GET User: series leaderboard category list', () => {
    it('Should be get single series leaderboard category', (done) => {
      request(server)
        .get(`/api/user/series-leaderboard-category-list/${store.iSeriesLBId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cseriesLeaderBoardCategory))
          done()
        })
    })
  })

  describe('/POST add series leaderboard category price breakup', () => {
    it('Should be add series leaderboard category price breakup', (done) => {
      const data = {
        nRankFrom: 1, nRankTo: 1, eRankType: 'R', nPrize: 100
      }
      request(server)
        .post(`/api/admin/series-leaderboard-category/${store.iSeriesCategoryId}/price-breakup/v1`)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cnewPriceBreakup))
          done()
        })
    })

    it('Should not be add series leaderboard category price breakup because invalid series category id', (done) => {
      const data = {
        nRankFrom: 1, nRankTo: 1, eRankType: 'R', nPrize: 100
      }
      request(server)
        .post(`/api/admin/series-leaderboard-category/${store.wID}/price-breakup/v1`)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cseriesCategory))
          done()
        })
    })
  })

  describe('/GET list of price breakup', () => {
    it('Should be get price breakup list', (done) => {
      request(server)
        .get(`/api/admin/series-leaderboard-category/${store.iSeriesCategoryId}/price-breakup/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpriceBreakup))
          store.iPriceBreakupId = res.body.data[0]._id
          done()
        })
    })

    it('Should not be get price breakup because invalid series category id', (done) => {
      request(server)
        .get(`/api/admin/series-leaderboard-category/${store.wID}/price-breakup/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cseries))
          done()
        })
    })
  })

  describe('/GET single price breakup', () => {
    it('Should be get single price breakup', (done) => {
      request(server)
        .get(`/api/admin/series-leaderboard-category/${store.iSeriesCategoryId}/price-breakup/${store.iPriceBreakupId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpriceBreakup))
          done()
        })
    })

    it('Should not be get single price breakup because invalid price breakup id', (done) => {
      request(server)
        .get(`/api/admin/series-leaderboard-category/${store.wID}/price-breakup/${store.iPriceBreakupId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cseriesCategory))
          done()
        })
    })
  })

  describe('/PUT update single price breakup', () => {
    it('Should be get single price breakup', (done) => {
      const data = {
        nRankFrom: 1, nRankTo: 1, eRankType: 'B', nPrize: 100
      }
      request(server)
        .put(`/api/admin/series-leaderboard-category/${store.iSeriesCategoryId}/price-breakup/${store.iPriceBreakupId}/v1`)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cpriceBreakup))
          done()
        })
    })

    it('Should not be update single price breakup because invalid series category id', (done) => {
      const data = {
        nRankFrom: 1, nRankTo: 1, eRankType: 'B', nPrize: 100
      }
      request(server)
        .put(`/api/admin/series-leaderboard-category/${store.wID}/price-breakup/${store.iPriceBreakupId}/v1`)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cseriesCategory))
          done()
        })
    })
  })
})

// Series leader Board ranking system  Routes

describe('Series LeaderBoard ranking system Routes', () => {
  before(async() => {
    store.wID = '5f7f0fd9b18344309eb41138'
    store.adminToken = await adminAuthServices.getAdminToken()
    const userData = await userAuthServices.getUserToken()
    store.userToken = userData.Authorization
  })

  describe('/GET single user rank', () => {
    it('Should be get single user rank', (done) => {
      request(server)
        .get(`/api/user/series-leaderboard-get-myrank/${store.iSeriesCategoryId}/v1`)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cuserRank))
          done()
        })
    })
    it('Should be not get single user rank because invalid series category id', (done) => {
      request(server)
        .get(`/api/user/series-leaderboard-get-myrank/${store.wID}/v1`)
        .set('Authorization', store.userToken)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cseriesCategory))
          done()
        })
    })
  })

  describe('/GET All rank of series leader board', () => {
    it('Should be get all rank', (done) => {
      request(server)
        .get(`/api/user/series-leaderboard-get-allrank/${store.iSeriesCategoryId}/v2`)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cuserRank))
          done()
        })
    })
  })

  describe('/GET final counts of series leaderboard', () => {
    it('Should be get counts', (done) => {
      request(server)
        .get(`/api/admin/final-counts/${store.iSeriesLBId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cseries))
          done()
        })
    })
    it('Should be not get count because invalid series leaderboard id', (done) => {
      request(server)
        .get(`/api/admin/final-counts/${store.wID}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_found.replace('##', messages.English.cseries))
          done()
        })
    })
  })
})
