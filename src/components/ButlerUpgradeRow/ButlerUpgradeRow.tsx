/**
 * ButlerUpgradeRow — 管家卡片升级引导行（2026-08-21，L2 用户主权升级）
 *
 * 渲染于 butler 卡片 actions 槽（ChatScreen renderTextMessage 注入），
 * 点按 → 路由到更聪明的模型（复用懒切换链路：chat 任务族选型 + loadCandidate）。
 * 锋利原则：只渲染 + 回调透传，不直接驱动 store/native（与 TaskErrorCard 同构）。
 */
import * as React from 'react';
import {Text, TouchableOpacity, View, ViewStyle, TextStyle} from 'react-native';

import {useTheme} from '../../hooks';
import {Theme} from '../../utils/types';
import {withOpacity} from '../../utils/colorUtils';
import {L10nContext} from '../../utils';

export const ButlerUpgradeRow: React.FC<{
  userText: string;
  onUpgrade: (text: string) => void;
}> = ({userText, onUpgrade}) => {
  const theme = useTheme();
  const l10n = React.useContext(L10nContext);

  return (
    <View style={styles.wrap} testID="butler-upgrade-row">
      <TouchableOpacity
        testID="butler-upgrade"
        onPress={() => onUpgrade(userText)}
        style={styles.chip(theme)}
        accessibilityRole="button">
        <Text style={styles.chipText(theme)}>
          ✨ {l10n.chat.butlerUpgrade}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles: {
  wrap: ViewStyle;
  chip: (theme: Theme) => ViewStyle;
  chipText: (theme: Theme) => TextStyle;
} = {
  wrap: {
    marginTop: 6,
    marginLeft: 12,
  },
  chip: theme => ({
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs + 1,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.primary, 0.4),
    backgroundColor: withOpacity(theme.colors.primary, 0.06),
  }),
  chipText: theme => ({
    ...theme.typography.captionM,
    fontWeight: '600',
    color: theme.colors.primary,
  }),
};
