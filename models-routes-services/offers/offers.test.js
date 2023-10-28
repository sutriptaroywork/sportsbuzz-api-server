const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')
const userAuthServices = require('../user/auth/services')

const store = {}
const offerBaseData = {
  sImage: 'offers/1598434402556_test4.jpg',
  sTitle: 'offer pic',
  sDetail: 'some details',
  eStatus: 'Y',
  sDescription: 'hvhhvh'
}

const preSignedBaseData = {
  sFileName: 'test4.jpg',
  sContentType: 'image/jpeg'
}

describe('Offer Servers', () => {
  before(async () => {
    const adminToken = await adminAuthServices.getAdminToken()
    const userData = await userAuthServices.getUserToken()
    const userToken = userData.Authorization
    store.ID = undefined
    store.wID = '5f7f0fd9b18344309eb41138'
    store.userToken = userToken
    store.token = adminToken
  })

  describe('/GET list of a offer list where eStatus is Y', () => {
    it('Should be a list of offer', (done) => {
      request(server)
        .get('/api/user/offer/list/v1')
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.coffer))
          done()
        })
    })
  })

  describe('/GET list of a offer list', () => {
    it('Should be a list of offer', (done) => {
      request(server)
        .get('/api/admin/offer/list/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) { return done(err) }
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.coffer))
          done()
        })
    })
  })

  describe('/GET list of a offer list as per params', () => {
    it('Should be a list of offer', (done) => {
      request(server)
        .get('/api/admin/offer/list/v1?search=e&start=0&limit=2&order=desc')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) { return done(err) }
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.coffer))
          done()
        })
    })
  })

  describe('/POST add offer', () => {
    it('should be a Add offer', (done) => {
      const offer = { ...offerBaseData }
      request(server)
        .post('/api/admin/offer/add/v1')
        .set('Authorization', store.token)
        .send(offer)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cnewOffer))
          store.ID = res.body.data._id
          done()
        })
    })

    it('should not Add a offer because of insufficant data', (done) => {
      const offer = {}
      request(server)
        .post('/api/admin/offer/add/v1')
        .set('Authorization', store.token)
        .send(offer)
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  describe('/POST add pre signed url', () => {
    it('should be a Add pre signed url', (done) => {
      const presigned = { ...preSignedBaseData }
      request(server)
        .post('/api/admin/offer/pre-signed-url/v1')
        .set('Authorization', store.token)
        .send(presigned)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          done()
        })
    })

    it('should not be a Add pre signed url', (done) => {
      const presigned = { ...preSignedBaseData }
      delete presigned.sContentType
      request(server)
        .post('/api/admin/offer/pre-signed-url/v1')
        .set('Authorization', store.token)
        .send(presigned)
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  describe('/GET details of offer', () => {
    it('should be a details of one offer', (done) => {
      request(server)
        .get(`/api/admin/offer/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.coffer))
          done()
        })
    })

    it('should not be a details of one offer', (done) => {
      request(server)
        .get(`/api/admin/offer/${store.wID}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.coffer))
          done()
        })
    })
  })

  describe('/PUT Update a offer', () => {
    it('Should be a update a offer', (done) => {
      const updateOffer = { ...offerBaseData }
      updateOffer.sDescription = 'hvhhvh'
      request(server)
        .put(`/api/admin/offer/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(updateOffer)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cofferDetails))
          done()
        })
    })

    it('Should not be a update a offer', (done) => {
      const updateOffer = { ...offerBaseData }
      updateOffer.sDescription = 'hvhhvh'
      request(server)
        .put(`/api/admin/offer/${store.wID}/v1`)
        .set('Authorization', store.token)
        .send(updateOffer)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.coffer))
          done()
        })
    })
  })

  describe('/DELETE a offer', () => {
    it('should be a Delete a one offer ', (done) => {
      request(server)
        .delete(`/api/admin/offer/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.del_success.replace('##', messages.English.coffer))
          done()
        })
    })

    it('should not be Delete a one offer ', (done) => {
      request(server)
        .delete(`/api/admin/offer/${store.wID}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.coffer))
          done()
        })
    })
  })
})
