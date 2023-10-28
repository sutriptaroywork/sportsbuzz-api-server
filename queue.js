const { queuePop, queuePush, redisClient, queueLen, bulkQueuePop, checkTeamExist, getPlayerRoles, setPlayerRoles } = require('./helper/redis')
const matchLeagueServices = require('./models-routes-services/matchLeague/services')
const UserModel = require('./models-routes-services/user/model')
const AdminLogModel = require('./models-routes-services/admin/logs.model')
const pdf = require('html-pdf')
const mongoose = require('mongoose')
const ObjectId = mongoose.Types.ObjectId
const { pushNotification, pushTopicNotification, sendMultiCastNotification } = require('./helper/firebase.services')
const { sendMail } = require('./helper/email.service')
const { sendOTPFromProvider } = require('./helper/sms.services')
const s3 = require('./helper/s3config')
const UserLeagueModel = require('./models-routes-services/userLeague/model')
const UserTeamModel = require('./models-routes-services/userTeam/model')
const MatchTeamsModel = require('./models-routes-services/matchTeams/model')
const MatchLeagueModel = require('./models-routes-services/matchLeague/model')
const MatchPlayerModel = require('./models-routes-services/matchPlayer/model')
const SeriesLBUserRankModel = require('./models-routes-services/seriesLeaderBoard/seriesLBUserRank.model')
const SeriesLeaderBoardModel = require('./models-routes-services/seriesLeaderBoard/model')
const userBalanceServices = require('./models-routes-services/userBalance/services')
const axios = require('axios')
const config = require('./config/config')
const BankModel = require('./models-routes-services/user/bankDetails/model')
const { handleCatchError, pick, validateEmail, replaceSensitiveInfo } = require('./helper/utilities.services')
const MyMatchesModel = require('./models-routes-services/myMatches/model')
const { bAllowDiskUse, s3UserTeams, POD_ENV, NODE_ENV } = config
const AuthLogsModel = require('./models-routes-services/user/authlogs.model')
const CityModel = require('./models-routes-services/user/cities')
const StateModel = require('./models-routes-services/user/states')
const { GamesDBConnect } = require('./database/mongoose')
const { decryption } = require('./middlewares/middleware')
const { CASHFREE_ORDERID_PREFIX, TRANSACTION_LOG_BULK_INSERT_SIZE, ADMIN_LOG_BULK_INSERT_SIZE } = require('./config/common')
const TransactionLogModel = require('./models-routes-services/apiLog/TransactionLog.model')
const { getMatchLeagueStatus } = require('./helper/utilities.services')
const { getPrice } = require('./models-routes-services/userLeague/common')
const PlayerRoleModel = require('./models-routes-services/playerRoles/model')
// const AdminModel = require('./models-routes-services/admin/model')
const { processPayment, checkCashfreeStatus } = require('./models-routes-services/payment/common')
const { calculateTotalScorePoint, calculateScorePointCricket, calculateScorePointFootball, calculateScorePointKabaddi, calculateScorePointBasketball } = require('./models-routes-services/scorePoint/common')
const MatchModel = require('./models-routes-services/match/model')
const PDFDocument = require('pdfkit-table')
const { PassThrough } = require('stream')
const adminServices = require('./models-routes-services/admin/subAdmin/services')
const adminLogQueue = require('./rabbitmq/queue/adminLogQueue')
const transactionLogQueue = require('./rabbitmq/queue/transactionLogQueue')

/***
 * It takes a match league from the queue, checks if it's cancelled, if not, it checks if it's a play
 * return or live match league, if it's a live match league, it checks if it's a cashback match league,
 * if it's a cashback match league, it checks if it's processed, if it's not processed, it processes
 * the cashback, if it's not a cashback match league, it checks if it's an overflow match league, if
 * it's an overflow match league, it processes the play return, if it's not an overflow match league,
 * it pushes the match league to the fair play queue
 * @returns the result of the function call.
 */
async function matchLive() {
  let matchLeague
  try {
    matchLeague = await queuePop('MatchLive')
    if (!matchLeague) {
      setTimeout(() => {
        matchLive()
      }, 2000)
      return
    }
    matchLeague = JSON.parse(matchLeague)
    let { _id, sName, nTotalPayout, nPrice, sFairPlay, nMax, nJoined, bCashbackEnabled, nMinCashbackTeam, nCashbackAmount, eCashbackType, eCategory, iMatchId, bIsProcessed, bCancelled, bUnlimitedJoin } = matchLeague
    nJoined = await UserLeagueModel.countDocuments({ iMatchLeagueId: _id }, { readPreference: 'primary' })
    matchLeague.nJoined = nJoined

    if (!bCancelled) {
      const uniqueUserJoin = await UserLeagueModel.aggregate([
        {
          $match: { iMatchLeagueId: ObjectId(_id) }
        },
        {
          $group: {
            _id: '$iUserId'
          }
        },
        {
          $group: {
            _id: null,
            nJoinedCount: { $sum: 1 }
          }
        }
      ]).allowDiskUse(bAllowDiskUse).read('primary').exec()
      const uniqueUserJoinCount = (uniqueUserJoin.length) ? uniqueUserJoin[0].nJoinedCount : 0

      const leagueStatus = await getMatchLeagueStatus(matchLeague, uniqueUserJoinCount)

      if (leagueStatus === 'PLAY_RETURN') {
        await MatchLeagueModel.updateOne({ _id: ObjectId(matchLeague._id) }, { bPlayReturnProcess: true })
        // await queuePush('ProcessPlayReturn', { matchLeague, type: 'MATCHLEAGUE', iAdminId: null, sIP: '', sOperationBy: 'MATCH LIVE CRON', nJoined, uniqueUserJoinCount })
        await matchLeagueServices.processPlayReturn(matchLeague, 'MATCHLEAGUE', null, '', 'MATCH LIVE CRON', nJoined, uniqueUserJoinCount)
      } else if (leagueStatus === 'LIVE') {
        if (bCashbackEnabled && !bIsProcessed && nMinCashbackTeam) {
          await matchLeagueServices.processCashback({ _id, iMatchId, eCategory, nMinTeam: parseInt(nMinCashbackTeam), nCashbackAmount, eCashbackType })
        }
        if (nJoined > nMax && !bUnlimitedJoin) {
          // await queuePush('ProcessPlayReturn', { matchLeague, type: 'OVERFLOW', iAdminId: null, sIP: '', sOperationBy: 'MATCH LIVE CRON', nJoined, uniqueUserJoinCount })
          await matchLeagueServices.processPlayReturn(matchLeague, 'OVERFLOW', null, '', 'MATCH LIVE CRON', nJoined, uniqueUserJoinCount)
        }
        await queuePush('FairPlay', { _id: matchLeague._id, sFairPlay, sName, nTotalPayout, nPrice, nJoined, iMatchId })
      }
    }

    // await redisClient.del(`${_id}`)
    matchLive()
  } catch (error) {
    await queuePush('dead:MatchLive', matchLeague)
    handleCatchError(error)
    matchLive()
  }
}

/**
 * It takes a match league from the queue, checks if it has enough players, and if it does, it
 * processes the match league
 * @returns the result of the function call to processMatchLeague()
 */
async function processMatchLeague() {
  let matchLeague
  try {
    matchLeague = await queuePop('ProcessMatchLeague')
    if (!matchLeague) {
      setTimeout(() => {
        processMatchLeague()
      }, 2000)
      return
    }
    matchLeague = JSON.parse(matchLeague)

    const { _id } = matchLeague

    const nJoined = await UserLeagueModel.countDocuments({ iMatchLeagueId: _id }, { readPreference: 'primary' })

    matchLeague.nJoined = nJoined

    const uniqueUserJoin = await UserLeagueModel.aggregate([
      {
        $match: { iMatchLeagueId: ObjectId(_id) }
      },
      {
        $group: {
          _id: '$iUserId'
        }
      },
      {
        $group: {
          _id: null,
          nJoinedCount: { $sum: 1 }
        }
      }
    ]).allowDiskUse(bAllowDiskUse).exec()
    const uniqueUserJoinCount = uniqueUserJoin[0].nJoinedCount

    if (uniqueUserJoinCount < 2) {
      await MatchLeagueModel.updateOne({ _id: ObjectId(matchLeague._id) }, { bPlayReturnProcess: true })
      // await queuePush('ProcessPlayReturn', { matchLeague, type: 'MATCHLEAGUE', iAdminId: null, sIP: '', sOperationBy: 'PROCESS MATCHLEAGUE CRON', nJoined, uniqueUserJoinCount })
      await matchLeagueServices.processPlayReturn(matchLeague, 'MATCHLEAGUE', null, '', 'PROCESS MATCHLEAGUE CRON', nJoined, uniqueUserJoinCount)
    } else {
      if (matchLeague.nJoined > matchLeague.nMax) {
        await matchLeagueServices.processPlayReturn(matchLeague, 'OVERFLOW', null, '', 'PROCESS MATCHLEAGUE CRON', nJoined, uniqueUserJoinCount)
      }
      // await queuePush('ProcessPlayReturn', { matchLeague, type: 'OVERFLOW', iAdminId: null, sIP: '', sOperationBy: 'PROCESS MATCHLEAGUE CRON', nJoined, uniqueUserJoinCount })
    }

    processMatchLeague()
  } catch (error) {
    await queuePush('dead:ProcessMatchLeague', matchLeague)
    handleCatchError(error)
    processMatchLeague()
  }
}

/**
 * It checks the number of users joined in a match league and updates the number of joined users in
 * Redis as well as match league
 */
async function checkRedisJoinedCount() {
  let matchLeague
  try {
    matchLeague = await queuePop('checkRedisJoinedCount')
    if (!matchLeague) {
      setTimeout(() => {
        checkRedisJoinedCount()
      }, 2000)
      return
    }
    matchLeague = JSON.parse(matchLeague)

    const { _id, nJoined: nMatchLeagueJoined, bCancelled, eMatchStatus } = matchLeague

    let nJoined
    if (!bCancelled && eMatchStatus === 'U') {
      nJoined = await UserLeagueModel.countDocuments({ iMatchLeagueId: ObjectId(_id), bCancelled: false }, { readPreference: 'primary' })
      if (nMatchLeagueJoined !== nJoined) {
        await MatchLeagueModel.updateOne({ _id: ObjectId(_id) }, { nJoined }, { readPreference: 'primary' })
      }
    }

    checkRedisJoinedCount()
  } catch (error) {
    await queuePush('dead:checkRedisJoinedCount', matchLeague)
    handleCatchError(error)
    checkRedisJoinedCount()
  }
}

// Deprecated
/**
 * It takes a match league from the queue, gets the user teams, creates a PDF and uploads it to S3
 */
async function generateFairPlay() {
  let data
  try {
    let matchLeague = await queuePop('FairPlay')
    if (!matchLeague) {
      setTimeout(() => {
        generateFairPlay()
      }, 2000)
      return
    }

    matchLeague = JSON.parse(matchLeague)

    const { _id, sName, nTotalPayout, nPrice, nJoined, sFairPlay } = matchLeague
    const userleagues = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(_id), bCancelled: false }, { iUserTeamId: 1, sTeamName: 1, sMatchName: 1, sUserName: 1, nTotalPayout: 1 }).lean()
    const sMatchName = userleagues[0].sMatchName
    const oUserLeague = {}
    userleagues.forEach((ul, i) => {
      oUserLeague[ul.iUserTeamId] = i
    })

    const aUserTeamId = userleagues.map(iTeamId => iTeamId.iUserTeamId)
    const aUserTeams = await UserTeamModel.find({ _id: { $in: aUserTeamId } }, { _id: 1, iCaptainId: 1, iViceCaptainId: 1, sHash: 1 }).lean()

    const aTeamHashes = aUserTeams.map(sTeamHash => sTeamHash.sHash)
    const aTeamData = await MatchTeamsModel.find({ sHash: { $in: aTeamHashes } }, { aPlayers: 1, _id: 0, sHash: 1 }).populate({ path: 'aPlayers.iMatchPlayerId', select: 'sName' }).sort({ _id: 1 }).lean()

    const oTeam = {}
    aTeamData.forEach((pl, i) => {
      oTeam[pl.sHash] = i
    })

    const data = []
    for (const hash of aUserTeams) {
      // const exist = oTeamData.find((d) => d.sHash === hash.sHash)
      const ul = typeof oUserLeague[hash._id] === 'number' ? { ...userleagues[oUserLeague[hash._id]] } : false
      const exist = typeof oTeam[hash.sHash] === 'number' ? { ...aTeamData[oTeam[hash.sHash]] } : false
      if (exist && exist.aPlayers) {
        data.push({ sUserName: ul.sUserName, sTeamName: ul.sTeamName, sMatchName, ...hash, aPlayers: exist.aPlayers.map(p => p.iMatchPlayerId), sHash: undefined })
      }
    }

    if (data.length) {
      const { sMatchName } = data[0]

      const list = data.map((ul) => {
        const { sUserName, sTeamName, iCaptainId, iViceCaptainId, aPlayers: players } = ul
        const [captain, viceCaptain, playerList] = players.reduce((acc, player) => {
          if ((player._id.toString()) === (iCaptainId.toString())) {
            acc[0] = player
          } else if ((player._id.toString()) === (iViceCaptainId.toString())) {
            acc[1] = player
          } else {
            acc[2].push(player)
          }
          return acc
        }, [0, 0, []])
        const htmlPlayers = playerList.map((player) => `<td style='padding: 2px 4px'> ${player.sName}</td>`).join(' ')
        return `
            <tr>
                <td style='padding: 2px 4px'>${sUserName} (${sTeamName})</td>
                <td style='padding: 2px 4px'>${captain.sName}</td>
                <td style='padding: 2px 4px'>${viceCaptain.sName}</td>
                ${htmlPlayers}
            </tr>
                `
      }).join(' ')
      const html = `
            <html>
              <head>
                  <title> ${sMatchName}</title>
                  <link rel="preconnect" href="https://fonts.gstatic.com">
                  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,600;0,700;0,800;1,300;1,400;1,600;1,700;1,800&display=swap" rel="stylesheet">
                  <style type="text/css">
                    /** Define the margins of your page **/
                    @page {
                      margin: 100px 25px;
                    }
                  </style>
                </head>

                <body>

                  <div>
                    <table border='1' width='100%' style='border-collapse: collapse; font-family: "Open Sans", sans-serif;'>
                      <thead style='font-family: "Open Sans", sans-serif; font-size: 8px'>
                        <tr>
                          <th style='padding: 2px 4px'>User (Team)</th>
                          <th style='padding: 2px 4px'>Player 1 (C)</th>
                          <th style='padding: 2px 4px'>Player 2 (VC)</th>
                          <th style='padding: 2px 4px'>Player 3</th>
                          <th style='padding: 2px 4px'>Player 4</th>
                          <th style='padding: 2px 4px'>Player 5</th>
                          <th style='padding: 2px 4px'>Player 6</th>
                          <th style='padding: 2px 4px'>Player 7</th>
                          <th style='padding: 2px 4px'>Player 8</th>
                          <th style='padding: 2px 4px'>Player 9</th>
                          <th style='padding: 2px 4px'>Player 10</th>
                          <th style='padding: 2px 4px'>Player 11</th>
                        </tr>
                      </thead>
                      <tbody style='font-family: "Open Sans", sans-serif; font-size: 8px'>
                        ${list}
                      </tbody>
                    </table>
                  </div>
                </body>
            </html>
            `
      var options = {
        format: 'A4',
        timeout: 9000000,
        orientation: 'landscape',
        header: {
          height: '50px',
          contents: `<div style="padding: 8px; background-color: #045de9; color: #fff; text-align: center; "><span style="display: block; font-size: 14px; line-height: 18px; font-weight: 600;">Match: ${sMatchName}</span><span style="font-size: 12px; line-height: 14px; ">Entry Fee: ${nPrice} Members: ${nJoined} League Name: ${sName} Contest: Win Rs. ${nTotalPayout}</span></div>`
        },
        childProcessOptions: { detached: true }
      }

      pdf.create(html, options).toBuffer(async (err, buffer) => {
        try {
          if (err) return

          const sFileName = `${sMatchName}-${_id}.pdf`
          const sContentType = 'application/pdf'

          if (sFairPlay) {
            const s3Params = {
              Bucket: config.S3_BUCKET_NAME,
              Key: sFairPlay
            }
            await s3.deleteObject(s3Params)
          }
          const data = await s3.putObj(sFileName, sContentType, s3UserTeams, buffer)
          await MatchLeagueModel.updateOne({ _id: ObjectId(matchLeague._id) }, { sFairPlay: (data.key || data.Key) })
        } catch (error) {
          handleCatchError(error)
        }
      })
    }

    generateFairPlay()
  } catch (error) {
    await queuePush('dead:FairPlay', data)
    handleCatchError(error)
    generateFairPlay()
  }
}

async function generateFairPlayV2() {
  let data
  try {
    let matchLeague
    matchLeague = await queuePop('FairPlay')
    if (!matchLeague) {
      setTimeout(() => {
        generateFairPlayV2()
      }, 2000)
      return
    }
    matchLeague = JSON.parse(matchLeague)

    const { _id, nTotalPayout, nPrice, sFairPlay, iMatchId } = matchLeague

    const [aMatchPlayer, oMatch, oMatchLeague, nJoined] = await Promise.all([
      MatchPlayerModel.find({ iMatchId }, { sName: 1 }).lean(),
      MatchModel.findOne({ _id: iMatchId }, { sName: 1 }).lean(),
      MatchLeagueModel.findOne({ _id }, { sLeagueCategory: 1 }).lean(),
      UserLeagueModel.countDocuments({ iMatchLeagueId: ObjectId(_id), bCancelled: false })
    ])
    const { sLeagueCategory } = oMatchLeague

    const oMatchPlayers = aMatchPlayer.reduce((acc, cur) => {
      acc = { ...acc, [cur._id.toString()]: cur.sName }
      return acc
    }, {})

    const sPdfHeader = `Match-Name: ${oMatch.sName}, League: ${sLeagueCategory}`
    const sPdfSubtitle = `TotalUsers: ${nJoined}, EntryFee: ${nPrice}, WinningPrice: ${nTotalPayout}`
    const aHeaders = ['User(Team)', 'Player 1 (C)', 'Player 2 (VC)', 'Player 3', 'Player 4', 'Player 5', 'Player 6', 'Player 7', 'Player 8', 'Player 9', 'Player 10', 'Player 11']

    const stream = new PassThrough()
    const doc = new PDFDocument({ margin: 20, size: 'A4' })
    doc.pipe(stream)

    if (sFairPlay) {
      const s3Params = {
        Bucket: config.S3_BUCKET_NAME,
        Key: sFairPlay
      }
      await s3.deleteObject(s3Params)
    }

    const params = {
      Bucket: config.S3_BUCKET_NAME,
      Key: s3UserTeams + `${_id}.pdf`,
      ContentType: 'application/pdf',
      Body: doc,
      ContentDisposition: 'filename=fair-play.pdf'
    }
    s3.s3.upload(params, async function (err, data) {
      if (err) return handleCatchError(err)
      await MatchLeagueModel.updateOne({ _id: ObjectId(_id) }, { sFairPlay: (data.key || data.Key) })
    })

    const nLimit = 5000
    let nSkip = 0

    while (nSkip < nJoined) {
      const aUserLeague = await UserLeagueModel.find({ iMatchLeagueId: ObjectId(_id), bCancelled: false }, { iUserTeamId: 1, sTeamName: 1, sMatchName: 1, sUserName: 1 }).skip(nSkip).limit(nLimit).sort({ _id: -1 }).lean()

      const aUserTeamId = aUserLeague.map(league => league.iUserTeamId)
      const aUserTeams = await UserTeamModel.find({ _id: { $in: aUserTeamId } }, { _id: 1, iCaptainId: 1, iViceCaptainId: 1, sHash: 1 }).lean()

      const oUserTeam = {}
      const aTeamHashes = new Set()
      aUserTeams.forEach(team => {
        aTeamHashes.add(team.sHash)
        oUserTeam[team._id.toString()] = { sHash: team.sHash, iCaptainId: team.iCaptainId, iViceCaptainId: team.iViceCaptainId }
      })

      const aTeamData = await MatchTeamsModel.find({ sHash: { $in: [...aTeamHashes] } }, { 'aPlayers.iMatchPlayerId': 1, sHash: 1, _id: 0 }).lean()

      const oTeamHash = {}
      aTeamData.forEach(team => { oTeamHash[team.sHash] = team.aPlayers })

      const aPdfData = []
      for (const oUserLeague of aUserLeague) {
        const { sUserName, sTeamName, iUserTeamId } = oUserLeague
        const { iCaptainId, iViceCaptainId, sHash } = oUserTeam[iUserTeamId.toString()]

        const sUserTeam = `${sUserName}(${sTeamName})`
        const sCaptainName = oMatchPlayers[iCaptainId.toString()]
        const sVCaptainName = oMatchPlayers[iViceCaptainId.toString()]
        const aPlayer = oTeamHash[sHash]
        const aPlayerName = []
        aPlayer.forEach(p => {
          if (!(p.iMatchPlayerId.toString() === iCaptainId.toString()) && !(p.iMatchPlayerId.toString() === iViceCaptainId.toString())) {
            aPlayerName.push(oMatchPlayers[p.iMatchPlayerId.toString()])
          }
        })

        aPdfData.push([sUserTeam, sCaptainName, sVCaptainName, ...aPlayerName])
      }

      const oTable = {
        title: sPdfHeader,
        subtitle: sPdfSubtitle,
        headers: aHeaders,
        rows: aPdfData
      }

      await doc.table(oTable, {
        columnSpacing: 2,
        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(4),
        prepareRow: () => doc.font('Helvetica').fontSize(4)
      })

      nSkip += nLimit
    }

    doc.end()
    generateFairPlayV2()
  } catch (error) {
    await queuePush('dead:FairPlay', data)
    handleCatchError(error)
    generateFairPlayV2()
  }
}

/**
 * It takes a match league id from a queue, finds all the users who have joined that league, and then
 * gives them a cashback
 * @returns the result of the await expression.
 */
async function processUserCashbackReturnV2() {
  let data
  try {
    data = await queuePop('ProcessUsersCashbackReturn')
    if (!data) {
      setTimeout(() => {
        processUserCashbackReturnV2()
      }, 2000)
      return
    }
    data = JSON.parse(data)
    const { _id, iMatchId, nMinTeam, nCashbackAmount, eCashbackType, eCategory } = data

    const transactionOptions = {
      readPreference: 'primary',
      readConcern: { level: 'majority' },
      writeConcern: { w: 'majority' }
    }
    const session = await GamesDBConnect.startSession()
    session.startTransaction(transactionOptions)

    try {
      let resultCashbackLeagues = []
      let resultCashbackLeagueIds = []

      if (nMinTeam) {
        const nAmount = parseFloat(nCashbackAmount)

        const cashbackUserLeagues = await UserLeagueModel.aggregate([
          {
            $match: {
              iMatchLeagueId: ObjectId(_id)
            }
          }, {
            $addFields: {
              eType: { $cond: [{ $eq: ['$eType', 'U'] }, 'U', 'B'] }
            }
          }, {
            $group: {
              _id: '$iUserId',
              count: { $sum: 1 },
              sUserName: { $first: '$sUserName' },
              sLeagueName: { $first: '$sLeagueName' },
              iLeagueId: { $first: '$_id' },
              eType: { $first: '$eType' }
            }
          }, {
            $match: {
              count: { $gte: nMinTeam }
            }
          }
        ]).allowDiskUse(bAllowDiskUse).exec()

        if (cashbackUserLeagues && cashbackUserLeagues.length) {
          const resultCashback = await userBalanceServices.userContestCashbackReturn({ nAmount, eCashbackType, nTeams: nMinTeam, userLeagues: cashbackUserLeagues, iMatchId, iMatchLeagueId: _id, eCategory })
          // const resultCashback = await userBalanceServices.userCashbackReturn({ nAmount, eCashbackType, nTeams: nMinTeam, userLeagues: cashbackUserLeagues, iMatchId, iMatchLeagueId: _id, eCategory })
          const { aProcessedLeagues } = resultCashback
          if (aProcessedLeagues && aProcessedLeagues.length) {
            resultCashbackLeagues = cashbackUserLeagues.filter(({ iLeagueId }) => aProcessedLeagues.includes(iLeagueId))
            resultCashbackLeagueIds = aProcessedLeagues

            for (const ul of resultCashbackLeagues) {
              const ulSession = await GamesDBConnect.startSession()
              ulSession.startTransaction(transactionOptions)
              const { _id: iUserId } = ul
              try {
                let query = { $inc: { nJoinedLeague: -1 } }

                const isExist = await MyMatchesModel.findOne({ iMatchId, iUserId, aMatchLeagueCashback: { $elemMatch: { iMatchLeagueId: _id } } }, { _id: 1 }).session(ulSession).lean()
                if (isExist) {
                  const updateMyMatch = { iMatchLeagueId: _id }
                  query = { $inc: { nJoinedLeague: -1 }, $pull: { aMatchLeagueCashback: updateMyMatch } }
                }

                await MyMatchesModel.updateOne({ iMatchId, iUserId }, query, { upsert: true }).session(ulSession)
                await ulSession.commitTransaction()
              } catch (e) {
                handleCatchError(e)
                await ulSession.abortTransaction()
                break
              } finally {
                await ulSession.endSession()
              }
            }
          } else {
            await session.abortTransaction()
            throw new Error(resultCashback.error)
          }
        }
      }
      if (resultCashbackLeagueIds.length) await UserLeagueModel.updateMany({ _id: { $in: resultCashbackLeagueIds } }, { bCancelled: true }).session(session)
      await MatchLeagueModel.updateOne({ _id }, { bIsProcessed: true }).session(session)
      await session.commitTransaction()
    } catch (error) {
      handleCatchError(error)
      await session.abortTransaction()
      throw new Error(error)
    } finally {
      await session.endSession()
    }
    processUserCashbackReturnV2()
  } catch (error) {
    await queuePush('dead:ProcessUsersCashbackReturn', data)
    handleCatchError(error)
    processUserCashbackReturnV2()
  }
}

async function sendNotification(tokens, title, body, sPushType, id = '', matchCategory = '') {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const [token] = tokens.slice(-1)
        console.log('user token', token)
        if (token && token.sPushToken) {
          await pushNotification(token.sPushToken, title, body, sPushType, id, matchCategory)
        }
        resolve()
      } catch (error) {
        reject(error)
      }
    })()
  })
}
async function sendMultiCastNotifications(tokens, title, body, sPushType) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        await sendMultiCastNotification(tokens, title, body, sPushType)
        resolve()
      } catch (error) {
        reject(error)
      }
    })()
  })
}

// async function pushPlayReturnNotify() {
//   let data
//   try {
//     data = await queuePop('pushNotification:playReturn')
//     if (!data) {
//       setTimeout(() => { pushPlayReturnNotify() }, 2000)
//       return
//     }
//     data = JSON.parse(data)
//     const { _id } = data
//     const user = await UserModel.findById(_id, { aJwtTokens: 1 }).lean()
//     if (user && user.aJwtTokens) {
//       const tokens = user.aJwtTokens
//       await sendNotification(tokens, 'Play Return', 'Your Play return paid successfully')
//     }
//     pushPlayReturnNotify()
//   } catch (error) {
//     await queuePush('dead:pushNotification:playReturn', data)
//     handleCatchError(error)
//     pushPlayReturnNotify()
//   }
// }
async function pushPlayReturnNotify() {
  let data
  try {
    data = await bulkQueuePop('pushNotification:playReturn', 500)
    if (!data) {
      setTimeout(() => { pushPlayReturnNotify() }, 2000)
      return
    }
    data = data.map(d => JSON.parse(d))

    const user = await UserModel.find({ _id: { $in: data }, 'aJwtTokens.sPushToken': { $exists: true } }, { 'aJwtTokens.sPushToken': 1, _id: 0 }).lean()
    const pushtokens = new Set()
    for (let i = 0; i < user.length; i++) {
      for (const pushtoken of user[i].aJwtTokens) {
        pushtokens.add(pushtoken.sPushToken)
      }
    }

    if (pushtokens.size) {
      await sendMultiCastNotifications([...pushtokens], 'Entry Fee Refunded!', 'The contest you entered has been cancelled, and we have refunded your entry fee to your account.', 'Transaction')
    }
    pushPlayReturnNotify()
  } catch (error) {
    await queuePush('dead:pushNotification:playReturn', data)
    handleCatchError(error)
    pushPlayReturnNotify()
  }
}
async function winNotify(data) {
  // let data
  try {
    // data = await queuePop('pushNotification:Win')
    // if (!data) {
    //   setTimeout(() => { winNotify() }, 2000)
    //   return
    // }
    data = JSON.parse(data)
    const iMatchId = data?.iMatchId
    const matchCategory = data?.matchCategory

    const user = await UserModel.findOne({ _id: data.iUserId, 'aJwtTokens.sPushToken': { $exists: true } }, { aJwtTokens: 1, _id: 0 }).lean()

    if (user && user?.aJwtTokens) {
      const tokens = user.aJwtTokens
      await sendNotification(tokens, 'You\'re a Winner!', 'Congratulations on your victory! Join more contests on SportsBuzz11 and keep winning big!', 'completedMatches', iMatchId, matchCategory)
    }

    // winNotify()
  } catch (error) {
    await queuePush('dead:pushNotification:Win', data)
    handleCatchError(error)
    // winNotify()
  }
}

async function autoCreateLeague() {
  let matchLeague
  try {
    matchLeague = await queuePop('autoCreateLeague')
    if (!matchLeague) {
      setTimeout(() => { autoCreateLeague() }, 2000)
      return
    }

    matchLeague = JSON.parse(matchLeague)
    const nTotalJoined = await UserLeagueModel.countDocuments({ iMatchLeagueId: ObjectId(matchLeague._id) }, { readPreference: 'primary' })
    if (Number(matchLeague.nMax) === nTotalJoined) {
      matchLeague = pick(matchLeague, ['sName', 'sLeagueCategory', 'sFilterCategory', 'nTotalWinners', 'iLeagueId', 'iFilterCatId', 'nLoyaltyPoint', 'aLeaguePrize', 'nTeamJoinLimit', 'nMax', 'nMin', 'nPrice', 'nTotalPayout', 'nDeductPercent', 'nBonusUtil', 'sPayoutBreakupDesign', 'bConfirmLeague', 'bMultipleEntry', 'bAutoCreate', 'bPoolPrize', 'nPosition', 'eStatus', 'eCategory', 'nWinnersCount', 'iLeagueCatId', 'iFilterCatId', 'bUnlimitedJoin', 'nMinCashbackTeam', 'nCashbackAmount', 'eCashbackType', 'nMinTeamCount', 'nBotsCount', 'bBotCreate', 'iMatchId', 'nCopyBotsPerTeam', 'nSameCopyBotTeam'])
      await MatchLeagueModel.create({ ...matchLeague, nJoined: 0, bCopyLeague: true, eMatchStatus: 'U', bPlayReturnProcess: false })
    }

    autoCreateLeague()
  } catch (error) {
    await queuePush('dead:autoCreateLeague', matchLeague)
    handleCatchError(error)
    autoCreateLeague()
  }
}

async function referCodeBonusNotify() {
  let data
  try {
    data = await queuePop('pushNotification:referCodeBonus')

    if (!data) {
      setTimeout(() => { referCodeBonusNotify() }, 2000)
      return
    }
    data = JSON.parse(data)
    const { _id } = data
    const user = await UserModel.findById(_id, { aJwtTokens: 1 }).lean()
    if (user && user.aJwtTokens) {
      const tokens = user.aJwtTokens
      await sendNotification(tokens, 'Referral Bonus Credited', 'Great news! Your referral bonus has been credited to your wallet successfully. Keep referring your friends for even more earnings!', 'Profile')
    }
    referCodeBonusNotify()
  } catch (error) {
    await queuePush('dead:pushNotification:referCodeBonus', data)
    handleCatchError(error)
    referCodeBonusNotify()
  }
}

async function registerBonusNotify() {
  let data
  try {
    data = await queuePop('pushNotification:registerBonus')
    if (!data) {
      setTimeout(() => { registerBonusNotify() }, 2000)
      return
    }
    data = JSON.parse(data)
    const { _id } = data
    const user = await UserModel.findById(_id, { aJwtTokens: 1 }).lean()
    if (user && user.aJwtTokens) {
      const tokens = user.aJwtTokens
      await sendNotification(tokens, 'Sign-up Bonus Credited', 'Play now and enjoy our exciting games for even more earnings!', 'Profile')
    }

    registerBonusNotify()
  } catch (error) {
    await queuePush('dead:pushNotification:registerBonus', data)
    handleCatchError(error)
    registerBonusNotify()
  }
}

async function depositStatusNotify() {
  let data
  try {
    let sMessage = ''
    let sTitle = ''
    data = await queuePop('pushNotification:Deposit')
    if (!data) {
      setTimeout(() => { depositStatusNotify() }, 2000)
      return
    }
    data = JSON.parse(data)

    let { iUserId = '', ePaymentStatus = '', sPushType = 'Transaction' } = data
    const user = await UserModel.findById(iUserId, { aJwtTokens: 1 }).lean()

    if (ePaymentStatus === 'C') {
      sTitle = 'Transaction Failed :('
      sMessage = 'We\'re sorry to inform you that your deposit attempt has failed. Please try again.'
      sPushType = 'Transaction'
    }
    if (ePaymentStatus === 'S') {
      sTitle = 'Deposit successful!'
      sMessage = 'Your deposit was successful! Join exciting contests on SportsBuzz11 and start winning today!'
      sPushType = 'Home'
    }

    if (user && user.aJwtTokens) {
      const tokens = user.aJwtTokens
      await sendNotification(tokens, sTitle, sMessage, sPushType)
    }

    depositStatusNotify()
  } catch (error) {
    await queuePush('dead:pushNotification:Deposit', data)
    handleCatchError(error)
    depositStatusNotify()
  }
}
async function withdrawalStatusNotify() {
  let data
  try {
    let sMessage = ''
    let sTitle = ''
    data = await queuePop('pushNotification:Withdraw')
    if (!data) {
      setTimeout(() => { withdrawalStatusNotify() }, 2000)
      return
    }
    data = JSON.parse(data)

    let { iUserId = '', ePaymentStatus = '', sPushType = 'Transaction' } = data
    const user = await UserModel.findById(iUserId, { aJwtTokens: 1 }).lean()

    if (ePaymentStatus === 'C') {
      sTitle = 'Withdrawal failed!'
      sMessage = 'Sorry, we could not process your withdrawal request. Let\'s work together to fix it.'
      sPushType = 'Withdrawal'
    }

    if (ePaymentStatus === 'R') {
      sTitle = 'Withdrawal failed!'
      sMessage = 'Sorry, we could not process your withdrawal request. Let\'s work together to fix it.'
      sPushType = 'Transaction'
    }
    if (ePaymentStatus === 'S') {
      sTitle = 'Withdrawal Successful!'
      sMessage = 'Your winnings have been successfully transferred to your bank account. Keep playing and winning on SportsBuzz11!'
      sPushType = 'Transaction'
    }

    if (user && user.aJwtTokens) {
      const tokens = user.aJwtTokens
      await sendNotification(tokens, sTitle, sMessage, sPushType)
    }

    withdrawalStatusNotify()
  } catch (error) {
    await queuePush('dead:pushNotification:Withdraw', data)
    handleCatchError(error)
    withdrawalStatusNotify()
  }
}

async function tdsStatusNotify() {
  let data
  try {
    let sMessage = ''
    let sTitle = ''
    data = await queuePop('pushNotification:TDS')
    if (!data) {
      setTimeout(() => { tdsStatusNotify() }, 2000)
      return
    }
    data = JSON.parse(data)

    let { iUserId = '', ePaymentStatus = '', sPushType = 'Transaction', nRequestedAmount = 0, nTDSAmount = 0, nPercentage = 30 } = data
    const user = await UserModel.findById(iUserId, { aJwtTokens: 1 }).lean()

    if (ePaymentStatus === 'S') {
      sTitle = 'TDS Deducted Successfully!'
      sMessage = `Dear User, we have successfully deducted TDS of ${nTDSAmount} on your recent winning withdrawal of ${nRequestedAmount}. For any queries or concerns, please reach out to our customer support team.`
      sPushType = 'Transaction'
    }

    if (user && user.aJwtTokens) {
      const tokens = user.aJwtTokens
      await sendNotification(tokens, sTitle, sMessage, sPushType)
    }

    tdsStatusNotify()
  } catch (error) {
    await queuePush('dead:pushNotification:TDS', data)
    handleCatchError(error)
    tdsStatusNotify()
  }
}

async function kycStatusNotify() {
  let data
  try {
    let sMessage = ''
    let sTitle = ''
    data = await queuePop('pushNotification:KYC')
    if (!data) {
      setTimeout(() => { kycStatusNotify() }, 2000)
      return
    }
    data = JSON.parse(data)

    let { iUserId = '', eStatus = '', sPushType = 'KYC', ePlatform = 'A' } = data
    const user = await UserModel.findById(iUserId, { aJwtTokens: 1 }).lean()

    if (eStatus === 'R') {
      sTitle = 'KYC Verification Failed :('
      sMessage = 'We`re sorry to inform you that we could not verify your account. Please contact our support team for assistance.'
      sPushType = 'KYC'
    }
    if (eStatus === 'A') {
      sTitle = 'KYC Verification Successful!'
      if (ePlatform === 'A') sMessage = 'Congrats! Your account is now fully verified and you can now make deposits to start playing.'
      if (ePlatform === 'I') sMessage = 'Congrats! Your account is now fully verified and you can now withdraw your winnings.'
      sPushType = 'Deposit'
    }

    if (user && user.aJwtTokens) {
      const tokens = user.aJwtTokens
      await sendNotification(tokens, sTitle, sMessage, sPushType)
    }

    kycStatusNotify()
  } catch (error) {
    await queuePush('dead:pushNotification:KYC', data)
    handleCatchError(error)
    kycStatusNotify()
  }
}

// for new flow
async function kycStatusMSNotify(data) {
  try {
    let sMessage = ''
    let sTitle = ''
    // if (!global.bShutdown) data = await queuePop('pushNotification:KYC')
    // if (!data) {
    //   setTimeout(() => { kycStatusNotify() }, 2000)
    //   return
    // }
    data = JSON.parse(data)

    let { iUserId = '', eStatus = '', ePlatform = data.ePlatform, sPushType = data.sPushType } = data
    const user = await UserModel.findById(iUserId, { aJwtTokens: 1 }).lean()

    if (eStatus === 'R') {
      if (sPushType === 'AADHAAR_FAILED' && ePlatform === 'A') {
        sTitle = 'KYC Verification Failed :('
        sMessage = 'We`re sorry to inform you that we could not verify your Aadhaar card. Please contact our support team for assistance.'
        sPushType = 'AADHAAR_FAILED'
      }
      if (sPushType === 'KYC_FAILED') {
        sTitle = 'KYC Verification Failed :('
        sMessage = 'We`re sorry to inform you that we could not verify your documents. Please contact our support team for assistance.'
        sPushType = 'KYC_FAILED'
      }
    }
    if (eStatus === 'A') {
      if (sPushType === 'AADHAAR_SUCCESS') {
        sTitle = 'KYC Verification Successful!'
        if (ePlatform === 'A') sMessage = 'Congrats! You are ready to make your first deposit.'
        sPushType = 'AADHAAR_SUCCESS'
      }
      if (sPushType === 'KYC_SUCCESS') {
        sTitle = 'KYC Verification Successful!'
        if (ePlatform === 'A' || ePlatform === 'I') sMessage = 'Congrats! Your account is now fully verified and you can now withdraw your winnings'
        sPushType = 'KYC_SUCCESS'
      }
    }
    if (user && user.aJwtTokens) {
      const tokens = user.aJwtTokens
      await sendNotification(tokens, sTitle, sMessage, sPushType)
    }

    // kycStatusNotify()
  } catch (error) {
    // await queuePush('dead:pushNotification:KYC', data)
    handleCatchError(error)
    // kycStatusNotify()
  }
}

async function kycStatusMSLogs(data) {
  try {
    // if (!global.bShutdown) data = await queuePop('pushNotification:KYC')
    // if (!data) {
    //   setTimeout(() => { kycStatusNotify() }, 2000)
    //   return
    // }
    data = JSON.parse(data)
    const { iAdminId, oldFields, newFields, userId, ip } = data
    if (iAdminId) {
      let logData = { iAdminId, oOldFields: oldFields, oNewFields: newFields, iUserId: userId, sIP: ip, eKey: 'KYC' }
      logData = await replaceSensitiveInfo(logData)
      adminLogQueue.publish(logData)
      // await adminServices.adminLog(null, null, logData)
    }
  } catch (error) {
    handleCatchError(error)
  }
}

async function kycStatUpdate (data) {
  await userBalanceServices.createAndupdateStatastics(data)
}

async function kycExpireBonus (data) {
  await userBalanceServices.bonusExpire()
}

async function registerReferNotifify() {
  let data
  try {
    data = await queuePop('pushNotification:registerReferBonus')
    if (!data) {
      setTimeout(() => { registerReferNotifify() }, 2000)
      return
    }
    data = JSON.parse(data)
    const { _id } = data
    const user = await UserModel.findById(_id, { aJwtTokens: 1 }).lean()
    if (user && user.aJwtTokens) {
      const tokens = user.aJwtTokens
      await sendNotification(tokens, 'Referral Bonus Credited!', 'Keep referring your friends for even more earnings!', 'Profile')
    }
    registerReferNotifify()
  } catch (error) {
    await queuePush('dead:pushNotification:registerReferBonus', data)
    handleCatchError(error)
    registerReferNotifify()
  }
}

async function sendSms() {
  let data
  try {
    data = await queuePop('sendSms')
    if (!data) {
      setTimeout(() => { sendSms() }, 2000)
      return
    }
    data = JSON.parse(data)
    // need to add code here
    const { sProvider, oUser } = data
    await sendOTPFromProvider(sProvider, oUser)
    sendSms()
  } catch (error) {
    await queuePush('dead:sendSms', data)
    handleCatchError(error)
    sendSms()
  }
}

async function sendMails() {
  let data
  try {
    data = await queuePop('SendMail')
    if (!data) {
      setTimeout(() => { sendMails() }, 2000)
      return
    }
    data = JSON.parse(data)

    const { sSlug, replaceData, to } = data

    const bEmail = await validateEmail(to)
    if (to && bEmail) {
      await sendMail({ sSlug: sSlug, replaceData: replaceData, to: to })
    }

    sendMails()
  } catch (error) {
    await queuePush('dead:SendMail', data)
    handleCatchError(error)
    sendMails()
  }
}

async function notificationScheduler() {
  let data
  try {
    data = await queuePop('NOTIFY')
    if (!data) {
      setTimeout(() => { notificationScheduler() }, 2000)
      return
    }
    data = JSON.parse(data)
    const { sTopic, sTitle, sMessage } = data
    // console.log('notificationScheduler :: Notification Topic Data from queue ::', data)
    // console.log(`notificationScheduler:: que pop at notification scheduler:*********** ${sTopic} ${sTitle} ${sMessage}`)
    await pushTopicNotification(sTopic, sTitle, sMessage)
    notificationScheduler()
  } catch (error) {
    // console.log('in notificationScheduler error ::', data)
    await queuePush('dead:NOTIFY', data)
    handleCatchError(error)
    notificationScheduler()
  }
}

async function notificationSchedulerV2(data) {
  try {
    // console.log(':: Notification Scheduler V2 Started ::')
    const { ePlatform, sTitle, sDescription } = data
    await pushTopicNotification(ePlatform, sTitle, sDescription)
  } catch (error) {
    // console.log('in notificationSchedulerV2 error ::', error)
    handleCatchError(error)
  }
}

async function processAuthLogs() {
  let data
  try {
    const length = await queueLen('AuthLogs')
    if (length <= 5) {
      setTimeout(() => { processAuthLogs() }, 2000)
      return
    }

    data = await bulkQueuePop('AuthLogs', 5)

    if (data && data.length) {
      data = data.map((d) => JSON.parse(d))
      await AuthLogsModel.insertMany(data)
    }
    setTimeout(() => { processAuthLogs() }, 2000)
  } catch (error) {
    await queuePush('dead:AuthLogs', data)
    handleCatchError(error)
    setTimeout(() => { processAuthLogs() }, 2000)
  }
}

async function prizeDistributionBySeries() {
  let data
  try {
    data = await queuePop('MatchSeriesRank')
    if (!data) {
      setTimeout(() => { prizeDistributionBySeries() }, 2000)
      return
    }
    data = JSON.parse(data)
    const { _id, aPrizeBreakup, iCategoryId } = data
    const userRank = SeriesLBUserRankModel.aggregate([
      {
        $match: {
          iSeriesId: ObjectId(_id),
          iCategoryId: ObjectId(iCategoryId)
        }
      }, {
        $group: {
          id: { $first: '$_id' },
          _id: '$nUserRank',
          count: { $sum: 1 },
          data: { $push: '$$ROOT' }
        }
      }, {
        $project: {
          _id: '$id',
          nRank: '$_id',
          data: 1,
          count: 1
        }
      }, {
        $sort: { nRank: 1 }
      }
    ]).allowDiskUse(bAllowDiskUse).cursor()

    for await (const user of userRank) {
      let sameRankTeamCount = 1
      if (user.count > 1) {
        sameRankTeamCount = user.count
      }
      const prize = getPrice(aPrizeBreakup, user.nRank, sameRankTeamCount)
      let { nTotalRealMoney, nTotalBonus, aTotalExtraWin } = prize

      nTotalRealMoney = sameRankTeamCount > 1 ? Number(((nTotalRealMoney / sameRankTeamCount).toFixed(2))) : nTotalRealMoney
      nTotalBonus = sameRankTeamCount > 1 ? Number(((nTotalBonus / sameRankTeamCount).toFixed(2))) : nTotalBonus

      const userRankUpdate = { nPrize: nTotalRealMoney, aExtraWin: aTotalExtraWin, nBonusWin: nTotalBonus, bPrizeCalculated: true }

      for (const d of user.data) {
        await SeriesLBUserRankModel.updateOne({ _id: ObjectId(d._id) }, userRankUpdate)
      }
    }
    await SeriesLeaderBoardModel.updateOne({ _id: ObjectId(_id), aSeriesCategory: { $elemMatch: { _id: ObjectId(iCategoryId) } } }, { 'aSeriesCategory.$.bPrizeDone': true })
    prizeDistributionBySeries()
  } catch (error) {
    await queuePush('dead:MatchSeriesRank', data)
    handleCatchError(error)
    prizeDistributionBySeries()
  }
}

async function validateCashfreeToken(iUserId, iWithdrawId, iPassbookId) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        let existToken = await redisClient.get('CashfreePayoutToken')
        if (!existToken) {
          const response = await axios.post(`${config.CASHFREE_BASEURL}/${config.CASHFREE_AUTHORIZE_PATH}`, {}, { headers: { 'X-Client-Id': config.CASHFREE_CLIENTID, 'X-Client-Secret': config.CASHFREE_CLIENTSECRET } })
          if (response.data.subCode === '200') {
            existToken = response.data.data.token
            await redisClient.setex('CashfreePayoutToken', 300, existToken)
          }
          const error = { isVerify: false, ...response.data }
          if (response.data.subCode === '403' && response.data.message === 'IP not whitelisted') {
            return reject(error)
          }
        }
        const getVerifyFirst = await axios.post(`${config.CASHFREE_BASEURL}/${config.CASHFREE_VERIFY_PATH}`, {}, { headers: { Authorization: `Bearer ${existToken}` } })
        // const logData = { iUserId, iWithdrawId, iPassbookId, eGateway: 'CASHFREE', eType: 'W', oRes: getVerifyFirst ? getVerifyFirst.data : {} }
        // await queuePush('TransactionLog', logData)

        if (getVerifyFirst.data.subCode === '200') {
          return resolve({ isVerify: true, Token: existToken })
        }
      } catch (error) {
        const rejectReason = { success: false, ...error }
        handleCatchError(rejectReason)
      }
    })()
  })
}

async function getBenficiaryDetails(iUserId, iWithdrawId, iPassbookId) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const { isVerify, Token } = await validateCashfreeToken(iUserId, iWithdrawId, iPassbookId)
        if (isVerify) {
          const response = await axios.get(`${config.CASHFREE_BASEURL}/${config.CASHFREE_GETBENEFICIARY_PATH}/${iUserId}`, { headers: { Authorization: `Bearer ${Token}` } })

          const logData = { iUserId, iWithdrawId, iPassbookId, eGateway: 'CASHFREE', eType: 'W', oRes: response ? response.data : {} }
          // await queuePush('TransactionLog', logData)
          transactionLogQueue.publish(logData)

          const { success, status, message } = await handleCashfreeError(response)
          if (!success && status !== '404') {
            const err = { success, status, message }
            return resolve(err)
          } else if (!success && status === '404') {
            const add = await addBeneficiary(iUserId, iWithdrawId, iPassbookId)
            return resolve(add)
          } else {
            return resolve({ success: true })
          }
        }
      } catch (error) {
        return resolve({ success: false, ...error })
      }
    })()
  })
}

async function addBeneficiary(iUserId, iWithdrawId, iPassbookId) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const { isVerify, Token } = await validateCashfreeToken(iUserId, iWithdrawId, iPassbookId)
        if (isVerify) {
          const bankDetails = await BankModel.findOne({ iUserId }, {}, { readPreference: 'primary' }).populate([{ path: 'iUserId', select: 'iStateId iCityId sAddress nPinCode sMobNum sEmail', populate: { path: 'iStateId iCityId' } }]).lean()

          let { sBranchName: address1, sAccountHolderName: name, sAccountNo: bankAccount, sIFSC: ifsc, iUserId: user } = bankDetails
          let { _id: beneId, sEmail: email, sMobNum: phone, iStateId: state = 'Gujarat', iCityId: city = 'Ahmedabad', nPinCode: pincode = 350005 } = user
          email = !email ? config.CASHFREE_MAIL_DEFAULT_ACCOUNT : email

          if (typeof state === 'number') {
            const stateData = await StateModel.findOne({ id: state }, { sName: 1 }).lean()
            state = stateData.sName.replace(/[^A-Za-z]/gi, '')
          }
          if (typeof city === 'number') {
            const cityData = await CityModel.findOne({ id: city }, { sName: 1 }).lean()
            city = cityData.sName.replace(/[^A-Za-z]/gi, '')
          }
          bankAccount = decryption(bankAccount)
          const benData = JSON.stringify({ beneId, name, email, phone, bankAccount, ifsc, address1, city, state, pincode })

          const response = await axios.post(`${config.CASHFREE_BASEURL}/${config.CASHFREE_ADDBENEFICIARY_PATH}`, benData, { headers: { Authorization: `Bearer ${Token}` } })

          const logData = { iUserId, iWithdrawId, iPassbookId, eGateway: 'CASHFREE', eType: 'W', oReq: JSON.parse(benData), oRes: response ? response.data : {} }
          // await queuePush('TransactionLog', logData)
          transactionLogQueue.publish(logData)

          const { success, status, message } = await handleCashfreeError(response)
          if (!success) {
            if (status === '409' && message === 'Entered bank Account is already registered') {
              const { success, status, message, beneId } = await getBeneficiaryId(bankAccount, ifsc, iWithdrawId, iPassbookId, iUserId)
              if (success) {
                await removeBeneficiary(beneId, iWithdrawId, iPassbookId)
                const add = await addBeneficiary(iUserId, iWithdrawId, iPassbookId)
                return resolve(add)
              } else {
                const err = { success, status, message }
                return resolve(err)
              }
            } else {
              const err = { success, status, message }
              return resolve(err)
            }
          } else { return resolve({ success: true }) }
        }
      } catch (error) {
        return resolve({ success: false, ...error })
      }
    })()
  })
}

async function getBeneficiaryId(bankAccount, ifsc, iWithdrawId, iPassbookId, iUserId) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const { isVerify, Token } = await validateCashfreeToken(iUserId, iWithdrawId, iPassbookId)
        if (isVerify) {
          const response = await axios.get(`${config.CASHFREE_BASEURL}/${config.CASHFREE_GETBENEFICIARYID_PATH}?bankAccount=${bankAccount}&ifsc=${ifsc}`, { headers: { Authorization: `Bearer ${Token}` } })
          const logData = { iWithdrawId, iPassbookId, eGateway: 'CASHFREE', eType: 'W', oReq: { bankAccount, ifsc }, oRes: response ? response.data : {} }
          // await queuePush('TransactionLog', logData)
          transactionLogQueue.publish(logData)

          const { success, status, message } = await handleCashfreeError(response)
          if (success) {
            return resolve({ success: true, beneId: response.data.data.beneId })
          } else {
            const err = { success, status, message }
            return resolve(err)
          }
        }
      } catch (error) {
        return resolve({ success: false, ...error })
      }
    })()
  })
}

async function removeBeneficiary(iUserId, iWithdrawId, iPassbookId) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const { isVerify, Token } = await validateCashfreeToken(iUserId, iWithdrawId, iPassbookId)
        if (isVerify) {
          const benData = JSON.stringify({ beneId: iUserId })
          const response = await axios.post(`${config.CASHFREE_BASEURL}/${config.CASHFREE_REMOVEBENEFICIARY_PATH}`, benData, { headers: { Authorization: `Bearer ${Token}` } })

          const logData = { iUserId, iWithdrawId, iPassbookId, eGateway: 'CASHFREE', eType: 'W', oReq: {}, oRes: response ? response.data : {} }
          // await queuePush('TransactionLog', logData)
          transactionLogQueue.publish(logData)

          return resolve({ success: true })
        }
      } catch (error) {
        handleCatchError(error)
        return resolve({ success: false, ...error })
      }
    })()
  })
}

async function handleCashfreeError(response) {
  return new Promise((resolve, reject) => {
    const { data } = response
    const { subCode, message, status } = data
    if (subCode === '200') {
      return resolve({ success: true })
    }
    return resolve({ success: false, status: subCode, message, sCurrentStatus: status })
  })
}

async function requestTransfer(data) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const { iUserId, nFinalAmount, iWithdrawId, iAdminId, iPassbookId, id } = data
        const { isVerify, Token } = await validateCashfreeToken(iUserId, iWithdrawId, iPassbookId)
        const tranferData = JSON.stringify({
          beneId: iUserId,
          amount: nFinalAmount,
          transferId: id || iWithdrawId
        })
        if (isVerify) {
          const response = await axios.post(`${config.CASHFREE_BASEURL}/${config.CASHFREE_TRANSFER_PATH}`, tranferData, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Token}` } })

          const logData = { iUserId, iAdminId, iWithdrawId, iPassbookId, eGateway: 'CASHFREE', eType: 'W', oReq: { nFinalAmount, transferId: id || iWithdrawId }, oRes: response ? response.data : {} }
          // await queuePush('TransactionLog', logData)
          transactionLogQueue.publish(logData)

          const { success, status, message, sCurrentStatus } = await handleCashfreeError(response)
          if (!success) {
            if ((status === '409' || status === '400') && message === 'Transfer Id already exists') {
              const iNewWithdrawId = data.id || iWithdrawId
              const id = `${CASHFREE_ORDERID_PREFIX}${iNewWithdrawId}`
              const reqTransData = { iUserId, nFinalAmount, iWithdrawId, iAdminId, iPassbookId, id }
              const newData = await requestTransfer(reqTransData)
              return resolve(newData)
            } else {
              const err = { success, status, message, sCurrentStatus, referenceId: (response.data && response.data.data) ? response.data.data.referenceId : null }
              return resolve(err)
            }
          } else {
            return resolve({ success: true, referenceId: response.data.data.referenceId })
          }
        }
      } catch (error) {
        return resolve({ success: false, ...error })
      }
    })()
  })
}

async function getUserBalance(iUserId, iWithdrawId, iPassbookId) {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const { isVerify, Token } = await validateCashfreeToken(iUserId, iWithdrawId, iPassbookId)
        if (isVerify) {
          const response = await axios.get(`${config.CASHFREE_BASEURL}/${config.CASHFREE_GETBALANCE_PATH}`, { headers: { Authorization: `Bearer ${Token}` } })

          const logData = { iUserId, iWithdrawId, iPassbookId, eGateway: 'CASHFREE', eType: 'W', oRes: response ? response.data : {} }
          // await queuePush('TransactionLog', logData)
          transactionLogQueue.publish(logData)

          const { success, status, message } = await handleCashfreeError(response)
          if (!success) {
            const err = { success, status, message }
            return resolve(err)
          } else {
            return resolve({ success: true })
          }
        }
      } catch (error) {
        return resolve({ success: false, ...error })
      }
    })()
  })
}

async function processTransactionLog() {
  let data
  try {
    const length = await queueLen('TransactionLog')

    if (length <= config.TRANSACTION_LOG_BULK_INSERT_SIZE) {
      setTimeout(() => { processTransactionLog() }, 2000)
      return
    }
    data = await bulkQueuePop('TransactionLog', config.TRANSACTION_LOG_BULK_INSERT_SIZE)
    data = data.map((d) => JSON.parse(d))

    await TransactionLogModel.insertMany(data)
    processTransactionLog()
  } catch (error) {
    await queuePush('dead:TransactionLog', data)
    handleCatchError(error)
    processTransactionLog()
  }
}

async function calculateTotalScorePointV2(data) {
  try {
    data = JSON.parse(data)
    console.log(`data for score calculation ${data}`)
    console.time(`calculateTotalScorePointV2-${data.sHash}`)
    const { eCategory } = data
    const oMatchPlayers = {}
    const aBulkUserTeam = []
    const aBulkUserLeague = []
    const aBulkMatchTeam = []

    let playerRolesBycatagory = await getPlayerRoles(eCategory)
    if (!playerRolesBycatagory) {
      playerRolesBycatagory = await PlayerRoleModel.findOne({ eCategory: eCategory }).lean()
      await setPlayerRoles(eCategory, playerRolesBycatagory)
    }
    const [MatchTeams, allMatchPlayers] = await Promise.all([MatchTeamsModel.find({ iMatchId: data.iMatchId, sHash: data.sHash }).select({ aPlayers: 1 }).lean(), MatchPlayerModel.find({ iMatchId: data.iMatchId }).select({ nScoredPoints: 1 }).lean()])
    allMatchPlayers.forEach((player) => {
      oMatchPlayers[player._id] = player.nScoredPoints
    })
    let totalPoint = 0
    let playersUpdatedPoints = []
    MatchTeams.forEach((eachTeam) => {
      if (totalPoint === 0) {
        eachTeam.aPlayers.forEach(eachPlayer => {
          eachPlayer.nScoredPoints = oMatchPlayers[eachPlayer.iMatchPlayerId]
        })
        playersUpdatedPoints = eachTeam.aPlayers.map((player) => { // calculate total team point
          const { iMatchPlayerId, nScoredPoints = 0 } = player
          totalPoint = totalPoint + nScoredPoints
          return { iTeamId: player.iTeamId, iMatchPlayerId, nScoredPoints }
        })
      }

      aBulkMatchTeam.push({
        updateOne: {
          filter: { _id: ObjectId(eachTeam._id) },
          update: { $set: { nTotalPoint: totalPoint, aPlayers: playersUpdatedPoints } }
        }
      })
    })

    const userTeams = await UserTeamModel.find({ iMatchId: ObjectId(data.iMatchId), sHash: data.sHash, bPointCalculated: false }).read('primary').readConcern('majority')
    userTeams.forEach((eachUserTeam) => {
      if (!userTeams) return
      let nTotalPoints = totalPoint - (oMatchPlayers[eachUserTeam.iViceCaptainId.toString()] + oMatchPlayers[eachUserTeam.iCaptainId.toString()])
      // calculate and update captain and viceCaption point
      nTotalPoints = nTotalPoints + (oMatchPlayers[eachUserTeam.iViceCaptainId.toString()] * playerRolesBycatagory.nViceCaptainPoint) + (oMatchPlayers[eachUserTeam.iCaptainId.toString()] * playerRolesBycatagory.nCaptainPoint)
      aBulkUserTeam.push({
        updateOne: {
          filter: { _id: ObjectId(eachUserTeam._id) },
          update: { $set: { nTotalPoints, bPointCalculated: true } }
        }
      })
      aBulkUserLeague.push({
        updateMany: {
          filter: { iUserTeamId: ObjectId(eachUserTeam._id) },
          update: { $set: { nTotalPoints, bPointCalculated: true } }
        }
      })
    })

    await Promise.all([
      MatchTeamsModel.bulkWrite(aBulkMatchTeam, { writeConcern: { w: 'majority' }, ordered: false }),
      UserTeamModel.bulkWrite(aBulkUserTeam, { writeConcern: { w: 'majority' }, ordered: false }),
      UserLeagueModel.bulkWrite(aBulkUserLeague, { writeConcern: { w: 'majority' }, ordered: false })
    ])
    console.timeEnd(`calculateTotalScorePointV2-${data.sHash}`)
  } catch (error) {
    console.log('Error :: ', data)
    handleCatchError(error)
  }
}

async function processAdminLog() {
  let data
  try {
    const length = await queueLen('AdminLogs')

    if (length <= ADMIN_LOG_BULK_INSERT_SIZE) {
      setTimeout(() => { processAdminLog() }, 2000)
      return
    }
    data = await bulkQueuePop('AdminLogs', ADMIN_LOG_BULK_INSERT_SIZE)

    if (data && data.length) {
      data = data.map((d) => JSON.parse(d))
      await AdminLogModel.insertMany(data)
    }
    setTimeout(() => { processAdminLog() }, 2000)
  } catch (error) {
    await queuePush('dead:AdminLogs', data)
    handleCatchError(error)
    setTimeout(() => { processAdminLog() }, 2000)
  }
}

async function processPaymentQueue() {
  let data
  try {
    data = await bulkQueuePop('ProcessPayment', config.PROCESS_PAYMENT_RATE_LIMIT)

    if (!data || !data.length) {
      setTimeout(() => { processPaymentQueue() }, 60000)
      return
    }

    data = data.map((d) => JSON.parse(d))
    for (const deposit of data) {
      const { id, ePaymentGateway, iOrderId } = deposit
      if (['CASHFREE', 'CASHFREE_UPI'].includes(ePaymentGateway)) {
        const { isSuccess, payload } = await checkCashfreeStatus(iOrderId)
        if (isSuccess) {
          await processPayment(deposit, payload)
        }
      }
    }
    setTimeout(() => { processPaymentQueue() }, 2000)
  } catch (error) {
    await queuePush('dead:ProcessPayment', data)
    handleCatchError(error)
    setTimeout(() => { processPaymentQueue() }, 60000)
  }
}

async function liveMatchScorePointCalculation() {
  let data
  try {
    data = await queuePop('LiveLeaderBoard')
    if (!data) {
      setTimeout(() => { liveMatchScorePointCalculation() }, 2000)
      return
    }
    data = JSON.parse(data)
    const { eCategory, _id } = data
    const oMatch = await MatchModel.findOne({ _id: ObjectId(_id), eStatus: 'L' }).lean()

    if (!oMatch) {
      liveMatchScorePointCalculation()
    }

    let oRes = {}
    if (eCategory === 'CRICKET') {
      oRes = await calculateScorePointCricket(data)
    } else if (eCategory === 'FOOTBALL') {
      oRes = await calculateScorePointFootball(data)
    } else if (eCategory === 'BASKETBALL') {
      oRes = await calculateScorePointBasketball(data)
    } else if (eCategory === 'KABADDI') {
      oRes = await calculateScorePointKabaddi(data)
    }

    if (oRes.isSuccess) {
      calculateTotalScorePoint(oRes)
    }

    liveMatchScorePointCalculation()
  } catch (error) {
    await queuePush('dead:LiveLeaderBoard', data)
    handleCatchError(error)
    setTimeout(() => { liveMatchScorePointCalculation() }, 2000)
  }
}

setTimeout(() => {
  // CopyTeamUpdate()
  // processTransactionLog()
  // calculateTotalScorePointV2()
  // processAdminLog()// method moved to LOG_MS
  kycStatusNotify()
  // winNotify()
  depositStatusNotify()
  withdrawalStatusNotify()
  tdsStatusNotify()
}, 2000)

setTimeout(() => {
  processPaymentQueue()
}, 60000)

if (NODE_ENV !== 'production' || POD_ENV === 'cron') {
  setTimeout(() => {
    generateFairPlayV2()
    prizeDistributionBySeries()
    liveMatchScorePointCalculation()
  }, 2000)
}
module.exports = {
  matchLive,
  generateFairPlay,
  pushPlayReturnNotify,
  autoCreateLeague,
  referCodeBonusNotify,
  registerBonusNotify,
  registerReferNotifify,
  sendSms,
  sendMails,
  sendNotification,
  notificationScheduler,
  prizeDistributionBySeries,
  validateCashfreeToken,
  getBenficiaryDetails,
  addBeneficiary,
  requestTransfer,
  getUserBalance,
  processAuthLogs,
  processMatchLeague,
  checkRedisJoinedCount,
  processUserCashbackReturnV2,
  removeBeneficiary,
  // processTransactionLog,
  notificationSchedulerV2,
  calculateTotalScorePointV2,
  winNotify,
  kycStatusMSNotify,
  kycStatusMSLogs,
  kycStatUpdate,
  kycExpireBonus
}
