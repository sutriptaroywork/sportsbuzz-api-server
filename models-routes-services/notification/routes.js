const router = require('express').Router()
const notificationsServices = require('./services')
const validators = require('./validators')
const { setLanguage, validateAdmin, isUserAuthenticated } = require('../../middlewares/middleware')
const { cacheRoute } = require('../../helper/redis')
const config = require('../../config/config')
const { forwardRequest: forwardRequestHelper } = require('../../middlewares/axiosForwardRequest')
const forwardRequest = forwardRequestHelper(config.SB11_BACKEND_MS_NOTIFICATION_SERVICE)

router.post('/admin/notification/v1', forwardRequest, validators.adminAddNotification, validateAdmin('NOTIFICATION', 'W'), notificationsServices.add)
router.post('/admin/notification/timed/v1', forwardRequest, validators.adminAddTimedNotification, validateAdmin('NOTIFICATION', 'W'), notificationsServices.addTimedNotification)
router.get('/admin/notification/types/v1', forwardRequest, cacheRoute(5 * 60), setLanguage, notificationsServices.listTypes)

router.put('/admin/notification/:id/v1', forwardRequest, validators.adminUpdateNotification, validateAdmin('NOTIFICATION', 'W'), notificationsServices.updateNotification)
router.get('/admin/notification/list/v1', validateAdmin('NOTIFICATION', 'R'), notificationsServices.listNotification) // deprecated
router.get('/admin/notification/list/v2', forwardRequest, validateAdmin('NOTIFICATION', 'R'), notificationsServices.listNotificationV2)
router.get('/admin/notification/:id/v1', forwardRequest, validateAdmin('NOTIFICATION', 'R'), notificationsServices.get) // deprecated
router.get('/admin/notification/:id/v2', forwardRequest, validateAdmin('NOTIFICATION', 'R'), notificationsServices.getV2)
router.delete('/admin/notification/:id/v1', forwardRequest, validateAdmin('NOTIFICATION', 'W'), notificationsServices.deleteNotification)

router.get('/user/notification/types/v1', forwardRequest, cacheRoute(5 * 60), setLanguage, notificationsServices.listTypes)
router.get('/user/notification/unread-count/v1', forwardRequest, isUserAuthenticated, notificationsServices.unreadCount)
router.post('/user/notification/list/v1', forwardRequest, isUserAuthenticated, notificationsServices.list)

router.post('/admin/push-notification/v1', forwardRequest, validators.adminPushNotification, validateAdmin('PUSHNOTIFICATION', 'W'), notificationsServices.pushNotificationV2)
router.put('/admin/push-notification/:id/v1', forwardRequest, validators.adminOpsPushNotification, validateAdmin('PUSHNOTIFICATION', 'W'), notificationsServices.updatePushNotification)
router.delete('/admin/push-notification/:id/v1', forwardRequest, validators.adminOpsPushNotification, validateAdmin('PUSHNOTIFICATION', 'W'), notificationsServices.deletePushNotification)
router.get('/admin/push-notification/:id/v1', forwardRequest, validators.adminOpsPushNotification, validateAdmin('PUSHNOTIFICATION', 'R'), notificationsServices.getSinglePushNotification)
router.get('/admin/push-notification-list/v1', forwardRequest, validateAdmin('PUSHNOTIFICATION', 'R'), notificationsServices.pushNotificationList)

router.put('/admin/notification-message/:id/v1', forwardRequest, validators.adminAddNotificationMessage, validateAdmin('PUSHNOTIFICATION', 'W'), notificationsServices.updateNotificationMessage)
router.get('/admin/notification-message-list/v1', forwardRequest, validateAdmin('PUSHNOTIFICATION', 'R'), notificationsServices.NotificationMessageList)
router.get('/admin/notification-message/:id/v1', forwardRequest, validateAdmin('PUSHNOTIFICATION', 'R'), notificationsServices.NotificationMessageDetails)

router.post('/admin/push-notification/v2', validators.adminPushNotification, validateAdmin('PUSHNOTIFICATION', 'W'), notificationsServices.pushNotificationV2)
module.exports = router
