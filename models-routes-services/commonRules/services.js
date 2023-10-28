const CommonRuleModel = require('./model')
const { messages, status, jsonStatus } = require('../../helper/api.responses')
const { catchError, pick, removenull, getIp } = require('../../helper/utilities.services')
const { CACHE_2 } = require('../../config/config')
const mongoose = require('mongoose')
const { ObjectId } = mongoose.Types
const cachegoose = require('recachegoose')
const { commonRule, rewardOn } = require('../../data')
const adminServices = require('../admin/subAdmin/services')
const adminLogQueue = require('../../rabbitmq/queue/adminLogQueue')
class Rule {
  /**
   * To find rule by its key (eRule)
   * @param  { string } rule
   */
  findRule (rule) {
    return CommonRuleModel.findOne({ eRule: rule.toUpperCase(), eStatus: 'Y' }).lean().cache(CACHE_2, `rule:${rule}`)
  }

  async add(req, res) {
    try {
      const { eRule, nAmount, nMin, nMax } = req.body
      const { _id: iAdminId } = req.admin

      if (eRule === 'PLC' || eRule === 'LCC') {
        // PLC = PRIVATE_LEAGUE_COMMISSION, LCC =LEAGUE_CREATOR_COMMISSION
        // For this rule type, we required this field for particular rule data usage purpose. so, sanitize input here accordingly
        req.body = pick(req.body, ['eRule', 'nAmount', 'eType', 'eStatus', 'sRuleName'])
      } else {
        // DB = 'DEPOSIT_BONUS'
        // For this rule type, we required this field for particular rule data usage purpose. so, sanitize input here accordingly
        if (eRule === 'DB') pick(req.body, ['eRule', 'nAmount', 'eType', 'eStatus', 'nMax', 'nMin', 'nExpireDays', 'sRuleName'])
        else req.body = pick(req.body, ['eRule', 'nAmount', 'eType', 'eStatus', 'nExpireDays', 'sRuleName', 'sRewardOn'])
      }
      removenull(req.body)

      const rule = await CommonRuleModel.findOne({ eRule }).lean()
      if (rule) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', `${eRule} Rule`) })

      if (nMin && nMax && parseInt(nMin) > parseInt(nMax)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].minAmount).replace('#', messages[req.userLanguage].cmaximumAmount) })
      if (eRule && nAmount && (eRule === 'PLC' || eRule === 'LCC') && (parseInt(nAmount) > 100 || parseInt(nAmount) < 0)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].amount) })

      const data = await CommonRuleModel.create({ ...req.body })

      const logData = { oOldFields: {}, oNewFields: data, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'CR' }
      adminLogQueue.publish(logData);///changes Here
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].add_success.replace('##', messages[req.userLanguage].rule), data })
    } catch (error) {
      return catchError('Rule.add', error, req, res)
    }
  }

  async list(req, res) {
    try {
      const data = await CommonRuleModel.find().lean()

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].rule), data })
    } catch (error) {
      return catchError('Rule.list', error, req, res)
    }
  }

  async ruleList(req, res) {
    try {
      const data = !commonRule && !commonRule.length ? [] : commonRule

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].rule), data })
    } catch (error) {
      return catchError('Rule.list', error, req, res)
    }
  }

  async get(req, res) {
    try {
      const data = await CommonRuleModel.findById(req.params.id).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].rule) })

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].rule), data })
    } catch (error) {
      return catchError('Rule.get', error, req, res)
    }
  }

  async update(req, res) {
    try {
      const { eRule, nAmount, nMin, nMax } = req.body
      const { _id: iAdminId } = req.admin

      if (eRule === 'PLC' || eRule === 'LCC') {
        req.body = pick(req.body, ['eRule', 'nAmount', 'eType', 'eStatus', 'sRuleName'])
      } else if (eRule === 'DB') {
        pick(req.body, ['eRule', 'nAmount', 'eType', 'eStatus', 'nMax', 'nMin', 'nExpireDays', 'sRuleName'])
      } else {
        req.body = pick(req.body, ['eRule', 'nAmount', 'eType', 'eStatus', 'nExpireDays', 'sRuleName', 'sRewardOn'])
      }
      removenull(req.body)

      const rule = await Promise.all([
        CommonRuleModel.findOne({ eRule, _id: { $ne: ObjectId(req.params.id) }, eStatus: 'Y' }).lean(),
        CommonRuleModel.findOne({ _id: ObjectId(req.params.id) }).lean()
      ])

      if (rule[0]) return res.status(status.ResourceExist).jsonp({ status: jsonStatus.ResourceExist, message: messages[req.userLanguage].already_exist.replace('##', `${eRule} Rule`) })

      if (nMin && nMax && parseInt(nMin) > parseInt(nMax)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].less_then_err.replace('##', messages[req.userLanguage].minAmount).replace('#', messages[req.userLanguage].cmaximumAmount) })
      if (eRule && nAmount && (eRule === 'PLC' || eRule === 'LCC') && (parseInt(nAmount) > 100 || parseInt(nAmount) < 0)) return res.status(status.BadRequest).jsonp({ status: jsonStatus.BadRequest, message: messages[req.userLanguage].invalid.replace('##', messages[req.userLanguage].amount) })

      const data = await CommonRuleModel.findByIdAndUpdate(req.params.id, { ...req.body }, { new: true, runValidators: true })

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].rule) })
      cachegoose.clearCache(`rule:${data.eRule}`) // remove cached data from cachegoose also from update and delete time

      const logData = { oOldFields: rule[1], oNewFields: data, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'CR' }
      adminLogQueue.publish(logData);//chnages Here
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].update_success.replace('##', messages[req.userLanguage].rule), data })
    } catch (error) {
      return catchError('Rule.update', error, req, res)
    }
  }

  async remove(req, res) {
    try {
      const { _id: iAdminId } = req.admin

      const data = await CommonRuleModel.findByIdAndUpdate(req.params.id, { eStatus: 'N' }).lean()

      if (!data) return res.status(status.NotFound).jsonp({ status: jsonStatus.NotFound, message: messages[req.userLanguage].not_exist.replace('##', messages[req.userLanguage].rule) })
      cachegoose.clearCache(`rule:${data.eRule}`)

      const logData = { oOldFields: data, oNewFields: { ...data, eStatus: 'N' }, sIP: getIp(req), iAdminId: ObjectId(iAdminId), iUserId: null, eKey: 'CR' }
      adminLogQueue.publish(logData);//changes Here
      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].del_success.replace('##', messages[req.userLanguage].rule), data })
    } catch (error) {
      return catchError('Rule.remove', error, req, res)
    }
  }

  async rewardsRuleList(req, res) {
    try {
      const data = !rewardOn && !rewardOn.length ? [] : rewardOn

      return res.status(status.OK).jsonp({ status: jsonStatus.OK, message: messages[req.userLanguage].success.replace('##', messages[req.userLanguage].rule), data })
    } catch (error) {
      return catchError('Rule.list', error, req, res)
    }
  }
}

module.exports = new Rule()
