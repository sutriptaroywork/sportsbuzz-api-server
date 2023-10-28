const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')

const store = {}
const routes = {
  add: '/api/admin/league-category/v1',
  categoryList: '/api/admin/league-category/v1',
  list: '/api/admin/league-category/list/v1',
  get: '/api/admin/league-category/:id/v1',
  update: '/api/admin/league-category/:id/v1',
  addFilterCategory: '/api/admin/filter-category/v1',
  FilterCategoryList: '/api/admin/filter-category/v1',
  listFilterCategory: '/api/admin/filter-category/list/v1',
  getFilterCategory: '/api/admin/filter-category/61b0594d2c497e60d758a9a6/v1',
  updateFilterCategory: '/api/admin/filter-category/61b0594d2c497e60d758a9a6/v1'
}
const filterCategory = {
  sTitle: '1:1',
  sRemark: 'Get double'
}
describe('League Category Management Routes', () => {
  before(async () => {
    store.adminToken = await adminAuthServices.getAdminToken()
    store.wID = '5f7f0fd9b18344309eb41138'
  })

  describe('/POST Add New League Category', () => {
    it('Should be create a new League Category', (done) => {
      const LeagueCategory = {
        sTitle: 'Confirm League TEST',
        nPosition: 4
      }
      request(server)
        .post(routes.add)
        .set('Authorization', store.adminToken)
        .send(LeagueCategory)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cnewLeagueCategory))
          store.ID = res.body.data._id
          done()
        })
    })

    it('Should not be create a new League Category', (done) => {
      const LeagueCategory = {
        sTitle: 'Confirm League TEST'
      }
      request(server)
        .post(routes.add)
        .set('Authorization', store.adminToken)
        .send(LeagueCategory)
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  describe('/PUT Update A League Category', () => {
    it('Should be update a League Category', (done) => {
      const LeagueCategory = {
        sTitle: 'Confirm Leagues test update',
        nPosition: 4,
        sRemark: 'remarks'

      }
      request(server)
        .put(`/api/admin/league-category/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .send(LeagueCategory)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.leagueCategory))
          done()
        })
    })

    it('Should not be update a League Category because id passed in url does not exist', (done) => {
      const LeagueCategory = {
        sTitle: 'Confirm Leagues',
        nPosition: '4',
        sRemark: 'remarks'
      }
      request(server)
        .put(`/api/admin/league-category/${store.wID}/v1`)

        .set('Authorization', store.adminToken)
        .send(LeagueCategory)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.leagueCategory))
          done()
        })
    })
  })

  describe('/GET List of League Category', () => {
    it('Should be list of League Category', (done) => {
      request(server)
        .get('/api/admin/league-category/v1')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.leagueCategory))
          done()
        })
    })
  })

  describe('/GET List of League Category with pagination', () => {
    it('Should be list of League Category with pagination', (done) => {
      request(server)
        .get('/api/admin/league-category/list/v1')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end((err, res) => {
          if (err) { return done(err) }
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.leagueCategory))
          done()
        })
    })
  })

  describe('/GET details of League Category', () => {
    it('Should be details of League Category', (done) => {
      request(server)
        .get(`/api/admin/league-category/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) { return done(err) }
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.leagueCategory))
          done()
        })
    })

    it('Should not get details of League Category because id passed in url does not exist', (done) => {
      request(server)
        .get(`/api/admin/league-category/${store.wID}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.leagueCategory))
          done()
        })
    })
  })

  describe('/POST get pre sign url', () => {
    it('Should be get pre sign url', (done) => {
      const data = {
        sFileName: 'test.jpg',
        sContentType: 'image/jpeg'
      }
      request(server)
        .post('/api/admin/league-category/pre-signed-url/v1')
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.OK)
        .end((err, res) => {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.presigned_succ)
          done()
        })
    })
  })

  describe('/DELETE league category', () => {
    it('Should be delete league category', (done) => {
      request(server)
        .delete(`/api/admin/league-category/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end((err, res) => {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.del_success.replace('##', messages.English.leagueCategory))
          done()
        })
    })

    it('Should not be delete league category', (done) => {
      request(server)
        .delete(`/api/admin/league-category/${store.wID}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.leagueCategory))
          done()
        })
    })
  })

  describe('League Filter Category Management Routes', () => {
    describe('/POST Add New League Filter Category', () => {
      it('Should be create a new League Filter Category', (done) => {
        request(server)
          .post(routes.addFilterCategory)
          .set('Authorization', store.adminToken)
          .send(filterCategory)
          .expect(status.OK)
          .end(function (err, res) {
            if (err) return done(err)
            expect(res.body.data).toBeA('object')
            expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cnewFilterCategory))
            store.filterCategoryId = res.body.data._id
            done()
          })
      })
    })

    describe('/PUT Update A League Filter Category', () => {
      it('Should be update a League Filter Category', (done) => {
        request(server)
          .put(`/api/admin/filter-category/${store.filterCategoryId}/v1`)
          .set('Authorization', store.adminToken)
          .send({ ...filterCategory, sTitle: '2:2' })
          .expect(status.OK)
          .end(function (err, res) {
            if (err) return done(err)
            expect(res.body.data).toBeA('object')
            expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.filterCategory))
            done()
          })
      })

      it('Should not be update a League Filter Category', (done) => {
        request(server)
          .put(`/api/admin/filter-category/${store.wID}/v1`)
          .set('Authorization', store.adminToken)
          .send({ ...filterCategory, sTitle: '3:3' })
          .expect(status.NotFound)
          .end(function (err, res) {
            if (err) return done(err)
            expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.filterCategory))
            done()
          })
      })
    })

    describe('/GET details of League Filter Category', () => {
      it('Should be details of League Filter Category', (done) => {
        request(server)
          .get(`/api/admin/filter-category/${store.filterCategoryId}/v1`)
          .set('Authorization', store.adminToken)
          .expect(status.OK)
          .end(function (err, res) {
            if (err) { return done(err) }
            expect(res.body.data).toBeA('object')
            expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.filterCategory))
            done()
          })
      })

      it('Should not be details of League Filter Category because id passed in params does not exist', (done) => {
        request(server)
          .get(`/api/admin/filter-category/${store.wID}/v1`)
          .set('Authorization', store.adminToken)
          .expect(status.NotFound)
          .end((err, res) => {
            if (err) return done(err)
            expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.filterCategory))
            done()
          })
      })
    })

    describe('/GET List of League Filter Category with pagination', () => {
      it('Should be list of League Filter Category with pagination', (done) => {
        request(server)
          .get(routes.listFilterCategory)
          .set('Authorization', store.adminToken)
          .expect(status.OK)
          .end((err, res) => {
            if (err) { return done(err) }
            expect(res.body.data).toBeA('array')
            expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.filterCategory))
            done()
          })
      })
    })

    describe('/GET List of League Filter Category', () => {
      it('Should be list of League Filter Category', (done) => {
        request(server)
          .get(routes.FilterCategoryList)
          .set('Authorization', store.adminToken)
          .expect(status.OK)
          .end(function (err, res) {
            if (err) return done(err)
            expect(res.body.data).toBeA('array')
            expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.filterCategory))
            done()
          })
      })
    })

    describe('/DELETE filter category', () => {
      it('Should be delete filter category', (done) => {
        request(server)
          .delete(`/api/admin/filter-category/${store.filterCategoryId}/v1`)
          .set('Authorization', store.adminToken)
          .expect(status.OK)
          .end((err, res) => {
            if (err) { return done(err) }
            expect(res.body.message).toMatch(messages.English.del_success.replace('##', messages.English.filterCategory))
            done()
          })
      })

      it('Should not be delete filter category', (done) => {
        request(server)
          .delete(`/api/admin/filter-category/${store.wID}/v1`)
          .set('Authorization', store.adminToken)
          .expect(status.NotFound)
          .end((err, res) => {
            if (err) { return done(err) }
            expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.filterCategory))
            done()
          })
      })
    })
  })
})
