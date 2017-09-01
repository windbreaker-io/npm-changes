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
  const updatesPub = new UpdatesPublisher({
    producerOptions,
    amqUrl,
    registryUrl,
    logger
  })
  await updatesPub.start(true)
})()
