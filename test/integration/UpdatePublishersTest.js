require('require-self-ref')
const test = require('ava')
const sinon = require('sinon')
const Promise = require('bluebird')
const config = require('~/src/config')
const {createConsumer} = require('windbreaker-service-util/queue')
const updatesPub = require('~/src/UpdatesPublisher')
config.load()
const producerOptions = {
  queueName: 'test-queue'
}
updatesPub.configure(producerOptions, config.getAmqUrl(), 'www.notasite.fake', console)

test.beforeEach('setup env', (t) => {
  const consumerOptions = {
    queueName: 'test-queue'
  }

  const sandbox = sinon.sandbox.create()

  t.context = {
    consumerOptions,
    sandbox
  }
})

test.afterEach('clean up', (t) => {
  const {sandbox} = t.context
  sandbox.restore()
})

test.serial('Will successfully detect changes and publish to rabbitmq', async (t) => {
  const {consumerOptions, sandbox} = t.context
  const amqURL = config.getAmqUrl()
  const spy = sandbox.spy()
  const consumer = await createConsumer({console, amqURL, onMessage: spy, consumerOptions})
  updatesPub.start(true)
  await Promise.delay(100).then(() => {
    updatesPub.changes.emit('data', {data: 'something cool'})
  })
  await Promise.delay(100).then(() => {
    t.true(spy.called)
    const message = spy.firstCall.args[0]
    t.deepEqual(message.data, {data: 'something cool', type: undefined}, 'received expected data')
  })
  await consumer.stop()
  await updatesPub.stop()
})
