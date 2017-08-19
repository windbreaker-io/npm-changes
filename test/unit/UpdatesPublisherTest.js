require('require-self-ref')
const test = require('ava')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const MockProducer = require('~/test/mocks/mockProducer')
const MockChangesStream = require('~/test/mocks/mockChangesStream')
const Promise = require('bluebird')
const uuid = require('uuid')
proxyquire.noPreserveCache()

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
  const {createProducerStub, publisher, sandbox} = t.context
  createProducerStub.onFirstCall().returns(Promise.reject(new Error('expected rejection')))
  createProducerStub.onSecondCall().returns(Promise.resolve())

  await publisher.setupProducer()
  sandbox.assert.calledTwice(createProducerStub)
  t.pass()
})

test('#setupChanges will retry on error', async (t) => {
  const {sandbox, publisher} = t.context
  const consoleSpy = sandbox.spy(console, 'info')

  await publisher.setupChanges()
  sandbox.assert.calledWith(consoleSpy, 'changes stream successfully created')
  t.pass()
})

test('#start: when producer fails, producer and changes will restart', async (t) => {
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

  sandbox.assert.notCalled(setupChangesStub)
  sandbox.assert.notCalled(setupProducerStub)

  // producer fails
  publisher._producer.emitError()
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
  publisher._changes.emitError()
  await Promise.delay(1100)

  sandbox.assert.notCalled(producerStopSpy)
  sandbox.assert.notCalled(setupProducerStub)
  sandbox.assert.calledOnce(changesDestroySpy)
  sandbox.assert.calledOnce(setupChangesStub)
  t.pass()
})

test('#start: will successfully detect and publish changes', async (t) => {
  // setup all mocks and context
  const {sandbox, publisher} = t.context
  publisher._producer = new MockProducer()
  publisher._changes = new MockChangesStream()

  // stubbing creation methods
  const setupProducerStub = sandbox.stub(publisher, 'setupProducer')
  const setupChangesStub = sandbox.stub(publisher, 'setupChanges')
  setupProducerStub.resolves()
  setupChangesStub.resolves()

  // launch the publisher event loop
  publisher.start()
  sandbox.assert.notCalled(setupProducerStub)
  sandbox.assert.notCalled(setupChangesStub)

  // changes detected
  const producerSendMessageSpy = sandbox.spy(publisher._producer, 'sendMessage')

  publisher._changes.emitData()
  await Promise.delay(100)
  sandbox.assert.calledWith(producerSendMessageSpy, {})
  t.pass()
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
