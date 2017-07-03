require('require-self-ref')
const {checkWatcher, startNPMWatcher} = require('./watchNPM')
const redis = require('redis')
const logger = require('~/src/logging').logger(module)
const config = require('~/src/config')
const queue = require('windbreaker-service-util/queue')
const Promise = require('bluebird')
config.load()

;(async () => {
  let connection = null
  let channel = null
  let client = null
  const AmqUrl = config.getAmqUrl()
  const setup = async function () {
    try {
      connection = await queue.createConnection({
        logger,
        AmqUrl
      })
      channel = await connection.createChannel()
      await channel.assertQueue(config.getQueueName())
      client = redis.createClient(config.getRedisURL())
    } catch (error) {
      logger.info(error)
      logger.info('state: ' + {connection, channel, client})
      logger.info('cleaning up and restarting setup')
      client = null
      if (channel) {
        channel.close()
        channel = null
      }
      if (connection) {
        connection.close()
        connection = null
      }
      await Promise.delay(1000).then(async function () {
        await setup()
      })
    }
  }
  const watch = async function () {
    console.log('todo')
  }
  await setup()
  watch()
})()
