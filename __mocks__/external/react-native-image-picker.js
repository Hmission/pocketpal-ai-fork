export const launchCamera = jest.fn(options => {
  return Promise.resolve({
    didCancel: false,
    assets: [
      {
        uri: 'file://mock-image.jpg',
        fileName: 'mock-image.jpg',
        type: 'image/jpeg',
      },
    ],
  });
});

export const launchImageLibrary = jest.fn(options => {
  return Promise.resolve({
    didCancel: false,
    assets: [
      {
        uri: 'file://mock-image-library.jpg',
        fileName: 'mock-image-library.jpg',
        type: 'image/jpeg',
      },
    ],
  });
});
