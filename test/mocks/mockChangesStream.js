require('require-self-ref')
const EventEmitter = require('events')
const Promise = require('bluebird')

module.exports = class MockChangesStream extends EventEmitter {
  constructor () {
    super()
    this._destroyed = false
  }
  emitError () {
    this.emit('error', new Error('mockChangesStream error'))
  }
  emitData () {
    this.emit('data', {})
  }
  destroy () {
    return Promise.resolve()
  }
}
