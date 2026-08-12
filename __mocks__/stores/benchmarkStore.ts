import {BenchmarkResult} from '../../src/utils/types';
import {mockResult} from '../../jest/fixtures/benchmark';

// Create mock functions
const mockRemoveResult = jest.fn((timestamp: string) => {
  benchmarkStore.results = benchmarkStore.results.filter(
    result => result.timestamp !== timestamp,
  );
});

const mockClearResults = jest.fn(() => {
  benchmarkStore.results = [];
});

const mockAddResult = jest.fn((result: BenchmarkResult) => {
  benchmarkStore.results.unshift(result);
});

const mockMarkAsSubmitted = jest.fn((uuid: string) => {
  const result = benchmarkStore.results.find(r => r.uuid === uuid);
  if (result) {
    result.submitted = true;
  }
});

const mockGetResultsByModel = jest.fn((modelId: string): BenchmarkResult[] => {
  return benchmarkStore.results.filter(result => result.modelId === modelId);
});

// Define the mockBenchmarkStore
export const benchmarkStore = {
  results: [mockResult],
  addResult: mockAddResult,
  removeResult: mockRemoveResult,
  clearResults: mockClearResults,
  markAsSubmitted: mockMarkAsSubmitted,
  getResultsByModel: mockGetResultsByModel,
  latestResult: mockResult,
};
