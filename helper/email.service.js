const nodemailer = require('nodemailer')
const fs = require('fs')
const ejs = require('ejs')
const config = require('../config/config')
const transporter = nodemailer.createTransport(config.MAIL_TRANSPORTER)
const { replaceText, validateEmail } = require('./utilities.services')
const EmailTemplateModel = require('../models-routes-services/emailTemplates/model')
const { handleCatchError } = require('./utilities.services')

const sendMail = async ({ sSlug, replaceData, to }) => {
  try {
    const emailTemplate = await EmailTemplateModel.findOne({ sSlug: sSlug }).lean()

    if (!emailTemplate) {
      throw Error('template not found from the database')
    }

    const sContent = emailTemplate.sContent
    const content = replaceText(sContent, replaceData)

    const template = fs.readFileSync(config.EMAIL_TEMPLATE_PATH + 'basic.ejs', {
      encoding: 'utf-8' // Unicode Transformation Format (UTF).
    })

    const emailBody = ejs.render(template, { content })

    const nodeMailerOptions = {
      from: `SportsBuzz11 ${config.SMTP_FROM}`,
      to: to,
      subject: emailTemplate.sSubject,
      html: emailBody
    }

    return transporter.sendMail(nodeMailerOptions)
  } catch (error) {
    handleCatchError(error)
  }
}
/**
 * This function is used to send mail with attachments and without slug
 * @param {string} sDates provides a date range for matches of that particular day
 * @param {object} oAttachments provides an object with attachments of mail
 * @returns mail sent
 */
const sendMailTo = async ({ oOptions, oAttachments }) => {
  try {
    const nodeMailerOptions = {
      from: oOptions.from,
      to: oOptions.to,
      subject: oOptions.subject,
      attachments: oAttachments
    }

    const bEmail = await validateEmail(config.RECEIVER_EMAIL)
    if (config.RECEIVER_EMAIL && bEmail) {
      return await transporter.sendMail(nodeMailerOptions)
    }
    return
  } catch (error) {
    return handleCatchError(error)
  }
}
module.exports = {
  sendMail,
  sendMailTo
}
