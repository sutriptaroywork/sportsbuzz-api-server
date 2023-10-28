const request = require('supertest')
const { describe, it, before } = require('mocha')
const expect = require('expect')
const server = require('../../../index')
const store = {}
const { status } = require('../../../helper/api.responses')
const adminAuthServices = require('../../admin/auth/services')
const data = {
  sName: 'temp-test-role',
  aPermissions: [{
    sKey: 'STATISTICS',
    eType: 'N'
  },
  {
    sKey: 'PAYMENT_OPTION',
    eType: 'N'
  },
  {
    sKey: 'PROMO',
    eType: 'N'
  },
  {
    sKey: 'USERTEAM',
    eType: 'N'
  },
  {
    sKey: 'SUBADMIN',
    eType: 'N'
  },
  {
    sKey: 'MATCHLEAGUE',
    eType: 'N'
  },
  {
    sKey: 'BALANCE',
    eType: 'N'
  },
  {
    sKey: 'MATCHPLAYER',
    eType: 'N'
  },
  {
    sKey: 'SERIES_LEADERBOARD',
    eType: 'N'
  },
  {
    sKey: 'SCORE_POINT',
    eType: 'N'
  },
  {
    sKey: 'LEADERSHIP_BOARD',
    eType: 'N'
  },
  {
    sKey: 'PAYOUT_OPTION',
    eType: 'N'
  },
  {
    sKey: 'PERMISSION',
    eType: 'N'
  },
  {
    sKey: 'BANNER',
    eType: 'N'
  },
  {
    sKey: 'VERSION',
    eType: 'N'
  },
  {
    sKey: 'RULE',
    eType: 'N'
  },
  {
    sKey: 'BANKDETAILS',
    eType: 'N'
  },
  {
    sKey: 'USERLEAGUE',
    eType: 'N'
  },
  {
    sKey: 'ROLES',
    eType: 'N'
  },
  {
    sKey: 'PUSHNOTIFICATION',
    eType: 'N'
  },
  {
    sKey: 'PLAYER',
    eType: 'N'
  },
  {
    sKey: 'CMS',
    eType: 'N'
  },
  {
    sKey: 'USERS',
    eType: 'N'
  },
  {
    sKey: 'SYSTEM_USERS',
    eType: 'N'
  },
  {
    sKey: 'COMPLAINT',
    eType: 'N'
  },
  {
    sKey: 'DEPOSIT',
    eType: 'N'
  },
  {
    sKey: 'REPORT',
    eType: 'N'
  },
  {
    sKey: 'KYC',
    eType: 'N'
  },
  {
    sKey: 'PASSBOOK',
    eType: 'N'
  },
  {
    sKey: 'PREFERENCES',
    eType: 'N'
  },
  {
    sKey: 'MAINTENANCE',
    eType: 'N'
  },
  {
    sKey: 'NOTIFICATION',
    eType: 'N'
  },
  {
    sKey: 'SPORT',
    eType: 'N'
  },
  {
    sKey: 'VALIDATION',
    eType: 'N'
  },
  {
    sKey: 'OFFER',
    eType: 'N'
  },
  {
    sKey: 'MATCH',
    eType: 'N'
  },
  {
    sKey: 'LEAGUE',
    eType: 'N'
  },
  {
    sKey: 'TEAM',
    eType: 'N'
  },
  {
    sKey: 'SETTING',
    eType: 'N'
  },
  {
    sKey: 'WITHDRAW',
    eType: 'N'
  },
  {
    sKey: 'POPUP_ADS',
    eType: 'N'
  },
  {
    sKey: 'EMAIL_TEMPLATES',
    eType: 'N'
  },
  {
    sKey: 'ADMIN_ROLE',
    eType: 'N'
  },
  {
    sKey: 'TDS',
    eType: 'N'
  },
  {
    sKey: 'BOT_LOG',
    eType: 'N'
  }]
}
describe('Roles Routes', () => {
  before(async () => {
    store.token = await adminAuthServices.getAdminToken()
    store.ID = undefined
    store.permission = undefined
    store.wID = '5f892aee05b16f154f12b60e'
  })

  describe('Fetch all the roles', () => {
    it('should fetch all the roles where eStatus is Y', (done) => {
      request(server)
        .get('/api/admin/role/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('Roles fetched successfull')
          done()
        })
    })
  })
  describe('Fetch role by searching', () => {
    it('should fetch all the roles as per search params', (done) => {
      request(server)
        .get('/api/admin/role/list/v1?search=Wr')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('Roles fetched successfull')
          done()
        })
    })
  })
  describe('Fetch specific role', () => {
    it('should fetch the specific role(as per id)', (done) => {
      request(server)
        .get('/api/admin/role/61e00a727de6f3aa7cb2ecf3/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('Role fetched successfull')
          done()
        })
    })
  })

  describe('add role', () => {
    // just remove the role from the data object end it will send error (bad request)
    it('should add the new role in roles collection', (done) => {
      request(server)
        .post('/api/admin/role/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('Role added successfully')
          done()
        })
    })
  })

  describe('update role', () => {
    // just remove the role from the data object end it will send error (bad request)
    data.eStatus = 'Y'
    it('update the role by passing role id in roles collection', (done) => {
      request(server)
        .put('/api/admin/role/6214b4e1c6040a3fb50aeef6/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('Role updated successfully')
          done()
        })
    })
  })
})
