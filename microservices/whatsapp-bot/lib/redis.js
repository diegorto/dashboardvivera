require('dotenv').config()
const Redis = require('ioredis')

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  keyPrefix: process.env.REDIS_PREFIX || 'wabot:',
  lazyConnect: false,
  maxRetriesPerRequest: 2
})

redis.on('error', (e) => console.error('[redis] erro:', e.message))

module.exports = redis
