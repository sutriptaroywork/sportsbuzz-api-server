local teams = {}
local allScores = redis.call('ZMSCORE', KEYS[1], unpack(ARGV))

for i, key in ipairs(ARGV) do
  local data = {}
  local score = allScores[i]
  if score ~= nil then
    table.insert(data, key)
    table.insert(data, score)
    
    local sameScoreMembers = redis.call('zrange', KEYS[1] , score, score, 'BYSCORE', 'REV', 'limit', 0, 1)

    local checkRank = redis.call('ZREVRANK', KEYS[1], sameScoreMembers[1])
    
    table.insert(data, checkRank + 1)
    table.insert(teams, data)
  end
end
return teams