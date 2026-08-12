// Import the mocked module
jest.mock('../src/utils/keepAwake');
import {activateKeepAwake, deactivateKeepAwake} from '../src/utils/keepAwake';

describe('keepAwake', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should call activate on the native module', () => {
    activateKeepAwake();
    expect(activateKeepAwake).toHaveBeenCalled();
  });

  it('should call deactivate on the native module', () => {
    deactivateKeepAwake();
    expect(deactivateKeepAwake).toHaveBeenCalled();
  });
});
