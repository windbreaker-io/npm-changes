require('require-self-ref')
const config = require('~/src/config')
config.load()
const logger = require('~/src/logging').logger(module)

;(async () => {
  const producerOptions = {
    queueName: config.getQueueName()
  }

  const updatesPub = require('./UpdatesPublisher')
  updatesPub.configure(producerOptions, config.getAmqUrl(), config.getRegistryUrl(), logger)
  await updatesPub.start(true)
})()
