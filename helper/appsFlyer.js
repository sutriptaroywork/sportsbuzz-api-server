const axios = require('axios')
const config = require('../config/config')
const { handleCatchError } = require('../helper/utilities.services')

async function getEventReport(dDateFrom, dDateTo) {
  try {
    const iAndroidAppId = config.APPSFLYER_ANDROID_APPID
    const iIOSAppId = config.APPSFLYER_IOS_APPID
    const sRegisterEvent = config.APPSFLYER_REGISTER_EVENT

    const dateFrom = encodeURIComponent(dDateFrom)
    const dateTo = encodeURIComponent(dDateTo)
    const sTimezone = encodeURIComponent('+05:30') // IST time

    const [androidRes, iosRes] = await Promise.all([
      axios.get(`https://hq1.appsflyer.com/api/raw-data/export/app/${iAndroidAppId}/in_app_events_report/v5?from=${dateFrom}&to=${dateTo}&timezone=${sTimezone}&event_name=${sRegisterEvent}`,
        { headers: { Authorization: `Bearer ${config.APPSFLYER_TOKEN}`, accept: 'text/csv' } }
      ),
      axios.get(`https://hq1.appsflyer.com/api/raw-data/export/app/${iIOSAppId}/in_app_events_report/v5?from=${dateFrom}&to=${dateTo}&timezone=${sTimezone}&event_name=${sRegisterEvent}`,
        { headers: { Authorization: `Bearer ${config.APPSFLYER_TOKEN}`, accept: 'text/csv' } }
      )
    ])

    const aAndroidReport = csvToJson(androidRes.data)
    const aIOSReport = csvToJson(iosRes.data)

    const aData = [...aAndroidReport, ...aIOSReport]
    return aData
  } catch (error) {
    handleCatchError(error)
  }
}

async function getAggregateReport(dDateFrom, dDateTo) {
  try {
    const iAndroidAppId = config.APPSFLYER_ANDROID_APPID
    const iIOSAppId = config.APPSFLYER_IOS_APPID

    const dateFrom = encodeURIComponent(dDateFrom)
    const dateTo = encodeURIComponent(dDateTo)
    const sTimezone = encodeURIComponent('+05:30') // IST time

    const [androidRes, iosRes] = await Promise.all([
      axios.get(`https://hq1.appsflyer.com/api/agg-data/export/app/${iAndroidAppId}/partners_report/v5?from=${dateFrom}&to=${dateTo}&timezone=${sTimezone}`,
        { headers: { Authorization: `Bearer ${config.APPSFLYER_TOKEN}`, accept: 'text/csv' } }
      ),
      axios.get(`https://hq1.appsflyer.com/api/agg-data/export/app/${iIOSAppId}/partners_report/v5?from=${dateFrom}&to=${dateTo}&timezone=${sTimezone}`,
        { headers: { Authorization: `Bearer ${config.APPSFLYER_TOKEN}`, accept: 'text/csv' } }
      )
    ])

    const aAndroidReport = csvToJson(androidRes.data)
    const aIOSReport = csvToJson(iosRes.data)

    const aData = []
    aAndroidReport.forEach(report => {
      aData.push({ ...report, PlateForm: 'Android' })
    })
    aIOSReport.forEach(report => {
      aData.push({ ...report, PlateForm: 'IOS' })
    })
    return aData
  } catch (error) {
    handleCatchError(error)
  }
}

function csvToJson(csvStr) {
  const aLines = csvStr.split('\n')
  const aResult = []

  const aHeaders = aLines[0].split(',')

  for (let i = 1; i < aLines.length; i++) {
    const obj = {}
    const currentLine = aLines[i].split(',')

    for (let j = 0; j < aHeaders.length; j++) {
      obj[aHeaders[j]] = currentLine[j]
    }

    aResult.push(obj)
  }
  return aResult
}

module.exports = {
  getEventReport,
  getAggregateReport
}
