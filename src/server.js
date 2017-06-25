require('require-self-ref')
const {checkWatcher, startNPMWatcher} = require('./watchNPM')
const redis = require('redis')
const logger = require('~/src/logging').logger(module)
const config = require('~/src/config')
const queue = require('windbreaker-service-util/queue')
config.load()

;(async () => {
  const AmqUrl = config.getAmqUrl()
  const connection = await queue.createConnection({
    logger,
    AmqUrl
  })
  const channel = await connection.createChannel()
  await channel.assertQueue(config.getQueueName())
  const client = redis.createClient(config.getRedisURL())
  const run = async function () {
    try {
      const changes = await startNPMWatcher(channel, client)
      await setTimeout(checkWatcher(changes, client), 10000)
      return setTimeout(run(), 10000)
    } catch (error) {
      logger.error(error)
    } finally {
      setTimeout(run(), 10000)
    }
  }
})()
