// config model
const BaseConfig = require('windbreaker-service-util/models/BaseServiceConfig')
const DefaultsMixin = require('fashion-model-defaults')

module.exports = BaseConfig.extend({
  mixins: [ DefaultsMixin ],

  properties: {
    amqUrl: {
      description: 'The url used to access activeMQ',
      default: 'amqp://rabbitmq'
    },

    queueName: {
      description: 'The name of the queue in which events are published on',
      default: 'events'
    },

    registryUrl: {
      description: 'URL for npm registry',
      default: 'https://replicate.npmjs.com/registry'
    }
  }
})
