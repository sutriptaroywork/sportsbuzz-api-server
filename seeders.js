const mongoose = require('mongoose')
const cachegoose = require('recachegoose')
const fs = require('fs')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const saltRounds = 1
const salt = bcrypt.genSaltSync(saltRounds)
const { JWT_SECRET, JWT_VALIDITY, REDIS_HOST, REDIS_PORT, FRONTEND_HOST_URL } = require('./config/config')
const { category, appPlatform } = require('./data')
const SeriesLBCategoriesTemplateModel = require('./models-routes-services/seriesLeaderBoard/seriesLBCategoriesTemplate.model')
const PrivateLeaguePrizeModel = require('./models-routes-services/privateLeague/model')
const GeneralizeReportModel = require('./models-routes-services/report/generalizeReports.model')
const ScorePointModel = require('./models-routes-services/scorePoint/model')
const AdminModel = require('./models-routes-services/admin/model')
const UserModel = require('./models-routes-services/user/model')
const userBalanceServices = require('./models-routes-services/userBalance/services')
const PreferencesModel = require('./models-routes-services/preferences/model')
const commonRuleServices = require('./models-routes-services/commonRules/services')
const { genDynamicLinkV2 } = require('./helper/firebase.services')
const AuthLogsModel = require('./models-routes-services/user/authlogs.model')
const NotificationTypesModel = require('./models-routes-services/notification/notificationtypes.model')
const CitiesModel = require('./models-routes-services/user/cities')
const StatesModel = require('./models-routes-services/user/states')
const SportsModel = require('./models-routes-services/sports/model')
const CountryModel = require('./models-routes-services/country/model')
const CredentialModel = require('./models-routes-services/admin/credential.model')
const PermissionsModel = require('./models-routes-services/admin/permissions/model')
const PlayerRolesModel = require('./models-routes-services/playerRoles/model')
const SettingsModel = require('./models-routes-services/setting/model')
const CommonRulesModel = require('./models-routes-services/commonRules/model')
const LeagueCategoryModel = require('./models-routes-services/leagueCategory/model')
const NotificationMessagesModel = require('./models-routes-services/notification/notificationMessages.model')
const CMSModel = require('./models-routes-services/cms/model')
const { handleCatchError } = require('./helper/utilities.services')
const scorePath = '../fantasy-seeders/scorepoints.json'
const notificationPath = '../fantasy-seeders/notificationtypes.json'
const statePath = '../fantasy-seeders/states.json'
const cityPath = '../fantasy-seeders/cities.json'
const commonRulesPath = '../fantasy-seeders/commonrules.json'
const settingsPath = '../fantasy-seeders/settings.json'
const playerRolesPath = '../fantasy-seeders/playerroles.json'
const permissionsPath = '../fantasy-seeders/permissions.json'
const sportsPath = '../fantasy-seeders/sports.json'
const seriesTemplate = '../fantasy-seeders/series_leader_board_categories_templates.json'
const privateLeaguePrizeBreakup = '../fantasy-seeders/privateleagueprizes.json'
const countriesPath = '../fantasy-seeders/countries.json'
const banksPath = '../fantasy-seeders/banks.json'
const paymentOptionPath = '../fantasy-seeders/paymentoptions.json'
const payoutOptionPath = '../fantasy-seeders/payoutoptions.json'
const csssPath = '../fantasy-seeders/csses.json'
const versionPath = '../fantasy-seeders/versions.json'
const emailTemplatePath = '../fantasy-seeders/emailtemplates.json'
const notificationMessagesPath = '../fantasy-seeders/notificationMessage.json'
const cmsPath = '../fantasy-seeders/cms.json'
const PaymentOptionModel = require('./models-routes-services/paymentOptions/model')
const PayoutOptionModel = require('./models-routes-services/payoutOptions/model')
const CsssModel = require('./models-routes-services/cms/CSS.model')
const VersionModel = require('./models-routes-services/version/model')
const EmailTemplateModel = require('./models-routes-services/emailTemplates/model')
const MaintenanceModel = require('./models-routes-services/maintenance/model')
const BanksModel = require('./models-routes-services/banks/model')
const KYCModel = require('./models-routes-services/kyc/model')
const MatchModel = require('./models-routes-services/match/model')
const FantasyPostModel = require('./models-routes-services/match/fantasyPosts/model')
const LiveInningsModel = require('./models-routes-services/scorecard/liveInnings/model')
const SeasonModel = require('./models-routes-services/season/model')
const SeriesLeaderBoardModel = require('./models-routes-services/seriesLeaderBoard/model')
const TeamsModel = require('./models-routes-services/team/model')
const BankDetailsModel = require('./models-routes-services/user/bankDetails/model')
const StatisticsModel = require('./models-routes-services/user/statistics/model')
const PlayerModel = require('./models-routes-services/player/model')
const userAuthLogQueue = require('./rabbitmq/queue/userAuthLogQueue')
const ObjectId = mongoose.Types.ObjectId

const adminPlayloads = [
  {
    sName: 'super admin 1',
    sUsername: 'superadmin',
    sEmail: 'superman@gmail.com',
    sMobNum: '7878787878',
    sPassword: 'Super@123',
    eType: 'SUPER',
    ePlatform: 'O'
  }, {
    sName: 'super admin 2',
    sUsername: 'admin123',
    sEmail: 'admin@yudiz.com',
    sMobNum: '8809706243',
    sPassword: 'yudiz@123',
    eType: 'SUPER',
    ePlatform: 'O'
  }, {
    sName: 'super admin',
    sUsername: 'admin',
    sEmail: 'super@admin.com',
    sMobNum: '8809726243',
    sPassword: 'admin@123',
    eType: 'SUPER',
    ePlatform: 'O'
  }]
const systemUser = [{
  _id: ObjectId('625429308cfe9babd81f18a7'),
  sName: 'super user',
  sUsername: 'superuser',
  sEmail: 'superuser@gmail.com',
  sMobNum: '7878787878',
  // sPassword: '$2a$04$3vSWWuxMovDbqSees2slmeHddsll9S9vIeZQjqrbxgGkQzp3qxyAu',
  bIsEmailVerified: true,
  bIsMobVerified: true,
  eGender: 'M',
  ePlatform: 'O'
}, {
  sName: 'Internal user',
  sUsername: 'internaluser',
  sEmail: 'internaluser@gmail.com',
  sMobNum: '7676767676',
  // sPassword: '$2a$04$3vSWWuxMovDbqSees2slmeHddsll9S9vIeZQjqrbxgGkQzp3qxyAu',
  bIsEmailVerified: true,
  bIsMobVerified: true,
  eGender: 'M',
  ePlatform: 'O'
}
]
const credentialPlayload = {
  eKey: 'PAY',
  sPassword: 'fantasy@321'
}
const maintenancePayload = {
  bIsMaintenanceMode: false,
  sMessage: 'Unfortunately the site is down for a bit of maintenance right now. But soon we\'ll be up and the sun will shine again.'
}
require('./database/mongoose')
cachegoose(mongoose, {
  engine: 'redis',
  host: REDIS_HOST,
  port: REDIS_PORT
})

function executeFeeder(flag) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        syncModelsUniqueIndexes()
        await fileExist(scorePath, ScorePointModel, flag)
        await fileExist(notificationPath, NotificationTypesModel, flag)
        await fileExist(statePath, StatesModel, flag)
        await fileExist(cityPath, CitiesModel, flag)
        await fileExist(commonRulesPath, CommonRulesModel, flag)
        await fileExist(settingsPath, SettingsModel, flag)
        await fileExist(playerRolesPath, PlayerRolesModel, flag)
        await fileExist(permissionsPath, PermissionsModel, flag)
        await fileExist(sportsPath, SportsModel, flag)
        await fileExist(seriesTemplate, SeriesLBCategoriesTemplateModel, flag)
        await fileExist(privateLeaguePrizeBreakup, PrivateLeaguePrizeModel, flag)
        await fileExist(countriesPath, CountryModel, flag)
        await fileExist(paymentOptionPath, PaymentOptionModel, flag)
        await fileExist(payoutOptionPath, PayoutOptionModel, flag)
        await fileExist(csssPath, CsssModel, flag)
        await fileExist(versionPath, VersionModel, flag)
        await fileExist(emailTemplatePath, EmailTemplateModel, flag)
        await fileExist(notificationMessagesPath, NotificationMessagesModel, flag)
        await fileExist(banksPath, BanksModel, flag)
        await fileExist(cmsPath, CMSModel, flag)

        for (const adminPlayload of adminPlayloads) {
          await addNormalSeeds(adminPlayload, AdminModel, flag)
        }

        for (const userPlayload of systemUser) {
          await addUserSeed(userPlayload, UserModel, flag)
        }

        credentialPlayload.sPassword = bcrypt.hashSync(credentialPlayload.sPassword, salt)
        await addNormalSeeds(credentialPlayload, CredentialModel, flag)
        await addNormalSeeds(maintenancePayload, MaintenanceModel, flag)

        await reportFeeder(flag)

        if (flag) {
          await LeagueCategoryModel.deleteOne({ sKey: 'hiddenLeague' })
          await LeagueCategoryModel.create({
            sTitle: 'Hidden League',
            nPosition: 10,
            sKey: 'hiddenLeague',
            sRemark: 'This leagues will not be shown in front end',
            dCreatedAt: new Date()
          })
        } else {
          const leagueCategory = await LeagueCategoryModel.findOne({}).lean()
          if (!leagueCategory) {
            await LeagueCategoryModel.create({
              sTitle: 'Hidden League',
              nPosition: 10,
              sKey: 'hiddenLeague',
              sRemark: 'This leagues will not be shown in front end',
              dCreatedAt: new Date()
            })
          }
        }
        await updateSportScoreInfoLink()
        resolve()
      } catch (error) {
        handleCatchError(error)
      }
    })()
  })
}

async function fileExist(path, Model, flag) {
  fs.stat(path, async function(err, stat) {
    if (err == null) {
      await globeFeeder(path, Model, flag)
    } else if (err.code === 'ENOENT') {
      console.log(`File does not exist at this location ${scorePath}`)
    } else {
      throw new Error(err)
    }
  })
}

async function reportFeeder(flag) {
  try {
    if (flag) {
      await GeneralizeReportModel.deleteMany()
      await createReport('U')
      await createReport('B')
    } else {
      const data = await GeneralizeReportModel.find({}).lean()
      if (!data.length) {
        await createReport('U')
        await createReport('B')
      }
    }
    console.log('seeders executed successfully...')
  } catch (error) {
    throw new Error(error)
  }
}

async function addNormalSeeds (seed, Model, flag) {
  try {
    if (flag) {
      await Model.deleteMany(seed)
      // await Model.create(seed)
      const admin = new Model(seed)
      admin.sDepositToken = jwt.sign({ _id: (admin._id).toHexString() }, JWT_SECRET)
      await admin.save()
    } else {
      const data = await Model.findOne(seed).lean()
      if (!data) {
        // const admin = await Model.create(seed)
        const admin = new Model(seed)
        admin.sDepositToken = jwt.sign({ _id: (admin._id).toHexString() }, JWT_SECRET)
        await admin.save()
      }
    }
    console.log('addNormalSeeds', seed)
  } catch (error) {
    throw new Error(error)
  }
}

async function addUserSeed (systemUser, Model, flag) {
  let iUserId, eUserType
  try {
    if (flag) {
      await Model.deleteMany(systemUser)
      const user = new Model({ ...systemUser })
      const newToken = {
        sToken: jwt.sign({ _id: (user._id).toHexString(), eType: user.eType }, JWT_SECRET, { expiresIn: JWT_VALIDITY })
      }
      iUserId = user._id
      eUserType = user.eType
      user.aJwtTokens.push(newToken)
      const openAccount = await userBalanceServices.openAccount({ iUserId: user._id, sUsername: systemUser.sUsername, eType: user.eType })
      if (openAccount.isSuccess === false) {
        throw new Error('Something went wrong with opening account')
      }
      await PreferencesModel.create([{ iUserId: user._id }])
      const registerBonus = await commonRuleServices.findRule('RB')
      const refer = await userBalanceServices.referBonus({ iUserId: user._id, rule: registerBonus, sReferCode: user.sReferCode, sUserName: user.sUsername, eType: user.eType })
      if (refer.isSuccess === false) {
        throw new Error('Something went wrong with register bonus')
      }
      user.sReferCode = 'UYAS6J1A4H'
      user.sReferLink = (!['test', 'dev'].includes(process.env.NODE_ENV)) ? await genDynamicLinkV2('share', user.sReferCode) : 'https://google.com'
      const ePlatform = 'O'

      await user.save()
      const logData = { iUserId: user._id, ePlatform, eType: 'R', sDeviceToken: '8df4as9yaS489S4as', sIpAddress: '' }
      userAuthLogQueue.publish(logData)
      // await AuthLogsModel.create({ iUserId: user._id, ePlatform, eType: 'R', sDeviceToken: '8df4as9yaS489S4as', sIpAddress: '' })
    } else {
      const data = await Model.findOne(systemUser).lean()
      if (!data) {
        const user = new UserModel({ ...systemUser })
        const newToken = {
          sToken: jwt.sign({ _id: (user._id).toHexString(), eType: user.eType }, JWT_SECRET, { expiresIn: JWT_VALIDITY })
        }
        iUserId = user._id
        eUserType = user.eType
        user.aJwtTokens.push(newToken)
        const openAccount = await userBalanceServices.openAccount({ iUserId: user._id, sUsername: systemUser.sUsername, eType: user.eType })
        if (openAccount.isSuccess === false) {
          throw new Error('Something went wrong with opening account')
        }
        await PreferencesModel.create([{ iUserId: user._id }])
        const registerBonus = await commonRuleServices.findRule('RB')
        const refer = await userBalanceServices.referBonus({ iUserId: user._id, rule: registerBonus, sReferCode: user.sReferCode, sUserName: user.sUsername, eType: user.eType })
        if (refer.isSuccess === false) {
          throw new Error('Something went wrong with register bonus')
        }
        user.sReferCode = 'UYAS6J1A4H'
        user.sReferLink = (!['test', 'dev'].includes(process.env.NODE_ENV)) ? await genDynamicLinkV2('share', user.sReferCode) : 'https://google.com'
        const ePlatform = 'O'

        await user.save()
        const logData = { iUserId: user._id, ePlatform, eType: 'R', sDeviceToken: '8df4as9yaS489S4as', sIpAddress: '' }
        userAuthLogQueue.publish(logData)
        // await AuthLogsModel.create({ iUserId: user._id, ePlatform, eType: 'R', sDeviceToken: '8df4as9yaS489S4as', sIpAddress: '' })
      }
    }
    console.log('addNormalSeeds', systemUser)
  } catch (error) {
    if (iUserId && eUserType) await userBalanceServices.revertOpenedAccount({ iUserId, eType: eUserType })
    throw new Error(error)
  }
}

async function globeFeeder(sFilePath, Model, flag) {
  try {
    if (flag) {
      const feedData = fs.readFileSync(sFilePath)
      const parsedData = JSON.parse(feedData)
      await Model.deleteMany()
      await Model.insertMany(parsedData)
    } else {
      const feedData = fs.readFileSync(sFilePath)
      const parsedData = JSON.parse(feedData)
      const data = await Model.find({}).lean()
      if (!data.length) {
        await Model.insertMany(parsedData)
      }
    }
  } catch (error) {
    throw new Error(error)
  }
}

function giveData() {
  const arr = []
  let i = 0
  for (const sport of category) {
    arr[i] = {}
    arr[i].eCategory = sport
    i++
  }
  return arr
}
function appReportData() {
  const arr = []
  let i = 0
  for (const platform of appPlatform) {
    arr[i] = {}
    arr[i].ePlatform = platform
    i++
  }
  return arr
}

async function createReport(eType) {
  const report = new GeneralizeReportModel({ eType })
  const arr = giveData()
  const appArr = appReportData()
  report.aPlayed = arr
  report.aPlayReturn = arr
  report.aCashback = arr
  report.aCashbackReturn = arr
  report.aCreatorBonus = arr
  report.aCreatorBonusReturn = arr
  report.aTeams = arr
  report.aParticipants = arr
  report.aWins = arr
  report.aWinReturn = arr
  report.aPrivateLeague = arr
  report.aAppDownload = appArr
  await report.save()
}

async function updateSportScoreInfoLink() {
  try {
    const sports = await SportsModel.find({}, { sScoreInfoLink: 1 })
    for (const sport of sports) {
      sport.sScoreInfoLink = `${FRONTEND_HOST_URL}/score-card/`
      await sport.save()
    }
  } catch (error) {
    handleCatchError(error)
  }
}

function syncModelsUniqueIndexes() {
  SyncIndex(CredentialModel, 'Credential')
  SyncIndex(AdminModel, 'Admin')
  SyncIndex(CMSModel, 'CMS')
  SyncIndex(CommonRulesModel, 'Common Rules')
  SyncIndex(CountryModel, 'Country')
  SyncIndex(EmailTemplateModel, 'Email Template')
  SyncIndex(KYCModel, 'KYC')
  SyncIndex(MatchModel, 'Match')
  SyncIndex(FantasyPostModel, 'Fantasy Post')
  SyncIndex(PlayerRolesModel, 'Player Roles')
  SyncIndex(PreferencesModel, 'Preference')
  SyncIndex(LiveInningsModel, 'Live Innings')
  SyncIndex(SeasonModel, 'Season')
  SyncIndex(SeriesLeaderBoardModel, 'Series LeaderBoard')
  SyncIndex(SettingsModel, 'Settings')
  SyncIndex(TeamsModel, 'Teams')
  SyncIndex(UserModel, 'Users')
  SyncIndex(PlayerModel, 'Players')
  SyncIndex(BankDetailsModel, 'Bank Details')
  SyncIndex(StatisticsModel, 'Statistics')
}

function SyncIndex(Model, sName) {
  Model.syncIndexes().then(() => {
    console.log(`${sName} Model Indexes Synced`)
  }).catch((err) => {
    console.log(`${sName} Model Indexes Sync Error`, err)
  })
}

executeFeeder()
