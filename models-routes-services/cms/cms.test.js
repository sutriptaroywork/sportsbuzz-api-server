const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')
const store = {}
const cmsData = {
  sTitle: 'Content-test',
  sDescription: 'Content Description test',
  sSlug: 'profile-test',
  sContent: 'cms Content test',
  nPriority: '1',
  eStatus: 'Y'
}

describe('Content management routes', () => {
  before(async () => {
    // await CMSModel.collection.drop()
    const adminToken = await adminAuthServices.getAdminToken()
    store.sSlug = undefined
    store.wsSlug = 'undefined'
    store.ID = undefined
    store.wId = '5f7f0fd9b18344309eb41138'
    store.token = adminToken
  })

  describe('/POST Add New CMS', () => {
    it('Should be create a new CMS', (done) => {
      const cms = { ...cmsData }
      request(server)
        .post('/api/admin/cms/add/v1')
        .set('Authorization', store.token)
        .send(cms)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.content))
          store.sSlug = res.body.data.sSlug
          store.ID = res.body.data._id
          done()
        })
    })
    it('Should be create a new CMS', (done) => {
      const cms = { ...cmsData }
      cms.sSlug = 'about'
      request(server)
        .post('/api/admin/cms/add/v1')
        .set('Authorization', store.token)
        .send(cms)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.content))
          store.IDD = res.body.data._id
          store.sSlug = res.body.data.sSlug
          done()
        })
    })
    it('Should not be create a new cms', (done) => {
      const cms = { ...cmsData }
      cms.sTitle = 'cms'
      cms.sSlug = store.sSlug
      request(server)
        .post('/api/admin/cms/add/v1')
        .set('Authorization', store.token)
        .send(cms)
        .expect(status.ResourceExist)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.cmsSlug))
          done()
        })
    })
  })

  describe('/GET A List of cms', () => {
    it('Should be a get List of CMS', (done) => {
      request(server)
        .get('/api/admin/cms/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.content))
          done()
        })
    })
  })

  describe('/GET A Slug of cms for admin', () => {
    it('Should be a get Slug of CMS', (done) => {
      request(server)
        .get(`/api/admin/cms/${store.sSlug}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((error, result) => {
          if (error) return done(error)
          expect(result.body.message).toMatch(messages.English.success.replace('##', messages.English.content))
          done()
        })
    })
  })

  describe('/GET A Slug of cms add slug in params', () => {
    it('Should be a get Slug of CMS', function (done) {
      request(server)
        .get(`/api/admin/cms/${store.sSlug}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.content))
          done()
        })
    })

    it('Should not be a get Slug of CMS', (done) => {
      request(server)
        .get(`/api/admin/cms/${store.wsSlug}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.content))
          done()
        })
    })
  })

  describe('/PUT Update a CMS ', () => {
    it('Should be update a CMS', (done) => {
      const updateCms = { ...cmsData }
      updateCms.sTitle = 'cms'
      updateCms.sDescription = 'cms Description'
      updateCms.sSlug = 'abcdef'
      request(server)
        .put(`/api/admin/cms/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(updateCms)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cms))
          done()
        })
    })

    it('Should not be update a CMS', (done) => {
      const updateCms = { ...cmsData }
      updateCms.sTitle = 'cms'
      updateCms.sDescription = 'cms Description'
      updateCms.sSlug = 'sdasdasdasdadasd'
      updateCms.sContent = 'cms Content'

      request(server)
        .put(`/api/admin/cms/${store.wId}/v1`)
        .set('Authorization', store.token)
        .send(updateCms)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cms))
          done()
        })
    })

    it('Should not be A updated CMS', (done) => {
      const updateCms = { ...cmsData }
      updateCms.sTitle = 'cms'
      updateCms.sDescription = 'cms Description'
      updateCms.sSlug = store.sSlug
      updateCms.sContent = 'cms Content'

      request(server)
        .put(`/api/admin/cms/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(updateCms)
        .expect(status.ResourceExist)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.cmsSlug))
          done()
        })
    })
  })

  describe('/DELETE a CMS ', () => {
    it('Should be delete a CMS', (done) => {
      request(server)
        .delete(`/api/admin/cms/${store.IDD}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.del_success.replace('##', messages.English.cms))
          done()
        })
    })

    it('Should not be delete a CMS', (done) => {
      request(server).delete(`/api/admin/cms/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cms))
          done()
        })
    })
  })

  describe('CSS routes', () => {
    it('add css', (done) => {
      const cms = {
        sTitle: 'Content-test',
        sContent: 'cms Content test'
      }
      request(server)
        .post('/api/admin/css/common/v1')
        .set('Authorization', store.token)
        .send(cms)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cssStyle))
          done()
        })
    })
    it('list css', (done) => {
      const cms = { ...cmsData }
      cms.sSlug = 'about'
      request(server)
        .get('/api/admin/css-list/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cssStyle))
          done()
        })
    })
    it('get particular css', (done) => {
      request(server)
        .get('/api/admin/css/common/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cssStyle))
          done()
        })
    })

    it('get particular css, error because invalid type abc is send in url params', (done) => {
      request(server)
        .get('/api/admin/css/abc/v1')
        .set('Authorization', store.token)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.invalid.replace('##', messages.English.cssType))
          done()
        })
    })

    it('update particular css', (done) => {
      const cms = { ...cmsData }
      cms.sTitle = 'cms-test-modification'
      request(server)
        .put('/api/admin/css/common/v1')
        .set('Authorization', store.token)
        .send(cms)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cssStyle))
          done()
        })
    })
  })

  describe('CSS routes', () => {
    it('add css', (done) => {
      request(server)
        .get('/api/user/css/common/v1')
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cssStyle))
          done()
        })
    })
  })
})
