const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const KycModel = require('./model')
const adminAuthServices = require('../admin/auth/services')
const userAuthServices = require('../user/auth/services')

const store = {}

function makeid(length) {
  var result = ''
  KycModel.collection.drop()
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  var charactersLength = characters.length
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}
const randomtext = makeid(6)

const randomNumber12 = Math.floor(Math.random() * 1000000000000)
const randomNumber6 = Math.floor(Math.random() * 1000000)

const urlBaseData = {
  sFileName: 'test1.jpg',
  sContentType: 'jpg'
}

const panBaseData = {
  eType: 'PAN',
  sNo: `${randomtext}${randomNumber6}`,
  sImage: `${store.imagePath}`
}

const adharBaseData = {
  eType: 'AADHAAR',
  nNo: `${randomNumber12}`,
  sFrontImage: `${store.imagePath}`,
  sBackImage: `${store.imagePath2}`
}

describe('Kyc Management routes', () => {
  before(async () => {
    const adminToken = await adminAuthServices.getAdminToken()
    const userData = await userAuthServices.getUserToken()
    const userToken = userData.Authorization
    store.iUserId = userData.data._id
    store.ID = undefined
    store.imagePath = undefined
    store.imagePath2 = undefined
    store.wId = '5f894da3c3f1200f8ce176fd'
    store.pan = 'PAN'
    store.aadhar = 'AADHAAR'
    store.userToken = userToken
    store.adminToken = adminToken
  })

  describe('/Get admin side list of pending user request', () => {
    it('Should be a get list of admin', (done) => {
      request(server)
        .get('/api/admin/kyc-list/v2')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.kyc))
          done()
        })
    })
  })

  describe('/Get the details of pertiuclar one kyc', () => {
    it('Should be a Add Pre-signed url', (done) => {
      const data = { ...urlBaseData }
      request(server)
        .post(`/api/user/pre-signed-url/${store.pan}/v1`)
        .set('Authorization', store.userToken)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          store.imagePath = res.body.data.sPath
          done()
        })
    })

    it('Should be a Create a kyc Pancard / Aadhar card', (does) => {
      const data = { ...panBaseData }
      request(server)
        .post('/api/user/kyc/add/v1')
        .set('Authorization', store.userToken)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return does(err)
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.newKyc))
          store.ID = res.body.data._id
          store.details = res.body.data
          does()
        })
    })

    it('Should be a details of one kyc', (arg) => {
      request(server)
        .get(`/api/admin/kyc-info/${store.iUserId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return arg(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.kyc))
          arg()
        })
    })

    it('Should be a details of one kyc by user', (cb) => {
      request(server)
        .get('/api/user/kyc/v1')
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return cb(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.kyc))
          cb()
        })
    })
  })

  describe('/Put update a kyc status', () => {
    it('Should be a Add Pre-signed url', function (done) {
      const data = { ...urlBaseData }
      request(server)
        .post(`/api/user/pre-signed-url/${store.pan}/v1`)
        .set('Authorization', store.userToken)
        .send(data)
        .expect(status.OK)
        .end((err, res) => {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          store.imagePath = res.body.data.sPath
          done()
        })
    })

    it('Should be a Add Pre-signed url', (done) => {
      const data = { ...urlBaseData }
      data.sFileName = 'test2.jpg'
      request(server)
        .post(`/api/user/pre-signed-url/${store.aadhar}/v1`)
        .set('Authorization', store.userToken)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          store.imagePath2 = res.body.data.sPath
          done()
        })
    })

    it('Should be a Create a kyc Aadhar card', (done) => {
      const data = { ...adharBaseData }
      request(server)
        .post('/api/user/kyc/add/v1')
        .set('Authorization', store.userToken)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.newKyc))
          done()
        })
    })

    it('Should NOT be a update kyc status because type is not right', (done) => {
      const data = {
        eType: 'ABC',
        eStatus: 'A'
      }
      request(server)
        .put(`/api/admin/kyc-status/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })

    it('Should be a update kyc status Accept', (done) => {
      const data = {
        eType: `${store.pan}`,
        eStatus: 'A'
      }
      request(server)
        .put(`/api/admin/kyc-status/${store.iUserId}/v1`)
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cpancardStatus))
          done()
        })
    })
  })

  describe('/post a pre-signed-url ', () => {
    it('Should be a Add Pre-signed url', function (done) {
      const data = { ...urlBaseData }
      request(server)
        .post(`/api/user/pre-signed-url/${store.pan}/v1`)
        .set('Authorization', store.userToken)
        .send(data)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          store.imagePath = res.body.data.sPath
          done()
        })
    })

    it('Should be a Add Pre-signed url', (done) => {
      const data = { ...urlBaseData }
      data.sFileName = 'test2.jpg'
      request(server)
        .post(`/api/user/pre-signed-url/${store.pan}/v1`)
        .set('Authorization', store.userToken)
        .send(data)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          store.imagePath2 = res.body.data.sPath
          done()
        })
    })

    it('Should NOT be a Add Pre-signed url', (done) => {
      const data = { ...urlBaseData }
      request(server)
        .post('/api/user/pre-signed-url/abc/v1')
        .set('Authorization', store.userToken)
        .send(data)
        .expect(status.BadRequest)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.went_wrong_with.replace('##', messages.English.stype))
          done()
        })
    })

    it('Should NOT be a Add Pre-signed url', (done) => {
      const data = {
        sFileName: 'test1.jpg'
      }
      request(server)
        .post(`/api/user/pre-signed-url/${store.pan}/v1`)
        .set('Authorization', store.userToken)
        .send(data)
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  describe('/Put the kyc image', () => {
    it('Should be a update a image url', (done) => {
      const data = {
        eType: 'PAN',
        sImage: `${store.imagePath}`
      }
      request(server)
        .put('/api/user/kyc/v1')
        .set('Authorization', store.userToken)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.kycDetails))
          store.ID = res.body.data._id
          done()
        })
    })

    it('Should NOT be a update a image url', (done) => {
      const data = {
        eType: 'ABC',
        sFrontImage: `${store.imagePath}`
      }
      request(server)
        .put('/api/user/kyc/v1')
        .set('Authorization', store.userToken)
        .send(data)
        .expect(status.UnprocessableEntity)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })

    it('Should not be a update a image url', (done) => {
      const data = {
        eType: `${store.aadhar}`,
        sFrontImage: `${store.imagePath}`
      }
      request(server)
        .put('/api/user/kyc/v1')
        .set('Authorization', store.userToken)
        .send(data)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.kyc_under_review)
          done()
        })
    })
  })

  describe('/Post add kyc', () => {
    it('Should NOT be a Create a kyc Pancard / Aadhar card BECAUSE type is wrong', (args) => {
      const data = {
        eType: 'ABC',
        sNo: `${randomNumber12}`,
        sFrontImage: `${store.imagePath}`,
        sBackImage: `${store.imagePath}`
      }
      request(server)
        .post('/api/user/kyc/add/v1')
        .set('Authorization', store.userToken)
        .send(data)
        .expect(status.UnprocessableEntity)
        .end((err, res) => {
          if (err) return args(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          args()
        })
    })
  })
  describe('admin kyc list count', () => {
    it('should fetch kyc lists count', (done) => {
      request(server)
        .post('/api/admin/kyc-list/counts/v1')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', `${messages.English.kyc} ${messages.English.cCounts}`))
          done()
        })
    })
  })
  describe('admin kyc add', () => {
    const data = {
      eType: `${store.aadhar}`,
      sFrontImage: `${store.imagePath}`
    }
    it('should add kyc', (done) => {
      request(server)
        .post('/api/admin/kyc/add/61af293417d5b417ababa42f/v1')
        .send(data)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.newKyc))
          done()
        })
    })
  })
  describe('admin kyc pre signed url', () => {
    it('should add kyc', (done) => {
      request(server)
        .post('/api/admin/pre-signed-url-kyc/v1')
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          done()
        })
    })
  })
  describe('admin kyc url with type', () => {
    const data = {}
    it('should add kyc', (done) => {
      request(server)
        .post('/api/admin/pre-signed-url-kyc/61b09e4a515e179430cd3f53/v1')
        .send(data)
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          done()
        })
    })
    it('update kyc details', (done) => {
      request(server)
        .put('/api/admin/kyc/61b09e4a515e179430cd3f53/v1')
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.kycDetails))
          done()
        })
    })
  })
  describe('user kyc url', () => {
    it('user should add kyc ', (done) => {
      request(server)
        .post('/api/user/pre-signed-url-kyc/v1')
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          done()
        })
    })
    it('update kyc details', (done) => {
      request(server)
        .get('/api/user/kyc/v2')
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.kyc))
          done()
        })
    })
  })
})
