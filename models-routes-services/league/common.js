
/**
 * It'll generate Total Pool prize for Pool contest
 * @param {10} nJoined 10
 * @param {20} nMax 20
 * @param {10} nPrice 10
 * @param {5} nDeductPercent 5%
 * @returns Total Prize pool for Pool contest
 */
const getTotalPayoutForLeague = (nJoined, nMin, nPrice, nDeductPercent, nMax, eMatchStatus) => {
  // let totalPrizePool = 0
  // const netEntryFee = nPrice - profitPerEntry
  // const profitPerEntry = (nPrice * nDeductPercent) / 100
  // totalPrizePool = Math.trunc(netEntryFee * totalUsers)
  let totalUsers = (nJoined > nMin) ? nJoined : nMin
  if (['L', 'CMP'].includes(eMatchStatus)) totalUsers = nJoined

  return parseFloat(Number(((nPrice * totalUsers * 100) / ((nDeductPercent || 0) + 100))).toFixed(2))

  // return totalPrizePool
}

module.exports = {
  getTotalPayoutForLeague
}
