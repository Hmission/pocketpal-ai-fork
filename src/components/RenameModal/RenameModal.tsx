import React, {useContext, useEffect} from 'react';
import {TextInput} from 'react-native';

import {useTheme} from '../../hooks';
import {OverlayCard} from '../ui/OverlayCard';
import {L10nContext} from '../../utils';
import {chatSessionStore, SessionMetaData} from '../../store';

interface RenameModalProps {
  visible: boolean;
  onClose: () => void;
  session: SessionMetaData | null;
}

/**
 * RenameModal — 会话重命名弹窗（OverlayCard 底座，DESIGN_SPEC §12.1）。
 * 表单类弹窗：标题 + 输入框 + 取消/保存操作区。
 */
export const RenameModal: React.FC<RenameModalProps> = ({
  visible,
  onClose,
  session,
}) => {
  const [newTitle, setNewTitle] = React.useState(session?.title || '');
  const theme = useTheme();
  const l10n = useContext(L10nContext);

  useEffect(() => {
    setNewTitle(session?.title || '');
  }, [session, visible]);

  const handleRename = async () => {
    if (session?.id && newTitle.trim()) {
      await chatSessionStore.updateSessionTitleBySessionId(
        session?.id,
        newTitle,
      );
      onClose();
    }
  };

  return (
    <OverlayCard
      visible={visible}
      onRequestClose={onClose}
      title={l10n.common.rename}
      actions={{
        secondary: {label: l10n.common.cancel, onPress: onClose},
        primary: {
          label: l10n.common.save,
          onPress: handleRename,
          disabled: !newTitle.trim(),
        },
      }}>
      <TextInput
        style={{
          borderWidth: theme.stroke.sm,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.s,
          padding: theme.spacing.s,
          ...theme.typography.bodyS,
          color: theme.colors.onSurface,
          minHeight: 44,
        }}
        placeholder="New Title"
        placeholderTextColor={theme.colors.onSurfaceVariant}
        value={newTitle}
        maxLength={40}
        onChangeText={setNewTitle}
        autoFocus={true}
        onSubmitEditing={handleRename}
        returnKeyType="done"
      />
    </OverlayCard>
  );
};
