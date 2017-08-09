const {createProducer} = require('windbreaker-service-util/queue')
const ChangesStream = require('changes-stream')
const Promise = require('bluebird')

class UpdatesPublisher {
  constructor (options) {
    this.producerOptions = options.producerOptions
    this.amqUrl = options.amqUrl
    this.registryUrl = options.registryUrl
    this.logger = options.logger
  }

  async setupProducer () {
    const {logger, amqUrl, producerOptions} = this
    try {
      this.producer = await createProducer({logger, amqUrl, producerOptions})
      logger.info('producer successfully created')
    } catch (error) {
      logger.error(error)
      logger.info('error creating producer, retrying ...')
      await Promise.delay(500)
      await this.setupProducer()
    }
  }

  async setupChanges () {
    const {registryUrl, logger} = this
    this.changes = new ChangesStream({
      db: registryUrl,
      since: 'now',
      include_docs: true
    })
    logger.info('changes stream successfully created')
  }

  async start (setup) {
    if (setup) {
      await this.setupProducer()
      await this.setupChanges()
    }
    const {logger} = this
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
      logger.info('changes detected')
      await this.producer.sendMessage(data)
      logger.info('data: ' + JSON.stringify(data))
      logger.info('successfully published changes')
    })
  }

  async stop () {
    const {logger} = this
    this.changes.destroy()
    await this.producer.stop()
    logger.info('stopping UpdatesPublisher')
  }
}

module.exports = UpdatesPublisher
