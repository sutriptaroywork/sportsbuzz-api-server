const { body } = require('express-validator')
const { kycStatus } = require('../../data')

const updateKycStatus = [
  body('eType').not().isEmpty().toUpperCase().isIn(['PAN', 'AADHAAR', 'PENNY_DROP']),
  body('eStatus').not().isEmpty().toUpperCase().isIn(kycStatus)
  // body('sRejectReason').not().isEmpty()
]

const getSignedUrlKyc = [
  body('oPath').not().isEmpty()
]

const getSignedUrl = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

const adminKycUpdate = [
  body('eType').not().isEmpty().toUpperCase().isIn(['PAN', 'AADHAAR', 'PENNY_DROP'])
]

const userKycAdd = [
  body('eType').not().isEmpty().toUpperCase().isIn(['PAN', 'AADHAAR', 'PENNY_DROP'])
]

const userGetSignedUrlKyc = [
  body('sFileName').not().isEmpty(),
  body('sContentType').not().isEmpty()
]

const userKycUpdate = [
  body('eType').not().isEmpty().isIn(['PAN', 'AADHAAR', 'PENNY_DROP'])
]

module.exports = {
  updateKycStatus,
  getSignedUrlKyc,
  getSignedUrl,
  adminKycUpdate,
  userKycAdd,
  userGetSignedUrlKyc,
  userKycUpdate
}
