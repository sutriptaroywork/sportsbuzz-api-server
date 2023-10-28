local cursor = "0"
local done

repeat
    local result = redis.call("SCAN", cursor, "match", "ml:" .. KEYS[1] .. ":*", "count", 100)

    cursor = result[1];
    local keys_returned = result[2];

    for i, key in ipairs(keys_returned) do
      local allMembers = redis.call('ZRANGE', key, 0, -1)
      local toUpdateLB = {}

      for i, singleMember in ipairs(allMembers) do
        local scoredPoints = redis.call('HGET', "matchTeams:" .. KEYS[1], singleMember)
        if scoredPoints ~= nil then
          redis.call('ZADD', key, scoredPoints, singleMember)
        else
          redis.call('ZADD', key, 0, singleMember)
        end
      end

      redis.call('EXPIRE', key, 86400)
      redis.call('HSET', 'h' .. key, 'putTime', redis.call('TIME')[1] * 1000)
      redis.call('EXPIRE', 'h' .. key, 86400)
    end

    if cursor == "0" then
        done = true;
    end

until done

return true
