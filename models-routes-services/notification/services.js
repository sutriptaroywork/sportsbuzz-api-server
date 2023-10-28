const UsersModel = require('../user/model')
const NotificationsModel = require('../notification/model')
const NotificationTypesModel = require('../notification/notificationtypes.model')
const NotificationMessagesModel = require('../notification/notificationMessages.model')
const PushNotificationModel = require('../notification/pushNotification.model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { removenull, catchError, pick, getPaginationValues2 } = require('../../helper/utilities.services')
const { redisClient } = require('../../helper/redis')
const ObjectId = require('mongoose').Types.ObjectId
const { bAllowDiskUse } = require('../../config/config')
const { sendNotification, notificationSchedulerV2 } = require('../../queue')
const UserModel = require('../user/model')
const AdminModel = require('../admin/model')

class Notifications {
  async add(req, res) {
    try {
      req.body = pick(req.body, ['iUserId', 'sTitle', 'sMessage', 'iType'])
      removenull(req.body)
      const { iUserId, sTitle, sMessage, iType } = req.body
      const iAdminId = req.admin._id

      const exist = await UsersModel.findById(iUserId).lean()
      if (!exist) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].cuserId) })

      // For any notification add, we required it's type like profile, promotional, transaction, etc.
      const ntExist = await NotificationTypesModel.findById(iType).lean()
      if (!ntExist) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].cnotificationType) })

      const data = await NotificationsModel.create({ ...req.body, iAdminId })

      await sendNotification(exist.aJwtTokens, sTitle, sMessage)

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].cnotificaiton), data })
    } catch (error) {
      return catchError('Notifications.add', error, req, res)
    }
  }

  async addTimedNotification(req, res) {
    try {
      const { dExpTime } = req.body
      req.body = pick(req.body, ['sTitle', 'sMessage', 'iType', 'dExpTime'])
      removenull(req.body)

      const dTime = new Date(dExpTime)
      if (dTime < (new Date())) { return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].schedule_date_err }) }

      const data = await NotificationsModel.create({ ...req.body, aReadIds: [] })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].sent_success.replace('##', messages[req.userLanguage].cnotificaiton), data })
    } catch (error) {
      return catchError('Notifications.addTimedNotification', error, req, res)
    }
  }

  async unreadCount(req, res) {
    try {
      const count = await NotificationsModel.aggregate([
        { $match: { $or: [{ iUserId: req.user._id }, { dExpTime: { $gte: new Date() } }] } },
        {
          $project: {
            status: {
              $cond: [
                '$dExpTime',
                { $cond: [{ $in: [req.user._id, '$aReadIds'] }, 1, 0] },
                '$eStatus']
            }
          }
        },
        { $match: { status: 0 } }
      ]).allowDiskUse(bAllowDiskUse).exec()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cunreadNotificationCount), data: { nUnreadCount: count.length } })
    } catch (error) {
      catchError('Notifications.unreadCount', error, req, res)
    }
  }

  async list(req, res) {
    try {
      let { nLimit, nSkip, aFilters } = req.body
      nLimit = parseInt(nLimit) || 20
      nSkip = parseInt(nSkip) || 0

      const filterQuery = { $or: [] }
      let matchQuery = { $or: [{ iUserId: req.user._id }, { dExpTime: { $gte: new Date() } }] }

      if (aFilters && aFilters.length) {
        aFilters.map(s => filterQuery.$or.push({ iType: ObjectId(s) }))
        matchQuery = { ...matchQuery, $and: [] }
        matchQuery.$and.push({ ...filterQuery })
      }

      const notifications = await NotificationsModel.aggregate([
        { $match: matchQuery },
        {
          $project: {
            _id: 1,
            eStatus: {
              $cond: [
                '$dExpTime',
                { $cond: [{ $in: [req.user._id, '$aReadIds'] }, 1, 0] },
                '$eStatus']
            },
            sTitle: 1,
            sMessage: 1,
            dExpTime: 1,
            dCreatedAt: 1
          }
        },
        { $sort: { dCreatedAt: -1 } },
        { $skip: nSkip },
        { $limit: nLimit }
      ]).allowDiskUse(bAllowDiskUse).exec()

      const updateIds = []
      const timeIds = []
      notifications.map(s => {
        if (s.dExpTime && !s.eStatus) {
          timeIds.push(s._id)
        } else if (!s.eStatus) {
          updateIds.push(s._id)
        }
      })
      if (updateIds.length) await NotificationsModel.updateMany({ _id: { $in: updateIds } }, { $set: { eStatus: 1 } })
      if (timeIds.length) await NotificationsModel.updateMany({ _id: { $in: timeIds } }, { $addToSet: { aReadIds: req.user._id } })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cnotificaitons), data: notifications })
    } catch (error) {
      catchError('notificationController.list', error, req, res)
    }
  }

  async listTypes(req, res) {
    try {
      // Notification Types (Static) only be added in DB from backend developer, it'll not be add and update from admin
      const data = await NotificationTypesModel.find({ eStatus: 'Y' }).lean()
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cnotificationTypes), data })
    } catch (error) {
      return catchError('Notifications.listTypes', error, req, res)
    }
  }

  async pushNotification(req, res) {
    console.info('pushNotification starts')
    console.error('pushNotification starts')
    console.warn('pushNotification starts')
    try {
      // console.log('inside pushNotification function')
      req.body = pick(req.body, ['sTitle', 'sMessage', 'sTopic', 'dExpTime'])
      removenull(req.body)
      // console.log(':: Push Notification req.body :: recieved', req.body)
      const { sTitle, sMessage, sTopic, dExpTime } = req.body
      const dTime = new Date(dExpTime)
      if (dTime < (new Date())) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].schedule_date_err })

      // schedule notification in redis of it's schedule time.
      // console.log(':: Push Notification Scheduled :: start', JSON.stringify(sMessage))
      const data = await PushNotificationModel.create({ sTitle, iAdminId: req.admin._id, sDescription: sMessage, dScheduleTime: dTime, ePlatform: sTopic })
      // console.log(':: Push Notification Scheduled :: created')
      // console.log(`pushNotification::******* Data for notification from admin panel : ------- ${data._id} -------`, data)
      // console.log(`-=-=-=-=-==-=- data for notification: ${sTitle + '_' + sMessage} @@@@@@@@@@@@@@@`, sTopic, dExpTime)
      await redisClient.zadd('scheduler', Number(+dTime), JSON.stringify({ _id: data._id.toString(), sTopic, sTitle, sMessage, queueName: 'NOTIFY' }))

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].schedule_success.replace('##', messages[req.userLanguage].cpushNotification), data: {} })
    } catch (error) {
      return catchError('Notifications.pushNotification', error, req, res)
    }
  }

  async pushNotificationV2(req, res) {
    try {
      req.body = pick(req.body, ['sTitle', 'sMessage', 'sTopic'])
      removenull(req.body)
      const { sTitle, sMessage, sTopic } = req.body
      // console.log(`:: Push Notification V2 Started :: ${sTitle}`)
      const data = await PushNotificationModel.create({ sTitle, iAdminId: req.admin._id, sDescription: sMessage, ePlatform: sTopic })
      await notificationSchedulerV2(data)
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].schedule_success.replace('##', messages[req.userLanguage].cpushNotification), data })
    } catch (error) {
      return catchError('Notifications.pushNotification V2', error, req, res)
    }
  }

  async updatePushNotification(req, res) {
    try {
      req.body = pick(req.body, ['sTitle', 'sMessage', 'sTopic', 'dExpTime'])
      removenull(req.body)

      const { sTitle, sMessage, sTopic, dExpTime } = req.body
      const data = await PushNotificationModel.findOne({ _id: ObjectId(req.params.id) }).lean()
      if (!data) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpushNotification) })

      const dTime = dExpTime ? +new Date(dExpTime) : +new Date(data.dExpTime)

      if (dTime < (new Date()) || (dTime < (+new Date() + 60000))) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].schedule_date_err })
      await redisClient.zrem('scheduler', JSON.stringify({ _id: req.params.id, sTopic: data?.ePlatform, sTitle: data?.sTitle, sMessage: data?.sDescription, queueName: 'NOTIFY' }))
      await redisClient.zadd('scheduler', Number(dTime), JSON.stringify({ _id: req.params.id, sTopic, sTitle, sMessage, queueName: 'NOTIFY' }))
      const updateData = await PushNotificationModel.findOneAndUpdate({ _id: ObjectId(req.params.id) }, { sTitle, iAdminId: req.admin._id, sDescription: sMessage, dScheduleTime: dTime, ePlatform: sTopic }, { new: true }).lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cpushNotification), data: updateData })
    } catch (error) {
      return catchError('Notifications.updatePushNotification', error, req, res)
    }
  }

  async deletePushNotification(req, res) {
    try {
      const data = await PushNotificationModel.findOne({ _id: ObjectId(req.params.id), eStatus: 1 }).lean()
      if (!data) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpushNotification) })

      await redisClient.zrem('scheduler', JSON.stringify({ _id: req.params.id, sTopic: data?.ePlatform, sTitle: data?.sTitle, sMessage: data?.sDescription, queueName: 'NOTIFY' }))
      await PushNotificationModel.updateOne({ _id: ObjectId(req.params.id) }, { eStatus: 0 })
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].cpushNotification) })
    } catch (error) {
      return catchError('Notifications.deletePushNotification', error, req, res)
    }
  }

  async getSinglePushNotification(req, res) {
    try {
      const oData = await PushNotificationModel.findOne({ _id: ObjectId(req.params.id), eStatus: 1 }).lean()
      if (!oData) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cpushNotification) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpushNotification), data: oData })
    } catch (error) {
      return catchError('Notifications.getSinglePushNotification', error, req, res)
    }
  }

  async pushNotificationList(req, res) {
    try {
      const { dateFrom, dateTo, platform } = req.query
      const { start, limit, search, sorting } = getPaginationValues2(req.query)

      let query = search ? { sTitle: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      query = dateFrom && dateTo ? { ...query, dScheduleTime: { $gte: (dateFrom), $lte: (dateTo) } } : query
      query = platform ? { ...query, ePlatform: platform } : query
      query = { ...query, eStatus: 1 }

      const [queryData, total] = await Promise.all([
        PushNotificationModel.find(query, {
          sTitle: 1,
          sDescription: 1,
          ePlatform: 1,
          iAdminId: 1,
          dScheduleTime: 1,
          dCreatedAt: 1,
          eStatus: 1
        }).sort(sorting).skip(Number(start)).limit(Number(limit)).populate({ path: 'oAdmin', select: { sName: 1, sUsername: 1, eType: 1 } }).lean(),
        PushNotificationModel.countDocuments(query)
      ])

      const results = queryData && Array.isArray(queryData) ? queryData : []
      const totalCount = total || 0

      const data = [{ results, total: totalCount }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cpushNotification), data })
    } catch (error) {
      return catchError('Notifications.pushNotificationList', error, req, res)
    }
  }

  async updateNotificationMessage(req, res) {
    try {
      const { ePlatform } = req.body
      req.body = pick(req.body, ['sHeading', 'sDescription', 'ePlatform', 'bEnableNotifications'])

      const data = await NotificationMessagesModel.findByIdAndUpdate(req.params.id, { ...req.body, ePlatform: ePlatform.toUpperCase() }, { new: true, runValidators: true }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].cnotificaiton) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cnotificaiton), data })
    } catch (error) {
      return catchError('Notifications.updateNotificationMessage', error, req, res)
    }
  }

  async NotificationMessage(req, res) {
    try {
      req.body = pick(req.body, ['sHeading', 'sDescription', 'ePlatform', 'bEnableNotifications'])

      const data = await NotificationMessagesModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].cnotificaiton) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cnotificaiton), data })
    } catch (error) {
      return catchError('Notifications.updateNotificationMessage', error, req, res)
    }
  }

  async NotificationMessageList(req, res) {
    try {
      const data = await NotificationMessagesModel.find().lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cNotificationMessages), data })
    } catch (error) {
      return catchError('Notifications.NotificationMessageList', error, req, res)
    }
  }

  async NotificationMessageDetails(req, res) {
    try {
      const data = await NotificationMessagesModel.findById(req.params.id).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].went_wrong_with.replace('##', messages[req.userLanguage].cnotificaiton) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cnotificaiton), data })
    } catch (error) {
      return catchError('Notifications.NotificationMessageDetails', error, req, res)
    }
  }

  async listNotification(req, res) {
    try {
      const { iType, dateFrom, dateTo } = req.query
      const { start, limit, sorting, search } = getPaginationValues2(req.query)

      const iTypeFilter = iType ? { iType } : {}
      const datefilter = dateFrom && dateTo ? { $and: [{ dExpTime: { $gte: (dateFrom) } }, { dExpTime: { $lte: (dateTo) } }] } : {}
      const searchFilter = search ? { sTitle: { $regex: new RegExp('^.*' + search + '.*', 'i') } } : {}

      const query = { ...iTypeFilter, ...datefilter, ...searchFilter }

      const results = await NotificationsModel.find(query, {
        iUserId: 1,
        sTitle: 1,
        sMessage: 1,
        eStatus: 1,
        iType: 1,
        dExpTime: 1,
        aReadIds: 1,
        dCreatedAt: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).lean()

      const total = await NotificationsModel.countDocuments({ ...query })

      const data = [{ total, results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cnotificaitons), data: data })
    } catch (error) {
      return catchError('Notifications.adminNotificationList', error, req, res)
    }
  }

  async listNotificationV2(req, res) {
    try {
      const { iType, dDateFrom, dDateTo, nStart, nLimit, sSorting, sSearch } = req.query
      const { start, limit, sorting } = getPaginationValues2({ start: nStart, limit: nLimit, sort: sSorting })

      const iTypeFilter = iType ? { iType } : {}
      const datefilter = dDateFrom && dDateTo ? { $and: [{ dExpTime: { $gte: (dDateFrom) } }, { dExpTime: { $lte: (dDateTo) } }] } : {}
      const searchFilter = sSearch ? { sTitle: { $regex: new RegExp('^.*' + sSearch + '.*', 'i') } } : {}

      const query = { ...iTypeFilter, ...datefilter, ...searchFilter }

      const results = await NotificationsModel.find(query, {
        iUserId: 1,
        sTitle: 1,
        sMessage: 1,
        eStatus: 1,
        iType: 1,
        dExpTime: 1,
        aReadIds: 1,
        iAdminId: 1,
        dCreatedAt: 1
      }).sort(sorting).skip(Number(start)).limit(Number(limit)).populate('oAdminNotification', 'sName sUsername eType').populate('oUserNotification', 'sName sUsername sMobnum').lean()

      const total = await NotificationsModel.countDocuments({ ...query })

      const data = [{ total, results }]

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cnotificaitons), data: data })
    } catch (error) {
      return catchError('Notifications.adminNotificationList', error, req, res)
    }
  }

  async updateNotification(req, res) {
    try {
      req.body = pick(req.body, ['sTitle', 'sMessage', 'aReadIds', 'iType', 'eStatus', 'dExpTime'])

      const data = await NotificationsModel.findByIdAndUpdate(req.params.id, { ...req.body, iAdminId: req.admin._id }, { new: true, runValidators: true })
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cnotificaiton) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].cnotificaiton), data })
    } catch (error) {
      return catchError('Notifications.adminUpdateNotification', error, req, res)
    }
  }

  async deleteNotification(req, res) {
    try {
      const data = await NotificationsModel.findByIdAndDelete(req.params.id)
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cnotificaiton) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].cnotificaiton), data })
    } catch (error) {
      return catchError('Notifications.adminDeleteNotification', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const data = await NotificationsModel.findById(req.params.id, ['sTitle', 'sMessage', 'eStatus', 'iType', 'dExpTime', 'dCreatedAt']).lean()
      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cnotificaiton) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cnotificaiton), data })
    } catch (error) {
      return catchError('Notifications.get', error, req, res)
    }
  }

  async getV2(req, res) {
    try {
      const data = await NotificationsModel.findOne({ _id: req.params.id }, { sTitle: 1, sMessage: 1, eStatus: 1, iType: 1, dExpTime: 1, dCreatedAt: 1, iUserId: 1, iAdminId: 1 }).lean()

      const oUser = await UserModel.findOne({ _id: ObjectId(data.iUserId) }, { sName: 1, sUsername: 1, sMobNum: 1 }).lean()
      const oAdmin = await AdminModel.findOne({ _id: ObjectId(data.iAdminId) }, { sName: 1, sUsername: 1 }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].cnotificaiton) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].cnotificaiton), data: { ...data, oAdmin, oUser } })
    } catch (error) {
      return catchError('Notifications.get', error, req, res)
    }
  }
}
module.exports = new Notifications()
