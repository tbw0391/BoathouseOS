-- Board membership is separate from role/team: any member can also be a
-- board member (e.g. a coach or parent serving on the board).

alter table profiles
  add column if not exists is_board_member boolean not null default false;
