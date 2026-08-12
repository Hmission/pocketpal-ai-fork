const mockAppCheck = {
  newReactNativeFirebaseAppCheckProvider: jest.fn().mockReturnValue({
    configure: jest.fn(),
  }),
  initializeAppCheck: jest.fn(),
  getToken: jest.fn().mockResolvedValue({token: 'mock-token'}),
};

export default () => ({
  appCheck: () => mockAppCheck,
});
