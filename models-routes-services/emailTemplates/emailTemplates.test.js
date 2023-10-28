const request = require('supertest')
const { describe, it, before } = require('mocha')
const server = require('../../index')
const { messages, status } = require('../../helper/api.responses')
const expect = require('expect')
const adminAuthServices = require('../admin/auth/services')
const store = {}

describe('Email template routes', () => {
  before(async () => {
    // await EmailTemplateModel.collection.drop()
    store.sSlug = undefined
    store.wsSlug = 'undefined'
    store.ID = undefined
    store.wId = '5f7f0fd9b18344309eb41138'
    const adminToken = await adminAuthServices.getAdminToken()
    store.token = adminToken
  })

  describe('/POST Add New Email template', () => {
    it('Should be create a new Email template', (done) => {
      const data = {
        sTitle: 'Welcome Email test',
        sSubject: 'Welcome Email Subject test',
        sDescription: 'Welcome email Description test',
        sSlug: 'welcome-email-test-bhavin',
        sContent: 'template Content test',
        eStatus: 'Y'
      }
      request(server)
        .post('/api/admin/email-template/add/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.emailTemplate))
          store.sSlug = res.body.data.sSlug
          store.ID = res.body.data._id
          done()
        })
    })
    it('Should be create a new Email template', (done) => {
      const data = {
        sTitle: 'Verify Email test',
        sSubject: 'Verify Email Subject test',
        sDescription: 'Verify email Description test',
        sSlug: 'verify-email-test',
        sContent: 'template Content',
        eStatus: 'Y'
      }
      request(server)
        .post('/api/admin/email-template/add/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.data).toBeA('object')
          expect(res.body.message).toMatch(messages.English.add_success.replace('##', messages.English.emailTemplate))
          store.IDD = res.body.data._id
          store.sSlug = res.body.data.sSlug
          done()
        })
    })
    it('Should not be create a new Email template because template already exist', (done) => {
      const data = {
        sTitle: 'Verify Email',
        sSubject: 'Verify Email Subject',
        sDescription: 'Verify email Description',
        sSlug: store.sSlug,
        sContent: 'template Content',
        eStatus: 'Y'
      }
      request(server)
        .post('/api/admin/email-template/add/v1')
        .set('Authorization', store.token)
        .send(data)
        .expect(status.ResourceExist)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.emailTemplateSlug))
          done()
        })
    })
  })

  describe('/GET A List of email template', () => {
    it('Should be a get List of email template', (done) => {
      request(server)
        .get('/api/admin/email-template/v1')
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.emailTemplates))
          done()
        })
    })
  })

  describe('/GET A Slug of email template for admin', () => {
    it('Should be a get Slug of Email templates', (done) => {
      request(server)
        .get(`/api/admin/email-template/${store.sSlug}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.emailTemplate))
          done()
        })
    })
  })

  describe('/GET A Slug of email template add slug in params', () => {
    it('Should be a get Slug of email template', function(done) {
      request(server)
        .get(`/api/admin/email-template/${store.sSlug}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.success.replace('##', messages.English.emailTemplate))
          done()
        })
    })

    it('Should not fetch email template beacause it does not exist', (done) => {
      request(server)
        .get(`/api/admin/email-template/${store.wsSlug}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.emailTemplate))
          done()
        })
    })
  })

  describe('/PUT Update a email template ', () => {
    it('Should be update a email template', (done) => {
      const data = {
        sTitle: 'Forgot password Email-test-change',
        sSubject: 'forgot password Email Subject-test-change',
        sDescription: 'email Description-test',
        sSlug: 'forgot-pass-test-change',
        sContent: 'template Content',
        eStatus: 'Y'
      }
      request(server)
        .put(`/api/admin/email-template/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.update_success.replace('##', messages.English.emailTemplate))
          done()
        })
    })

    it('Should not be update a email template', (done) => {
      const data = {
        sTitle: 'Testing Email',
        sSubject: 'Testing Email Subject',
        sDescription: 'email Description',
        sSlug: 'testing-email',
        sContent: 'template Content',
        eStatus: 'Y'
      }
      request(server)
        .put(`/api/admin/email-template/${store.wId}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.NotFound)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.emailTemplate))
          done()
        })
    })

    it('Should not be A updated email template because sSlug and params id is not same', (done) => {
      // case: update template name to already existing template name, it must return error
      const data = {
        sTitle: 'Welcome Email',
        sSubject: 'Welcome Email Subject',
        sDescription: 'Welcome email Description',
        sSlug: store.sSlug,
        sContent: 'template Content',
        eStatus: 'Y'
      }
      request(server)
        .put(`/api/admin/email-template/${store.ID}/v1`)
        .set('Authorization', store.token)
        .send(data)
        .expect(status.ResourceExist)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.already_exist.replace('##', messages.English.emailTemplateSlug))
          done()
        })
    })
  })

  describe('/DELETE a email template ', () => {
    it('Should be delete a email template', (done) => {
      request(server)
        .delete(`/api/admin/email-template/${store.IDD}/v1`)
        .set('Authorization', store.token)
        .expect(status.OK)
        .end(function(err, res) {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.del_success.replace('##', messages.English.emailTemplate))
          done()
        })
    })

    it('Should not be delete a email template', (done) => {
      request(server).delete(`/api/admin/email-template/${store.wId}/v1`)
        .set('Authorization', store.token)
        .expect(status.NotFound)
        .end((err, res) => {
          if (err) return done(err)
          expect(res.body.message).toMatch(messages.English.not_exist.replace('##', messages.English.emailTemplate))
          done()
        })
    })
  })
})
