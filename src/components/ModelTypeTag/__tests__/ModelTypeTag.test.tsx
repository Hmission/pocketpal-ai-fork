import React from 'react';
import {render} from '@testing-library/react-native';

import {ModelTypeTag, ModelType} from '../ModelTypeTag';

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => {
  return (props: any) => {
    const {View} = require('react-native');
    return <View testID="mock-icon" {...props} />;
  };
});

// Mock useTheme hook
jest.mock('../../../hooks', () => ({
  useTheme: () => ({
    colors: {
      tertiary: '#FF6B35',
      secondary: '#4ECDC4',
      onSurfaceVariant: '#666666',
    },
  }),
}));

describe('ModelTypeTag', () => {
  it('renders vision type correctly', () => {
    const {getByTestId} = render(<ModelTypeTag type="vision" />);

    const container = getByTestId('model-type-tag-container');
    expect(container).toBeTruthy();
  });

  it('renders mmproj type correctly', () => {
    const {getByTestId} = render(<ModelTypeTag type="mmproj" />);

    const container = getByTestId('model-type-tag-container');
    expect(container).toBeTruthy();
  });

  it('renders llm type correctly', () => {
    const {getByTestId} = render(<ModelTypeTag type="llm" />);

    const container = getByTestId('model-type-tag-container');
    expect(container).toBeTruthy();
  });

  it('renders with label when provided', () => {
    const {getByText} = render(
      <ModelTypeTag type="vision" label="Vision Model" />,
    );

    expect(getByText('Vision Model')).toBeTruthy();
  });

  it('renders without label when not provided', () => {
    const {queryByText} = render(<ModelTypeTag type="vision" />);

    // Should not have any text when no label is provided
    expect(queryByText(/./)).toBeNull();
  });

  it('renders small size by default', () => {
    const {getByTestId} = render(<ModelTypeTag type="vision" />);

    const container = getByTestId('model-type-tag-container');
    expect(container).toBeTruthy();
  });

  it('renders medium size when specified', () => {
    const {getByTestId} = render(<ModelTypeTag type="vision" size="medium" />);

    const container = getByTestId('model-type-tag-container');
    expect(container).toBeTruthy();
  });

  it('uses correct icon for vision type', () => {
    const {getByTestId} = render(<ModelTypeTag type="vision" />);

    const icon = getByTestId('mock-icon');
    expect(icon.props.name).toBe('eye');
  });

  it('uses correct icon for mmproj type', () => {
    const {getByTestId} = render(<ModelTypeTag type="mmproj" />);

    const icon = getByTestId('mock-icon');
    expect(icon.props.name).toBe('image-outline');
  });

  it('uses correct icon for llm type', () => {
    const {getByTestId} = render(<ModelTypeTag type="llm" />);

    const icon = getByTestId('mock-icon');
    expect(icon.props.name).toBe('brain');
  });

  it('uses correct icon size for small size', () => {
    const {getByTestId} = render(<ModelTypeTag type="vision" size="small" />);

    const icon = getByTestId('mock-icon');
    expect(icon.props.size).toBe(12);
  });

  it('uses correct icon size for medium size', () => {
    const {getByTestId} = render(<ModelTypeTag type="vision" size="medium" />);

    const icon = getByTestId('mock-icon');
    expect(icon.props.size).toBe(16);
  });

  it('uses correct color for vision type', () => {
    const {getByTestId} = render(<ModelTypeTag type="vision" />);

    const icon = getByTestId('mock-icon');
    expect(icon.props.color).toBe('#FF6B35'); // tertiary color
  });

  it('uses correct color for mmproj type', () => {
    const {getByTestId} = render(<ModelTypeTag type="mmproj" />);

    const icon = getByTestId('mock-icon');
    expect(icon.props.color).toBe('#FF6B35'); // tertiary color
  });

  it('uses correct color for llm type', () => {
    const {getByTestId} = render(<ModelTypeTag type="llm" />);

    const icon = getByTestId('mock-icon');
    expect(icon.props.color).toBe('#4ECDC4'); // secondary color
  });

  it('handles unknown type gracefully', () => {
    const {getByTestId} = render(
      <ModelTypeTag type={'unknown' as ModelType} />,
    );

    const icon = getByTestId('mock-icon');
    expect(icon.props.name).toBe('cube-outline');
    expect(icon.props.color).toBe('#666666'); // onSurfaceVariant color
  });

  it('renders both icon and label when both are provided', () => {
    const {getByTestId, getByText} = render(
      <ModelTypeTag type="vision" label="Vision Model" />,
    );

    const icon = getByTestId('mock-icon');
    const label = getByText('Vision Model');

    expect(icon).toBeTruthy();
    expect(label).toBeTruthy();
  });
});
