const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')
const userAuthServices = require('../user/auth/services')

const store = {}
const notficationId = '61efb399d208f1c2df7d21c5'
const notficationMsgId = '620651172e2d154828281de1'
const baseData = {
  iUserId: '5fc77476abab800d04bf058c',
  sTitle: 'get 20% bouns on this league',
  sMessage: 'this is sMessage....',
  iType: store.type
}

describe('Notification Management routes', () => {
  before(async () => {
    const adminToken = await adminAuthServices.getAdminToken()
    const userData = await userAuthServices.getUserToken()
    const userToken = userData.Authorization
    baseData.iUserId = userData.data._id
    store.ID = undefined
    store.wId = '5f894da3c3f1200f8ce176fd'
    store.userToken = userToken
    store.adminToken = adminToken
    store.notficationId = undefined
    store.notficationMsgId = undefined
  })

  describe('/Get List of notification types', () => {
    it('Should be a get list Notification types', (done) => {
      request(server)
        .get('/api/admin/notification/types/v1')
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          store.type = res.body.data[0]._id
          baseData.iType = store.type
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cnotificationTypes))
          done()
        })
    })
  })

  describe('/Post Add notification', () => {
    it('Should be send notification to single user', (done) => {
      const data = { ...baseData }
      request(server)
        .post('/api/admin/notification/v1')
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.cnotificaiton))
          store.ID = res.body.data._id
          done()
        })
    })

    it('Should not send notification', (cb) => {
      const data = { ...baseData }
      data.iUserId = store.wId
      data.sTitle = 'time notification will exp'
      request(server)
        .post('/api/admin/notification/v1')
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return cb(err)
          expect(res.body.message).toMatch(messages.English.went_wrong_with.replace('##', messages.English.cuserId))
          cb()
        })
    })
  })

  describe('/Post Add Time notification', () => {
    it('Should be send notification to single user', (done) => {
      const data = { ...baseData }
      delete data.iUserId
      data.sTitle = 'time notification will exp'
      const date = new Date()
      date.setMinutes(date.getMinutes() + 30)
      data.dExpTime = date
      request(server)
        .post('/api/admin/notification/timed/v1')
        .set('Authorization', store.adminToken)
        .send(data)
        .expect(status.OK)
        .end((err, res) => {
          if (err) { return done(err) }
          expect(res.body.message).toMatch(messages.English.sent_success.replace('##', messages.English.cnotificaiton))
          done()
        })
    })
  })

  describe('/Get notification unread count', () => {
    it('Should get notification unread count', (done) => {
      request(server)
        .get('/api/user/notification/unread-count/v1')
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cunreadNotificationCount))
          done()
        })
    })
  })

  describe('/Post List of notification', () => {
    it('Should be get list of notification', (done) => {
      request(server)
        .post('/api/user/notification/list/v1')
        .set('Authorization', store.userToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cnotificaitons))
          done()
        })
    })
  })

  describe('Fetch notification message list', () => {
    it('Should fetch the list of notification', (done) => {
      request(server)
        .get('/api/admin/notification-message-list/v1')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cNotificationMessages))
          store.notficationMsgId = res.body.data[0]._id
          done()
        })
    })
  })

  describe('notification message information', () => {
    it('Should fetch notification message details', (done) => {
      request(server)
        .get(`/api/admin/notification-message/${store.notficationMsgId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cnotificaiton))
          done()
        })
    })
  })

  describe('Admin: notification message information', () => {
    it('Should fetch notification details', (done) => {
      request(server)
        .get(`/api/admin/notification/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cnotificaiton))
          done()
        })
    })
  })

  describe('Admin: notification message information', () => {
    it('Should fetch notification list', (done) => {
      request(server)
        .get('/api/admin/notification/list/v1')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cnotificaitons))
          done()
        })
    })
  })

  describe('Admin: push notification', () => {
    it('Should add notification', (done) => {
      request(server)
        .post('/api/admin/push-notification/v1')
        .set('Authorization', store.adminToken)
        .send({
          sTitle: 'Hello notification test',
          sMessage: 'hello test there',
          sTopic: 'All',
          dExpTime: new Date().setUTCHours(23, 59, 59, 999),
          nHours: 11,
          nMinutes: 11,
          nSeconds: 11
        })
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.schedule_success.replace('##', messages.English.cpushNotification))
          done()
        })
    })
  })

  describe('Admin: notification update', () => {
    it('Should update notification', (done) => {
      request(server)
        .put(`/api/admin/notification/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .send({
          sTitle: 'Hello notification test',
          sMessage: 'hello test there',
          iType: store.type,
          aReadIds: [],
          dExpTime: new Date()
        })
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cnotificaiton))
          done()
        })
    })

    it('Should not update notification because insufficant data', (done) => {
      request(server)
        .put(`/api/admin/notification/${notficationId}/v1`)
        .set('Authorization', store.adminToken)
        .send({
          sTitle: 'Hello notification test'
        })
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })

    it('Should not update notification as id passed in url does not exist', (done) => {
      request(server)
        .put(`/api/admin/notification/${notficationMsgId}/v1`)
        .set('Authorization', store.adminToken)
        .send({
          sTitle: 'Hello notification test',
          sMessage: 'hello test there',
          iType: store.type,
          aReadIds: [],
          dExpTime: new Date()
        })
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cnotificaiton))
          done()
        })
    })
  })

  describe('Admin: notification delete', () => {
    it('Should be delete notification', (done) => {
      request(server)
        .delete(`/api/admin/notification/${store.ID}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.del_success.replace('##', messages.English.cnotificaiton))
          done()
        })
    })
    it('Should not be delete notification', (done) => {
      request(server)
        .delete(`/api/admin/notification/${store.wId}/v1`)
        .set('Authorization', store.adminToken)
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.cnotificaiton))
          done()
        })
    })
  })

  describe('Admin: push notification message update', () => {
    it('Should update notification message', (done) => {
      request(server)
        .put(`/api/admin/notification-message/${store.notficationMsgId}/v1`)
        .set('Authorization', store.adminToken)
        .send({
          sHeading: 'Hello notification test',
          sDescription: 'hello test there',
          eKey: 'LINEUPS',
          ePlatform: 'ALL'
        })
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.cnotificaiton))
          done()
        })
    })

    it('Should not update notification message as message id does not exist', (done) => {
      request(server)
        .put(`/api/admin/notification-message/${notficationId}/v1`)
        .set('Authorization', store.adminToken)
        .send({
          sHeading: 'Hello notification test',
          sDescription: 'hello test there',
          eKey: 'LINEUPS',
          ePlatform: 'ALL'
        })
        .expect(status.NotFound)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.went_wrong_with.replace('##', messages.English.cnotificaiton))
          done()
        })
    })

    it('Should not update notification message because of insufficant data', (done) => {
      request(server)
        .put(`/api/admin/notification-message/${notficationId}/v1`)
        .set('Authorization', store.adminToken)
        .send({
          sHeading: 'Hello notification test'
        })
        .expect(status.UnprocessableEntity)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.errors[0].msg).toMatch('Invalid value')
          done()
        })
    })
  })

  describe('Admin: push notification list', () => {
    it('Should fetch push notification list', (done) => {
      request(server)
        .get('/api/admin/push-notification-list/v1')
        .set('Authorization', store.adminToken)
        .expect(status.OK)
        .end(function (err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('array')
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.cpushNotification))
          done()
        })
    })
  })
})
