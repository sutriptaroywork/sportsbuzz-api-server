const { body, param } = require('express-validator')
const { notificationTopic, notificationMessageKeys } = require('../../data')

const adminAddNotification = [
  body('iUserId').not().isEmpty(),
  body('sTitle').not().isEmpty(),
  body('sMessage').not().isEmpty(),
  body('iType').not().isEmpty()
]

const adminAddTimedNotification = [
  body('sTitle').not().isEmpty(),
  body('sMessage').not().isEmpty(),
  body('iType').not().isEmpty(),
  body('dExpTime').not().isEmpty()
]

const adminPushNotification = [
  body('sTitle').not().isEmpty(),
  body('sMessage').not().isEmpty(),
  body('sTopic').not().isEmpty().isIn(notificationTopic)
]

const adminAddNotificationMessage = [
  body('eKey').not().isEmpty().isIn(notificationMessageKeys)
]
const adminOpsPushNotification = [
  param('id').isMongoId().not().isEmpty()
]

const adminUpdateNotification = [
  body('sTitle').not().isEmpty(),
  body('sMessage').not().isEmpty(),
  body('iType').not().isEmpty(),
  body('aReadIds').optional().isArray(),
  body('eStatus').optional().isInt(),
  body('dExpTime').not().isEmpty()
]

module.exports = {
  adminAddNotification,
  adminAddTimedNotification,
  adminPushNotification,
  adminAddNotificationMessage,
  adminUpdateNotification,
  adminOpsPushNotification
}
