const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')
const userAuthServices = require('../user/auth/services')
const PromocodeStatisticModel = require('./statistics/model')
const MatchLeagueModel = require('../matchLeague/model')
const store = {
  matchLeagueId: '6201f9c1f188d16e775a0338' // league must present in db
}
const promoData = {
  sName: 'for new users',
  sCode: 'NEW3030',
  sInfo: 'Get 20% off',
  bIsPercent: true,
  nAmount: '20',
  eStatus: 'Y',
  nMinAmount: '20',
  nMaxAmount: '200',
  nMaxAllow: '2',
  eType: 'DEPOSIT',
  aMatches: [],
  aLeagues: [],
  dStartTime: new Date(new Date().getTime() - 24 * 60 * 60 * 1000),
  dExpireTime: new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
}

describe('Promocode Routes', () => {
  before(async () => {
    const adminToken = await adminAuthServices.getAdminToken()
    const matchLeagueData = await MatchLeagueModel.findOne({}, { _id: 1, iMatchId: 1, iLeagueId: 1 }).lean()
    const userData = await userAuthServices.getUserToken()
    promoData.aMatches = [{ id: matchLeagueData.iMatchId.toString() }]
    promoData.aLeagues = [{ id: matchLeagueData.iLeagueId.toString() }]
    store.matchLeagueId = matchLeagueData._id
    store.ID = undefined
    store.wId = '5f7f0fd9b18344309eb41138'
    store.token = adminToken
    store.iUserId = userData.data._id
  })

  describe('/POST Add Promocode', () => {
    const promocode = { ...promoData }
    it('Should be add promocode', (done) => {
      request(server)
        .post('/api/admin/promocode/v1')
        .set('Authorization', store.token)
        .send(promocode)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cpromocode))
          store.ID = res.body.data._id
          done()
        })
    })

    it('Should not be add promocode', (done) => {
      const promocode = { ...promoData }
      promocode.sCode = 'NEW303030'
      promocode.dStartTime = '2022/01/02'
      promocode.dExpireTime = '2022/03/01'
      request(server)
        .post('/api/admin/promocode/v1')
        .set('Authorization', store.token)
        .send(promocode)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          if (promocode.nMinAmount > promocode.nMaxAmount) {
            expect(res.body.message).toMatch(messages.English.less_then_err.replace('##', messages.English.minAmount).replace('#', messages.English.cmaximumAmount))
          }
          if (promocode.bIsPercent === true) {
            if (parseInt(promocode.nAmount) < 0 || parseInt(promocode.nAmount) > 100) {
              expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.snAmount))
            }
          }
          if (new Date(promocode.dExpireTime) < new Date(Date.now())) {
            expect(res.body.message).toMatch(messages.English.past_date_err.replace('##', messages.English.cexpireTime))
          }
          if (new Date(promocode.dStartTime) > new Date(promocode.dExpireTime)) {
            expect(res.body.message).toMatch(messages.English.less_then_err.replace('##', messages.English.cstartTime).replace('#', messages.English.cexpireTime))
          }
          done()
        })
    })

    it('Should be add match promocode', (done) => {
      const promocode = { ...promoData }
      promocode.eType = 'MATCH'
      promocode.sCode = 'TEST' + Date.now()

      request(server)
        .post('/api/admin/promocode/v1')
        .set('Authorization', store.token)
        .send(promocode)
        .expect(status.OK)
        .end(async function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cpromocode))
          store.sPromo = res.body.data.sCode
          await PromocodeStatisticModel.create({ iUserId: store.iUserId, iPromocodeId: res.body.data._id, sTransactionType: 'MATCH' })
          done()
        })
    })
  })

  describe('/PUT Update a Promocode', () => {
    it('Should be update promocode', (done) => {
      const promocode = { ...promoData }
      promocode.dStartTime = new Date(new Date().getTime() - 24 * 60 * 60 * 1000)
      promocode.dExpireTime = new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
      request(server)
        .put(`/api/admin/promocode/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(promocode)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cpromocode))
          store.ID = res.body.data._id
          done()
        })
    })

    it('Should not be update promocode', (done) => {
      const promocode = { ...promoData }
      promocode.bIsPercent = true
      promocode.nAmount = 120
      promocode.nMinAmount = 30
      promocode.nMaxAmount = 300
      promocode.dStartTime = new Date()
      promocode.dExpireTime = new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
      request(server)
        .put(`/api/admin/promocode/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(promocode)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          if (promocode.nMinAmount > promocode.nMaxAmount) {
            expect(res.body.message).toMatch(messages.English.less_then_err.replace('##', messages.English.minAmount).replace('#', messages.English.cmaximumAmount))
          }
          if (promocode.bIsPercent === true) {
            if (parseInt(promocode.nAmount) < 0 || parseInt(promocode.nAmount) > 100) {
              expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.amount))
            }
          }
          if (new Date(promocode.dExpireTime) < new Date(Date.now())) {
            expect(res.body.message).toMatch(messages.English.past_date_err.replace('##', messages.English.cexpireTime))
          }
          if (new Date(promocode.dStartTime) > new Date(promocode.dExpireTime)) {
            expect(res.body.message).toMatch(messages.English.less_then_err.replace('##', messages.English.cstartTime).replace('#', messages.English.cexpireTime))
          }
          done()
        })
    })

    it('Should not be update promocode', (done) => {
      const promocode = { ...promoData }
      promocode.bIsPercent = true
      promocode.nAmount = 20
      promocode.nMinAmount = 30
      promocode.nMaxAmount = 300
      promocode.dStartTime = new Date()
      promocode.dExpireTime = new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
      request(server)
        .put(`/api/admin/promocode/${store.wId}/v1`)
        .set('Authorization', store.token)
        .send(promocode)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cpromocode))
          done()
        })
    })
  })

  describe('/GET admin side promocode list', () => {
    it('Should be fetch promocode list', (done) => {
      request(server)
        .get('/api/admin/promocode/list/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpromocode))
          done()
        })
    })
  })

  describe('/GET list of promocode details', () => {
    it('Should be list of promocode details', (done) => {
      request(server)
        .get(`/api/admin/promocode/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpromocode))
          done()
        })
    })

    it('Should not be list of promocode details', (done) => {
      request(server)
        .get(`/api/admin/promocode/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cpromocode))
          done()
        })
    })
  })

  describe('User: fetch promocode list', () => {
    it('Should fetch a promocode list', (done) => {
      request(server)
        .get('/api/user/promocode/list/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpromocode))
          done()
        })
    })

    it('Should fetch particular match promocode', (done) => {
      request(server)
        .get(`/api/user/promocode/match/list/${store.matchLeagueId}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpromocode))
          done()
        })
    })

    it('Should not fetch particular match promocode', (done) => {
      request(server)
        .get('/api/user/promocode/match/list/620f2ac5fb20a1951b306085/v1')
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cmatchLeague))
          done()
        })
    })

    it('check promocode v1 badRequest', (done) => {
      request(server)
        .post('/api/user/promocode/check/v1')
        .set('Authorization', store.token)
        .send({
          sPromo: 'random',
          nAmount: promoData.nAmount
        })
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.invalid_promo_err)
          done()
        })
    })

    it('check promocode v1 error due to insufficant data', (done) => {
      request(server)
        .post('/api/user/promocode/check/v1')
        .set('Authorization', store.token)
        .send({
          sPromo: 'abc'
        })
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })

    it('check promocode v1', (done) => {
      request(server)
        .post('/api/user/promocode/match/check/v1')
        .set('Authorization', store.token)
        .send({
          sPromo: store.sPromo,
          iMatchLeagueId: store.matchLeagueId,
          nTeamCount: 1
        })
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.is_active.replace('##', messages.English.cpromocode))
          done()
        })
    })

    it('check promocode v1 error promocode does not exist', (done) => {
      request(server)
        .post('/api/user/promocode/match/check/v1')
        .set('Authorization', store.token)
        .send({
          sPromo: 'BASKETBALL_GET',
          iMatchLeagueId: store.matchLeagueId,
          nTeamCount: 2
        })
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.invalid_promo_err)
          done()
        })
    })

    it('check promocode v1 error match does not exist', (done) => {
      request(server)
        .post('/api/user/promocode/match/check/v1')
        .set('Authorization', store.token)
        .send({
          sPromo: 'BASKETBALL_GET25',
          iMatchLeagueId: '6201f94bf188d16e775a00df',
          nTeamCount: 1
        })
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cmatchLeague))
          done()
        })
    })

    it('check promocode v1 failed because match league id not entered', (done) => {
      request(server)
        .post('/api/user/promocode/match/check/v1')
        .set('Authorization', store.token)
        .send({
          sPromo: 'abc',
          iMatchLeagueId: ''
        })
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  describe('/DELETE a perticular one promocode', () => {
    it('Should be delete a promocode', (done) => {
      request(server)
        .delete(`/api/admin/promocode/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.del_success.replace('##', messages.English.cpromocode))
          done()
        })
    })

    it('Should not be delete a promocode', (done) => {
      request(server)
        .delete(`/api/admin/promocode/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cpromocode))
          done()
        })
    })
  })
})
