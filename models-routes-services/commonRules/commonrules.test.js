const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const CommonRuleModel = require('./model')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')

const store = {}
const ruleData = {
  eRule: 'RR',
  nAmount: 50,
  eType: 'C',
  eStatus: 'Y',
  nExpireDays: 10
}

describe('CommonRules management routes is working or not', () => {
  before(async () => {
    // await CommonRuleModel.collection.drop()
    await CommonRuleModel.deleteOne({ eRule: 'DB' })
    const adminToken = await adminAuthServices.getAdminToken()
    store.crID = undefined
    store.wId = '5f7f0fd9b18344309eb41138'
    store.token = adminToken
  })

  describe('/POST Add Rules', () => {
    it('Should be create a Rule', (done) => {
      const rule = { ...ruleData }
      request(server)
        .post('/api/admin/rules/add/v1')
        .set('Authorization', store.token)
        .send(rule)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.rule))
          expect(res.body.data).toBeA('object')
          store.crID = res.body.data._id
          done()
        })
    })

    it('Should not be create a Rule', (done) => {
      const rule = { ...ruleData }
      rule.eRule = 'DB'
      rule.nMin = 20
      rule.nMax = 5
      request(server)
        .post('/api/admin/rules/add/v1')
        .set('Authorization', store.token)
        .send(rule)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) { return done(err) }
          if (rule.nMin > rule.nMax) {
            expect(res.body.message).toMatch(messages.English.less_then_err.replace('##', messages.English.minAmount).replace('#', messages.English.cmaximumAmount))
          } else if ((rule.eRule === 'PLC') || (rule.eRule === 'LCC')) {
            if ((parseInt(rule.nAmount) > 100) || (parseInt(rule.nAmount) < 0)) {
              expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.amount))
            }
          }
          done()
        })
    })
  })

  describe('/GET A list of common rules', () => {
    it('Should be a get list of Common rules', (done) => {
      request(server)
        .get('/api/admin/rules/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.rule))
          done()
        })
    })
  })

  describe('/GET a fetches a Ruled List', () => {
    it('Should be a get list of Common RULESS', (done) => {
      request(server)
        .get('/api/admin/rules/list/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.rule))
          done()
        })
    })
  })

  describe('/GET a single rule details', () => {
    it('should be a get single rule details', (done) => {
      request(server)
        .get(`/api/admin/rules/${store.crID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.rule))
          done()
        })
    })

    it('should not get single rule details', (done) => {
      request(server)
        .get(`/api/admin/rules/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.rule))
          done()
        })
    })
  })

  describe('/PUT a Single Rule Update', () => {
    it(' updated sucessfully ', (done) => {
      const rule = { ...ruleData }
      rule.eRule = 'DB'
      rule.eType = 'C'
      rule.nMax = 20
      rule.nMin = 2
      rule.nExpireDays = 20
      request(server)
        .put(`/api/admin/rules/${store.crID}/v1`)
        .set('Authorization', store.token)
        .send(rule)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.rule))
          done()
        })
    })

    it(' not updated sucessfully ', (does) => {
      const rule = { ...ruleData }
      rule.eType = 'C'
      delete rule.eStatus
      delete rule.nExpireDays
      request(server)
        .put(`/api/admin/rules/${store.wId}/v1`)
        .set('Authorization', store.token)
        .send(rule)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) { return does(err) }
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.rule))
          does()
        })
    })

    it('rules not updated sucessfully ', (done) => {
      const rule = { ...ruleData }
      rule.eType = 'C'
      rule.nMin = 20
      rule.nMax = 5
      request(server)
        .put(`/api/admin/rules/${store.wId}/v1`)
        .set('Authorization', store.token)
        .send(rule)
        .expect(status.BadRequest)
        .end((err, res) => {
          if (err) { return done(err) }
          if (rule.nMin > rule.nMax) {
            expect(res.body.message).toMatch(messages.English.less_then_err.replace('##', messages.English.minAmount).replace('#', messages.English.cmaximumAmount))
          } else if ((rule.eRule === 'PLC') || (rule.eRule === 'LCC')) {
            if ((parseInt(rule.nAmount) > 100) || (parseInt(rule.nAmount) < 0)) {
              expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.amount))
            }
          }
          done()
        })
    })
  })

  describe('/DELETE a Perticular one rule', () => {
    it('Should be delete a CMS', (done) => {
      request(server)
        .delete(`/api/admin/rules/${store.crID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.del_success.replace('##', messages.English.rule))
          done()
        })
    })

    it('Should not be delete a rule', (done) => {
      request(server)
        .delete(`/api/admin/rules/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.rule))
          done()
        })
    })
  })

  describe('/GET Rules Reward list', () => {
    it('Should be get rules reward list', (done) => {
      request(server)
        .get('/api/admin/rules/rewards/list/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.rule))
          done()
        })
    })
  })
})
