const router = require('express').Router()
const emailTemplateServices = require('./services')
const validators = require('./validators')
const { validateAdmin } = require('../../middlewares/middleware')

router.post('/admin/email-template/add/v1', validators.adminAddEmailTemplate, validateAdmin('EMAIL_TEMPLATES', 'W'), emailTemplateServices.add)

router.get('/admin/email-template/v1', validateAdmin('EMAIL_TEMPLATES', 'R'), emailTemplateServices.list)

router.get('/admin/email-template/:sSlug/v1', validateAdmin('EMAIL_TEMPLATES', 'R'), emailTemplateServices.adminGet)

router.put('/admin/email-template/:id/v1', validators.adminUpdateEmailTemplate, validateAdmin('EMAIL_TEMPLATES', 'W'), emailTemplateServices.update)

router.delete('/admin/email-template/:id/v1', validateAdmin('EMAIL_TEMPLATES', 'W'), emailTemplateServices.remove)

// not in used
router.get('/admin/send-email/v1', validators.sendEmail, validateAdmin('EMAIL_TEMPLATES', 'W'), emailTemplateServices.send)

router.post('/admin/email-template/pre-signed-url/v1', validators.adminGetPreSignedUrl, validateAdmin('EMAIL_TEMPLATES', 'W'), emailTemplateServices.getSignedUrl)

module.exports = router
