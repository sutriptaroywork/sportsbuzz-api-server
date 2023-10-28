/* eslint-disable indent */
const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../../index')
const { messages, status } = require('../../../helper/api.responses')
const expect = require('expect')
const PermissionsModel = require('./model')
const adminAuthServices = require('../auth/services')

const store = {}
const data = {
  sName: 'banner',
  eStatus: 'Y',
  sKey: 'BANNER'
}

describe('Permission Routes', () => {
  before(async () => {
    await PermissionsModel.collection.drop()
    store.token = await adminAuthServices.getAdminToken()
    store.ID = undefined
    store.wID = '5f892aee05b16f154f12b60e'
  })

  describe('/POST Add Permission', () => {
    it('should add permission', (done) => {
      request(server)
        .post('/api/admin/permission/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.permission))
          store.ID = res.body.data._id
          done()
        })
    })

    it('should not add Permission', (done) => {
      data.sKey = undefined
      request(server)
        .post('/api/admin/permission/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.UnprocessableEntity)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })

    it('should not add Permission', (done) => {
      data.sKey = 'BANNER'
      request(server)
        .post('/api/admin/permission/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.ResourceExist)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.permission))
          done()
        })
    })
  })

  describe('/GET list of Permission', () => {
    it('should be a get list of Permission', (done) => {
      request(server)
        .get('/api/admin/permission/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.permissions))
          done()
        })
    })
  })

  describe('/GET admin list of Permission', () => {
    it('should be a get list of banner', (done) => {
      request(server)
        .get('/api/admin/permission/list/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((error, response) => {
          if (error) return done(error)
          expect(response.body.message).toMatch(messages.English.success.replace('##', messages.English.permissions))
          done()
        })
    })
  })

  describe('/GET a details of one Permission', () => {
    it('should be a get details of permission', (done) => {
      request(server)
        .get(`/api/admin/permission/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.permissions))
          done()
        })
    })

    it('should not be a get details of permission', (done) => {
      request(server)
        .get(`/api/admin/permission/${store.wID}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.permission))
          done()
        })
    })
  })

  describe('/PUT update permission', () => {
    it('should be a update a permission ', (done) => {
      data.sName = 'banner Management'
      data.eStatus = 'Y'
      data.sKey = 'BANNER'
      request(server)
        .put(`/api/admin/permission/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.permission))
          done()
        })
    })

    it('should not be a update a Permission ', (done) => {
      data.sName = 'banner Management'
      data.eStatus = 'Y'
      data.sKey = 'BANNER'
      request(server)
        .put(`/api/admin/permission/${store.wID}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.NotFound)
        .end((resErr, result) => {
          if (resErr) return done(resErr)
          expect(result.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.permission))
          done()
        })
    })
  })
})
