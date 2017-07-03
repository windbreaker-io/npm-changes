const request = require('request-promise')
const _ = require('lodash')
const ChangesStream = require('changes-stream')
const clean = require('normalize-registry-metadata')
const logger = require('~/src/logging').logger(module)

// will hit up registry
exports.checkWatcher = async function () { // TODO: fill the skeleton
  console.log('todo')
}

// will publish to mq
exports.handleChanges = async function ({channel, client, registry}) {
  logger.info('saw change....todo handle logic')
}

exports.startNPMWatcher = async function ({channel, client, registry}) {
  console.log(registry)
  client.get('changes-stream', function (err, reply) {
    if (err) {
      logger.error('error when hitting redis')
      throw Error(err)
    }
    logger.info('Reply from Redis: ' + JSON.stringify(reply))
    logger.info('starting changes stream')

    const changes = new ChangesStream({
      db: registry,
      since: 'now',
      include_docs: true
    })

    changes.on('error', function (error) {
      changes.destroy()
      logger.error('error in changesStream')
      throw Error(error)
    })

    changes.on('data', function () {
      exports.handleChanges({channel, client, registry})
    })
    return changes
  })
}
