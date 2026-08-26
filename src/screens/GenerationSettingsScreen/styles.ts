import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.surface,
    },
    container: {
      padding: theme.spacing.m,
    },
    scrollViewContent: {
      paddingVertical: theme.spacing.m,
      paddingHorizontal: theme.spacing.m,
    },
    card: {
      marginVertical: theme.spacing.s,
      // 形状角色：内容卡片 l(20)（DESIGN_SPEC §4）
      borderRadius: theme.radius.l,
      backgroundColor: theme.colors.background,
    },
    settingItemContainer: {
      marginVertical: theme.spacing.m,
    },
    switchContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginVertical: theme.spacing.s,
    },
    textContainer: {
      flex: 1,
      marginRight: theme.spacing.m,
    },
    labelWithIconContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.xs,
    },
    settingIcon: {
      marginRight: theme.spacing.s,
    },
    textLabel: {
      color: theme.colors.onSurface,
    },
    textDescription: {
      color: theme.colors.onSurfaceVariant,
      //marginTop: 4,
    },
    divider: {
      marginVertical: theme.spacing.sm,
    },
    slider: {
      //marginVertical: 8,
      //height: 40,
    },
    textInput: {
      marginVertical: theme.spacing.s,
    },
    invalidInput: {
      borderColor: theme.colors.error,
      borderWidth: 1,
    },
    errorText: {
      color: theme.colors.error,
      marginTop: theme.spacing.xs,
    },
    menuContainer: {
      position: 'relative',
    },
    menuButton: {
      minWidth: 100,
    },
    consentContainer: {
      marginVertical: theme.spacing.s,
    },
    consentButton: {
      alignSelf: 'flex-end',
      marginTop: theme.spacing.sm,
    },
    buttonContent: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
    },
    advancedSettingsButton: {
      marginVertical: theme.spacing.s,
    },
    advancedSettingsContent: {
      marginTop: theme.spacing.s,
    },
    advancedAccordion: {
      height: 55,
      //backgroundColor: theme.colors.surface,
    },
    accordionTitle: {
      fontSize: theme.typography.uiM.fontSize, // B56③ fontSize→uiM
      color: theme.colors.secondary,
    },
    menu: {
      width: 170,
    },
    linkContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: theme.spacing.xs,
    },
    linkIcon: {
      marginLeft: theme.spacing.xs,
    },
    segmentedButtons: {
      marginVertical: theme.spacing.s,
    },
  });
