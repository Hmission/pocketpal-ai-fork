// Mock Model class
export default class Model {
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
}

// Mock Associations type
export const Associations = {};
