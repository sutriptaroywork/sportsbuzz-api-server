const test = {
  DEPLOY_HOST_URL: process.env.DEPLOY_HOST_URL,
  PORT: process.env.PORT || 1338,
  FANTASY_NODE_URL: process.env.FANTASY_NODE_URL || 'http://localhost:1339',
  SUPERUSER_ID: process.env.SUPERUSER_ID || '625429308cfe9babd81f18a7',

  USERS_DB_URL: process.env.USERS_DB_URL || 'mongodb://localhost:27017/fantasy_users',
  LEAGUES_DB_URL: process.env.LEAGUES_DB_URL || 'mongodb://localhost:27017/fantasy_leagues',
  NOTIFICATION_DB_URL: process.env.NOTIFICATION_DB_URL || 'mongodb://localhost:27017/fantasy_notifications',
  STATISTICS_DB_URL: process.env.STATISTICS_DB_URL || 'mongodb://localhost:27017/fantasy_statistics',
  BANNERS_DB_URL: process.env.BANNERS_DB_URL || 'mongodb://localhost:27017/fantasy_banners',
  COMPLAINS_DB_URL: process.env.COMPLAINS_DB_URL || 'mongodb://localhost:27017/fantasy_complains',
  FANTASYTIPS_DB_URL: process.env.FANTASYTIPS_DB_URL || 'mongodb://localhost:27017/fantasy_tips',
  PROMOCODES_DB_URL: process.env.PROMOCODES_DB_URL || 'mongodb://localhost:27017/fantasy_promocodes',
  ADMINS_DB_URL: process.env.ADMINS_DB_URL || 'mongodb://localhost:27017/fantasy_admins',
  GEO_DB_URL: process.env.GEO_DB_URL || 'mongodb://localhost:27017/fantasy_geo',
  GAME_DB_URL: process.env.GAME_DB_URL || 'mongodb://localhost:27017/fantasy_game',
  MATCH_DB_URL: process.env.MATCH_DB_URL || 'mongodb://localhost:27017/fantasy_match',
  FANTASY_TEAM_DB_URL: process.env.FANTASY_TEAM_DB_URL || 'mongodb://localhost:27017/fantasy_teams',
  REPORT_DB_URL: process.env.REPORT_DB_URL || 'mongodb://localhost:27017/fantasy_report',
  SERIES_LB_DB_URL: process.env.SERIES_LB_DB_URL || 'mongodb://localhost:27017/fantasy_seriesLB',

  FRONTEND_HOST_URL: process.env.FRONTEND_HOST_URL || 'https://appstag.fantasywl.tk',
  DB_SQL_NAME: process.env.TEST_DB_SQL_NAME || 'fantasy_test',
  DB_SQL_USER: process.env.TEST_DB_SQL_USER || 'root',
  DB_SQL_PASSWORD: process.env.TEST_DB_SQL_PASSWORD || 'root',
  DB_SQL_HOST: process.env.TEST_DB_SQL_HOST || '127.0.0.1',
  DB_SQL_PORT: process.env.TEST_DB_SQL_PORT || 3306,
  DB_SQL_HOST_REPLICA: process.env.TEST_DB_SQL_HOST_REPLICA || process.env.TEST_DB_SQL_HOST || '127.0.0.1',
  DB_SQL_DIALECT: process.env.TEST_DB_SQL_DIALECT || 'mysql',
  JWT_VALIDITY: process.env.JWT_VALIDITY || '90d',
  JWT_SECRET: process.env.JWT_SECRET || 'aAbBcC@test_123',
  MAIL_TRANSPORTER: {
    service: process.env.SMTP_SERVICES || 'gmail',
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    auth: {
      user: process.env.SMTP_USERNAME || 'fwl47576@gmail.com',
      pass: process.env.SMTP_PASSWORD || 'fantasy@321wl'
    },
    secure: false
  },
  SPORTSRADAR_API_KEY: process.env.SPORTSRADAR_API_KEY,
  ENTITYSPORT_BASEBALL_API_KEY: process.env.ENTITYSPORT_BASEBALL_API_KEY,
  ENTITYSPORT_CRICKET_API_KEY: process.env.ENTITYSPORT_CRICKET_API_KEY || 'ec471071441bb2ac538a0ff901abd249',
  ENTITYSPORT_SOCCER_API_KEY: process.env.ENTITYSPORT_SOCCER_API_KEY,
  FOOTBALL_API_KEY: process.env.FOOTBALL_API_KEY,
  NBA_API_KEY: process.env.NBA_API_KEY,
  ENTITYSPORT_KABADDI_API_KEY: process.env.ENTITYSPORT_KABADDI_API_KEY,
  ENTITYSPORT_BASKETBALL_API_KEY: process.env.ENTITYSPORT_BASKETBALL_API_KEY || 'b602a891bc688fdc6551fee946454605',
  SMTP_FROM: process.env.SMTP_FROM || 'no-reply@fantasy.com',
  LOGIN_HARD_LIMIT: 5, // 0 = unlimited
  LOGIN_HARD_LIMIT_ADMIN: 5, // 0 = unlimited
  EMAIL_TEMPLATE_PATH: 'views/email_templates/',
  SCORECARD_TEMPLATE_PATH: 'views/',

  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY || 'your aws access key',
  AWS_SECRET_KEY: process.env.AWS_SECRET_KEY || 'your aws secretAccessKey',
  AWS_KYC_ACCESS_KEY: process.env.AWS_KYC_ACCESS_KEY || 'your aws kyc access key',
  AWS_KYC_SECRET_KEY: process.env.AWS_KYC_SECRET_KEY || 'your aws kyc secretAccessKey',
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'yudiz-fantasy-media',
  S3_BUCKET_URL: process.env.S3_BUCKET_URL || 'https://yudiz-fantasy-media.s3.ap-south-1.amazonaws.com/',
  S3_BUCKET_KYC_URL: process.env.S3_BUCKET_KYC_URL || 'https://fantasy-kyc.s3.ap-south-1.amazonaws.com/',
  S3_KYC_BUCKET_NAME: process.env.S3_KYC_BUCKET_NAME || 'fantasy-kyc',
  FIREBASE_WEB_API_KEY: process.env.FIREBASE_WEB_API_KEY || 'your firebase key',

  CASHFREE_URL: process.env.CASHFREE_URL,
  CASHFREE_APPID: process.env.CASHFREE_APPID,
  CASHFREE_SECRETKEY: process.env.CASHFREE_SECRETKEY,
  CASHFREE_RETURN_URL: process.env.CASHFREE_RETURN_URL || 'https://www.google.com/',
  CASHFREE_STABLE_URL: process.env.CASHFREE_STABLE_URL || 'https://sandbox.cashfree.com/pg',

  FUNCTIONALITY: {
    USER_KYC_VISIBLE: true
  },
  GOOGLE_CLIENT_ID_W: process.env.GOOGLE_CLIENT_ID_W || '218538323308-p1bf5od94pbdfna1rstq3s1kea8gpgfr.apps.googleusercontent.com',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: process.env.REDIS_PORT || 6379,
  CONTACT_EMAIL: '',
  CACHE_1: 10, // 10 seconds
  CACHE_2: 60, // 1 minute
  CACHE_3: 3600, // 1 hour
  CACHE_4: 86400, // 1 day
  CACHE_5: 864000, // 10 days
  CACHE_6: 21600, // 6 Hours
  CACHE_7: 300, // 5 minute
  CACHE_8: 600, // 10 minute
  CACHE_9: 5, // 5 seconds,
  CACHE_10: 1800, // 30 minute
  PUBLIC_EMAIL_BLOCK: true,
  PROCESS_PAYMENT_RATE_LIMIT: process.env.PROCESS_PAYMENT_RATE_LIMIT || 10,
  CASHFREE_BASEURL: process.env.CASHFREE_BASEURL,
  CASHFREE_CLIENTID: process.env.CASHFREE_CLIENTID,
  CASHFREE_CLIENTSECRET: process.env.CASHFREE_CLIENTSECRET,
  CASHFREE_AUTHORIZE_PATH: 'payout/v1/authorize',
  CASHFREE_VERIFY_PATH: 'payout/v1/verifyToken',
  CASHFREE_ADDBENEFICIARY_PATH: 'payout/v1/addBeneficiary',
  CASHFREE_GETBALANCE_PATH: 'payout/v1/getBalance',
  CASHFREE_GETBENEFICIARY_PATH: 'payout/v1/getBeneficiary',
  CASHFREE_TRANSFER_PATH: 'payout/v1/requestTransfer',
  CASHFREE_TRANSFER_STATUS_PATH: 'payout/v1.1/getTransferStatus',
  CASHFREE_REMOVEBENEFICIARY_PATH: 'payout/v1/removeBeneficiary',
  CASHFREE_GETBENEFICIARYID_PATH: 'payout/v1/getBeneId',
  AMAZONPAY_MERCHANT_ID: process.env.AMAZONPAY_MERCHANT_ID || 'your amazon pay merchant key',
  AMAZONPAY_ACCESS_KEY: process.env.AMAZONPAY_ACCESS_KEY || 'your amazon pay access key',
  AMAZONPAY_SECRET_KEY: process.env.AMAZONPAY_SECRET_KEY || 'your amazon pay secret key',

  STABLE_CASHFREE_BASEURL: process.env.STABLE_CASHFREE_BASEURL || 'https://sandbox.cashfree.com/pg',

  username: process.env.TEST_DB_SQL_USER || 'root',
  password: process.env.TEST_DB_SQL_PASSWORD || 'root',
  database: process.env.TEST_DB_SQL_NAME || 'fantasy_test',
  host: process.env.TEST_DB_SQL_HOST || '127.0.0.1',
  port: process.env.TEST_DB_SQL_PORT || 3306,
  dialect: process.env.TEST_DB_SQL_DIALECT || 'mysql',

  PRIVATE_KEY: `-----BEGIN RSA PRIVATE KEY-----
MIICXQIBAAKBgQDUH3YJ9lSOPsof/8qyHKPG1kuAQXNLEWE4bd+VLBgbEitOwm9+
TLpzcnzweaiVfr9NIoaEydxP4ZlJF/h/7fhOuazSQRld429/k+ZzyfmpDkGIPbgK
OndPdy0AuWZoiEMXKQvSbtmbCN0isWlquW1vU7FnSJi4Dm1LbgpnL6FLgwIDAQAB
AoGBAIbHaq/PxVAQU0tbssXS7rkDJjva2k/DPjuljF9zAeoJdFz5q+/a/skl4H7H
PjemrhRrsH8k54gV9th7k5htcswhjs+beqAAS2gbkfM2gyE1py3eMW+9o7B+iurd
anml/SQburJEOqHnavIH33IfqDL21ikNo++3CIfMobKcGbhRAkEA/MrF8V4JEhWH
RYp5dl4Ykeu6+yP71Yg1ZWAqRRBzU+Mvei4I2zO/wjYiBmSY/1R++bBRLV+uybfO
eAXzq49xSQJBANbQkaSTcQfMxXB/YmADBWSxzNuxeUqhkKvUlmrC9r6tMcPDjgkw
I02bPsrkZVWtb1JUvwF2sK9j1ZFsmwXXYmsCQC3BLe6wDIg/aUqG89Ee2ueeeSt3
qd9OVgvRShVSEu2+ExvUNTonta+bSLFLh/2+93SOG0NRLDvKjw5eVWpZ/jECQQC1
bWxEun5RXyI2NHAqtQJ+HCjwOAFABhrA9Yig3M83FeIc+/HfUrfOWNr800++v/9w
YsD7hHoPd9sturNniJTHAkAY27gpCsXkQ4mBYNMmyW7SvP0u7D4J39CpM1vLBInM
SSMOg2rBkjg7SFp1Y+xtRNv6V/fYLQq2ohILPu1KkHIf
-----END RSA PRIVATE KEY-----`,
  PUBLIC_KEY: `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDUH3YJ9lSOPsof/8qyHKPG1kuA
QXNLEWE4bd+VLBgbEitOwm9+TLpzcnzweaiVfr9NIoaEydxP4ZlJF/h/7fhOuazS
QRld429/k+ZzyfmpDkGIPbgKOndPdy0AuWZoiEMXKQvSbtmbCN0isWlquW1vU7Fn
SJi4Dm1LbgpnL6FLgwIDAQAB
-----END PUBLIC KEY-----`,
  bAllowDiskUse: process.env.MONGODB_ALLOW_DISK_USE || true,
  s3PriceDistributionLog: process.env.S3_PRICE_DISTRIBUTION_PATH || 'priceDistributionLogs/',
  s3UserTeams: process.env.S3_USERTEAMS_PATH || 'userteams/',
  s3Banners: process.env.S3_BANNERS_PATH || 'banners/',
  s3LeagueCategories: process.env.S3_LEAGUE_CATEGORIES_PATH || 'leagueCategories/',
  s3Complain: process.env.S3_COMPLAINS_PATH || 'complain/',
  s3Complaint: process.env.S3_COMPLAINTS_PATH || 'complaint/',
  s3EmailTemplates: process.env.S3_EMAIL_TEMPLATES_PATH || 'email-templates/',
  s3KycPan: process.env.S3_KYC_PAN_PATH || 'kyc/pan/',
  s3KycAadhaar: process.env.S3_KYC_AADHAAR_PATH || 'kyc/aadhaar/',
  s3KycBankDoc: process.env.S3_KYC_BANK_DOC_PATH || 'kyc/bank/',
  s3Leagues: process.env.S3_LEAGUES_PATH || 'leagues/',
  s3MatchPlayers: process.env.S3_MATCHPLAYERS_PATH || 'match-players/',
  s3Offer: process.env.S3_OFFERS_PATH || 'offer/',
  s3PaymentOption: process.env.S3_PAYMENT_OPTIONS_PATH || 'payment-option/',
  s3PayoutOption: process.env.S3_PAYOUT_OPTIONS_PATH || 'payout-option/',
  s3Players: process.env.S3_PLAYERS_PATH || 'players/',
  s3PopupAds: process.env.S3_POPUP_ADS_PATH || 'popupAds/',
  s3SeriesCategories: process.env.S3_SERIES_CATEGORIES_PATH || 'seriesCategories/',
  s3SeriesLBCategoriesTemplate: process.env.S3_SERIESLB_CATEGORIES_TEMPLATES_PATH || 'seriesLBCategoriesTemplate/',
  s3SideBackground: process.env.S3_SIDE_BACKGROUND_PATH || 'side-background/',
  s3Teams: process.env.S3_TEAMS_PATH || 'teams/',
  s3UserProfile: process.env.S3_USER_PROFILE_PATH || 'Users/profile',
  s3MatchLeagueReport: process.env.S3_USER_PROFILE_PATH || 'report/matchLeague/',
  s3TransactionReport: process.env.S3_TRANSACTION_REPORT_PATH || 'report/transaction/',

  MSG91_TEMPLATE_ID: process.env.MSG91_TEMPLATE_ID,
  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY,
  MSG91_FLOW_ID: process.env.MSG91_FLOW_ID,
  MSG91_SENDER_ID: process.env.MSG91_SENDER_ID,

  OTP_PROVIDER: process.env.OTP_PROVIDER,
  OTP_LENGTH: process.env.OTP_LENGTH || 6,
  DEFAULT_OTP: 123456,
  MAX_OTP_RETRIES: 5,
  OTP_EXPIRY_TIME: 1800,

  S3_BUCKET_TEAM_THUMB_URL_PATH: process.env.S3_BUCKET_TEAM_THUMB_URL_PATH || 'team/thumbUrl/',
  S3_BUCKET_PLAYER_THUMB_URL_PATH: process.env.S3_BUCKET_PLAYER_THUMB_URL_PATH || 'player/thumbUrl/',
  CASHFREE_MAIL_DEFAULT_ACCOUNT: process.env.CASHFREE_MAIL_DEFAULT_ACCOUNT || 'test@cashfree.com',

  ALLOW_BANK_UPDATE: (process.env.ALLOW_BANK_UPDATE === 'true') ? true : false || true, // this flag is for admin allow to user to update bank details or not.
  TRIAL_USER_NUMBER: process.env.TRIAL_USER_NUMBER || '9090909090',
  SB_OPS_TEAM_USER_NUMBER: process.env.SB_OPS_TEAM_USER_NUMBER || '9354132387',
  TEST_USER_NUMBER: process.env.TEST_USER_NUMBER || '9191919191',
  TEST_USER_NUMBER_2: process.env.TEST_USER_NUMBER_2 || '9717416639',

  GAME_DB_POOLSIZE: process.env.GAME_DB_POOLSIZE || 10,
  MATCH_DB_POOLSIZE: process.env.MATCH_DB_POOLSIZE || 10,
  FANTASY_TEAM_DB_POOLSIZE: process.env.FANTASY_TEAM_DB_POOLSIZE || 10,
  LEAGUES_DB_POOLSIZE: process.env.LEAGUES_DB_POOLSIZE || 10,
  ADMINS_DB_POOLSIZE: process.env.ADMINS_DB_POOLSIZE || 10,
  SERIES_LB_DB_POOLSIZE: process.env.SERIES_LB_DB_POOLSIZE || 10,
  USERS_DB_POOLSIZE: process.env.USERS_DB_POOLSIZE || 10,
  STATISTICS_DB_POOLSIZE: process.env.STATISTICS_DB_POOLSIZE || 10,
  BANNERS_DB_POOLSIZE: process.env.BANNERS_DB_POOLSIZE || 10,
  COMPLAINS_DB_POOLSIZE: process.env.COMPLAINS_DB_POOLSIZE || 10,
  FANTASYTIPS_DB_POOLSIZE: process.env.FANTASYTIPS_DB_POOLSIZE || 10,
  PROMOCODES_DB_POOLSIZE: process.env.PROMOCODES_DB_POOLSIZE || 10,
  GEO_DB_POOLSIZE: process.env.GEO_DB_POOLSIZE || 10,
  NOTIFICATION_DB_POOLSIZE: process.env.NOTIFICATION_DB_POOLSIZE || 10,
  REPORT_DB_POOLSIZE: process.env.REPORT_DB_POOLSIZE || 10,

  DB_SQL_MIN_POOLSIZE: process.env.DB_SQL_MIN_POOLSIZE || 10,
  DB_SQL_MAX_POOLSIZE: process.env.DB_SQL_MAX_POOLSIZE || 50,
  MEGA_CONTEST_AMOUNT_LIMIT_CRICKET: process.env.MEGA_CONTEST_AMOUNT_LIMIT_CRICKET || 10000,
  MEGA_CONTEST_AMOUNT_LIMIT_FOOTBALL: process.env.MEGA_CONTEST_AMOUNT_LIMIT_FOOTBALL || 2500,
  MEGA_CONTEST_ENTRY_LIMIT: process.env.MEGA_CONTEST_ENTRY_LIMIT || 50,
  MEGA_CONTEST_AMOUNT_LIMIT: 10000,

  EMAIL_SUBJECT: process.env.EMAIL_SUBJECT || 'Match Reports',
  RECEIVER_EMAIL: process.env.RECEIVER_EMAIL || 'anmol.chaudhary@technoagile.io',
  IDFY_API_KEY: process.env.IDFY_API_KEY || '3718d5e4-47ad-7665-71f8-3d81f2156342',
  IDFY_ACCOUNT_ID: process.env.IDFY_ACCOUNT_ID || '56e2e1c397aa/12244132-1ttd-4dee-g27w-1e6020b4b426',
  IDFY_BASE_URL: process.env.IDFY_BASE_URL || 'https://eve.idfy.com/v3',

  APPSFLYER_TOKEN: process.env.APPSFLYER_TOKEN || 'Token',
  APPSFLYER_ANDROID_APPID: process.env.APPSFLYER_ANDROID_APPID || 'com.sportsbuzz11.fantasy',
  APPSFLYER_IOS_APPID: process.env.APPSFLYER_IOS_APPID || 'id6443443913',
  APPSFLYER_REGISTER_EVENT: process.env.APPSFLYER_REGISTER_EVENT || 'af_complete_registration',

  AFFILIATE_DASHBOARD_URL: process.env.AFFILIATE_DASHBOARD_URL || 'http://3.108.78.128:8080/dashboard-backend-1',
  ROUTE_AUTH_TOKEN: process.env.ROUTE_AUTH_TOKEN,

  TRANSACTION_LOG_BULK_INSERT_SIZE: Number(process.env.TRANSACTION_LOG_BULK_INSERT_SIZE) || 3,

  POD_ENV: process.env.POD_ENV || 'node-backend',

  // Internal Services
  USER_KYC_SERVICE_BASE_URL: process.env.USER_KYC_SERVICE_BASE_URL,
  SB11_BACKEND_MS_NOTIFICATION_SERVICE: process.env.SB11_BACKEND_MS_NOTIFICATION_SERVICE
}

module.exports = test
