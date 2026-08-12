import {database} from '../src/database';

describe('WatermelonDB', () => {
  it('should have a mocked database', () => {
    expect(database).toBeDefined();
    expect(database.collections).toBeDefined();
  });

  it('should have mocked collections', () => {
    const chatSessionsCollection = database.get('chat_sessions');
    expect(chatSessionsCollection).toBeDefined();
  });

  it('should be able to create records', async () => {
    const chatSessionsCollection = database.get('chat_sessions');
    const session = await chatSessionsCollection.create(record => {
      record.title = 'Test Session';
      record.date = new Date().toISOString();
    });

    expect(session).toBeDefined();
    expect(session.title).toBe('Test Session');
  });
});
