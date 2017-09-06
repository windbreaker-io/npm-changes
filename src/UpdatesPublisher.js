const Promise = require('bluebird')
const ChangesStream = require('changes-stream')

const { createProducer } = require('windbreaker-service-util/queue')

const DependencyUpdate = require('windbreaker-service-util/models/events/dependency/DependencyUpdate')
const DependencyType = require('windbreaker-service-util/models/events/dependency/DependencyType')

const Event = require('windbreaker-service-util/models/events/Event')
const EventType = require('windbreaker-service-util/models/events/EventType')

const { NPM: NPM_TYPE } = DependencyType

// Wait times in ms
const setupProducerWaitTime = 500
const producerStopWaitTime = 1000
const setupChangesWaitTime = 1000

class UpdatesPublisher {
  constructor (options) {
    this._producerOptions = options.producerOptions
    this._amqUrl = options.amqUrl
    this._registryUrl = options.registryUrl
    this.logger = options.logger
  }

  async setupProducer () {
    const { logger, _amqUrl, _producerOptions } = this

    try {
      this._producer = await createProducer({
        logger,
        amqUrl: _amqUrl,
        producerOptions: _producerOptions
      })

      logger.info('producer successfully created')
    } catch (error) {
      logger.error('Error creating producer', error)
      logger.info('Attempting to reinitialize queue producer')
      await Promise.delay(setupProducerWaitTime)
      await this.setupProducer()
    }
  }

  async setupChanges () {
    const {_registryUrl, logger} = this
    this._changes = new ChangesStream({
      db: _registryUrl,
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

    const {
      logger,
      _producer: producer,
      _changes: changesStream
    } = this

    producer.on('error', async (error) => {
      logger.error('Error received from producer', error)
      logger.info('Restarting producer and changes stream')
      this._changes.destroy()
      await this._producer.stop()
      await Promise.delay(producerStopWaitTime)
      await this.start(true)
    })

    changesStream.on('error', async (error) => {
      logger.error('Error received from changes stream', error)
      logger.info('Restarting changes stream')
      this._changes.destroy()
      await this.setupChanges()
      await Promise.delay(setupChangesWaitTime)
      await this.start()
    })

    changesStream.on('data', async ({ doc: npmDoc }) => {
      const {
        name,
        'dist-tags': distTags
      } = npmDoc

      const { latest: version } = distTags

      logger.info(`Received update for package: ${name}, version: ${version}`)

      const update = DependencyUpdate.wrap({
        name,
        version,
        type: NPM_TYPE
      })

      const message = new Event({
        type: EventType.DEPENDENCY_UPDATE,
        data: update
      })

      // publish update to queue
      await producer.sendMessage(message)
    })
  }

  async stop () {
    const {logger} = this
    if (this._changes) {
      this._changes.destroy()
    }
    if (this._producer) {
      await this._producer.stop()
    }
    logger.info('stopping UpdatesPublisher')
  }
}

module.exports = UpdatesPublisher
