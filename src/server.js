require('require-self-ref')

;(async () => {
  const config = require('~/src/config')
  await config.load()
  const logger = require('~/src/logging').logger(module)
  const UpdatesPublisher = require('./UpdatesPublisher')

  const producerOptions = {
    queueName: config.getQueueName()
  }
  const amqUrl = config.getAmqUrl()
  const registryUrl = config.getRegistryUrl()
  const updatesPublisher = new UpdatesPublisher({
    producerOptions,
    amqUrl,
    registryUrl,
    logger
  })

  updatesPublisher.on('error', (error) => {
    logger.error(error)

    // TODO: consider tearing down after encountering
    // receiving too many errors
  })

  await updatesPublisher.start(true)
})()
