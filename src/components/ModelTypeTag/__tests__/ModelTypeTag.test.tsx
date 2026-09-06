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

// 替身 theme。⚠ 两个要点：
// 1) mock 路径必须与组件实际 import 一致——ModelTypeTag 走的是 `../../hooks/useTheme`
//    （具体文件），原先 mock barrel `'../../../hooks'` **从未生效**，组件一直用真主题渲染，
//    表现为 4 例「色值不匹配」的假故障（色值 SSOT 在 src/theme/tokens/colors.ts）。
// 2) 下列 hex 是**故意造的哨兵值**，不是任何设计口径；断言一律绑 token（见下方用例）——
//    本测试的契约是 type → token 映射，锁死 hex 会让「改主题色」错误地惊动组件测试。
const mockTheme = {
  colors: {
    tertiary: '#FF6B35',
    secondary: '#4ECDC4',
    onSurfaceVariant: '#666666',
  },
  // B56① token 数值对机械替换后补全（等值替换不改变消费面）
  spacing: {
    size: {minTapTarget: 44, controlHeight: 36}, // R1 size 域防御补全
    none: 0,
    xxs: 2,
    xs: 4,
    s: 8,
    sm: 12,
    m: 16,
    ml: 20,
    l: 24,
    xl: 32,
    xxl: 40,
  },
  radius: {
    none: 0,
    xxs: 2,
    xs: 4,
    s: 8,
    m: 12,
    ml: 16,
    l: 20,
    xl: 32,
    xxl: 40,
    full: 999,
  },
};

jest.mock('../../../hooks/useTheme', () => ({
  useTheme: () => mockTheme,
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
    expect(icon.props.color).toBe(mockTheme.colors.tertiary);
  });

  it('uses correct color for mmproj type', () => {
    const {getByTestId} = render(<ModelTypeTag type="mmproj" />);

    const icon = getByTestId('mock-icon');
    expect(icon.props.color).toBe(mockTheme.colors.tertiary);
  });

  it('uses correct color for llm type', () => {
    const {getByTestId} = render(<ModelTypeTag type="llm" />);

    const icon = getByTestId('mock-icon');
    expect(icon.props.color).toBe(mockTheme.colors.secondary);
  });

  it('handles unknown type gracefully', () => {
    const {getByTestId} = render(
      <ModelTypeTag type={'unknown' as ModelType} />,
    );

    const icon = getByTestId('mock-icon');
    expect(icon.props.name).toBe('cube-outline');
    expect(icon.props.color).toBe(mockTheme.colors.onSurfaceVariant);
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
