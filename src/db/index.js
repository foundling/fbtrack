const sqlite = require('sqlite')
const path = require('path')
const format = require('date-fns/format')
const { 
  createTable, 
  getByParticipantId,
  getAllActive,
  getAll,
  insert,
} = require('./statements').participants

class Database {

  constructor({ databaseFile }) {

    this.databaseFile = databaseFile
    this.dbPromise = sqlite.open(__dirname + `/${databaseFile}`, { Promise })

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
      const params = { $participant_id: participantId }
      return await db.get(getByParticipantId, params)
    } catch(e) {
      throw new Error(e)
    }

  }

  async addParticipant({ participantId, registrationDate, isActive }) {

    const params = {
      $participant_id: participantId,
      $registration_date: registrationDate,
      $is_active: isActive 
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
