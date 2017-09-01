const configUtil = require('windbreaker-service-util/config')

const Config = require('./Config')
const config = module.exports = new Config()

config.load = async function () {
  return configUtil.load({ config })
}
