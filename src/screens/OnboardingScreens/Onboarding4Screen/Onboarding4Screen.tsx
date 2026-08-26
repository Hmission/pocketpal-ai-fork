import React from 'react';
import {View} from 'react-native';
import {observer} from 'mobx-react';
import {Text} from 'react-native-paper';

import {useTheme} from '../../../hooks';

import {OnboardingScaffold} from '../components/OnboardingScaffold';
import {OnboardingBottomBar} from '../components/OnboardingBottomBar';
import {OnboardingContent} from '../components/OnboardingContent';
import {ItalicAccentTitle} from '../components/ItalicAccentTitle';
import {HighlightText} from '../components/HighlightText';
import {PhoneWithShield} from '../illustrations/PhoneWithShield';
import {useOnboardingHandlers} from '../useOnboardingHandlers';
import {createStyles} from './styles';

export const Onboarding4Screen: React.FC = observer(() => {
  const {l10n, next, goBack} = useOnboardingHandlers(4);
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const t = l10n.onboarding;
  return (
    <OnboardingScaffold
      step={4}
      illustration={
        <View style={styles.illustrationWrap}>
          <PhoneWithShield width={85} />
        </View>
      }
      content={
        <OnboardingContent
          eyebrow={t.screen4.eyebrow}
          title={
            <ItalicAccentTitle
              title={t.screen4.title}
              accent={t.screen4.titleAccent}
            />
          }
          body={
            <>
              <HighlightText
                body={t.screen4.body}
                phrases={[t.screen4.highlight]}
              />
              {/* 阶段四审计闭环：首启流程存储权限说明（B13/B15 权限链的可见面） */}
              <Text style={styles.storageNote}>{t.screen4.storageNote}</Text>
            </>
          }
        />
      }
      bottomBar={
        <OnboardingBottomBar
          primaryLabel={t.screen4.cta}
          onPrimary={next}
          onBack={goBack}
          backAccessibilityLabel={t.back}
        />
      }
    />
  );
});
