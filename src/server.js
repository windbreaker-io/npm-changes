require('require-self-ref')
const config = require('~/src/config')
config.load()
const logger = require('~/src/logging').logger(module)
const {createProducer} = require('windbreaker-service-util/queue')
const ChangesStream = require('changes-stream')
const Promise = require('bluebird')

const producerOptions = {
  queueName: config.getQueueName()
}

const amqUrl = config.getAmqUrl()

class UpdatesPublisher {
  async setupProducer () {
    try {
      this.producer = await createProducer({logger, amqUrl, producerOptions})
    } catch (error) {
      logger.error(error)
      logger.info('error creating producer, retrying ...')
      await Promise.delay(500)
      await this.setupProducer()
    }
  }

  async setupChanges () {
    try {
      this.changes = new ChangesStream({
        db: config.getRegistryUrl(),
        since: 'now',
        include_docs: true
      })
    } catch (error) {
      logger.error(error)
      logger.info('error creating ChangesStream, retrying ...')
      await Promise.delay(500)
      await this.setupChanges()
    }
  }

  async start (setup) {
    if (setup) {
      await this.setupProducer()
      await this.setupChanges()
    }

    this.producer.on('error', async (error) => {
      logger.error(error)
      logger.info('error emitted from producer, restarting it and changes stream')
      this.changes.destroy()
      await this.producer.stop()
      await Promise.delay(1000)
      await this.start(true)
    })

    this.changes.on('error', async (error) => {
      logger.error(error)
      logger.info('error emitted from changesStream, restarting it')
      this.changes.destroy()
      await this.setupChanges()
      await Promise.delay(1000)
      await this.start()
    })

    this.changes.on('data', async (data) => {
      console.log('got data: ' + data)
    })
  }
}

;(async () => {
  const updatesPub = new UpdatesPublisher()
  await updatesPub.start(true)
})()
