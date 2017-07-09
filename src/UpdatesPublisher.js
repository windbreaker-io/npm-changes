const {createProducer} = require('windbreaker-service-util/queue')
const ChangesStream = require('changes-stream')
const Promise = require('bluebird')

let producerOptions = null
let amqUrl = null
let logger = null
let registryUrl = null

class UpdatesPublisher {

  configure (_producerOptions, _amqUrl, _registryUrl, _logger) {
    producerOptions = _producerOptions
    amqUrl = _amqUrl
    registryUrl = _registryUrl
    logger = _logger
  }

  async setupProducer () {
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
    try {
      this.changes = new ChangesStream({
        db: registryUrl,
        since: 'now',
        include_docs: true
      })
      logger.info('changes stream successfully created')
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
      logger.info('changes detected')
      await this.producer.sendMessage(data)
      logger.info('successfully published changes')
    })
  }
}

module.exports = new UpdatesPublisher()
