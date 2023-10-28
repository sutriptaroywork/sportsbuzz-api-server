local teams = {}
local allScores = redis.call('ZMSCORE', KEYS[1], unpack(ARGV))

for i, key in ipairs(ARGV) do
  local data = {}
  table.insert(data, key)
  local score = allScores[i]
  table.insert(data, score)
  local sameScoreMembers = redis.call('zrangebyscore', KEYS[1] , score, score)

  local rank
  for i, s in ipairs(sameScoreMembers) do
    local checkRank = redis.call('ZREVRANK', KEYS[1], s)
    if rank == nil and checkRank ~= nil then
      rank = checkRank
    end
    if rank ~= nil and checkRank < rank then
        rank = checkRank
    end
  end
  table.insert(data, rank + 1)
  table.insert(teams, data)
end
return teams