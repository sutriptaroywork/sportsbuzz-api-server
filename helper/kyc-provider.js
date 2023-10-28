const axios = require('axios')
const { uuid } = require('uuidv4')
const { STATES_NOT_ALLOWED } = require('../enums/locationNotAllowedEnums/locationNotAllowedEnums')
const config = require('../config/config')
const Jimp = require('jimp')
const AWS = require('aws-sdk')

class KycProvider {
  constructor() {
    this.apiKey = config.IDFY_API_KEY
    this.accountId = config.IDFY_ACCOUNT_ID
    this.baseUrl = config.IDFY_BASE_URL

    if (!this.apiKey && !this.accountID) {
      throw new Error('IDFY api must account key must required')
    }

    this.header = {
      'account-id': this.accountId,
      'api-key': this.apiKey
    }
    this.s3 = new AWS.S3({
      accessKeyId: config.AWS_KYC_ACCESS_KEY,
      secretAccessKey: config.AWS_KYC_SECRET_KEY
    })
  }

  async verifyAadhar(aadharFront, aadharBack, groupId) {
    try {
      const url = `${this.baseUrl}/tasks/sync/extract/ind_aadhaar_plus`
      const taskId = uuid()
      const payload = {
        task_id: taskId,
        group_id: groupId,
        data: {
          document1: aadharFront,
          document2: aadharBack,
          consent: 'yes'
        }
      }

      const result = await axios.post(url, payload, { headers: this.header })
      // console.log('Aadhaar OCR result', result?.data)
      return result.data
    } catch (error) {
      return error.response.data
    }
  }

  async verifyPan(panCard, groupId) {
    try {
      const url = `${this.baseUrl}/tasks/sync/extract/ind_pan`
      const taskId = uuid()
      const payload = {
        task_id: taskId,
        group_id: groupId,
        data: {
          document1: panCard
        }
      }
      const result = await axios.post(url, payload, { headers: this.header })
      // console.log('PAN OCR result', result?.data)
      return result.data
    } catch (error) {
      return error.response.data
    }
  }

  async documentImageValidation(image, groupId, docType) {
    try {
      const url = `${this.baseUrl}/tasks/sync/validate/document`
      const taskId = uuid()
      const payload = {
        task_id: taskId,
        group_id: groupId,
        data: {
          document1: image,
          doc_type: docType,
          advanced_features: { detect_doc_side: true }
        }
      }
      const result = await axios.post(url, payload, { headers: this.header })
      return result.data
    } catch (error) {
      // console.log(`documentValidation: Document validation error for group id- ${groupId} from IDFY error ${error}`)
      return error.response.data
    }
  }

  isAadharPanNameMatch(nameOnAadhar, nameOnPan) {
    /*
     * to do, in future we will add more accuracy to verify name on both
     **/

    if (nameOnPan && nameOnAadhar && nameOnAadhar.toLowerCase() === nameOnPan.toLowerCase()) {
      return true
    }
    return false
  }

  isAgeValid(age) {
    if (age < Number(18)) {
      return false
    }
    return true
  }

  // for new Aadhar-kyc 2.1
  aadhaarAgeValidator(userDOB) {
    const optimizedDate = userDOB.replace(/-/g, '/')
    const DOB = new Date(optimizedDate)
    const currentDate = new Date().toJSON().slice(0, 10) + ' 01:00:00'
    const age = ~~((Date.now(currentDate) - DOB) / (31557600000))

    if (age < Number(18)) {
      return false
    }
    return true
  }

  isLocationValid(userLocation) {
    const lowercaseUserLocation = userLocation.toLowerCase()
    return STATES_NOT_ALLOWED.includes(lowercaseUserLocation)
  }

  // Image Merge and upload function

  async joinImagesAndUpload(image1Path, image2Path, userId) {
    try {
      const image1 = await Jimp.read(image1Path)
      const image2 = await Jimp.read(image2Path)

      const width = image1.bitmap.width + image2.bitmap.width
      const height = Math.max(image1.bitmap.height, image2.bitmap.height)

      const result = new Jimp(width, height)

      result.composite(image1, 0, 0)
      result.composite(image2, image1.bitmap.width, 0)
      const buffer = await result.getBufferAsync(Jimp.MIME_JPEG)
      const params = {
        Bucket: process.env.S3_KYC_BUCKET_NAME,
        Key: 'test_kyc/' + userId + '_' + new Date().getTime() + '.jpeg',
        Body: buffer,
        ContentType: 'image/jpeg'
      }

      const s3path = await this.s3.upload(params).promise()
      return s3path.Key
    } catch (error) {
      console.error('Error in joining images or uploading image:', error)
      throw error
    }
  }
}

module.exports = KycProvider
