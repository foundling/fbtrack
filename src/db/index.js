const sqlite = require('sqlite')
const path = require('path')
const format = require('date-fns/format')
const { 
  createParticipantsTable, 
  getParticipantBySubjectId,
  getActiveParticipants,
  insertParticipant,
  selectAllParticipants
} = require('./statements')

class Database {

  constructor({ path }) {

    this.path = path
    this.dbPromise = sqlite.open(`${path}`, { Promise })

  }

  async init() {

    try {
      const db = await this.dbPromise
      await db.run(createParticipantsTable)
    } catch(e) {
      throw new Error(e)
    }

  }

  async getParticipants() {

    try {
      const db = await this.dbPromise
      const allParticipants = await db.all(selectAllParticipants)
      return allParticipants
    } catch(e) {
      throw new Error(e)
    }
  }

  async getParticipantBySubjectId(subjectId) {

    try {
      const db = await this.dbPromise
      const participant = await db.get(getParticipantBySubjectId, subjectId) 
    } catch(e) {
      throw new Error(e)
    }

  }

  async addParticipant({ subjectId, registrationDate, isActive }) {

    const params = {
      $subject_id: subjectId,
      $registration_date: registrationDate,
      $is_active: isActive 
    }

    try {
      const db = await this.dbPromise
      const newParticipant = await db.run(insertParticipant, params)
      return newParticipant
    } catch(e) {
      throw new Error(e)
    }

  }

}
