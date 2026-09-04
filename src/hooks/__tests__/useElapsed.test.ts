import {act, renderHook} from '@testing-library/react-hooks';

import {useElapsed, formatElapsed} from '../useElapsed';

describe('useElapsed', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('active=true 时按秒递增', () => {
    const {result, rerender} = renderHook(({active}) => useElapsed(active), {
      initialProps: {active: false},
    });
    expect(result.current).toBe(0);

    rerender({active: true});
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(1);
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(6);
  });

  it('active=false 归零', () => {
    const {result, rerender} = renderHook(({active}) => useElapsed(active), {
      initialProps: {active: true},
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(2);

    rerender({active: false});
    expect(result.current).toBe(0);
  });
});

describe('formatElapsed', () => {
  it('mm:ss 双位补零', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(5)).toBe('00:05');
    expect(formatElapsed(65)).toBe('01:05');
    expect(formatElapsed(600)).toBe('10:00');
  });
});
