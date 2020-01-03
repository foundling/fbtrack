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
    getByParticipantId: `
      select 
        * 
      from 
        participants 
      where 
        participantId = $participantId
    `,
    getAll: `
      select 
        rowid, participantId, registrationDate, isActive 
      from 
        participants`, 
    getAllActive: `select * from participants where active = 1`,
    updateAccessTokens: `
      update participants 
      set 
        accessToken = $accessToken,
        refreshToken = $refreshToken
      where
        participantId = $participantId;
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
    updateAccessTokens: `
      update participants 
      set 
        accessToken = $accessToken,
        refreshToken = $refreshToken
      where
        participantId = $participantId
    `,
    setAccessToken: `
      update participants
      set
        accessToken = $accessToken
      where
        participantId = $participantId
    `
  }
}
