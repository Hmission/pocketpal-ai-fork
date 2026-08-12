// Mock migrations
export const schemaMigrations = migrations => migrations;
export const createTable = table => ({type: 'create_table', table});
export const addColumns = (table, columns) => ({
  type: 'add_columns',
  table,
  columns,
});
export const createIndex = (table, columns) => ({
  type: 'create_index',
  table,
  columns,
});
