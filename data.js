const enums = {
  category: ['CRICKET', 'FOOTBALL', 'KABADDI', 'BASEBALL', 'BASKETBALL'],
  cricketFormat: ['T10', 'T20', 'ODI', 'TEST', '100BALL', 'FIRSTCLASS'],
  format: ['T10', 'T20', 'ODI', 'BASEBALL', '100BALL', 'FOOTBALL', 'BASKETBALL', 'KABADDI', 'TEST', 'FIRSTCLASS'],
  role: ['BATS', 'BWL', 'ALLR', 'WK', 'IF', 'OF', 'P', 'CT', 'GK', 'DEF', 'MID', 'FWD', 'PG', 'SG', 'PF', 'SF', 'C', 'RAID'],
  platform: ['A', 'I', 'W', 'O', 'AD'], // A = Android, I = iOS, W = Web, O = Other, AD = Admin

  status: ['Y', 'N'],

  bankProvider: ['C'], // C = cashfree

  adminLogTypes: ['L', 'PC', 'RP'], // L = Login, PC = Password Change, RP = ResetPassword
  adminStatus: ['Y', 'B', 'D'],
  adminType: ['SUPER', 'SUB'],
  adminLogKeys: ['D', 'W', 'P', 'KYC', 'BD', 'SUB', 'AD', 'AW', 'PC', 'L', 'PB', 'M', 'ML', 'CR', 'S', 'MP', 'CF', 'SLB'], // D = DEPOSIT, W = WITHDRAW, P = PROFILE, BD = BANK DETAILS, SA = SUBADMIN, AD = ADMIN DEPOSIT, AW = ADMIN WITHDRAW, PC = PROMOCODE, L = LEAGUE, PB = PRIZE BREAKUP, M = MATCH, ML = MATCHLEAGUE, CR = COMMON RULE, S = SETTINGS, MP= MATCHPLAYER, CF = COMPLAINTS/FEEDBACK, SLB = SERIES LEADERBOARD

  adminPay: ['PAY'],

  bannerType: ['S', 'L'], // S = SCREEN, l = lINK,
  bannerScreen: ['D', 'S', 'CR', 'ST'], // D = DEPOSIT S = SHARE CR = CONTEST REDIRECT ST = STATIC
  bannerPlace: ['D', 'H'], // D = DEPOSIT H = HOME

  popupAdsType: ['I', 'E'], // I = INTERNAL, E = EXTERNAL
  popupAdsPlatform: ['ALL', 'W', 'A', 'I'], // I = IOS, A = ANDROID, W = WEB

  commonRule: ['RB', 'RCB', 'RR', 'DB', 'PLC', 'LCC', 'LCG'], // RB = REGISTER_BONUS, RCB = REFER_CODE_BONUS, RR = REGISTER_REFER, DB = DEPOSIT_BONUS, PLC = PRIVATE_LEAGUE_COMMISSION, LCC =LEAGUE_CREATOR_COMMISSION, LCG = LEAGUE_CREATOR_GST
  ruleType: ['C', 'B', 'D'], // C = CASH, B = BONUS, D = DEPOSIT

  kycStatus: ['P', 'A', 'R', 'N'], // P = Pending, A = Accepted, R = Rejected, N = Not uploaded
  bankStatus: ['P', 'A', 'R', 'N'], // P = Pending, A = Accepted, R = Rejected, N = Not uploaded

  leagueRankType: ['R', 'B', 'E'], // R = REAL_MONEY, B = BONUS, E = EXTRA

  matchStatus: ['P', 'U', 'L', 'CMP', 'CNCL', 'I'], // P = Pending, U = Upcoming, L = Live, CMP = Completed, CNCL = Cancel, I = Inreview
  matchTossWinnerAction: ['BAT', 'BOWLING'],
  matchProvider: ['SPORTSRADAR', 'CUSTOM', 'ENTITYSPORT', 'GOALSERVE'],

  notificationStatus: [0, 1],
  notificationTopic: ['All', 'Web', 'IOS', 'Android'],
  notificationMessageKeys: ['PLAY_RETURN', 'MATCH_TIPS', 'LINEUPS'],
  notificationPlatform: ['A', 'I', 'W', 'ALL'], // A = Android, I = iOS, W = Web, ALL = ALL

  authLogType: ['R', 'L', 'PC', 'RP'],

  userType: ['U', 'B', 'CB'],
  userGender: ['M', 'F', 'O'],
  socialType: ['G', 'F', 'A', 'T'],
  userStatus: ['Y', 'N', 'D'],

  otpType: ['E', 'M'], // Email | Mobile
  otpAuth: ['R', 'F', 'V', 'L'], // Register | ForgotPass | Verification | Login

  // paymentOptionsKey, paymentGetaways and withdrawPaymentGetaways all must be same ( except type ADMIN  )
  paymentOptionsKey: ['PAYTM', 'AMAZON', 'CASHFREE', 'CASHFREE_UPI'],
  paymentGetaways: ['PAYTM', 'ADMIN', 'CASHFREE', 'CASHFREE_UPI', 'JUSPAY'],
  payoutOptionKey: ['PAYTM', 'AMAZON', 'CASHFREE'],
  withdrawPaymentGetaways: ['ADMIN', 'PAYTM', 'AMAZON', 'CASHFREE'],

  payoutOptionType: ['INSTANT', 'STD'],

  transactionLogType: ['D', 'W'], // D = Deposit , W = Withdraw

  paymentStatus: ['P', 'S', 'C', 'R'], // P = pending, S = success, C = cancelled, R = refunded
  payoutStatus: ['P', 'S', 'C', 'R', 'I'], // P = pending, S = success, C = cancelled, R = refunded, I = Initiated

  tdsStatus: ['P', 'A'], // pending active

  transactionType: ['Bonus', 'Refer-Bonus', 'Deposit', 'Withdraw', 'Win', 'Play', 'Bonus-Expire', 'Play-Return', 'Win-Return', 'Opening', 'Creator-Bonus', 'TDS', 'Withdraw-Return', 'Cashback-Contest', 'Cashback-Return', 'Creator-Bonus-Return', 'Loyalty-Point', 'KYC-Bonus', 'GST', 'Loyalty-Point-Return'],
  categoryTransactionType: ['Win', 'Play', 'Play-Return', 'Win-Return', 'Creator-Bonus', 'TDS', 'Cashback-Contest', 'Cashback-Return', 'Creator-Bonus-Return', 'Loyalty-Point', 'GST', 'KYC-Bonus', 'Loyalty-Point-Return'],
  userLeagueTransactionType: ['Win', 'Play', 'KYC-Bonus'],

  passbookType: ['Dr', 'Cr'],
  passbookStatus: ['R', 'CMP', 'CNCL'], // CMP = Complete  R = REFUND  CNCL = CANCEL

  seriesLBCategoriesTemplateType: ['CONTEST_JOIN', 'PRIZE_WON', 'LOYALTY_POINTS', 'LOYALTY_DEPOSIT_POINTS'],
  reportsKeys: ['TU', 'RU', 'LU', 'TUT', 'W', 'BE', 'UB', 'TDS'],
  filterReportKeys: ['USER_REPORT', 'USERTEAM_REPORT', 'PARTICIPANT_REPORT', 'WIN_REPORT', 'WIN_RETURN_REPORT', 'PRIVATE_LEAGUE_REPORT', 'PLAY_REPORT', 'PLAY_RETURN_REPORT', 'CASHBACK_REPORT', 'CASHBACK_RETURN_REPORT', 'CREATOR_BONUS_REPORT', 'CREATOR_BONUS_RETURN_REPORT', 'APP_DOWNLOAD_REPORT'],
  sportsReportsKeys: ['TP', 'TT', 'TB', 'UT', 'LP', 'TW', 'TWR', 'CNCLL', 'CMPL', 'CL', 'PR', 'PL', 'CC', 'CR', 'CB', 'CBR', 'AD'],
  allReportKeys: ['TU', 'RU', 'LU', 'TUT', 'W', 'BE', 'UB', 'TP', 'TT', 'TB', 'UT', 'LP', 'TW', 'CNCLL', 'CMPL', 'CL', 'PR', 'PL', 'CC', 'CR', 'CB'],

  dashboardKeys: ['RUDW', 'RUMW', 'RUYW', 'UTDW', 'UTMW', 'UTYW', 'DDW', 'DMW', 'DYW', 'WDW', 'WMW', 'WYW'],

  seriesStatus: ['P', 'L', 'CMP'],

  adminPermissionType: ['R', 'W', 'N'], // R = READ, W = WRITE, N = NONE - Access Rights
  adminPermission: [
    'SUBADMIN',
    'PERMISSION',
    'ADMIN_ROLE',
    'BANNER',
    'BOT_LOG',
    'CMS',
    'RULE',
    'COMPLAINT',
    'DASHBOARD',
    'EMAIL_TEMPLATES',
    'KYC',
    'LEAGUE',
    'MAINTENANCE',
    'MATCH',
    'MATCHLEAGUE',
    'MATCHPLAYER',
    'NOTIFICATION',
    'PUSHNOTIFICATION',
    'OFFER',
    'PASSBOOK',
    'SYSTEM_USERS',
    'PAYMENT_OPTION',
    'PAYOUT_OPTION',
    'PLAYER',
    'ROLES',
    'POPUP_ADS',
    'PREFERENCES',
    'PROMO',
    'SEASON',
    'SCORE_POINT',
    'SERIES_LEADERBOARD',
    'SETTING',
    'SPORT',
    'TEAM',
    'BANKDETAILS',
    'USERS',
    'LEADERSHIP_BOARD',
    'STATISTICS',
    'BALANCE',
    'DEPOSIT',
    'USERLEAGUE',
    'TDS',
    'USERTEAM',
    'WITHDRAW',
    'VERSION',
    'REPORT'
  ],
  supportedLanguage: ['English', 'Hindi'],
  promocodeTypes: ['DEPOSIT', 'MATCH'],
  promoOffer: ['FIRST_DEPOSIT'],
  complainStatus: ['P', 'I', 'D', 'R'], // Pending In-Progress Declined Resolved
  complaintsStatus: ['P', 'I', 'D', 'R'], // Pending, In-Progress, Declined, Resolved
  issueType: ['C', 'F', 'CS'], // C = Complaints, F = Feedbacks, CS = Contact Us
  settingKeys: ['BG', 'IMG'],
  cssTypes: ['COMMON', 'CONDITION'],
  versionType: ['A', 'I', 'AW'], // A = Android, I = iOS, AW = Android Web
  rewardOn: ['REGISTER', 'FIRST_DEPOSIT', 'FIRST_LEAGUE_JOIN', 'FIRST_PAID_LEAGUE_JOIN'],
  botType: ['N', 'CP'], // N = Normal Bot, CP = Copy Bot,
  totalCountKeys: ['UC', 'SUC', 'TXC', 'DC', 'WC', 'MC', 'PC', 'TC'], // UC = users count, SUC = system users count, TXC = transaction count, DC = deposit count, WC = withdrawl count, MC = match count, PC = player count, TC = team count
  contestKeys: ['PCF', 'PCS', 'PUBC'], // ['PCF' = private contest fees, 'PCS' = Public contest size, 'PUBC' = Public contest fees

  copyTeamTypes: ['SAME', 'ROTATE', 'RANDOM'],

  userTypeForJoinLeague: ['U', 'B', 'CB', 'CMB'], // U = USER, B = BOT, CB = COPY_BOT, CMB = COMBINATION_BOT
  botLogsTypeForJoinLeague: ['U', 'B', 'CB', 'CMB', 'SCB'], // U = USER, B = BOT, CB = COPY_BOT, CMB = COMBINATION_BOT, SCB = Swapped Copy Bots with Combination Bots

  smsProvider: ['MSG91'],

  eDecision: ['fielding', 'batting'], // { fielding: 'fielding decision', batting: 'Batting decision' }
  eBattingPosition: ['s', 'ns'], // s - striker , ns - non striker
  eDismissal: ['caught', 'bowled', 'lbw', 'runout', 'hitwicket', 'stumped', 'retiredout', 'retired'],
  eBowlingPosition: ['ab', 'lb'], // ab - 'active bowler', lb - 'last bowler'
  apiLogType: ['SCOREPOINT', 'SCORECARD', 'LINEUP', 'MATCHES'],
  appPlatform: ['A', 'I'], // A - Android  I- IOS

  imageMimeTypes: ['image/png', 'image/jpeg', 'image/gif'],
  imageExtensions: ['jpeg', 'jpg', 'png', 'gif'],
  imageFormat: [{ extension: 'jpeg', type: 'image/jpeg' }, { extension: 'jpg', type: 'image/jpeg' }, { extension: 'png', type: 'image/png' }, { extension: 'gif', type: 'image/gif' }, { extension: 'svg', type: 'image/svg+xml' }, { extension: 'heic', type: 'image/heic' }, { extension: 'heif', type: 'image/heif' }],
  editCMBPlayers: ['P', 'IP', 'CMP', 'F'], // P-Pending, IP-In Process, CMP-Completed, F-Failed

  existingSocialType: ['T'],

  matchLeagueReportStatus: ['N', 'P', 'S'] // N - Not generated, P - In process , S - Success
}

module.exports = enums
