// Mock for SQLiteAdapter
class MockSQLiteAdapter {
  constructor(options = {}) {
    this.schema = options.schema;
    this.migrations = options.migrations;
    this.dbName = options.dbName;
  }
}

export default MockSQLiteAdapter;
