const {checkWatcher, startNPMWatcher} = require('./watchNPM')
const redis = require('redis')
const amqp = require('amqplib')
const logger = require('~/src/logging').logger(module)
const config = require('~/src/config')
config.load()

;(async () => {
  const connection = await amqp.connect(config.amqUrl)
  const channel = await connection.createChannel()
  await channel.assertQueue(config.queueName)
  const client = redis.createClient(config.redisURL)

  const run = async function () {
    try {
      const changes = await startNPMWatcher(channel, client)
      await checkWatcher(changes, client)
      return run()
    } catch (error) {
      logger.error(error)
      return run()
    }
  }
})()
