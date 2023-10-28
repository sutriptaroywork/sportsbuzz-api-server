const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { ReportDBConnect } = require('../../database/mongoose')
const { paymentGetaways, withdrawPaymentGetaways, platform, category, userType } = require('../../data')

const GeneralizeReports = new Schema({
  oTotalUser: {
    nTotalUsers: { type: Number, default: 0 },
    nTotalEmailVerifiedUsers: { type: Number, default: 0 },
    nTotalPhoneVerifiedUsers: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  },
  oRegisterUser: {
    nToday: { type: Number, default: 0 },
    nYesterday: { type: Number, default: 0 },
    nLastWeek: { type: Number, default: 0 },
    nLastMonth: { type: Number, default: 0 },
    nLastYear: { type: Number, default: 0 },
    aPlatformWiseUser: [{
      eTitle: { type: String, enum: platform, default: 'O' },
      nValue: { type: Number, default: 0 }
    }],
    dUpdatedAt: { type: Date }
  },
  oLoginUser: {
    nToday: { type: Number, default: 0 },
    nYesterday: { type: Number, default: 0 },
    nLastWeek: { type: Number, default: 0 },
    nLastMonth: { type: Number, default: 0 },
    nLastYear: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  },
  oDeposit: {
    nTotalWinnings: { type: Number, default: 0 },
    nTotalDeposits: { type: Number, default: 0 },
    nTotalPendingDeposits: { type: Number, default: 0 },
    nTotalSuccessDeposits: { type: Number, default: 0 },
    nTotalCancelledDeposits: { type: Number, default: 0 },
    nTotalRejectedDeposits: { type: Number, default: 0 },
    aDeposits: [{
      eTitle: { type: String, enum: paymentGetaways, default: 'CASHFREE' },
      nValue: { type: Number, default: 0 }
    }],
    dUpdatedAt: { type: Date }
  },
  oWithdraw: {
    aSuccessWithdrawals: [{
      eTitle: { type: String, enum: withdrawPaymentGetaways, default: 'ADMIN' },
      nValue: { type: Number, default: 0 }
    }],
    aPendingWithdrawals: [{
      eTitle: { type: String, enum: withdrawPaymentGetaways, default: 'ADMIN' },
      nValue: { type: Number, default: 0 }
    }],
    aInitiatedWithdrawals: [{
      eTitle: { type: String, enum: withdrawPaymentGetaways, default: 'ADMIN' },
      nValue: { type: Number, default: 0 }
    }],
    aCancelledWithdrawals: [{
      eTitle: { type: String, enum: withdrawPaymentGetaways, default: 'ADMIN' },
      nValue: { type: Number, default: 0 }
    }],
    aRejectedWithdrawals: [{
      eTitle: { type: String, enum: withdrawPaymentGetaways, default: 'ADMIN' },
      nValue: { type: Number, default: 0 }
    }],
    nInstantWithdrawals: { type: Number, default: 0 },
    nTotalWithdrawals: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  },
  oTds: {
    nTotalTds: { type: Number, default: 0 },
    nTotalActiveTds: { type: Number, default: 0 },
    nTotalPendingTds: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  },
  aTeams: [{
    eCategory: { type: String, enum: category, default: 'CRICKET' },
    nTotal: { type: Number, default: 0 },
    nToday: { type: Number, default: 0 },
    nYesterday: { type: Number, default: 0 },
    nLastWeek: { type: Number, default: 0 },
    nLastMonth: { type: Number, default: 0 },
    nLastYear: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  }],
  aParticipants: [{
    eCategory: { type: String, enum: category, default: 'CRICKET' },
    nTotal: { type: Number, default: 0 },
    nToday: { type: Number, default: 0 },
    nYesterday: { type: Number, default: 0 },
    nLastWeek: { type: Number, default: 0 },
    nLastMonth: { type: Number, default: 0 },
    nLastYear: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  }],
  aWins: [{
    eCategory: { type: String, enum: category, default: 'CRICKET' },
    nTotalCash: { type: Number, default: 0 },
    nTotalBonus: { type: Number, default: 0 },
    nTodayCash: { type: Number, default: 0 },
    nTodayBonus: { type: Number, default: 0 },
    nYesterCash: { type: Number, default: 0 },
    nYesterBonus: { type: Number, default: 0 },
    nWeekCash: { type: Number, default: 0 },
    nWeekBonus: { type: Number, default: 0 },
    nMonthCash: { type: Number, default: 0 },
    nMonthBonus: { type: Number, default: 0 },
    nYearCash: { type: Number, default: 0 },
    nYearBonus: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  }],
  aWinReturn: [{
    eCategory: { type: String, enum: category, default: 'CRICKET' },
    nTotalCash: { type: Number, default: 0 },
    nTotalBonus: { type: Number, default: 0 },
    nTodayCash: { type: Number, default: 0 },
    nTodayBonus: { type: Number, default: 0 },
    nYesterCash: { type: Number, default: 0 },
    nYesterBonus: { type: Number, default: 0 },
    nWeekCash: { type: Number, default: 0 },
    nWeekBonus: { type: Number, default: 0 },
    nMonthCash: { type: Number, default: 0 },
    nMonthBonus: { type: Number, default: 0 },
    nYearCash: { type: Number, default: 0 },
    nYearBonus: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  }],
  aPrivateLeague: [{
    eCategory: { type: String, enum: category, default: 'CRICKET' },
    oCreated: {
      nTotal: { type: Number, default: 0 },
      nToday: { type: Number, default: 0 },
      nYesterday: { type: Number, default: 0 },
      nLastWeek: { type: Number, default: 0 },
      nLastMonth: { type: Number, default: 0 },
      nLastYear: { type: Number, default: 0 },
      dUpdatedAt: { type: Date }
    },
    oCancelled: {
      nTotal: { type: Number, default: 0 },
      nToday: { type: Number, default: 0 },
      nYesterday: { type: Number, default: 0 },
      nLastWeek: { type: Number, default: 0 },
      nLastMonth: { type: Number, default: 0 },
      nLastYear: { type: Number, default: 0 },
      dUpdatedAt: { type: Date }
    },
    oCompleted: {
      nTotal: { type: Number, default: 0 },
      nToday: { type: Number, default: 0 },
      nYesterday: { type: Number, default: 0 },
      nLastWeek: { type: Number, default: 0 },
      nLastMonth: { type: Number, default: 0 },
      nLastYear: { type: Number, default: 0 },
      dUpdatedAt: { type: Date }
    }
  }],
  oBonusExpire: {
    nTotal: { type: Number, default: 0 },
    nToday: { type: Number, default: 0 },
    nYesterday: { type: Number, default: 0 },
    nLastWeek: { type: Number, default: 0 },
    nLastMonth: { type: Number, default: 0 },
    nLastYear: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  },
  oUserBonus: {
    nTotal: { type: Number, default: 0 },
    nToday: { type: Number, default: 0 },
    nYesterday: { type: Number, default: 0 },
    nLastWeek: { type: Number, default: 0 },
    nLastMonth: { type: Number, default: 0 },
    nLastYear: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  },
  aPlayReturn: [{
    eCategory: { type: String, enum: category, default: 'CRICKET' },
    nTotalCash: { type: Number, default: 0 },
    nTotalBonus: { type: Number, default: 0 },
    nTodayCash: { type: Number, default: 0 },
    nTodayBonus: { type: Number, default: 0 },
    nYesterCash: { type: Number, default: 0 },
    nYesterBonus: { type: Number, default: 0 },
    nWeekCash: { type: Number, default: 0 },
    nWeekBonus: { type: Number, default: 0 },
    nMonthCash: { type: Number, default: 0 },
    nMonthBonus: { type: Number, default: 0 },
    nYearCash: { type: Number, default: 0 },
    nYearBonus: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  }],
  aPlayed: [{
    eCategory: { type: String, enum: category, default: 'CRICKET' },
    nTotalCash: { type: Number, default: 0 },
    nTotalBonus: { type: Number, default: 0 },
    nTodayCash: { type: Number, default: 0 },
    nTodayBonus: { type: Number, default: 0 },
    nYesterCash: { type: Number, default: 0 },
    nYesterBonus: { type: Number, default: 0 },
    nWeekCash: { type: Number, default: 0 },
    nWeekBonus: { type: Number, default: 0 },
    nMonthCash: { type: Number, default: 0 },
    nMonthBonus: { type: Number, default: 0 },
    nYearCash: { type: Number, default: 0 },
    nYearBonus: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  }],
  aCashback: [{
    eCategory: { type: String, enum: category, default: 'CRICKET' },
    nTotalCash: { type: Number, default: 0 },
    nTotalBonus: { type: Number, default: 0 },
    nTodayCash: { type: Number, default: 0 },
    nTodayBonus: { type: Number, default: 0 },
    nYesterCash: { type: Number, default: 0 },
    nYesterBonus: { type: Number, default: 0 },
    nWeekCash: { type: Number, default: 0 },
    nWeekBonus: { type: Number, default: 0 },
    nMonthCash: { type: Number, default: 0 },
    nMonthBonus: { type: Number, default: 0 },
    nYearCash: { type: Number, default: 0 },
    nYearBonus: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  }],
  aCashbackReturn: [{
    eCategory: { type: String, enum: category, default: 'CRICKET' },
    nTotalCash: { type: Number, default: 0 },
    nTotalBonus: { type: Number, default: 0 },
    nTodayCash: { type: Number, default: 0 },
    nTodayBonus: { type: Number, default: 0 },
    nYesterCash: { type: Number, default: 0 },
    nYesterBonus: { type: Number, default: 0 },
    nWeekCash: { type: Number, default: 0 },
    nWeekBonus: { type: Number, default: 0 },
    nMonthCash: { type: Number, default: 0 },
    nMonthBonus: { type: Number, default: 0 },
    nYearCash: { type: Number, default: 0 },
    nYearBonus: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  }],
  aCreatorBonus: [{
    eCategory: { type: String, enum: category, default: 'CRICKET' },
    nTotal: { type: Number, default: 0 },
    nToday: { type: Number, default: 0 },
    nYesterday: { type: Number, default: 0 },
    nLastWeek: { type: Number, default: 0 },
    nLastMonth: { type: Number, default: 0 },
    nLastYear: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  }],
  aCreatorBonusReturn: [{
    eCategory: { type: String, enum: category, default: 'CRICKET' },
    nTotal: { type: Number, default: 0 },
    nToday: { type: Number, default: 0 },
    nYesterday: { type: Number, default: 0 },
    nLastWeek: { type: Number, default: 0 },
    nLastMonth: { type: Number, default: 0 },
    nLastYear: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  }],
  aAppDownload: [{
    ePlatform: { type: String },
    nTotal: { type: Number, default: 0 },
    nToday: { type: Number, default: 0 },
    nYesterday: { type: Number, default: 0 },
    nLastWeek: { type: Number, default: 0 },
    nLastMonth: { type: Number, default: 0 },
    nLastYear: { type: Number, default: 0 },
    dUpdatedAt: { type: Date }
  }],
  eType: { type: String, enum: userType, default: 'U' }, // U = USER B = BOT
  sExternalId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

module.exports = ReportDBConnect.model('generalizereports', GeneralizeReports)
