const { handleCatchError } = require('../../helper/utilities.services')
const { redisClient3 } = require('../../helper/redis')

async function getMyTeamsWithoutRankCalculation(iMatchId, iMatchLeagueId, teamIds) {
  try {
    const key = `ml:${iMatchId}:${iMatchLeagueId}`
    const teamScores = await redisClient3.zmscore(key, ...teamIds)

    const promises = []
    for (const team of teamIds) {
      promises.push(redisClient3.zrevrank(key, team))
    }
    const ranks = await Promise.all(promises)
    const data = teamIds.map((s, i) => {
      return [s, teamScores[i], ranks[i] + 1] // due to rank starts from 0 in redis ss
    })
    return data
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false }
  }
}

async function getMyTeamsWithRankCalculation(iMatchId, iMatchLeagueId, teamIds) {
  try {
    const key = `ml:${iMatchId}:${iMatchLeagueId}`
    const teamScores = await redisClient3.zmscore(key, ...teamIds)

    const sameScorePromise = []
    for (let i = 0; i < teamIds.length; i++) {
      sameScorePromise.push(redisClient3.zrangebyscore(key, teamScores[i], teamScores[i], 'limit', 0, 20))
    }
    const sameScoreData = await Promise.all(sameScorePromise)

    const sendData = []
    for (let i = 0; i < sameScoreData.length; i++) {
      // for await (const singleSameScoreData of sameScoreData) {
      let rank = null
      for await (const sameScoreMembers of sameScoreData[i]) {
        const checkRank = await redisClient3.zrevrank(key, sameScoreMembers)
        if (rank === null && checkRank) {
          rank = checkRank
        }
        if (rank !== null && checkRank < rank) {
          rank = checkRank
        }
      }
      sendData.push([teamIds[i], teamScores[i], rank + 1])
    }
    return sendData
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false }
  }
}

async function getMyTeamsWithRankCalculationV2(iMatchId, iMatchLeagueId, teamIds) {
  try {
    const key = `ml:${iMatchId}:${iMatchLeagueId}`
    const teamScores = await redisClient3.zmscore(key, ...teamIds)

    const sameScorePromise = []
    for (let i = 0; i < teamIds.length; i++) {
      sameScorePromise.push(redisClient3.zrange(key, teamScores[i], teamScores[i], 'BYSCORE', 'REV', 'limit', 0, 1))
    }
    const sameScoreData = await Promise.all(sameScorePromise)

    const sendData = []

    for (let i = 0; i < sameScoreData.length; i++) {
      // for await (const singleSameScoreData of sameScoreData) {
      const checkRank = await redisClient3.zrevrank(key, sameScoreData[i])
      sendData.push([teamIds[i], teamScores[i], checkRank + 1])
    }
    return sendData
  } catch (error) {
    handleCatchError(error)
    return { isSuccess: false }
  }
}

module.exports = {
  getMyTeamsWithoutRankCalculation,
  getMyTeamsWithRankCalculation,
  getMyTeamsWithRankCalculationV2
}
