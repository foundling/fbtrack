const { APP_CONFIG } = require('../config') 
const { DB_PATH, DB_NAME } = APP_CONFIG

const Database = require(DB_PATH)

class Participant {

  constructor({ participantId, files }) {
    this.participantId = participantId 
    this.files = files
  }

}

module.exports = Participant
