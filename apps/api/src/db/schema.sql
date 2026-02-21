CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT,
  city TEXT,
  logo_url TEXT,
  players TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  home_team_id TEXT NOT NULL,
  away_team_id TEXT NOT NULL,
  sets TEXT NOT NULL DEFAULT '[]',
  current_set INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'setup',
  home_lineup TEXT NOT NULL DEFAULT '[]',
  away_lineup TEXT NOT NULL DEFAULT '[]',
  set_lineups TEXT,
  serving_team_id TEXT,
  first_serve_team_id TEXT,
  home_libero_id TEXT,
  away_libero_id TEXT,
  home_libero_replaced_player_id TEXT,
  away_libero_replaced_player_id TEXT,
  home_timeouts INTEGER NOT NULL DEFAULT 0,
  away_timeouts INTEGER NOT NULL DEFAULT 0,
  home_substitutions INTEGER NOT NULL DEFAULT 0,
  away_substitutions INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (home_team_id) REFERENCES teams(id),
  FOREIGN KEY (away_team_id) REFERENCES teams(id)
);

CREATE TABLE IF NOT EXISTS match_events (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  rally_id TEXT,
  set_number INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  team_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  zone INTEGER,
  score_home INTEGER NOT NULL,
  score_away INTEGER NOT NULL,
  meta TEXT,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS special_events (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  team_id TEXT NOT NULL,
  type TEXT NOT NULL,
  meta TEXT,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rallies (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  rally_number INTEGER NOT NULL,
  serving_team_id TEXT NOT NULL,
  server_player_id TEXT NOT NULL,
  score_home_before INTEGER NOT NULL DEFAULT 0,
  score_away_before INTEGER NOT NULL DEFAULT 0,
  score_home_after INTEGER NOT NULL DEFAULT 0,
  score_away_after INTEGER NOT NULL DEFAULT 0,
  point_won_by_team_id TEXT,
  was_ace INTEGER NOT NULL DEFAULT 0,
  was_serve_error INTEGER NOT NULL DEFAULT 0,
  was_reception_error INTEGER NOT NULL DEFAULT 0,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_match_events_match ON match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_rally ON match_events(rally_id);
CREATE INDEX IF NOT EXISTS idx_special_events_match ON special_events(match_id);
CREATE INDEX IF NOT EXISTS idx_rallies_match ON rallies(match_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
