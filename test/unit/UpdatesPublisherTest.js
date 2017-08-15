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
  if (publisher.producer === undefined) {
    publisher.producer = new MockProducer()
  }
  if (publisher.changes === undefined) {
    publisher.changes = new MockChangesStream()
  }
  await publisher.stop()
})

test('#setupProducer will retry on error', async (t) => {
  const {createProducerStub, publisher} = t.context
  createProducerStub.onFirstCall().returns(Promise.reject(new Error('expected rejection')))
  createProducerStub.onSecondCall().returns(Promise.resolve())
  await publisher.setupProducer()
  t.true(createProducerStub.calledTwice)
})

test('#setupChanges will retry on error', async (t) => {
  const {sandbox, publisher} = t.context
  const consoleSpy = sandbox.spy(console, 'info')
  await publisher.setupChanges()
  t.true(consoleSpy.calledWith('changes stream successfully created'))
})

test('#start: when producer fails, producer and changes will restart', async (t) => {
  // setup all mocks and context
  const {sandbox, publisher} = t.context
  publisher.producer = new MockProducer()
  publisher.changes = new MockChangesStream()
  // stubbing creation methods
  const setupProducerStub = sandbox.stub(publisher, 'setupProducer')
  const setupChangesStub = sandbox.stub(publisher, 'setupChanges')
  setupProducerStub.resolves()
  setupChangesStub.resolves()
  // spying mocks' methods
  const producerStopSpy = sandbox.spy(publisher.producer, 'stop')
  const changesDestroySpy = sandbox.spy(publisher.changes, 'destroy')
  // launch the publisher event loop
  publisher.start()
  t.true(setupProducerStub.notCalled)
  t.true(setupChangesStub.notCalled)
  // producer fails
  publisher.producer.emitError()
  await Promise.delay(1100)
  t.true(producerStopSpy.calledOnce)
  t.true(changesDestroySpy.calledOnce)
  t.true(setupChangesStub.calledOnce)
  t.true(setupProducerStub.calledOnce)
})

test('#start: when changes fails, it restarts, producer does not', async (t) => {
  // setup all mocks and context
  const {sandbox, publisher} = t.context
  publisher.producer = new MockProducer()
  publisher.changes = new MockChangesStream()
  // stubbing creation methods
  const setupProducerStub = sandbox.stub(publisher, 'setupProducer')
  const setupChangesStub = sandbox.stub(publisher, 'setupChanges')
  setupProducerStub.resolves()
  setupChangesStub.resolves()
  // spying mocks' methods
  const producerStopSpy = sandbox.spy(publisher.producer, 'stop')
  const changesDestroySpy = sandbox.spy(publisher.changes, 'destroy')
  // launch the publisher event loop
  publisher.start()
  t.true(setupProducerStub.notCalled)
  t.true(setupChangesStub.notCalled)
  // changes fails
  publisher.changes.emitError()
  await Promise.delay(1100)
  t.true(producerStopSpy.notCalled)
  t.true(setupProducerStub.notCalled)
  t.true(changesDestroySpy.calledOnce)
  t.true(setupChangesStub.calledOnce)
})

test('#start: will successfully detect and publish changes', async (t) => {
  // setup all mocks and context
  const {sandbox, publisher} = t.context
  publisher.producer = new MockProducer()
  publisher.changes = new MockChangesStream()
  // stubbing creation methods
  const setupProducerStub = sandbox.stub(publisher, 'setupProducer')
  const setupChangesStub = sandbox.stub(publisher, 'setupChanges')
  setupProducerStub.resolves()
  setupChangesStub.resolves()
  // launch the publisher event loop
  publisher.start()
  t.true(setupProducerStub.notCalled)
  t.true(setupChangesStub.notCalled)
  // changes detected
  const producerSendMessageSpy = sandbox.spy(publisher.producer, 'sendMessage')
  publisher.changes.emitData()
  await Promise.delay(100)
  t.true(producerSendMessageSpy.calledWith({}))
})

test('#stop', async (t) => {
  const {sandbox, publisher} = t.context
  publisher.producer = new MockProducer()
  publisher.changes = new MockChangesStream()
  const producerStopSpy = sandbox.spy(publisher.producer, 'stop')
  const changesDestroySpy = sandbox.spy(publisher.changes, 'destroy')
  publisher.start()
  t.true(producerStopSpy.notCalled)
  t.true(changesDestroySpy.notCalled)
  await publisher.stop()
  t.true(producerStopSpy.calledOnce)
  t.true(changesDestroySpy.calledOnce)
})
