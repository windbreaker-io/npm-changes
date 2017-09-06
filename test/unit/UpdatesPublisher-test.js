require('require-self-ref')
const test = require('ava')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
proxyquire.noPreserveCache()

const MockProducer = require('~/test/mocks/MockProducer')
const MockChangesStream = require('~/test/mocks/MockChangesStream')
const Promise = require('bluebird')
const uuid = require('uuid')

const DependencyUpdate = require('windbreaker-service-util/models/events/dependency/DependencyUpdate')
const DependencyType = require('windbreaker-service-util/models/events/dependency/DependencyType')

const { NPM: NPM_TYPE } = DependencyType

const Event = require('windbreaker-service-util/models/events/Event')
const EventType = require('windbreaker-service-util/models/events/EventType')


const waitForEvent = require('windbreaker-service-util/test/util/waitForEvent')


test.beforeEach('setup mock channel and connections', (t) => {
  const queueName = `queue-${uuid.v4()}`
  const producerOptions = {
    queueName: queueName
  }

  const sandbox = sinon.sandbox.create()

  const createProducerStub = sandbox.stub()
  const UpdatesPublisher = proxyquire('~/src/UpdatesPublisher', {
    'windbreaker-service-util/queue': {
      createProducer: createProducerStub
    }
  })

  const publisher = new UpdatesPublisher({
    producerOptions,
    amqUrl: 'http://unhappypath.sad',
    registryUrl: 'http://unhappierpath',
    logger: console
  })

  t.context = {
    sandbox,
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
  createProducerStub.onFirstCall().returns(Promise.reject(new Error('expected rejection')))
  createProducerStub.onSecondCall().returns(Promise.resolve())

  await publisher.setupProducer()
  sandbox.assert.calledTwice(createProducerStub)
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
  publisher._producer = new MockProducer()
  publisher._changes = new MockChangesStream()

  // stubbing creation methods
  const setupProducerStub = sandbox.stub(publisher, 'setupProducer')
  const setupChangesStub = sandbox.stub(publisher, 'setupChanges')
  setupProducerStub.resolves()
  setupChangesStub.resolves()

  // spying mocks' methods
  const producerStopSpy = sandbox.spy(publisher._producer, 'stop')
  const changesDestroySpy = sandbox.spy(publisher._changes, 'destroy')

  // launch the publisher event loop
  publisher.start()

  sandbox.assert.notCalled(setupChangesStub)
  sandbox.assert.notCalled(setupProducerStub)

  // producer fails
  publisher._producer.emit('error', new Error('Producer error'))
  await Promise.delay(1100)

  sandbox.assert.calledOnce(producerStopSpy)
  sandbox.assert.calledOnce(changesDestroySpy)
  sandbox.assert.calledOnce(setupChangesStub)
  sandbox.assert.calledOnce(setupProducerStub)
  t.pass()
})

test('#start: when changes fails, it restarts, producer does not', async (t) => {
  // setup all mocks and context
  const {sandbox, publisher} = t.context
  publisher._producer = new MockProducer()
  publisher._changes = new MockChangesStream()

  // stubbing creation methods
  const setupProducerStub = sandbox.stub(publisher, 'setupProducer')
  const setupChangesStub = sandbox.stub(publisher, 'setupChanges')
  setupProducerStub.resolves()
  setupChangesStub.resolves()

  // spying mocks' methods
  const producerStopSpy = sandbox.spy(publisher._producer, 'stop')
  const changesDestroySpy = sandbox.spy(publisher._changes, 'destroy')

  // launch the publisher event loop
  publisher.start()

  sandbox.assert.notCalled(setupProducerStub)
  sandbox.assert.notCalled(setupChangesStub)

  // changes fails
  publisher._changes.emit('error', new Error('ChangesStream error'))
  await Promise.delay(1100)

  sandbox.assert.notCalled(producerStopSpy)
  sandbox.assert.notCalled(setupProducerStub)
  sandbox.assert.calledOnce(changesDestroySpy)
  sandbox.assert.calledOnce(setupChangesStub)
  t.pass()
})

test('#start: will successfully detect and publish changes', async (t) => {
  t.plan(0)

  // setup all mocks and context
  const { sandbox, publisher } = t.context
  const producer = publisher._producer = new MockProducer()
  const changesStream = publisher._changes = new MockChangesStream()

  const producerSendMessageSpy = sandbox.spy(producer, 'sendMessage')

  // stubout creation methods
  const setupProducerStub = sandbox.stub(publisher, 'setupProducer')
  const setupChangesStub = sandbox.stub(publisher, 'setupChanges')

  setupProducerStub.resolves()
  setupChangesStub.resolves()

  // launch the publisher event loop
  publisher.start()
  sandbox.assert.notCalled(setupProducerStub)
  sandbox.assert.notCalled(setupChangesStub)

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

    return event.getType() === EventType.DEPENDENCY_UPDATE &&
      dependencyUpdate.getName() === name &&
      dependencyUpdate.getVersion() === version &&
      dependencyUpdate.getType() === NPM_TYPE
  }))
})

test('#stop', async (t) => {
  const {sandbox, publisher} = t.context
  publisher._producer = new MockProducer()
  publisher._changes = new MockChangesStream()
  const producerStopSpy = sandbox.spy(publisher._producer, 'stop')
  const changesDestroySpy = sandbox.spy(publisher._changes, 'destroy')

  publisher.start()
  sandbox.assert.notCalled(producerStopSpy)
  sandbox.assert.notCalled(changesDestroySpy)

  await publisher.stop()
  sandbox.assert.calledOnce(producerStopSpy)
  sandbox.assert.calledOnce(changesDestroySpy)
  t.pass()
})
