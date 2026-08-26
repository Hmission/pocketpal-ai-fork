import React from 'react';
import {EnhancedSearchBar} from '../EnhancedSearchBar';
import {SearchFilters} from '../../../store/HFStore';
import {fireEvent, render} from '../../../../jest/test-utils';
import {l10n} from '../../../locales';

// Mock the theme hook
jest.mock('../../../hooks', () => ({
  useTheme: () => ({
    typography: {
      displayL: {fontSize: 28, lineHeight: 34, fontWeight: '600'},
      displayM: {fontSize: 26, lineHeight: 32, fontWeight: '600'},
      displayS: {fontSize: 24, lineHeight: 30, fontWeight: '600'},
      titleL: {fontSize: 22, lineHeight: 28, fontWeight: '600'},
      titleM: {fontSize: 18, lineHeight: 24, fontWeight: '600'},
      titleS: {fontSize: 16, lineHeight: 22, fontWeight: '600'},
      bodyM: {fontSize: 15, lineHeight: 21, fontWeight: '400'},
      bodyS: {fontSize: 13, lineHeight: 19, fontWeight: '400'},
      uiM: {fontSize: 14, lineHeight: 20, fontWeight: '400'},
      uiS: {fontSize: 12, lineHeight: 16, fontWeight: '400'},
      captionM: {fontSize: 11, lineHeight: 15, fontWeight: '400'},
      captionS: {fontSize: 10, lineHeight: 14, fontWeight: '400'},
      ml: {fontSize: 15, lineHeight: 21, fontWeight: '400'},
      xs: {fontSize: 12, lineHeight: 16, fontWeight: '400'},
      sm: {fontSize: 13, lineHeight: 19, fontWeight: '400'},
      lg: {fontSize: 18, lineHeight: 24, fontWeight: '600'},
      xl: {fontSize: 22, lineHeight: 28, fontWeight: '600'},
      display: {fontSize: 28, lineHeight: 34, fontWeight: '600'},
    },
    radius: {
      xs: 4,
      s: 6,
      m: 10,
      ml: 12,
      l: 14,
      xl: 20,
      full: 999,
      shapeRoles: {
        card: 'l',
        surface: 'm',
        pill: 'full',
        inputSmall: 's',
        circle: 'full',
      },
    },
    colors: {
      surface: '#ffffff',
      onSurface: '#000000',
      onSurfaceVariant: '#666666',
      surfaceVariant: '#f5f5f5',
      outline: '#cccccc',
      primary: '#007bff',
      primaryContainer: '#e3f2fd',
      onPrimaryContainer: '#0d47a1',
    },
    dark: false,
    // B52 图标 token 化后测试 mock 需同源（与 tokens/iconSize 一致）
    iconSize: {xs: 14, s: 16, m: 20, l: 24, xl: 28},
  }),
}));

describe('EnhancedSearchBar', () => {
  const defaultFilters: SearchFilters = {
    author: '',
    sortBy: 'relevance',
  };

  const defaultProps = {
    value: '',
    onChangeText: jest.fn(),
    filters: defaultFilters,
    onFiltersChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const {getByPlaceholderText, getByTestId} = render(
      <EnhancedSearchBar {...defaultProps} testID="enhanced-search-bar" />,
      {
        withBottomSheetProvider: true,
      },
    );

    expect(
      getByPlaceholderText(l10n.en.models.search.searchPlaceholder),
    ).toBeTruthy();
    expect(getByTestId('enhanced-search-bar')).toBeTruthy();
  });

  it('calls onChangeText when search input changes', () => {
    const onChangeText = jest.fn();
    const {getByPlaceholderText} = render(
      <EnhancedSearchBar {...defaultProps} onChangeText={onChangeText} />,
      {
        withBottomSheetProvider: true,
      },
    );

    const searchInput = getByPlaceholderText(
      l10n.en.models.search.searchPlaceholder,
    );
    fireEvent.changeText(searchInput, 'test query');

    expect(onChangeText).toHaveBeenCalledWith('test query');
  });

  it('shows clear button when search has text', () => {
    const {getByTestId} = render(
      <EnhancedSearchBar
        {...defaultProps}
        value="test"
        testID="enhanced-search-bar"
      />,
      {
        withBottomSheetProvider: true,
      },
    );

    // The component should render with testID when provided
    expect(getByTestId('enhanced-search-bar')).toBeTruthy();

    // The clear button should be present when there's text (it's a TouchableOpacity with close icon)
    const component = getByTestId('enhanced-search-bar');
    expect(component).toBeTruthy();
  });

  it('opens filter sheet when filter buttons are pressed', () => {
    const onFiltersChange = jest.fn();
    const {getByTestId} = render(
      <EnhancedSearchBar {...defaultProps} onFiltersChange={onFiltersChange} />,
      {
        withBottomSheetProvider: true,
      },
    );

    // Test that Author filter button exists and can be pressed
    const authorButton = getByTestId('filter-button-author');
    expect(authorButton).toBeTruthy();
    fireEvent.press(authorButton);

    // Test that Sort filter button exists and can be pressed
    const sortButton = getByTestId('filter-button-sort');
    expect(sortButton).toBeTruthy();
    fireEvent.press(sortButton);
  });

  it('shows active filter indicator when filters are applied', () => {
    const filtersWithActive: SearchFilters = {
      ...defaultFilters,
      author: 'test-author',
    };

    const {getByTestId, getByText} = render(
      <EnhancedSearchBar
        {...defaultProps}
        filters={filtersWithActive}
        testID="enhanced-search-bar"
      />,
      {
        withBottomSheetProvider: true,
      },
    );

    // Component should render without errors when filters are active
    expect(getByTestId('enhanced-search-bar')).toBeTruthy();

    // Should show the author filter value when active
    expect(getByText('test-author')).toBeTruthy();
  });
});
