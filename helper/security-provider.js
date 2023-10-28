const bcrypt = require('bcryptjs')
const crypto = require('crypto')

class SecurityProvider {
  constructor() {
    this.saltRound = 10
    this.secretKeyForCrypto = process.env.SECRET_FOR_CRYPTO || 'sportsbuzz_fantasy'
    this.algorithm = 'sha256'
    this.digest = 'hex'
  }

  get algorithmForCrypto() {
    return this.algorithm
  }

  set algorithmForCrypto(val) {
    if (!val) {
      return this.algorithm
    }
    this.algorithm = val
  }

  get cryptoDigest() {
    return this.digest
  }

  set cryptoDigest(val) {
    if (!val) {
      return this.digest
    }
    this.digest = val
  }

  hashString(str, saltRound = this.saltRound) {
    const convertToStr = str.toString()
    const genSalt = bcrypt.genSaltSync(saltRound)
    const hashStr = bcrypt.hashSync(convertToStr, genSalt)
    return hashStr
  }

  compareHashString(str, hashedStr) {
    const isHashedStrMatch = bcrypt.compareSync(str, hashedStr)
    return isHashedStrMatch
  }

  hashStrWithCrypto(str) {
    const hmacHash = crypto.createHmac(this.algorithm, this.secretKeyForCrypto).update(str).digest(this.digest)
    return hmacHash
  }
}

module.exports = SecurityProvider
