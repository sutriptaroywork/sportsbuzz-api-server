const request = require('supertest')
const { describe, it, before } = require('mocha')
const expect = require('expect')
const server = require('../../../index')
const store = {}
const { status, messages } = require('../../../helper/api.responses')
const adminAuthServices = require('../auth/services')
const randomNumber = Math.floor(Math.random() * 111111)
const randomPhone = Math.floor(1000000000 + Math.random() * 9000000000)

describe('Subadmin Routes', () => {
  before(async () => {
    store.token = await adminAuthServices.getAdminToken()
    store.ID = undefined
    store.permission = undefined
    store.wID = '5f892aee05b16f154f12b60e'
  })

  describe('get list of Permission', () => {
    it('should be a get list of banner', (done) => {
      request(server)
        .get('/api/admin/permission/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('Permissions fetched successfully.')
          store.permission = res.body.data[0].sKey
          done()
        })
    })
  })

  describe('/POST Add subadmin', () => {
    it('should be a create a subadmin ', (done) => {
      const data = {
        sName: `name${randomNumber}`,
        sUsername: `username${randomNumber}`,
        sEmail: `james${randomNumber}@mailinator.com`,
        sMobNum: `${randomPhone}`,
        sPassword: '123456',
        aPermissions: [{
          sKey: `${store.permission}`,
          eType: 'N'
        }]
      }
      request(server)
        .post('/api/admin/auth/sub-admin/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('Sub Admin added successfully.')
          done()
        })
    })

    it('should not be a create a subadmin Email ', (done) => {
      const data = {
        sName: `name${randomNumber}sdfdsf`,
        sUsername: `username${randomNumber}edfdf`,
        sEmail: `james${randomNumber}@mailinator.com`,
        sMobNum: '4574157896',
        sPassword: '123456',
        aPermissions: [{
          sKey: `${store.permission}`,
          eType: 'N'
        }]
      }
      request(server)
        .post('/api/admin/auth/sub-admin/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.ResourceExist)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('Email is already exist.')
          done()
        })
    })

    it('should not be a create a subadmin Username', (done) => {
      const data = {
        sName: `name${randomNumber}`,
        sUsername: `username${randomNumber}`,
        sEmail: `jamesdasd${randomNumber}@mailinator.com`,
        sMobNum: '1234567845',
        sPassword: '123456',
        aPermissions: [{
          sKey: `${store.permission}`,
          eType: 'N'
        }]
      }
      request(server)
        .post('/api/admin/auth/sub-admin/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.ResourceExist)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('Username is already exist.')
          done()
        })
    })

    it('should not be a create a subadmin Mobile Number', (done) => {
      const data = {
        sName: `name11145${randomNumber}`,
        sUsername: `username111${randomNumber}`,
        sEmail: `james1542454${randomNumber}@mailinator.com`,
        sMobNum: `${randomPhone}`,
        sPassword: '123456',
        aPermissions: [{
          sKey: `${store.permission}`,
          eType: 'N'
        }]
      }
      request(server)
        .post('/api/admin/auth/sub-admin/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.ResourceExist)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('Mobile number is already exist.')
          done()
        })
    })

    it('should not be a create a subadmin Alpha number', (done) => {
      const data = {
        sName: `name12${randomNumber}`,
        sUsername: 'username```',
        sEmail: `james12${randomNumber}@mailinator.com`,
        sMobNum: `${randomPhone}`,
        sPassword: '123456',
        aPermissions: [{
          sKey: `${store.permission}`,
          eType: 'N'
        }]
      }
      request(server)
        .post('/api/admin/auth/sub-admin/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('Username allows alphanumeric characters only.')
          done()
        })
    })
  })

  describe('get list of subadmin', () => {
    it('should be a get list of subadmin', (done) => {
      request(server)
        .get('/api/admin/sub-admin/list/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch('SubAdmin fetched successfully.')
          store.ID = res.body.data[0].results[0]._id
          store.mobileNumber = res.body.data[0].results[1].sMobNum
          done()
        })
    })
  })

  describe('get a details of one subadmin', () => {
    it('should be a get details of subadmin', (done) => {
      request(server)
        .get(`/api/admin/sub-admin/${store.ID}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch('SubAdmin fetched successfully.')
          done()
        })
    })

    it('should not be a get details of banner', (done) => {
      request(server)
        .get(`/api/admin/sub-admin/${store.wID}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('SubAdmin is not exist.')
          done()
        })
    })
  })

  describe('/PUT update subadmin', () => {
    it('should be a update a subadmin ', (done) => {
      const data = {
        sName: `name${randomNumber}`,
        sUsername: `username${randomNumber}`,
        sEmail: `james${randomNumber}@mailinator.com`,
        sMobNum: `${randomPhone}`,
        sPassword: '123456',
        aPermissions: [{
          sKey: `${store.permission}`,
          eType: 'R'
        }]
      }
      request(server)
        .put(`/api/admin/sub-admin/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch('Sub Admin updated successfully.')
          done()
        })
    })

    it('should not be a Update a subadmin mobile number', (done) => {
      const data = {
        sName: `nameasasfsdfsd${randomNumber}`,
        sUsername: `usernamexcfxcxz${randomNumber}`,
        sEmail: `jamesdccxc${randomNumber}@mailinator.com`,
        sMobNum: `${store.mobileNumber}`,
        sPassword: '123456',
        aPermissions: [{
          sKey: `${store.permission}`,
          eType: 'N'
        }]
      }
      request(server)
        .put(`/api/admin/sub-admin/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.ResourceExist)
        .end((error, result) => {
          if (error) return done(error)
          expect(result.body.message).toMatch('Mobile number is already exist.')
          done()
        })
    })

    it('should not be a Update a subadmin ', (done) => {
      const data = {
        sName: `name${randomNumber}`,
        sUsername: 'username```',
        sEmail: `james${randomNumber}@mailinator.com`,
        sMobNum: '9875412345',
        sPassword: '123456',
        aPermissions: [{
          sKey: `${store.permission}`,
          eType: 'N'
        }]
      }
      request(server)
        .put(`/api/admin/sub-admin/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.BadRequest)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch('Username allows alphanumeric characters only.')
          done()
        })
    })
  })

  describe('sub admin ids', () => {
    it('fetch all the sub admin', (done) => {
      request(server)
        .get('/api/admin/sub-admin-ids/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          // console.log(res.body.data)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.subAdmin))
          done()
        })
    })
  })

  describe('sub admin logs', () => {
    it('fetch all the logs', (done) => {
      request(server)
        .get('/api/admin/sub-admin-logs/v1?order=desc&iAdminId=61b753c3e93d171e9f30fcbf')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          // console.log(JSON.stringify(res.body.data, null, 3))
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.subAdmin))
          done()
        })
    })
  })

  describe('update sub admin v2', () => {
    const data = {
      sName: `name${randomNumber}`,
      sUsername: 'username-test-subadmin',
      sEmail: `james${randomNumber}@mailinator.com`,
      sMobNum: '9875412345',
      aPermissions: [],
      iRoleId: '6214b4e1c6040a3fb50aeef6'
    }
    it('update sub admin v2 by passing _id', (done) => {
      request(server)
        .post('/api/admin/sub-admin/621722239eaacfab7ba06e13/v2')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          // console.log(JSON.stringify(res.body.data, null, 3))
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.subAdmin))
          done()
        })
    })
  })
})
