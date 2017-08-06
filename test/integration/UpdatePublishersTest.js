require('require-self-ref')
const test = require('ava')
const sinon = require('sinon')
const Promise = require('bluebird')
const config = require('~/src/config')
const {createConsumer} = require('windbreaker-service-util/queue')
config.load()

test.beforeEach('setup env', (t) => {
  const producerOptions = {
    queueName: 'test-queue'
  }

  const consumerOptions = {
    queueName: 'test-queue'
  }

  const sandbox = sinon.sandbox.create()

  t.context = {
    producerOptions,
    consumerOptions,
    sandbox
  }
})

test.afterEach('clean up', (t) => {
  const {sandbox} = t.context
  sandbox.restore()
})

test.serial('Will successfully detect changes and publish to rabbitmq', async (t) => {
  const {producerOptions, consumerOptions, sandbox} = t.context
  const updatesPub = require('~/src/UpdatesPublisher')
  const amqURL = config.getAmqUrl()
  const spy = sandbox.spy()
  await createConsumer({console, amqURL, onMessage: spy, consumerOptions})
  updatesPub.configure(producerOptions, config.getAmqUrl(), 'www.notasite.fake', console)
  updatesPub.start(true)
  await Promise.delay(100).then(() => {
    updatesPub.changes.emit('data', {data: 'something cool'})
  })
  await Promise.delay(100).then(() => {
    t.true(spy.called)
    const message = spy.firstCall.args[0]
    t.deepEqual(message.data, {data: 'something cool', type: undefined}, 'received expected data')
  })
  await updatesPub.stop()
})
