const { APP_CONFIG } = require('../config') 
const { DB_PATH, DB_NAME } = APP_CONFIG

const Database = require(DB_PATH)

class Participant {

  constructor({ participantId, store }) {
    this.participantId = participantId 
    this.store = store || new Database({ databaseFile: DB_NAME })
    this.data = null
  }

  async fetch() {
    try { 

      const result = await this.store.getParticipantById(this.participantId)
      this.data = result

    } catch(e) {
      throw e
    }
  }

  get capturedDates() {
    const capturedDates  = []
    return capturedDates
  }
  get missingDates() {
    const missingDates  = []
    return missingDates
  }

  buildQueryPaths() {
  }

}

module.exports = Participant
