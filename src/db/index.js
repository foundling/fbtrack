const sqlite = require('sqlite')
const path = require('path')
const format = require('date-fns/format')
const { 
  createTable, 
  getByParticipantId,
  getAllActive,
  getAll,
  insert,
  update,
  updateAccessTokens
} = { participants } = require('./statements')

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
      throw new Error(['getParticipantByParticipantId failed', e])
    }

  }

  async setParticipantAccessToken({ participantId, accessToken }) {

    try {
      const db = await this.dbPromise
      const params = { $participantId: participantId, $accessToken: accessToken }
      return await db.run(setAccessToken, params)
    } catch(e) {
      throw new Error(['setParticipantAccessToken failed', e])
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
  async addParticipant({ participantId, registrationDate, refreshToken, accessToken, isActive }) {

    const params = {
      $accessToken: accessToken,
      $refreshToken: refreshToken,
      $participantId: participantId,
      $registrationDate: registrationDate,
      $isActive: isActive 
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
