const router = require('express').Router()
const { complaintServices, faqServices,freshDeskService } = require('./services')
const validators = require('./validators')
const { validateAdmin, isUserAuthenticated, validate } = require('../../middlewares/middleware')

router.post('/user/complaint/v1', validators.userAddComplaint, isUserAuthenticated, complaintServices.addComplaint)
router.post('/user/complaint/pre-signed-url/v1', validators.getSignedUrl, isUserAuthenticated, complaintServices.getSignedUrl)
router.get('/user/complaint/list/v1', isUserAuthenticated, complaintServices.list)
router.get('/user/complaint/:id/v1', isUserAuthenticated, complaintServices.get)
router.delete('/user/complaint/:id/v1', isUserAuthenticated, complaintServices.removeComplaint)

router.get('/admin/complaint/v1', validateAdmin('COMPLAINT', 'R'), complaintServices.adminList)
router.get('/admin/complaint/:id/v1', validateAdmin('COMPLAINT', 'R'), complaintServices.adminGet)
router.put('/admin/complaint/:id/v1', validators.adminUpdateStatus, validateAdmin('COMPLAINT', 'W'), complaintServices.updateStatus)

router.post('/user/contact-us/v1', validators.userAddContactUs, validate, complaintServices.addContactUs)

// ? FAQ Section
router.get('/user/faq/list/v1', isUserAuthenticated, faqServices.list) // To list down FAQs at UserApp

// * Admin Routes
router.get('/admin/faq/list/v1', validateAdmin('COMPLAINT', 'R'), faqServices.adminList)
router.get('/admin/faq/view/:id/v1', validateAdmin('COMPLAINT', 'R'), faqServices.adminGet)
router.post('/admin/faq/v1', validateAdmin('COMPLAINT', 'W'), faqServices.adminCreate)
router.put('/admin/faq/update/:id/v1', validateAdmin('COMPLAINT', 'R'), faqServices.adminUpdate)
router.delete('/admin/faq/delete/:id/v1', validateAdmin('COMPLAINT', 'R'), faqServices.adminDelete)

// ? FreshDesk Section
router.get('/user/fresh-desk/ticket/list/v1', isUserAuthenticated, freshDeskService.list)
router.get('/user/fresh-desk/ticket/view/:id/v1', isUserAuthenticated, freshDeskService.view)
router.post('/user/fresh-desk/ticket/create/v1', isUserAuthenticated, freshDeskService.create)
router.put('/user/fresh-desk/ticket/update/:id/v1', isUserAuthenticated, freshDeskService.update)
module.exports = router
