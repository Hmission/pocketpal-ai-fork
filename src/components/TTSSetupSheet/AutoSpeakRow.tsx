import React, {useContext} from 'react';
import {View} from 'react-native';
import {Text} from 'react-native-paper';
import {observer} from 'mobx-react';

import {Switch} from '../ui/Switch';

import {useTheme} from '../../hooks/useTheme';
import {ttsStore} from '../../store';
import {L10nContext} from '../../utils';

import {createStyles} from './styles';

/**
 * Primary-view auto-speak toggle row. Single switch bound to the store's
 * `autoSpeakEnabled` flag.
 */
export const AutoSpeakRow: React.FC = observer(() => {
  const theme = useTheme();
  const l10n = useContext(L10nContext);
  const styles = createStyles(theme);

  return (
    <View style={styles.primaryRow} testID="tts-auto-speak-row">
      <View style={styles.primaryRowLabelBlock}>
        <Text style={styles.primaryRowLabel}>
          {l10n.voiceAndSpeech.autoSpeakLabel}
        </Text>
        <Text style={styles.primaryRowDescription}>
          {l10n.voiceAndSpeech.autoSpeakDescription}
        </Text>
      </View>
      <Switch
        value={ttsStore.autoSpeakEnabled}
        onValueChange={v => ttsStore.setAutoSpeak(v)}
        testID="tts-auto-speak-switch"
        accessibilityLabel={l10n.voiceAndSpeech.autoSpeakLabel}
      />
    </View>
  );
});
