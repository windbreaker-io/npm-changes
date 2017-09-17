const path = require('path')
const configUtil = require('windbreaker-service-util/config')

const Config = require('./Config')
const config = module.exports = new Config()

config.load = async function () {
  await configUtil.load({ config, path: path.join(__dirname, '../../config') })
}
