/**
 * ButlerUpgradeRow — 管家卡片升级引导行（2026-08-21，L2 用户主权升级）
 *
 * 渲染于 butler 卡片 actions 槽（ChatScreen renderTextMessage 注入），
 * 点按 → 路由到更聪明的模型（复用懒切换链路：chat 任务族选型 + loadCandidate）。
 * 锋利原则：只渲染 + 回调透传，不直接驱动 store/native（与 TaskErrorCard 同构）。
 */
import * as React from 'react';
import {View, ViewStyle} from 'react-native';

import {L10nContext} from '../../utils';
import {Chip} from '../ui/Chip';

export const ButlerUpgradeRow: React.FC<{
  userText: string;
  onUpgrade: (text: string) => void;
}> = ({userText, onUpgrade}) => {
  const l10n = React.useContext(L10nContext);

  return (
    <View style={styles.wrap} testID="butler-upgrade-row">
      {/* B57：6% wash + 40% 描边 → DS Chip outline（透明底 + 1px
      语义色描边，disabled 自动降级；无障碍 label 由 label 自动承载） */}
      <Chip
        testID="butler-upgrade"
        variant="outline"
        color="primary"
        size="s"
        label={`✦ ${l10n.chat.butlerUpgrade}`}
        onPress={() => onUpgrade(userText)}
      />
    </View>
  );
};

const styles: {
  wrap: ViewStyle;
} = {
  wrap: {
    marginTop: 6,
    marginLeft: 12,
  },
};
