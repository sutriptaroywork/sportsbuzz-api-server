const mongoose = require('mongoose')
const Schema = mongoose.Schema
const { UsersDBConnect } = require('../../database/mongoose')
const config = require('../../config/config')
const jwt = require('jsonwebtoken')
const { userType, userGender, socialType, userStatus, platform } = require('../../data')

const User = new Schema({
  sName: { type: String, trim: true },
  sUsername: { type: String, trim: true, required: true },
  sEmail: { type: String, trim: true },
  bIsEmailVerified: { type: Boolean, default: false },
  sMobNum: { type: String, trim: true, required: true },
  bIsMobVerified: { type: Boolean, default: false },
  sProPic: { type: String, trim: true },
  eType: { type: String, enum: userType, default: 'U' }, // U = USER B = BOT
  eGender: { type: String, enum: userGender },
  aJwtTokens: [{
    sToken: { type: String },
    sPushToken: { type: String, trim: true },
    dTimeStamp: { type: Date, default: Date.now }
  }],
  oSocial: {
    sType: { type: String, enum: socialType },
    sId: { type: String },
    sToken: { type: String }
  },
  nLoyaltyPoints: { type: Number, default: 0 },
  iCityId: { type: Number }, // check
  iStateId: { type: Number }, // check
  iCountryId: { type: Number }, // check or not in used
  sState: { type: String },
  dDob: { type: Date },
  sCity: { type: String },
  sAddress: { type: String },
  nPinCode: { type: Number },
  aDeviceToken: { type: Array },
  eStatus: { type: String, enum: userStatus, default: 'Y' },
  iReferredBy: { type: Schema.Types.ObjectId, ref: 'users' },
  sReferCode: { type: String },
  sReferLink: { type: String },
  dLoginAt: { type: Date },
  dPasswordchangeAt: { type: Date },
  sPassword: { type: String, trim: true, default: null },
  sVerificationToken: { type: String },
  bIsInternalAccount: { type: Boolean, default: false },
  sExternalId: { type: String },
  sReferrerRewardsOn: { type: String },
  ePlatform: { type: String, enum: platform, required: true, default: 'O' }, // A = Android, I = iOS, W = Web, O = Other, AD = Admin
  bIsKycApproved: { type: Boolean, default: false },
  iAdId: { type: String }
}, { timestamps: { createdAt: 'dCreatedAt', updatedAt: 'dUpdatedAt' } })

User.index({ sReferCode: 1 })
User.index({ eType: 1 })
User.index({ 'oSocial.sId': 1 })
User.index({ sUsername: 1 }, { unique: true })
User.index({ sEmail: 1 })
User.index({ sMobNum: 1 }, { unique: true })
User.index({ dCreatedAt: 1 })
User.index({ eType: 1, aJwtTokens: 1 })
User.index({ eType: 1, _id: 1 })

User.pre('save', function (next) {
  var user = this

  if (user.isModified('sEmail')) {
    user.sEmail = user.sEmail.toLowerCase()
  }
  next()
})

User.statics.filterData = function (user) {
  user.__v = undefined
  user.sVerificationToken = undefined
  user.aJwtTokens = undefined
  user.iReferredBy = undefined
  user.sPassword = undefined
  user.eType = undefined
  user.dUpdatedAt = undefined
  user.aDeviceToken = undefined
  return user
}

User.statics.findByToken = function (token) {
  var User = this
  var decoded
  try {
    decoded = jwt.verify(token, config.JWT_SECRET)
  } catch (e) {
    return Promise.reject(e)
  }
  var query = {
    _id: decoded._id,
    'aJwtTokens.sToken': token,
    eStatus: 'Y'
  }
  return User.findOne(query).cache(config.CACHE_2, `at:${token}`)
}

const UserModel = UsersDBConnect.model('users', User)

UserModel.syncIndexes().then(() => {
  console.log('User Model Indexes Synced')
}).catch((err) => {
  console.log('User Model Indexes Sync Error', err)
})

module.exports = UserModel
