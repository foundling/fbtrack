module.exports = exports = {
  createParticipantsTable: `
    create table if not exists participants(
      -- note: rowid is automatically created as an autoinc'd primary key
      -- rowid          INT PRIMARY KEY,
      subject_id        INT NOT NULL,
      registration_date TEXT NOT NULL,
      is_active            INT NOT NULL   CHECK(is_active in (0,1))
    );
  `,
  getParticipantBySubjectId: `select * from participants where subject_id = $subject_id`,
  getActiveParticipants: `select * from participants where active = 1`,
  insertParticipant: `
    insert into participants (
      subject_id,
      registration_date,
      is_active
    )
    values (
      $subject_id,
      $registration_date,
      $is_active
    )
  `,
  selectAllParticipants: `
    select 
      rowid, subject_id, registration_date, is_active 
    from 
      participants` 
}
