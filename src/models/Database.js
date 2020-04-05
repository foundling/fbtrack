const sqlite = require('sqlite')
const path = require('path')
const { MissingParameterError, requireParam } = require('../lib/utils');
const { APP_CONFIG } = require('../config').getConfig({ requiresUserSetup: true })

const { participants } = require(path.join(APP_CONFIG.DB_PATH, 'statements'))

class Database {

  constructor({ databaseName }) {

    this.databaseName = path.join(APP_CONFIG.DB_PATH, databaseName)
    this.dbPromise = sqlite.open(`${ this.databaseName }.sqlite`, { Promise, cached: true })

  }

  async init() {

    try {

      const db = await this.dbPromise
      await db.run(participants.createTable)

      return this

    } catch(e) {
      throw new Error(e)
    }

  }

  async clearParticipants() {

    try {

      const db = await this.dbPromise
      await db.run(participants.deleteAll)

      return this

    } catch(e) {
      throw e
    }

  }

  async getParticipants({ active = false } = {}) {

    try {

      const db = await this.dbPromise
      return await db.all(active ? participants.getAllActive : participants.getAll)

    } catch(e) {
      throw new Error(e)
    }

  }

  async getParticipantById(participantId=requireParam('participantId')) {

    try {

      const db = await this.dbPromise
      const params = { $participantId: participantId }

      return await db.get(participants.getById, params)

    } catch(e) {
      throw new Error(['getParticipantByParticipantId failed', e])
    }

  }

  async updateAccessTokensById({
    participantId=requireParam('participantId'),
    accessToken=requireParam('accessToken'),
    refreshToken=requireParam('refreshToken')
  }) {

    if (!accessToken.length)
      throw MissingParameterError('accessToken')

    if (!refreshToken.length)
      throw MissingParameterError('refreshToken')

    try {

      const db = await this.dbPromise
      const params = {
        $participantId: participantId,
        $accessToken: accessToken,
        $refreshToken: refreshToken
      }

      await db.run(participants.updateAccessTokensById, params)
      return this

    } catch(e) {
      throw new Error(['updating participant by id failed', e])
    }

  }

  async addParticipant({
    accessToken=requireParam('accessToken'),
    isActive=true,
    participantId=requireParam('participantId'),
    refreshToken=requireParam('refreshToken'),
    registrationDate=requireParam('registrationDate'),
  }) {

    const params = {
      $accessToken: accessToken,
      $isActive: Number(Boolean(isActive)),
      $participantId: participantId,
      $refreshToken: refreshToken,
      $registrationDate: registrationDate,
    }

    const db = await this.dbPromise

    const participantExists = Boolean(await db.get(participants.getById, { $participantId: participantId }))

    if (participantExists) {
      await db.run(participants.updateById, params)
    } else {
      await db.run(participants.insert, params)
    }

    return this

  }

}

module.exports = exports = Database
