const ChangesStream = require('changes-stream')
const EventEmitter = require('events')

const Promise = require('bluebird')

const { createProducer } = require('windbreaker-service-util/queue')

const DependencyUpdate = require('windbreaker-service-util/models/events/dependency/DependencyUpdate')
const DependencyType = require('windbreaker-service-util/models/events/dependency/DependencyType')

const Event = require('windbreaker-service-util/models/events/Event')
const EventType = require('windbreaker-service-util/models/events/EventType')

const { NPM: NPM_TYPE } = DependencyType

// Wait times in ms
const PRODUCER_SETUP_DELAY = 1000
const CHANGES_STREAM_SETUP_DELAY = 1000

class UpdatesPublisher extends EventEmitter {
  constructor (options) {
    super()
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
      await Promise.delay(PRODUCER_SETUP_DELAY)
      await this.setupProducer()
    }

    this.emit('producer-created', this._producer)
  }

  async setupChanges () {
    const {_registryUrl, logger} = this
    this._changes = new ChangesStream({
      db: _registryUrl,
      since: 'now',
      include_docs: true
    })
    logger.info('changes stream successfully created')

    this.emit('changes-stream-created', this._changes)
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
      this.emit('error', new Error('Error received from prodcuer', error))
      logger.info('Restarting producer and changes stream')

      this._changes.destroy()
      await this._producer.stop()
      await Promise.delay(PRODUCER_SETUP_DELAY)
      this.start(true)
    })

    changesStream.on('error', async (error) => {
      this.emit('error', new Error('Error received from changes stream', error))
      logger.info('Restarting changes stream')

      this._changes.destroy()
      await this.setupChanges()
      await Promise.delay(CHANGES_STREAM_SETUP_DELAY)
      this.start()
    })

    changesStream.on('data', async ({ doc: npmDoc }) => {
      const {
        name,
        'dist-tags': distTags
      } = npmDoc

      const { latest: version } = distTags

      logger.info(`Received update for package: ${name}, version: ${version}`)

      const errors = []

      const update = DependencyUpdate.wrap({
        name,
        version,
        type: NPM_TYPE
      }, errors)

      if (errors.length) {
        const error = new Error(`Unable wrap npm dependency date Errors: "${errors.join(', ')}"`)
        return this.emit('error', error)
      }

      const message = new Event({
        type: EventType.DEPENDENCY_UPDATE,
        data: update
      })

      // publish update to queue
      await producer.sendMessage(message)
    })
  }

  async stop () {
    const { logger } = this
    if (this._changes) {
      this._changes.destroy()
    }
    if (this._producer) {
      await this._producer.stop()
    }
    logger.info('Stopping UpdatesPublisher')
  }
}

module.exports = UpdatesPublisher
