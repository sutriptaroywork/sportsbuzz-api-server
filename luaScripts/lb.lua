local r=redis.call('ZREVRANGE', KEYS[1], ARGV[1], ARGV[2], 'WITHSCORES')
local arr = {}

for i=1,#r,2 do
  local storeIndex = (i + 1) / 2
  arr[storeIndex] = {}
  arr[storeIndex][1] = r[i]
  arr[storeIndex][2] = r[i+1]
  arr[storeIndex][3] = redis.call('ZREVRANK', KEYS[1], r[i])
  arr[storeIndex][3] = arr[storeIndex][3] + 1
end

return arr
