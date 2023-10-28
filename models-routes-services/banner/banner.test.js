const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const expect = require('expect')
const { messages, status } = require('../../helper/api.responses')
const { isUrl } = require('../../helper/utilities.services')
const store = {}
// no need to drop collection
// const BannerModel = require('./model')
const adminAuthServices = require('../admin/auth/services')
const bannerData = {
  sImage: 'admin/banner-pic/5f193ed4861d0f18f4e3260c_1596014872699_test4.jpg',
  eType: 'L',
  eStatus: 'Y',
  sDescription: 'hello',
  nPosition: 1,
  ePlace: 'H'
}

describe('Banner Routes', () => {
  before(async () => {
    // await BannerModel.collection.drop()
    const adminToken = await adminAuthServices.getAdminToken()
    store.token = adminToken
    store.ID = undefined
    store.wID = '5f892aee05b16f154f12b60e'
    store.place = 'H'
  })

  describe('/POST Add banner', () => {
    it('should be a create a banner ', (done) => {
      const data = { ...bannerData }
      data.sLink = 'https://www.flipkart.com/?gclid=CjwKCAjw5p_8BRBUEiwAPpJO6_wpVFbSGcAEDqtpVPKWLwIAII9P_gOeSiZtS8Fl0wSlSYYWIMXtcRoCyuoQAvD_BwE'
      request(server)
        .post('/api/admin/banner/add/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.newBanner))
          store.ID = res.body.data._id
          done()
        })
    })

    it('should not be a create a banner ', (done) => {
      const data = { ...bannerData }
      data.sImage = 'path/img.jpg'
      request(server)
        .post('/api/admin/banner/add/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })

    it('should not be a create a banner ', (done) => {
      const data = { ...bannerData }
      data.sImage = 'admin/banner-pic/5f193ed4861d0f18f4e3260c_1596014872699_test4.jpg'
      data.sLink = 'jammmeeesss'
      request(server)
        .post('/api/admin/banner/add/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          if (data.eType === 'L' && !isUrl(data.sLink)) {
            expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.link))
          } else if (data.eType === 'L' && !data.sLink) {
            expect(res.body.message).toMatch(messages.English.fields_missing.replace('##', messages.English.link))
          } else if (data.eType === 'S' && !data.eScreen) {
            expect(res.body.message).toMatch(messages.English.fields_missing.replace('##', messages.English.screen))
          }
          done()
        })
    })
  })

  describe('get list of banner', () => {
    it('should be a get list of banner', (done) => {
      request(server)
        .get('/api/admin/banner/list/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.banner))
          done()
        })
    })
  })

  describe('get a details of one banner', () => {
    it('should be a get details of banner', (done) => {
      request(server)
        .get(`/api/admin/banner/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((error, result) => {
          if (error) return done(error)
          expect(result.body.data).toBeA('object')
          expect(result.body.message).toMatch(messages.English.success.replace('##', messages.English.banner))
          done()
        })
    })

    it('should not be a get details of banner', (done) => {
      request(server)
        .get(`/api/admin/banner/${store.wID}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.banner))
          done()
        })
    })
  })

  describe('post a pre-signed url inside a banner', () => {
    it('should be a pre-signed url of banner image', (done) => {
      const data = {
        sFileName: 'banner1.jpg',
        sContentType: 'image/jpeg'
      }
      request(server)
        .post('/api/admin/banner/pre-signed-url/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          done()
        })
    })
  })

  describe('/PUT update banner', () => {
    it('should be a update a banner ', (done) => {
      const data = { ...bannerData }
      data.sImage = 'admin/banner-pic/5f193ed4861d0f18f4e3260c_1596014872699_test4.jpg'
      data.sDescription = 'how are you'
      data.sLink = 'https://www.amazon.in/'
      request(server)
        .put(`/api/admin/banner/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.bannerDetails))
          done()
        })
    })

    it('should not be a update a banner ', (done) => {
      const data = { ...bannerData }
      data.sImage = 'admin/banner-pic/5f193ed4861d0f18f4e3260c_1596014872699_test4.jpg'
      data.sDescription = 'how are you'
      data.sLink = 'https://www.amazon.in/'
      request(server)
        .put(`/api/admin/banner/${store.wID}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.NotFound)
        .end((error, response) => {
          if (error) return done(error)
          expect(response.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.banner))
          done()
        })
    })

    it('should not be a update a banner ', (done) => {
      const data = {
        sImage: 'admin/banner-pic/5f193ed4861d0f18f4e3260c_1596014872699_test4.jpg',
        eType: 'L',
        eStatus: 'Y',
        sDescription: 'hello',
        sLink: 'jammmeeesss',
        ePlace: 'H'
      }
      request(server)
        .put(`/api/admin/banner/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          if (data.eType === 'L' && !data.sLink) {
            expect(res.body.message).toMatch(messages.English.fields_missing.replace('##', messages.English.link))
          } else if (data.eType === 'S' && !data.eScreen) {
            expect(res.body.message).toMatch(messages.English.fields_missing.replace('##', messages.English.screen))
          } else if (data.eType === 'L' && !isUrl(data.sLink)) {
            expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.link))
          }
          done()
        })
    })
  })

  describe('Get a particular type url', () => {
    it('should be a url of kyc', (done) => {
      // type can kyc or media, other wise error will be send
      const type = 'kyc'
      request(server)
        .get(`/api/get-url/${type}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.url))
          done()
        })
    })
    it('should be a  fail because of invalid type', (done) => {
      // type can kyc or media, other wise error will be send
      const type = 'abc'
      request(server)
        .get(`/api/get-url/${type}/v1`)
        .set('Authorization', store.token)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.type))
          done()
        })
    })
  })

  describe('/GET User: banner list using place', () => {
    it('should be get banner list', (done) => {
      request(server)
        .get(`/api/user/banner/list/${store.place}/v1`)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.banner))
          done()
        })
    })
  })

  describe('/GET User: banner urls', () => {
    it('should be get banner urls', (done) => {
      request(server)
        .get('/api/user/get-url/v1')
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.url))
          done()
        })
    })
  })

  describe('/Delete banner using id', () => {
    it('should be delete banner', (done) => {
      request(server)
        .delete(`/api/admin/banner/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.del_success.replace('##', messages.English.banner))
          done()
        })
    })
    it('should not be delete because wrong id', (done) => {
      request(server)
        .delete(`/api/admin/banner/${store.wID}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.banner))
          done()
        })
    })
  })
})
