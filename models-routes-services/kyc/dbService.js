
const KycModel = require('./model')

class DBService {
  async updateKycData(filter, data) {
    return KycModel.findOneAndUpdate(filter, data, { new: true, upsert: false })
  }

  async updateKycDataWithUpsert(filter, data) {
    return KycModel.findOneAndUpdate(filter, data, { new: true, upsert: true })
  }

  async getExistingUserData(iUserId) {
    return KycModel.findOne({ iUserId })
  }

  async kycPanDedupeCheck(panId) {
    return KycModel.findOne({ 'oPan.sNo': panId })
  }

  async kycAadhaarDedupeCheck(hashedAadhaarId) {
    return KycModel.findOne({ 'oAadhaar.sAadharHashedNumber': hashedAadhaarId })
  }
}

module.exports = new DBService()
