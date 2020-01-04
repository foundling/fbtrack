const sqlite = require('sqlite')
const path = require('path')
const format = require('date-fns/format')
const { 
  clearParticipants,
  createTable, 
  getByParticipantId,
  getAllActive,
  getAll,
  insert,
  update,
  updateAccessTokens
} = require('./statements').participants

class Database {

  constructor({ databaseFile }) {

    this.databaseFile = databaseFile
    this.dbPromise = sqlite.open(__dirname + `/${databaseFile}`, { Promise }) // add {cached: true} so you can reuse the db handle?

  }

  async init() {

    try {
      const db = await this.dbPromise
      await db.run(createTable)
    } catch(e) {
      throw new Error(e)
    }

  }

  async clearParticipants() {
    try {
      const db = await this.dbPromise
      await db.run(clearParticipants)
    } catch(e) {
      throw e 
    }
  }

  async getParticipants() {

    try {
      const db = await this.dbPromise
      const allParticipants = await db.all(getAll)
      return allParticipants
    } catch(e) {
      throw new Error(e)
    }
  }

  async getParticipantByParticipantId(participantId) {

    try {
      const db = await this.dbPromise
      const params = { $participantId: participantId }
      return await db.get(getByParticipantId, params)
    } catch(e) {
      console.log({getByParticipantId})
      throw new Error(['getParticipantByParticipantId failed', e])
    }

  }

  async updateAccessTokensByParticipantId({ participantId, accessToken, refreshToken }) {

    try {
      const db = await this.dbPromise
      const params = { 
        $participantId: participantId,
        $accessToken: accessToken,
        $refreshToken: refreshToken
      }
      return await db.run(updateAccessTokens, params)
    } catch(e) {
      throw new Error(['updating participant by id failed', e])
    }

  }

  async addParticipant({ participantId, registrationDate, refreshToken, accessToken, isActive=true }) {

    const params = {
      $accessToken: accessToken,
      $refreshToken: refreshToken,
      $participantId: participantId,
      $registrationDate: registrationDate,
      $isActive: Number(Boolean(isActive)) 
    }

    try {
      const db = await this.dbPromise
      const newParticipant = await db.run(insert, params)
      return newParticipant
    } catch(e) {
      throw new Error(e)
    }

  }

}

module.exports = exports = Database
