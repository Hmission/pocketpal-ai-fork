// Mock for WatermelonDB

// Mock Model class
class MockModel {
  constructor(collection, raw = {}) {
    this.collection = collection;
    this._raw = raw;
    this.id = raw.id || 'mock-id-' + Math.random().toString(36).substring(7);

    // Copy all properties from raw to this
    Object.keys(raw).forEach(key => {
      this[key] = raw[key];
    });
  }

  // Common Model methods
  update() {
    return Promise.resolve(this);
  }

  prepareUpdate() {
    return record => {
      // This function will be called with the record to update
      return Promise.resolve(this);
    };
  }

  markAsDeleted() {
    return Promise.resolve();
  }

  destroyPermanently() {
    return Promise.resolve();
  }

  // Add any other methods you need
}

// Mock Collection class
class MockCollection {
  constructor(database, modelClass) {
    this.database = database;
    this.modelClass = modelClass;
    this.table = modelClass.table;
    this._records = [];
  }

  // Mock query builder
  query() {
    return {
      fetch: () => Promise.resolve(this._records),
      observe: () => ({
        subscribe: callback => {
          callback(this._records);
          return {unsubscribe: () => {}};
        },
      }),
      where: () => this.query(),
      find: id =>
        Promise.resolve(this._records.find(record => record.id === id)),
    };
  }

  // Create a new record
  create(recordCreator) {
    const newRecord = new this.modelClass(this);
    if (typeof recordCreator === 'function') {
      recordCreator(newRecord);
    } else if (recordCreator) {
      Object.assign(newRecord, recordCreator);
    }
    this._records.push(newRecord);
    return Promise.resolve(newRecord);
  }

  // Find a record by ID
  find(id) {
    return Promise.resolve(this._records.find(record => record.id === id));
  }

  // Add any other methods you need
}

// Mock Database class
class MockDatabase {
  constructor(options = {}) {
    this.collections = new Map();
    this._adapter = options.adapter || {};

    // Initialize collections from modelClasses
    if (options.modelClasses) {
      options.modelClasses.forEach(modelClass => {
        this.collections.set(
          modelClass.table,
          new MockCollection(this, modelClass),
        );
      });
    }
  }

  // Get a collection by name
  get(collectionName) {
    return this.collections.get(collectionName);
  }

  // Batch operations
  batch(...operations) {
    return Promise.resolve();
  }

  // Write operations
  write(callback) {
    return Promise.resolve(callback());
  }

  // Action operations
  action(callback) {
    return callback();
  }

  // Add any other methods you need
}

// Mock SQLiteAdapter
class MockSQLiteAdapter {
  constructor(options = {}) {
    this.schema = options.schema;
    this.migrations = options.migrations;
    this.dbName = options.dbName;
  }

  // Add any methods you need
}

// Mock decorators
const text = () => (target, key) => {};
const field = () => (target, key) => {};
const date = () => (target, key) => {};
const children = () => (target, key) => {};
const relation = () => (target, key) => {};
const readonly = () => (target, key) => {};
const immutableRelation = () => (target, key) => {};
const json = () => (target, key) => {};
const nochange = () => (target, key) => {};

// Mock schema builders
const appSchema = schema => schema;
const tableSchema = schema => schema;

// Mock migrations
const schemaMigrations = migrations => migrations;
const createTable = table => ({type: 'create_table', table});
const addColumns = (table, columns) => ({type: 'add_columns', table, columns});
const createIndex = (table, columns) => ({
  type: 'create_index',
  table,
  columns,
});

// Export all the mocks
module.exports = {
  Database: MockDatabase,
  Model: MockModel,
  Collection: MockCollection,

  // Adapters
  SQLiteAdapter: MockSQLiteAdapter,

  // Decorators
  text,
  field,
  date,
  children,
  relation,
  readonly,
  immutableRelation,
  json,
  nochange,

  // Schema
  appSchema,
  tableSchema,

  // Migrations
  schemaMigrations,
  createTable,
  addColumns,
  createIndex,

  // Q for queries
  Q: {
    where: jest.fn(() => ({})),
    eq: jest.fn(() => ({})),
    gt: jest.fn(() => ({})),
    gte: jest.fn(() => ({})),
    lt: jest.fn(() => ({})),
    lte: jest.fn(() => ({})),
    between: jest.fn(() => ({})),
    oneOf: jest.fn(() => ({})),
    notIn: jest.fn(() => ({})),
    like: jest.fn(() => ({})),
    notLike: jest.fn(() => ({})),
    sanitizeLikeString: jest.fn(string => string),
    on: jest.fn(() => ({})),
    and: jest.fn(() => ({})),
    or: jest.fn(() => ({})),
    sortBy: jest.fn(() => ({})),
    desc: jest.fn(() => ({})),
    asc: jest.fn(() => ({})),
    take: jest.fn(() => ({})),
    skip: jest.fn(() => ({})),
    unsafe: jest.fn(() => ({})),
  },
};
