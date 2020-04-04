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
        rowid, participantId, registrationDate, isActive, accessToken, refreshToken
      from
        participants`,
    getAllActive: `
      select
        rowid, participantId, registrationDate, isActive, accessToken, refreshToken
      from
        participants
      where
        isActive=1`,
    getById: `
      select
        rowid, participantId, registrationDate, isActive, accessToken, refreshToken
      from
        participants
      where
        participantId = $participantId
    `,
    deleteAll: `
      delete from participants;
    `,
    deleteById: `
      delete from participants where id = $participantId;
    `,
    updateById: `
      update participants
      set
        registrationDate = $registrationDate,
        accessToken = $accessToken,
        refreshToken = $refreshToken,
        isActive = $isActive
      where
        participantId = $participantId;
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
