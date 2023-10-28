const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../../index')
const { messages, status } = require('../../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../../admin/auth/services')
const userAuthServices = require('../../user/auth/services')
const BankModel = require('./model')
const UsersModel = require('../model')

const store = {}

describe('Bank Management Routes', () => {
  before(async() => {
    // BankModel.collection.drop()
    store.ID = undefined
    store.wId = '5f894da3c3f1200f8ce176fd'
    store.wrongId = '5f7f0fd9b18344309eb41138'
    store.adminToken = await adminAuthServices.getAdminToken()
    const userData = await userAuthServices.getUserToken()
    const userData2 = await UsersModel.findOne({ sEmail: 'internaluser@gmail.com' }, { _id: 1 }).lean()
    store.userToken = userData.Authorization
    store.iUserId = userData.data._id
    store.iUserId2 = `${userData2._id}`
    await BankModel.deleteMany({ $or: [{ iUserId: store.iUserId }, { iUserId: store.iUserId2 }] })
  })

  const randomNumber12 = Math.floor(Math.random() * 1000000000000)

  describe('/POST Add bankDetails', () => {
    it('Should not be add bankDetails because invalid IFSC', (done) => {
      const bankDetails = {
        sBankName: 'Icici bank',
        sBranchName: 'gurukul road',
        sAccountHolderName: 'Manan',
        sAccountNo: 45218531556,
        sIFSC: 'ICICI01223'
      }
      request(server)
        .post('/api/user/bank-details/v2')
        .set('Authorization', store.userToken)
        .send(bankDetails)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.cIfscCode))
          done()
        })
    })

    it('Should be add bankDetails', (done) => {
      const bankDetails = {
        sBankName: 'ICICI',
        sBranchName: 'rajkot road',
        sAccountHolderName: 'Ravi Patel',
        sAccountNo: 161200107029,
        sIFSC: 'ICIC0123456'
      }
      request(server)
        .post('/api/user/bank-details/v2')
        .set('Authorization', store.userToken)
        .send(bankDetails)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cbankDetails))
          store.ID = res.body.data._id
          done()
        })
    })

    it('Should not be add bankDetails', (done) => {
      const bankDetails = {
        sBankName: 'IcICI',
        sBranchName: 'gurukul road',
        sAccountHolderName: 'Manan Mevada',
        sAccountNo: 161200107029,
        sIFSC: 'ICIC0123456'
      }
      request(server)
        .post('/api/user/bank-details/v2')
        .set('Authorization', store.userToken)
        .send(bankDetails)
        .expect(status.ResourceExist)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.cuserData))
          done()
        })
    })
  })

  describe('/GET User: bank detail', () => {
    it('Should be get bankDetails', (done) => {
      request(server)
        .get('/api/user/bank-details/v2')
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cbankDetails))
          done()
        })
    })
  })

  describe('/PUT User: bank detail', () => {
    it('Should be update bankDetails', (done) => {
      const bankDetails = {
        sBankName: 'ICICI',
        sBranchName: 'rajkot road',
        sAccountHolderName: 'Ravi Patel',
        sAccountNo: 161200107029,
        sIFSC: 'ICIC0123456'
      }
      request(server)
        .put('/api/user/bank-details/v2')
        .set('Authorization', store.userToken)
        .send(bankDetails)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cbankDetails))
          done()
        })
    })

    it('Should not be update bankDetails because invalid IFSC', (done) => {
      const bankDetails = {
        sBankName: 'Icici bank',
        sBranchName: 'gurukul road',
        sAccountHolderName: 'Manan',
        sAccountNo: 45218531556,
        sIFSC: 'ICICI01223'
      }
      request(server)
        .put('/api/user/bank-details/v2')
        .set('Authorization', store.userToken)
        .send(bankDetails)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.cIfscCode))
          done()
        })
    })
  })

  describe('/GET Admin: get bank detail', () => {
    it('Should be get admin side bankDetails', (done) => {
      request(server)
        .get(`/api/admin/bank-details/${store.iUserId}/v2`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cbankDetails))
          done()
        })
    })
  })

  describe('/PUT Admin: update bank detail', () => {
    it('Should be update bankDetails inside admin', (done) => {
      const bankDetails = {
        sBankName: 'Icici bank',
        sBranchName: 'gurukul road',
        sAccountName: 'Manan',
        sAccountNo: `${randomNumber12}`,
        sIFSC: 'ICIC0123456'
      }
      request(server)
        .put(`/api/admin/bank-details/${store.iUserId}/v2`)
        .set('Authorization', store.adminToken)
        .send(bankDetails)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cbankDetails))
          done()
        })
    })
    it('Should not be admin update bankDetails because invalid IFSC', (done) => {
      const bankDetails = {
        sBankName: 'Icici bank',
        sBranchName: 'gurukul road',
        sAccountHolderName: 'Manan',
        sAccountNo: 45218531556,
        sIFSC: 'ICICI01223'
      }
      request(server)
        .put(`/api/admin/bank-details/${store.iUserId}/v2`)
        .set('Authorization', store.adminToken)
        .send(bankDetails)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.cIfscCode))
          done()
        })
    })

    it('Should not be update bankDetails inside admin', (done) => {
      const bankDetails = {
        sBankName: 'Icici bank',
        sBranchName: 'gurukul road',
        sAccountName: 'Manan',
        sAccountNo: 45218531556,
        sIFSC: 'ICIC0123456'
      }
      request(server)
        .put(`/api/admin/bank-details/${store.wId}/v2`)
        .set('Authorization', store.adminToken)
        .send(bankDetails)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cuserBankDetails))
          done()
        })
    })
  })

  describe('/POST Admin: add bank detail', () => {
    it('Should be admin add bankDetails', (done) => {
      const bankDetails = {
        sBankName: 'Icici bank',
        sBranchName: 'gurukul road',
        sAccountHolderName: 'Manan',
        sAccountNo: 45218531556,
        sIFSC: 'ICIC0123456'
      }

      request(server)
        .post(`/api/admin/bank-details/${store.iUserId2}/v2`)
        .set('Authorization', store.adminToken)
        .send(bankDetails)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cbankDetails))
          store.adminID = res.body.data._id
          done()
        })
    })

    it('Should not be admin add bankDetails because invalid IFSC', (done) => {
      const bankDetails = {
        sBankName: 'Icici bank',
        sBranchName: 'gurukul road',
        sAccountHolderName: 'Manan',
        sAccountNo: 45218531556,
        sIFSC: 'ICICI01223'
      }
      request(server)
        .post(`/api/admin/bank-details/${store.iUserId}/v2`)
        .set('Authorization', store.adminToken)
        .send(bankDetails)
        .expect(status.BadRequest)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.cIfscCode))
          done()
        })
    })
  })

  describe('/PUT Admin: processed bank detail', () => {
    it('Should be processed bankDetails', (done) => {
      request(server)
        .put(`/api/admin/bank-details-processed/${store.iUserId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.successfully.replace('##', messages.English.processBankDetails))
          done()
        })
    })

    it('Should not be processed bankDetails', (done) => {
      request(server)
        .put(`/api/admin/bank-details-processed/${store.wId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cbankDetails))
          done()
        })
    })
  })
})
