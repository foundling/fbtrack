const sqlite = require('sqlite')
const path = require('path')
const format = require('date-fns/format')
const { participants } = require('./statements')

class Database {

  constructor({ databaseFile }) {

    this.databaseFile = databaseFile
    this.dbPromise = sqlite.open(`${ path.join(__dirname, databaseFile) }.sqlite`, { Promise, cached: true }) 
    // add {cached: true} so you can reuse the db handle?

  }

  async init() {

    try {
      const db = await this.dbPromise
      await db.run(participants.createTable)
    } catch(e) {
      throw new Error(e)
    }

  }

  async clearParticipants() {
    try {
      const db = await this.dbPromise
      await db.run(participants.deleteAll)
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
      return await db.run(participants.updateAccessTokensById, params)
    } catch(e) {
      throw new Error(['updating participant by id failed', e])
    }

  }

  async addParticipant({ 
    participantId=requireParam('participantId'),
    registrationDate=requireParam('registrationDate'),
    refreshToken=requireParam('refreshToken'),
    accessToken=requireParam('accessToken'),
    isActive=true
  }) {

    const params = {
      $accessToken: accessToken,
      $refreshToken: refreshToken,
      $participantId: participantId,
      $registrationDate: registrationDate,
      $isActive: Number(Boolean(isActive)) 
    }

    try {
      const db = await this.dbPromise
      const newParticipant = await db.run(participants.insert, params)
      return newParticipant
    } catch(e) {
      throw new Error(e)
    }

  }

}

function requireParam(p) {
  throw new MissingParameterError(p)
}

class MissingParameterError extends Error {
  constructor(message) {

    super(message)

    this.name = this.constructor.name

    Error.captureStackTrace(this, this.constructor)

  }
}

module.exports = exports = Database
