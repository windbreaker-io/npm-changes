const test = require('ava')
const sinon = require('sinon')
const config = require('~/src/config')
const { createConsumer } = require('windbreaker-service-util/queue')
const uuid = require('uuid')

const proxyquire = require('proxyquire')
proxyquire.noPreserveCache()

const MockChangesStream = require('~/test/mocks/MockChangesStream')

const waitForEvent = require('windbreaker-service-util/test/util/waitForEvent')

const DependencyType = require('windbreaker-service-util/models/events/dependency/DependencyType')
const { NPM: NPM_TYPE } = DependencyType

const EventType = require('windbreaker-service-util/models/events/EventType')

const messageParser = require('windbreaker-service-util/queue/util/message-parser')

test.before(async () => {
  return config.load()
})

test.beforeEach('setup env', async (t) => {
  const sandbox = sinon.sandbox.create()

  const amqUrl = config.getAmqUrl()
  const queueName = `queue-${uuid.v4()}`

  const queueOptions = {
    queueName
  }

  const onMessageStub = sandbox.stub()

  const UpdatesPublisher = proxyquire('~/src/UpdatesPublisher', {
    'changes-stream': MockChangesStream
  })

  const updatesPublisher = new UpdatesPublisher({
    amqUrl,
    logger: console,
    producerOptions: queueOptions,
    registryUrl: 'www.notasite.fake'
  })

  const consumer = await createConsumer({
    amqUrl,
    logger: console,
    onMessage: onMessageStub,
    consumerOptions: queueOptions
  })

  t.context = {
    consumer,
    sandbox,
    updatesPublisher,
    amqUrl
  }
})

test.afterEach('clean up', async (t) => {
  const {
    sandbox,
    consumer,
    updatesPublisher
  } = t.context

  sandbox.restore()
  await consumer.stop()
  return updatesPublisher.stop()
})

test('Will successfully detect changes and publish to dependency update to queue', async (t) => {
  const { consumer, updatesPublisher } = t.context

  await updatesPublisher.start(true)

  const messagePromise = waitForEvent(consumer, 'message')

  const { _changes: changesStream } = updatesPublisher

  const name = uuid.v4()
  const version = '1.0.0'

  const npmUpdate = {
    doc: {
      name,
      'dist-tags': {
        latest: version
      }
    }
  }

  changesStream.emit('data', npmUpdate)

  const message = await messagePromise
  const decoded = messageParser.decode(message.content)
  decoded.convertData()

  t.is(decoded.getType(), EventType.DEPENDENCY_UPDATE)

  const dependencyUpdate = decoded.getData()

  t.is(dependencyUpdate.getType(), NPM_TYPE)
  t.is(dependencyUpdate.getName(), name)
  t.is(dependencyUpdate.getVersion(), version)
})
