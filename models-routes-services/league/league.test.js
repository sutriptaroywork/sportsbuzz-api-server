const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const FilterCategoryModel = require('../leagueCategory/filterCategory.model')
const adminAuthServices = require('../admin/auth/services')

const store = {}
const base = {
  sName: 'Winner Gets it all test',
  sShareText: 'Winner Gets it all test 2',
  nMax: '22',
  nMin: '40',
  nPrice: '0',
  nTotalPayout: '220',
  nDeductPercent: '0',
  nBonusUtil: '0',
  sPayoutBreakupDesign: 'Winner Gets it all test',
  bConfirmLeague: true,
  bMultipleEntry: true,
  bAutoCreate: true,
  nPosition: '1',
  eStatus: 'Y',
  bPoolPrize: true,
  bUnlimitedJoin: false,
  eCategory: 'cricket',
  iLeagueCatId: `${store.iLeagueCatId}`,
  iFilterCatId: `${store.iFilterCatId}`
}
const updateBase = {
  sShareText: 'Winner Gets it all test text',
  nMax: 22,
  nMin: 20,
  nPrice: 0,
  nTotalPayout: 100,
  nDeductPercent: 0,
  eCategory: 'cricket'
}

const priceBreakUpBase = {
  nRankFrom: 1,
  nRankTo: 5,
  nPrize: 10,
  eRankType: 'B',
  sInfo: '',
  sImage: ''
}

describe('League Management Routes', () => {
  before(async () => {
    const adminToken = await adminAuthServices.getAdminToken()
    const filterCategory = await FilterCategoryModel.findOne({}, { _id: 1 })
    store.iFilterCatId = filterCategory._id
    store.ID = '620913932c01ac10298de277'
    store.PBID = '620913992c01ac10298de693'
    store.iLeagueCatId = undefined
    store.wId = '5f894da3c3f1200f8ce176fd'
    store.token = adminToken
    store.sportsType = 'cricket'
  })

  describe('/GET List of League Category with pagination', () => {
    it('Should be list of League Category with pagination', (done) => {
      request(server)
        .get('/api/admin/league-category/list/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.leagueCategory))
          store.iLeagueCatId = res.body.data[0].results[0]._id
          base.iLeagueCatId = store.iLeagueCatId
          base.iFilterCatId = store.iFilterCatId
          done()
        })
    })
  })

  describe('/Post add new a league', () => {
    it('Should be create a new League', (done) => {
      const league = { ...base }
      league.nMin = 20
      league.bPoolPrice = false
      request(server)
        .post('/api/admin/league/v1')
        .set('Authorization', store.token)
        .send(league)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.newLeague))
          store.ID = res.body.data._id
          done()
        })
    })

    it('Should not be create a new League', (done) => {
      const league = Object.assign({}, base)
      request(server)
        .post('/api/admin/league/v1')
        .set('Authorization', store.token)
        .send(league)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          if (league.nMin > league.nMax) {
            expect(res.body.message).toMatch(messages.English.less_then_err.replace('##', messages.English.cminimumEntry).replace('#', messages.English.cmaximumEntry))
          }
          if (league.bMultipleEntry === false && league.nTeamJoinLimit > 1) {
            expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.cteamJoinLimit))
          }
          done()
        })
    })
  })

  describe('/GET Sport wise leagues ', () => {
    it(' should be a list of league sportswise', (done) => {
      request(server)
        .get(`/api/admin/league/v1?sportsType=${store.sportsType}&searchCategory=Test Category`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cleague))
          done()
        })
    })

    it('should not be a list of league sportswise', (done) => {
      request(server)
        .get('/api/admin/league/v1')
        .set('Authorization', store.token)
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  describe('/GET Sports of leagues ', () => {
    it('should be a list of leagues of pagination sports', (done) => {
      request(server)
        .get(`/api/admin/league/list/v1?sportsType=${store.sportsType}`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cleague))
          done()
        })
    })

    it('should not be a list of leagues of pagination sports(Error because sportsType must be present in request query)', (done) => {
      request(server)
        .get('/api/admin/league/list/v1')
        .set('Authorization', store.token)
        .expect(status.UnprocessableEntity)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  describe('/GET a One league ', () => {
    it(' should be a get one league', (done) => {
      request(server)
        .get(`/api/admin/league/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cleague))
          done()
        })
    })

    it('should not be a list of leagues of pagination sports', (done) => {
      request(server)
        .get(`/api/admin/league/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cleague))
          done()
        })
    })
  })

  describe('/PUT update a one league ', () => {
    it('should be update a league', (done) => {
      const league = { ...updateBase }
      request(server)
        .put(`/api/admin/league/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .send(league)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cleague))
          done()
        })
    })

    it('should not be a update a league 400 error', (done) => {
      const league = { ...updateBase }
      league.nMin = 40
      request(server)
        .put(`/api/admin/league/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.BadRequest)
        .send(league)
        .end((err, res) => {
          if (err) { return done(err) }
          if (league.nMin > league.nMax) {
            expect(res.body.message).toMatch(messages.English.less_then_err.replace('##', messages.English.cminimumEntry).replace('#', messages.English.cmaximumEntry))
          }
          if ((league.bMultipleEntry === false) && (league.nTeamJoinLimit > 1)) {
            expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.cteamJoinLimit))
          }
          done()
        })
    })

    it('should not be a update a League 422 error', (done) => {
      const league = { ...updateBase }
      request(server)
        .put(`/api/admin/league/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .send(league)
        .end((err, res) => {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cleague))
          done()
        })
    })

    it('should not be a update a League throw 422 error - bUnlimitedJoin invalid', (done) => {
      const league = { ...updateBase }
      league.bPoolPrice = false
      league.bUnlimitedJoin = true
      request(server)
        .put(`/api/admin/league/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.BadRequest)
        .send(league)
        .end((err, res) => {
          if (err) { return done(err) }
          if (league.bPoolPrice === false && league.bUnlimitedJoin === true) {
            expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.unlimitedJoin))
          }
          done()
        })
    })
  })

  describe('/GET a List of price-breakup', () => {
    it(' should be a list of price-breakup', (done) => {
      request(server)
        .get(`/api/admin/league/${store.ID}/prize-breakup/v1?sportsType=${store.sportsType}`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data.aLeaguePrize).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpriceBreakup))
          done()
        })
    })
  })

  describe('/POST Add price-breakup', () => {
    it('should be add a price-breakup', (done) => {
      const pricebreakup = { ...priceBreakUpBase }
      request(server)
        .post(`/api/admin/league/${store.ID}/prize-breakup/v1`)
        .set('Authorization', store.token)
        .send(pricebreakup)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cnewPriceBreakup))
          store.PBID = res.body.data.aLeaguePrize[0]._id
          done()
        })
    })

    it(' should not add a price-breakup', (done) => {
      const pricebreakup = { ...priceBreakUpBase }
      request(server)
        .post(`/api/admin/league/${store.ID}/prize-breakup/v1`)
        .set('Authorization', store.token)
        .send(pricebreakup)
        .expect(status.ResourceExist)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.cpriceBreakup))
          done()
        })
    })

    it('should not add a price-breakup 404', (done) => {
      const pricebreakup = { ...priceBreakUpBase }
      pricebreakup.nRankFrom = 276
      pricebreakup.nRankTo = 276
      pricebreakup.nPrice = 1
      request(server)
        .post(`/api/admin/league/${store.wId}/prize-breakup/v1`)
        .set('Authorization', store.token)
        .send(pricebreakup)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) { return done(err) }
          if ((pricebreakup.eRankType === 'E') && (!pricebreakup.sInfo)) {
            expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.ssinfo))
          }
          if ((pricebreakup.eRankType === 'E') && (parseInt(pricebreakup.nPrice) === 0)) {
            expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.snprice))
          }
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cleague))
          done()
        })
    })
  })

  describe('/GET List of price-breakup', () => {
    it(' should be list of price-breakup for league', (done) => {
      request(server)
        .get(`/api/admin/league/${store.ID}/prize-breakup/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpriceBreakup))
          done()
        })
    })

    it('should not get list of price-breakup 404', (done) => {
      request(server)
        .get(`/api/admin/league/${store.wId}/prize-breakup/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cleague))
          done()
        })
    })
  })

  describe('/GET a one price-breakup for league', () => {
    it('should be a one price-breakup for league', (done) => {
      request(server)
        .get(`/api/admin/league/${store.ID}/prize-breakup/${store.PBID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpriceBreakup))
          done()
        })
    })

    it('should be a one price-breakup for league', (done) => {
      request(server)
        .get(`/api/admin/league/${store.wId}/prize-breakup/${store.PBID}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cleague))
          done()
        })
    })
  })

  describe('/PUT update a price-breakup for league', () => {
    it('should be update a price-breakup for league', (done) => {
      const pricebreakup = { ...priceBreakUpBase }
      pricebreakup.nRankFrom = 1
      pricebreakup.nRankTo = 1
      pricebreakup.eRankType = 'R'
      request(server)
        .put(`/api/admin/league/${store.ID}/prize-breakup/${store.PBID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .send(pricebreakup)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cpriceBreakup))
          done()
        })
    })
    it('should not be update a price-breakup because sufficiant information is not send(nRankFrom missing)', (done) => {
      const pricebreakup = { ...priceBreakUpBase }
      delete pricebreakup.nRankFrom
      pricebreakup.nRankTo = 1
      pricebreakup.eRankType = 'R'
      request(server)
        .put(`/api/admin/league/${store.ID}/prize-breakup/${store.PBID}/v1`)
        .set('Authorization', store.token)
        .expect(status.UnprocessableEntity)
        .send(pricebreakup)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })

    it('should not be update a price-breakup 404', (done) => {
      const pricebreakup = { ...priceBreakUpBase }
      pricebreakup.nRankFrom = 1
      pricebreakup.nRankTo = 1
      pricebreakup.eRankType = 'R'
      request(server)
        .put(`/api/admin/league/${store.wId}/prize-breakup/${store.PBID}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .send(pricebreakup)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cleague))
          done()
        })
    })
  })
})
