require('require-self-ref')
const test = require('ava')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const MockProducer = require('~/test/mocks/mockProducer')
const MockChangesStream = require('~/test/mocks/mockChangesStream')
const Promise = require('bluebird')
proxyquire.noPreserveCache()

function makeProducerAndStubs (sandbox) {
  const createProducerStub = sandbox.stub()
  const publisher = proxyquire('~/src/UpdatesPublisher', {
    'windbreaker-service-util/queue': {
      createProducer: createProducerStub
    }
  })
  return {
    createProducerStub: createProducerStub,
    publisher: publisher
  }
}

test.beforeEach('setup mock channel and connections', (t) => {
  const producerOptions = {
    queueName: 'test-queue'
  }

  const sandbox = sinon.sandbox.create()
  const {publisher, createProducerStub} = makeProducerAndStubs(sandbox)

  t.context = {
    producerOptions,
    sandbox,
    publisher,
    createProducerStub
  }
})

test.afterEach('clean up', (t) => {
  const { sandbox } = t.context

  sandbox.restore()
})

test.serial('#setupProducer', async (t) => {
  const {producerOptions, createProducerStub, publisher} = t.context
  publisher.configure(producerOptions, 'http://unhappypath.sad', 'http://unhappierpath.sad', console)
  createProducerStub.onFirstCall().returns(Promise.reject(new Error('expected rejection')))
  createProducerStub.onSecondCall().returns(Promise.resolve())
  await publisher.setupProducer()
  t.true(createProducerStub.calledTwice)
})
test.serial('#setupChanges', async (t) => {
  const {producerOptions, sandbox, publisher} = t.context
  publisher.configure(producerOptions, 'http://unhappypath.sad', 'http://unhappierpath.sad', console)
  const consoleSpy = sandbox.spy(console, 'info')
  await publisher.setupChanges()
  t.true(consoleSpy.calledWith('changes stream successfully created'))
  publisher.changes.destroy()
})
test.serial('#start', async (t) => {
  // setup all mocks and context
  const {producerOptions, sandbox, publisher} = t.context
  publisher.configure(producerOptions, 'http://unhappypath.sad', 'http://unhappierpath.sad', console)
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
  // first producer fails
  publisher.producer.emitError()
  await Promise.delay(1100)
  t.true(producerStopSpy.calledOnce)
  t.true(changesDestroySpy.calledOnce)
  t.true(setupChangesStub.calledOnce)
  t.true(setupProducerStub.calledOnce)
  // then changes fails
  publisher.changes.emitError()
  await Promise.delay(1100)
  t.true(producerStopSpy.calledOnce) // i.e not called
  t.true(setupProducerStub.calledOnce) // ^
  console.log(changesDestroySpy.callCount)
  t.true(changesDestroySpy.callCount > 1)
  t.true(setupChangesStub.callCount > 1)
  // finally changes detects changes
  const producerSendMessageSpy = sandbox.spy(publisher.producer, 'sendMessage')
  publisher.changes.emitData()
  await Promise.delay(100)
  t.true(producerSendMessageSpy.calledWith({}))
})

test.serial('#stop', async (t) => {
  const {producerOptions, sandbox, publisher} = t.context
  publisher.configure(producerOptions, 'http://unhappypath.sad', 'http://unhappierpath.sad', console)
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
