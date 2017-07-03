const request = require('request-promise')
const _ = require('lodash')
const ChangesStream = require('changes-stream')
const clean = require('normalize-registry-metadata')

// will be structured similiarly to greenkeeper changes follow.js, except gutting the fluff

// will hit up registry
exports.checkWatcher = async function () { // TODO: fill the skeleton
  console.log('todo')
}

// will publish to mq
exports.handleChanges = async function () { // TODO
  console.log('todo')
}

exports.startNPMWatcher = async function () { // TODO
  console.log('todo')
}
