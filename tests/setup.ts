// Preloaded before any test (registered in bunfig.toml [test].preload).
// Swaps DATABASE_URL → TEST_DATABASE_URL *before* src/lib/db.ts reads it, so the
// whole suite runs against an isolated database and never mutates dev/prod data.
//
// Why this matters: WaPolicy is a singleton row (id="global") shared by the whole
// app. Without isolation, an integration test that flips allowFirstContact leaks
// into the dev DB and the dashboard reads the polluted value on next load.

const testUrl = process.env.TEST_DATABASE_URL
const devUrl = process.env.DATABASE_URL

if (!testUrl) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Tests must run against an isolated database, ' +
      'not the dev/prod DATABASE_URL. Add TEST_DATABASE_URL to .env (see .env.example).',
  )
}

if (testUrl === devUrl) {
  throw new Error(
    'TEST_DATABASE_URL must differ from DATABASE_URL — refusing to run tests against the dev/prod database.',
  )
}

process.env.DATABASE_URL = testUrl
process.env.NODE_ENV = 'test'
