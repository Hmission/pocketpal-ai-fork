export const setGenericPassword = jest.fn(() => Promise.resolve('mockPass'));
export const getGenericPassword = jest.fn(() =>
  Promise.resolve({password: 'mockPass', username: 'mockUser'}),
);
export const resetGenericPassword = jest.fn(() => Promise.resolve(null));
