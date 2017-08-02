require('require-self-ref')
const test = require('ava')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const Promise = require('bluebird')
proxyquire.noPreserveCache()

test.beforeEach('setup env', (t) => {
  const producerOptions = {
    queueName: 'test-queue'
  }

  const sandbox = sinon.sandbox.create()

  t.context = {
    producerOptions,
    sandbox
  }
})

test.afterEach('clean up', (t) => {
  const {sandbox} = t.context
  sandbox.restore()
})
