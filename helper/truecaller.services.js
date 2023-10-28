const pemtools = require('pemtools')
const crypto = require('crypto')
const https = require('https')

const ALGO_MAP = {
  SHA512withRSA: 'RSA-SHA512'
}

function fetchPublicKey(callback) {
  https.get('https://api4.truecaller.com/v1/key', res => {
    const data = []

    res.on('data', chunk => {
      data.push(chunk)
    })

    res.on('end', () => {
      const result = JSON.parse(Buffer.concat(data).toString())
      // eslint-disable-next-line standard/no-callback-literal
      if (result.length < 1) { callback('Invalid response while fetching public key') } else { callback(null, result[0]) }
    })
  }).on('error', err => {
    callback(err.message)
  })
}

function verify(profile, cb) {
  fetchPublicKey(function (err, keyResult) {
    if (err) {
      cb(err, null)
    } else {
      const keyStr = keyResult.key
      const keyBytes = Buffer.from(pemtools(Buffer.from(keyStr, 'base64'), 'PUBLIC KEY').pem)
      const payload = Buffer.from(profile.payload)
      const signature = Buffer.from(profile.signature, 'base64')
      const signatureAlgorithm = ALGO_MAP[profile.signatureAlgorithm]

      const verifier = crypto.createVerify(signatureAlgorithm)
      verifier.update(payload)

      const signatureVerificationResult = verifier.verify(keyBytes, signature)
      cb(null, signatureVerificationResult)
    }
  })
}

exports = module.exports = {
  verifyProfile: verify
}
