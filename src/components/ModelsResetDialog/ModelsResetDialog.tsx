import React, {useContext} from 'react';

import {observer} from 'mobx-react';
import {Text} from 'react-native-paper';

import {styles} from './styles';

import {L10nContext} from '../../utils';
import {OverlayCard} from '../../components/ui/OverlayCard';

type ModelsResetDialogProps = {
  testID?: string;
  visible: boolean;
  onDismiss: () => void;
  onReset: () => void;
};

export const ModelsResetDialog: React.FC<ModelsResetDialogProps> = observer(
  ({testID, visible, onDismiss, onReset}) => {
    const l10n = useContext(L10nContext);
    return (
      <OverlayCard
        visible={visible}
        onRequestClose={onDismiss}
        testID={testID}
        title={l10n.components.modelsResetDialog.confirmReset}
        actions={{
          secondary: {
            label: l10n.common.cancel,
            onPress: onDismiss,
            testID: 'cancel-reset-button',
          },
          primary: {
            label: l10n.components.modelsResetDialog.proceedWithReset,
            onPress: onReset,
            testID: 'proceed-reset-button',
          },
        }}>
        <Text style={styles.paragraph}>
          This will reset model settings (
          <Text variant="labelMedium">
            'system prompt', 'chat template', 'temperature',
          </Text>
          etc.) to their default configuration.
        </Text>

        <Text style={styles.paragraph}>
          - Your downloaded models will <Text style={styles.bold}>not</Text> be
          removed.
        </Text>

        <Text style={styles.paragraph}>
          - Your 'Local Models' will remain intact.
        </Text>
      </OverlayCard>
    );
  },
);
