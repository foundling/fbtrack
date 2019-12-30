module.exports = exports = {
  participants: {

    createTable: `
      create table if not exists participants(
        -- note: rowid is automatically created as an autoinc'd primary key
        -- rowid          INT  PRIMARY KEY,
        participant_id    TEXT  NOT NULL,
        registration_date TEXT NOT NULL,
        is_active         INT  NOT NULL   CHECK(is_active in (0,1))
      );
    `,
    getByParticipantId: `select * from participants where participant_id = $participant_id`,
    getAll: `
      select 
        rowid, participant_id, registration_date, is_active 
      from 
        participants`, 
    getAllActive: `select * from participants where active = 1`,
    insert: `
      insert into participants (
        participant_id,
        registration_date,
        is_active
      )
      values (
        $participant_id,
        $registration_date,
        $is_active
      )
    `,
    setAccessToken: `update participants set access_token = $access_token where participant_id = $participant_id`
  }
}
