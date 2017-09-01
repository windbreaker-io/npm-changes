require('require-self-ref')
const test = require('ava')
const sinon = require('sinon')
const Promise = require('bluebird')
const config = require('~/src/config')
const {createConsumer} = require('windbreaker-service-util/queue')
const UpdatesPublisher = require('~/src/UpdatesPublisher')
const uuid = require('uuid')

test.before(async () => {
  return config.load()
})

test.beforeEach('setup env', (t) => {
  const queueName = `queue-${uuid.v4()}`

  const producerOptions = {
    queueName: queueName
  }

  const consumerOptions = {
    queueName: producerOptions.queueName
  }

  const amqUrl = config.getAmqUrl()

  const updatesPub = new UpdatesPublisher({
    producerOptions,
    amqUrl,
    registryUrl: 'www.notasite.fake',
    logger: console
  })

  const sandbox = sinon.sandbox.create()

  t.context = {
    consumerOptions,
    sandbox,
    updatesPub,
    amqUrl
  }
})

test.afterEach('clean up', (t) => {
  const {sandbox} = t.context
  sandbox.restore()
})

test('Will successfully detect changes and publish to rabbitmq', async (t) => {
  const {consumerOptions, sandbox, updatesPub, amqUrl} = t.context
  const spy = sandbox.spy()
  const consumer = await createConsumer({logger: console, amqUrl, onMessage: spy, consumerOptions})

  await updatesPub.setupProducer()
  await updatesPub.setupChanges()
  updatesPub.start(false)

  await Promise.delay(100).then(() => {
    updatesPub._changes.emit('data', {data: 'something cool'})
  })

  await Promise.delay(100).then(() => {
    sandbox.assert.called(spy)
    const message = spy.firstCall.args[0]
    t.deepEqual(message.data, {data: 'something cool', type: undefined}, 'received expected data')
  })

  await consumer.stop()
  await updatesPub.stop()
})
