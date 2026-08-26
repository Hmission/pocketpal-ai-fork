import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

export const createStyles = (theme: Theme, compact: boolean = false) =>
  StyleSheet.create({
    container: {
      marginTop: compact ? 2 : 4,
    },
    skillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
    },
    skillsLabel: {
      fontSize: compact ? 10 : 12,
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginRight: theme.spacing.xs,
    },
    skillItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: theme.spacing.xs,
    },
    specialSkill: {
      // Additional styling for special skills like vision
    },
    skillIcon: {
      margin: 0,
      padding: 0,
      width: compact ? 14 : 16,
      height: compact ? 14 : 16,
      marginRight: 0,
    },
    skillText: {
      fontSize: compact ? 10 : 12,
      fontWeight: '600',
    },
    specialSkillText: {
      fontWeight: '600',
    },
    skillsText: {
      fontSize: compact ? 10 : 12,
      color: theme.colors.onSurfaceVariant,
      flexShrink: 1,
    },
    warningBadge: {
      marginLeft: theme.spacing.xxs,
      padding: 0,
    },
    warningIcon: {
      margin: 0,
      padding: 0,
      width: compact ? 14 : 16,
      height: compact ? 14 : 16,
    },
    warningContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    warningText: {
      fontSize: compact ? 10 : 12,
      color: theme.colors.error,
      marginLeft: theme.spacing.xxs,
    },
  });
