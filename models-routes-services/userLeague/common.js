const { addMember, removeMember, checkTeamExist, redisClient } = require('../../helper/redis')
const CopyTeamLogModel = require('./CopyTeamLogModel')
const CopyTeamUpdateLogModel = require('../userTeam/CopyTeamUpdateLogModel')
const UserTeamModel = require('../userTeam/model')
const MatchTeamsModel = require('../matchTeams/model')
const MatchLeagueModel = require('../matchLeague/model')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const { handleCatchError, randomBetween, dateFormat } = require('../../helper/utilities.services')
const csv = require('fast-csv')
const UserLeagueModel = require('./model')
const config = require('../../config/config')
const { s3 } = require('../../helper/s3config')

function getPrice(aLeaguePrize, rank, count) {
  let nTotalRealMoney = 0
  let nTotalBonus = 0
  const aTotalExtraWin = []

  for (const leaguePrice of aLeaguePrize) {
    const p = leaguePrice

    for (let i = rank; i < (rank + count); i++) {
      if (i >= p.nRankFrom && i <= p.nRankTo) {
        if (p.eRankType === 'E') {
          aTotalExtraWin.push({ sImage: p.sImage, sInfo: p.sInfo })
        } else if (p.eRankType === 'R') {
          nTotalRealMoney = nTotalRealMoney + Number(p.nPrize)
        } else if (p.eRankType === 'B') {
          nTotalBonus = nTotalBonus + Number(p.nPrize)
        }
      }
    }
  }

  return { nTotalRealMoney: Number(nTotalRealMoney.toFixed(2)), nTotalBonus: Number(nTotalBonus.toFixed(2)), aTotalExtraWin }
}

/**
 * It takes a copy team log from the queue, and updates the team in the database
 */
async function CopyTeamUpdate(copyTeam) {
  try {
    const { matchLeagueIds, iUserId, iMatchId, iUserTeamId, iNewUserTeamId, eUpdateTeamType, dStartDate } = copyTeam
    const copyTeamLogs = await CopyTeamLogModel.find({ iMatchLeagueId: { $in: matchLeagueIds }, iMatchId: iMatchId, iUserId, iUserTeamId }, {}, { readPreference: 'primary' }).lean()

    const teamId = eUpdateTeamType === 'SWITCH' ? iNewUserTeamId : iUserTeamId

    const newTeam = await UserTeamModel.findById(teamId, { _id: 0, iUserId: 0 }, { readPreference: 'primary' }).lean()
    const matchTeams = await MatchTeamsModel.findOne({ sHash: newTeam.sHash }, { aPlayers: 1 }, { readPreference: 'primary' }).lean()
    const aPlayers = matchTeams.aPlayers

    const { iCaptainId, iViceCaptainId, sHash } = newTeam

    // CopyTeamLog object
    const oCopyTeamUpdateLog = {
      oCVCData: { iCaptainId, iViceCaptainId, sHash },
      oPayload: copyTeam,
      iMatchId,
      iUserTeamId,
      iUserId,
      nCopyTeamCount: copyTeamLogs.length,
      $push: { aUserTeamPlayers: aPlayers },
      $inc: { nEditCount: 1 }
    }
    const sameTeamUpdate = []
    const rotateTeamUpdate = []
    const aSystemUserTeamIds = []
    const randomTeams = []
    const aBulkCopyTeam = []
    await redisClient.del(`UserTeam:${iUserTeamId.toString()}`)
    for (const logs of copyTeamLogs) {
      const copyTeam = logs
      if (copyTeam.eTeamType === 'SAME') {
        sameTeamUpdate.push(copyTeam.iSystemUserTeamId)
        if (eUpdateTeamType === 'SWITCH') await removeMember(iUserTeamId.toString(), `${iCaptainId.toString()}:${iViceCaptainId.toString()}`)
        await addMember(teamId.toString(), `${iCaptainId.toString()}:${iViceCaptainId.toString()}`, +new Date(dStartDate) + 84600)
      } else if (copyTeam.eTeamType === 'ROTATE') {
        rotateTeamUpdate.push(copyTeam.iSystemUserTeamId)
        if (eUpdateTeamType === 'SWITCH') await removeMember(iUserTeamId.toString(), `${iViceCaptainId.toString()}:${iCaptainId.toString()}`)
        await addMember(teamId.toString(), `${iViceCaptainId.toString()}:${iCaptainId.toString()}`, +new Date(dStartDate) + 84600)
      } else if (copyTeam.eTeamType === 'RANDOM') {
        randomTeams.push(copyTeam.iSystemUserTeamId)

        let capIndex
        let viceCapIndex
        do {
          capIndex = Math.floor((Math.random() * (aPlayers.length - 1)))
          viceCapIndex = Math.floor((Math.random() * (aPlayers.length - 1)))
        } while (capIndex === viceCapIndex)

        const data = await switchCapAndViceCap(teamId, {
          aPlayers,
          iCaptainId: aPlayers[capIndex].iMatchPlayerId,
          iViceCaptainId: aPlayers[viceCapIndex].iMatchPlayerId
        })

        if (eUpdateTeamType === 'SWITCH') await removeMember(iUserTeamId.toString(), `${data.iCaptainId.toString()}:${data.iViceCaptainId.toString()}`)
        await addMember(teamId.toString(), `${data.iCaptainId.toString()}:${data.iViceCaptainId.toString()}`, +new Date(dStartDate) + 84600)

        aBulkCopyTeam.push({
          updateOne: {
            filter: { _id: ObjectId(copyTeam.iSystemUserTeamId) },
            update: {
              $set: {
                iCaptainId: data.iCaptainId,
                iViceCaptainId: data.iViceCaptainId,
                sHash
              }
            }
          }
        })
      }
      if (copyTeam?.iSystemUserTeamId) aSystemUserTeamIds.push(copyTeam.iSystemUserTeamId)
    }
    const [nSameEditCount, nRotateEditCount] = await Promise.all([
      UserTeamModel.updateMany({ _id: { $in: sameTeamUpdate } }, { iCaptainId, iViceCaptainId, sHash }),
      UserTeamModel.updateMany({ _id: { $in: rotateTeamUpdate } }, { iCaptainId: iViceCaptainId, iViceCaptainId: iCaptainId, sHash })
    ])
    await CopyTeamUpdateLogModel.updateOne({ iMatchId, iUserId, iUserTeamId }, { ...oCopyTeamUpdateLog, aSystemUserTeamIds, nSameEditCount: nSameEditCount.modifiedCount, nRotateEditCount: nRotateEditCount.modifiedCount, nRandomEditCount: aBulkCopyTeam.length }, { upsert: true })

    if (randomTeams.length) await UserTeamModel.bulkWrite(aBulkCopyTeam, { ordered: false })
    if (eUpdateTeamType === 'SWITCH') {
      // need to update oldHash and sHash
      await CopyTeamLogModel.updateMany({ iMatchLeagueId: { $in: matchLeagueIds }, iMatchId: iMatchId, iUserId, iUserTeamId }, { $push: { aHash: sHash }, $set: { iUserTeamId: iNewUserTeamId } })
    }
    return { bSuccess: true }
  } catch (error) {
    console.log('Error while updating switch copy bot team updatation', copyTeam)
    handleCatchError(error)
    return { bSuccess: false }
  }
}

async function switchCapAndViceCap(_id, oTeam, c = 0) {
  try {
    let { aPlayers, iCaptainId, iViceCaptainId } = oTeam

    if (!iCaptainId && !iViceCaptainId) {
      const indx1 = randomBetween(0, 11)
      let indx2 = randomBetween(0, 11)
      indx2 = (indx1 !== indx2) ? indx2 : randomBetween(0, 11)
      iCaptainId = aPlayers[indx1].iMatchPlayerId || aPlayers[indx1]
      iViceCaptainId = aPlayers[indx2].iMatchPlayerId || aPlayers[indx2]
    }
    _id = _id.toString()
    iCaptainId = iCaptainId.toString()
    iViceCaptainId = iViceCaptainId.toString()

    const data = (iCaptainId && iViceCaptainId && (iCaptainId !== iViceCaptainId)) ? await checkTeamExist(_id, `${iCaptainId}:${iViceCaptainId}`) : 'EXIST'
    if (data === 'EXIST') {
      c++
      const indx3 = randomBetween(0, 11)
      let indx4 = randomBetween(0, 11)
      indx4 = (indx3 !== indx4) ? indx4 : randomBetween(0, 11)
      iCaptainId = aPlayers[indx3].iMatchPlayerId || aPlayers[indx3]
      iViceCaptainId = aPlayers[indx4].iMatchPlayerId || aPlayers[indx4]
      oTeam = {
        ...oTeam,
        iCaptainId,
        iViceCaptainId
      }
      return await switchCapAndViceCap(_id, oTeam, c)
    }
    return oTeam
  } catch (error) {
    handleCatchError(error)
    return oTeam
  }
}

/**
 * It will generate userleague report based on user
 */
async function generateUserLeagueReport(_id, oMatchPlayers, sPrizePool = 'No') {
  try {
    const nLimit = 100
    let nSkip = 0
    // temp code
    const projection = { iUserTeamId: 1, nTotalPoints: 1, nRank: 1, nPrice: 1, sUserName: 1, sTeamName: 1, dCreatedAt: 1, eType: 1 }

    const aFields = ['Username', 'User Type', 'Match Name', 'Team Name', 'Total Points', 'Rank', 'Prize', 'Pool Prize', 'Contest Join Time', 'Player1', 'Player2', 'Player3', 'Player4', 'Player5', 'Player6', 'Player7', 'Player8', 'Player9', 'Player10', 'Player11']

    const [oULeague, oBLeague, oCBLeague, oCMBLeague] = await Promise.all([
      UserLeagueModel.findOne({ iMatchLeagueId: ObjectId(_id), bCancelled: false, eType: 'U' }, { _id: 1 }).lean(),
      UserLeagueModel.findOne({ iMatchLeagueId: ObjectId(_id), bCancelled: false, eType: 'B' }, { _id: 1 }).lean(),
      UserLeagueModel.findOne({ iMatchLeagueId: ObjectId(_id), bCancelled: false, eType: 'CB' }, { _id: 1 }).lean(),
      UserLeagueModel.findOne({ iMatchLeagueId: ObjectId(_id), bCancelled: false, eType: 'CMB' }, { _id: 1 }).lean()
    ])

    // Start CSV stream
    const UCsvStream = csv.format({ headers: aFields, quoteHeaders: true })
    const NBCsvStream = csv.format({ headers: aFields, quoteHeaders: true })
    const CBCsvStream = csv.format({ headers: aFields, quoteHeaders: true })
    const CMBCsvStream = csv.format({ headers: aFields, quoteHeaders: true })

    const aPromise = []
    if (oULeague) aPromise.push(uploadReport(_id, UCsvStream, 'U'))
    if (oBLeague) aPromise.push(uploadReport(_id, NBCsvStream, 'B'))
    if (oCBLeague) aPromise.push(uploadReport(_id, CBCsvStream, 'CB'))
    if (oCMBLeague) aPromise.push(uploadReport(_id, CMBCsvStream, 'CMB'))
    // 4 report call
    await Promise.all(aPromise)

    // Fetch total count of userleague for specific contest
    const nTotalCount = await UserLeagueModel.countDocuments({ iMatchLeagueId: ObjectId(_id), bCancelled: false })
    while (nSkip < nTotalCount) {
      let aUserLeagueData = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(_id), bCancelled: false }, projection).populate({ path: 'iUserTeamId', select: ['sHash', 'iCaptainId', 'iViceCaptainId'] }).sort({ nRank: 1 }).skip(nSkip).limit(nLimit).lean()
      const teamHashes = aUserLeagueData.map(({ iUserTeamId }) => iUserTeamId.sHash)
      const uniqueHashes = [...new Set(teamHashes)]

      const teams = await MatchTeamsModel.find({ sHash: { $in: uniqueHashes } }, { 'aPlayers.iMatchPlayerId': 1, sHash: 1, _id: 0 }).lean()
      aUserLeagueData = aUserLeagueData.map((userLeague) => {
        const iUserTeamId = userLeague.iUserTeamId

        const team = teams[teams.findIndex((t) => t.sHash === iUserTeamId.sHash)]
        const aPlayers = team.aPlayers.map(p => {
          const isC = p.iMatchPlayerId.toString() === iUserTeamId.iCaptainId.toString()
          const isVc = p.iMatchPlayerId.toString() === iUserTeamId.iViceCaptainId.toString()
          const replace = isC ? '(C)' : isVc ? '(VC)' : ''
          const sName = `${oMatchPlayers[p.iMatchPlayerId.toString()]}${replace}`
          return sName
        })
        const oType = { U: 'User', B: 'Bot', CB: 'Copy Bot', CMB: 'Combination Bot' }

        delete userLeague.iUserTeamId
        return { ...userLeague, eType: oType[userLeague.eType], aPlayers }
      })
      // console.log(aUserLeagueData, 'aUserLeagueData')
      for (const oLeague of aUserLeagueData) {
        const { sUserName, eType, sMatchName, sTeamName, nTotalPoints, nRank, nPrice, dCreatedAt, aPlayers } = oLeague
        switch (eType) {
          case 'User':
            UCsvStream.write([sUserName, eType, sMatchName, sTeamName, nTotalPoints, nRank, nPrice, sPrizePool, dateFormat(dCreatedAt), ...aPlayers])
            break
          case 'Bot':
            NBCsvStream.write([sUserName, eType, sMatchName, sTeamName, nTotalPoints, nRank, nPrice, sPrizePool, dateFormat(dCreatedAt), ...aPlayers])
            break
          case 'Copy Bot':
            CBCsvStream.write([sUserName, eType, sMatchName, sTeamName, nTotalPoints, nRank, nPrice, sPrizePool, dateFormat(dCreatedAt), ...aPlayers])
            break
          case 'Combination Bot':
            CMBCsvStream.write([sUserName, eType, sMatchName, sTeamName, nTotalPoints, nRank, nPrice, sPrizePool, dateFormat(dCreatedAt), ...aPlayers])
            break
          default:
            break
        }
      }
      nSkip += nLimit
    }

    UCsvStream.end()
    NBCsvStream.end()
    CBCsvStream.end()
    CMBCsvStream.end()
  } catch (error) {
    handleCatchError(error)
  }
}

async function uploadReport(iMatchLeagueId, stream, type) {
  const params = {
    Bucket: config.S3_BUCKET_NAME,
    Key: config.s3TransactionReport + `${type}-${iMatchLeagueId}.csv`,
    ContentType: 'text/csv',
    Body: stream,
    ContentDisposition: 'filename=UserLeague Report.csv'
  }
  s3.upload(params, async function (err, data) {
    if (err) return handleCatchError(err)
    await MatchLeagueModel.updateOne({ _id: ObjectId(iMatchLeagueId) }, { eReportStatus: 'S', $addToSet: { aReportUrl: data.Key } })
  })
}

module.exports = {
  getPrice,
  CopyTeamUpdate,
  switchCapAndViceCap,
  generateUserLeagueReport
}

