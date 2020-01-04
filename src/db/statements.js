module.exports = exports = {
  participants: {
    createTable: `
      create table if not exists participants(
        -- note: rowid is automatically created as an autoinc'd primary key
        -- rowid          INT  PRIMARY KEY,
        participantId    TEXT  NOT NULL,
        registrationDate TEXT NOT NULL,
        accessToken      TEXT,
        refreshToken     TEXT,
        isActive         INT  NOT NULL   CHECK(isActive in (0,1))
      );
    `,
    insert: `
      insert into participants (
        participantId,
        registrationDate,
        accessToken,
        refreshToken,
        isActive
      )
      values (
        $participantId,
        $registrationDate,
        $accessToken,
        $refreshToken,
        $isActive
      );
    `,
    getAll: `
      select 
        rowid, participantId, registrationDate, isActive 
      from 
        participants`, 
    getById: `
      select 
        * 
      from 
        participants 
      where 
        participantId = $participantId
    `,
    getActive: `select * from participants where active = 1`,
    deleteAll: `
      delete from participants;
    `,
    deleteById: `
      delete from participants where id = $participantId;
    `,
    updateAccessTokensById: `
      update participants 
      set 
        accessToken = $accessToken,
        refreshToken = $refreshToken
      where
        participantId = $participantId;
    `,
  }
}
