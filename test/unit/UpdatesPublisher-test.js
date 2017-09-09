const test = require('ava')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
proxyquire.noPreserveCache()

const MockProducer = require('~/test/mocks/MockProducer')
const MockChangesStream = require('~/test/mocks/MockChangesStream')
const Promise = require('bluebird')
const uuid = require('uuid')

const DependencyType = require('windbreaker-service-util/models/events/dependency/DependencyType')
const { NPM: NPM_TYPE } = DependencyType

const EventType = require('windbreaker-service-util/models/events/EventType')
const waitForEvent = require('windbreaker-service-util/test/util/waitForEvent')

test.beforeEach('setup mock channel and connections', async (t) => {
  const queueName = `queue-${uuid.v4()}`
  const producerOptions = {
    queueName: queueName
  }

  const sandbox = sinon.sandbox.create()

  const createProducerStub = sandbox.stub()
    .returns(new MockProducer())
  const UpdatesPublisher = proxyquire('~/src/UpdatesPublisher', {
    'windbreaker-service-util/queue': {
      createProducer: createProducerStub
    },
    'changes-stream': MockChangesStream
  })

  const publisherOptions = {
    producerOptions,
    amqUrl: 'http://unhappypath.sad',
    registryUrl: 'http://unhappierpath',
    logger: console
  }

  const publisher = new UpdatesPublisher(publisherOptions)

  // launch the publisher event loop
  await publisher.start(true)

  t.context = {
    publisherOptions,
    sandbox,
    UpdatesPublisher,
    publisher,
    createProducerStub
  }
})

test.afterEach('clean up', async (t) => {
  const { sandbox, publisher } = t.context
  sandbox.restore()
  await publisher.stop()
})

test('#setupProducer will retry on error', async (t) => {
  const { createProducerStub, publisher, sandbox } = t.context

  // first call was successful from setup
  // next call fails
  createProducerStub.onSecondCall().returns(Promise.reject(new Error('expected rejection')))
  // last call resolves
  createProducerStub.onThirdCall().returns(new MockProducer())

  // should not err out
  await publisher.setupProducer()

  sandbox.assert.calledThrice(createProducerStub)
  t.pass()
})

test('#setupChanges will retry on error', async (t) => {
  const { sandbox, publisher } = t.context
  const consoleSpy = sandbox.spy(console, 'info')

  await publisher.setupChanges()
  sandbox.assert.calledWith(consoleSpy, 'changes stream successfully created')
  t.pass()
})

test('#start: when producer fails, producer and changes will restart', async (t) => {
  // setup all mocks and context
  const { sandbox, publisher } = t.context

  const {
    _producer: producer,
    _changes: changesStream
  } = publisher

  // spying mocks' methods
  const producerStopSpy = sandbox.spy(producer, 'stop')
  const changesDestroySpy = sandbox.spy(changesStream, 'destroy')

  const publisherErrorPromise = waitForEvent(publisher, 'error')
  const producerPromise = waitForEvent(publisher, 'producer-created')

  // producer fails
  producer.emit('error', new Error('Producer error'))

  await Promise.all([ publisherErrorPromise, producerPromise ])

  sandbox.assert.calledOnce(producerStopSpy)
  sandbox.assert.calledOnce(changesDestroySpy)
  t.pass()
})

test('#start: when changes fails, it restarts, producer does not', async (t) => {
  // setup all mocks and context
  const {sandbox, publisher} = t.context

  const {
    _producer: producer,
    _changes: changesStream
  } = publisher

  // spying mocks' methods
  const producerStopSpy = sandbox.spy(producer, 'stop')

  const publisherErrorPromise = waitForEvent(publisher, 'error')
  const changesStreamPromise = waitForEvent(publisher, 'changes-stream-created')

  // changes fails
  changesStream.emit('error', new Error('ChangesStream error'))

  await Promise.all([ publisherErrorPromise, changesStreamPromise ])

  sandbox.assert.notCalled(producerStopSpy)

  t.pass()
})

test('#start: will successfully detect and publish changes', async (t) => {
  t.plan(0)

  // setup all mocks and context
  const { sandbox, publisher } = t.context

  const {
    _producer: producer,
    _changes: changesStream
  } = publisher

  const producerSendMessageSpy = sandbox.spy(producer, 'sendMessage')

  const name = 'some-dep'
  const version = '1.0.0'
  const doc = {
    name,
    'dist-tags': {
      latest: version
    }
  }

  // changes detected
  changesStream.emit('data', { doc })

  sandbox.assert.calledWith(producerSendMessageSpy, sandbox.match((event) => {
    const type = event.getType()
    const dependencyUpdate = event.getData()

    return type === EventType.DEPENDENCY_UPDATE &&
      dependencyUpdate.getName() === name &&
      dependencyUpdate.getVersion() === version &&
      dependencyUpdate.getType() === NPM_TYPE
  }))
})

test('#start: will emit an error if unable to wrap dependency update', async (t) => {
  t.plan(0)
  const { sandbox, publisherOptions, createProducerStub } = t.context

  const UpdatesPublisher = proxyquire('~/src/UpdatesPublisher', {
    'windbreaker-service-util/queue': {
      createProducer: createProducerStub
    },
    'changes-stream': sandbox.stub().returns(new MockChangesStream()),
    'windbreaker-service-util/models/events/dependency/DependencyUpdate': {
      wrap: sandbox.stub().callsFake((input, errors) => {
        errors.push(new Error('Error wrapping input'))
      })
    }
  })

  const publisher = new UpdatesPublisher(publisherOptions)

  // launch the publisher event loop
  await publisher.start(true)

  const {
    _changes: changesStream
  } = publisher

  const name = 'some-module'
  const version = '1.0.0'
  const doc = {
    name,
    'dist-tags': {
      latest: version
    }
  }

  const publisherErrorPromise = waitForEvent(publisher, 'error')

  // changes detected
  changesStream.emit('data', { doc })
  return publisherErrorPromise
})

test('#stop: should stop existing producer and changes stream', async (t) => {
  const {sandbox, publisher} = t.context

  const {
    _producer: producer,
    _changes: changesStream
  } = publisher

  const producerStopSpy = sandbox.spy(producer, 'stop')
  const changesDestroySpy = sandbox.spy(changesStream, 'destroy')

  sandbox.assert.notCalled(producerStopSpy)
  sandbox.assert.notCalled(changesDestroySpy)

  await publisher.stop()
  sandbox.assert.calledOnce(producerStopSpy)
  sandbox.assert.calledOnce(changesDestroySpy)

  t.pass()
})

test('#stop: should do nothing if both producer or changes stream does not exist', async (t) => {
  const { UpdatesPublisher, publisherOptions } = t.context
  const publisher = new UpdatesPublisher(publisherOptions)
  await publisher.stop()
  t.pass()
})
