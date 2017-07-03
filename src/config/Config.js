// config model
const BaseConfig = require('windbreaker-service-util/models/BaseServiceConfig')
const DefaultsMixin = require('fashion-model-defaults')

module.exports = BaseConfig.extend({
  mixins: [ DefaultsMixin ],

  properties: {
    amqUrl: {
      description: 'The url used to access activeMQ',
      default: 'amqp://127.0.0.1:5672'
    },

    queueName: {
      description: 'The name of the queue in which events are published on',
      default: 'events'
    },

    registryURL: {
      description: 'URL for watcher\'s registry',
      default: 'https://replicate.npmjs.com/registry'
    },

    redisURL: {
      description: 'URL for redis',
      default: 'redis://127.0.0.1:6379'
    }
  }
})
