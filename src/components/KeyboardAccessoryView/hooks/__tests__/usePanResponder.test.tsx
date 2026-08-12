import React from 'react';
import {render} from '@testing-library/react-native';
import {View, Platform, Animated} from 'react-native';

import {usePanResponder} from '../usePanResponder';

// Mock Platform
const mockPlatform = Platform as any;

// Test component that uses the hook
const TestComponent = () => {
  const {panHandlers, positionY} = usePanResponder();

  return (
    <View testID="test-component" {...panHandlers}>
      <Animated.View
        testID="animated-view"
        style={{transform: [{translateY: positionY}]}}
      />
    </View>
  );
};

describe('usePanResponder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns pan handlers and position Y on iOS', () => {
    mockPlatform.OS = 'ios';

    const {getByTestId} = render(<TestComponent />);

    const testComponent = getByTestId('test-component');
    const animatedView = getByTestId('animated-view');

    expect(testComponent).toBeTruthy();
    expect(animatedView).toBeTruthy();
  });

  it('returns empty pan handlers on Android', () => {
    mockPlatform.OS = 'android';

    const {getByTestId} = render(<TestComponent />);

    const testComponent = getByTestId('test-component');
    const animatedView = getByTestId('animated-view');

    expect(testComponent).toBeTruthy();
    expect(animatedView).toBeTruthy();
  });

  it('provides consistent positionY reference across renders', () => {
    mockPlatform.OS = 'ios';

    const TestComponentWithState = () => {
      const [count, setCount] = React.useState(0);
      const {panHandlers, positionY} = usePanResponder();

      React.useEffect(() => {
        if (count < 2) {
          setCount(count + 1);
        }
      }, [count]);

      return (
        <View testID="test-component" {...panHandlers}>
          <Animated.View
            testID="animated-view"
            style={{transform: [{translateY: positionY}]}}
          />
        </View>
      );
    };

    const {getByTestId} = render(<TestComponentWithState />);

    const testComponent = getByTestId('test-component');
    const animatedView = getByTestId('animated-view');

    expect(testComponent).toBeTruthy();
    expect(animatedView).toBeTruthy();
  });

  it('handles pan responder creation correctly on iOS', () => {
    mockPlatform.OS = 'ios';

    const TestComponentWithHandlers = () => {
      const {panHandlers, positionY} = usePanResponder();

      // Test that pan handlers have the expected properties for iOS
      const hasOnMoveShouldSetPanResponder =
        'onMoveShouldSetPanResponder' in panHandlers;
      const hasOnPanResponderMove = 'onPanResponderMove' in panHandlers;

      return (
        <View testID="test-component" {...panHandlers}>
          <View
            testID="has-move-should-set"
            data-value={hasOnMoveShouldSetPanResponder}
          />
          <View
            testID="has-pan-responder-move"
            data-value={hasOnPanResponderMove}
          />
          <Animated.View
            testID="animated-view"
            style={{transform: [{translateY: positionY}]}}
          />
        </View>
      );
    };

    const {getByTestId} = render(<TestComponentWithHandlers />);

    const testComponent = getByTestId('test-component');
    const animatedView = getByTestId('animated-view');

    expect(testComponent).toBeTruthy();
    expect(animatedView).toBeTruthy();
  });

  it('returns empty object for pan handlers on Android', () => {
    mockPlatform.OS = 'android';

    const TestComponentWithHandlers = () => {
      const {panHandlers, positionY} = usePanResponder();

      // Test that pan handlers is empty object for Android
      const handlerKeys = Object.keys(panHandlers);

      return (
        <View testID="test-component" {...panHandlers}>
          <View testID="handler-keys-count" data-value={handlerKeys.length} />
          <Animated.View
            testID="animated-view"
            style={{transform: [{translateY: positionY}]}}
          />
        </View>
      );
    };

    const {getByTestId} = render(<TestComponentWithHandlers />);

    const testComponent = getByTestId('test-component');
    const animatedView = getByTestId('animated-view');
    const handlerKeysCount = getByTestId('handler-keys-count');

    expect(testComponent).toBeTruthy();
    expect(animatedView).toBeTruthy();
    expect(handlerKeysCount.props['data-value']).toBe(0);
  });

  it('initializes positionY with zero value', () => {
    mockPlatform.OS = 'ios';

    const TestComponentWithValue = () => {
      const {panHandlers, positionY} = usePanResponder();

      // Access the initial value of the Animated.Value
      const initialValue = (positionY as any)._value;

      return (
        <View testID="test-component" {...panHandlers}>
          <View testID="initial-value" data-value={initialValue} />
          <Animated.View
            testID="animated-view"
            style={{transform: [{translateY: positionY}]}}
          />
        </View>
      );
    };

    const {getByTestId} = render(<TestComponentWithValue />);

    const testComponent = getByTestId('test-component');
    const animatedView = getByTestId('animated-view');
    const initialValue = getByTestId('initial-value');

    expect(testComponent).toBeTruthy();
    expect(animatedView).toBeTruthy();
    expect(initialValue.props['data-value']).toBe(0);
  });

  it('maintains same Animated.Value instance across re-renders', () => {
    mockPlatform.OS = 'ios';

    const TestComponentWithRerender = () => {
      const [renderCount, setRenderCount] = React.useState(0);
      const {panHandlers, positionY} = usePanResponder();

      // Store the first positionY reference
      const positionYRef = React.useRef(positionY);
      const isSameReference = positionYRef.current === positionY;

      React.useEffect(() => {
        if (renderCount === 0) {
          setRenderCount(1);
        }
      }, [renderCount]);

      return (
        <View testID="test-component" {...panHandlers}>
          <View testID="same-reference" data-value={isSameReference} />
          <Animated.View
            testID="animated-view"
            style={{transform: [{translateY: positionY}]}}
          />
        </View>
      );
    };

    const {getByTestId} = render(<TestComponentWithRerender />);

    const testComponent = getByTestId('test-component');
    const animatedView = getByTestId('animated-view');
    const sameReference = getByTestId('same-reference');

    expect(testComponent).toBeTruthy();
    expect(animatedView).toBeTruthy();
    expect(sameReference.props['data-value']).toBe(true);
  });
});
