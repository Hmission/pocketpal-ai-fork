import React, {useContext} from 'react';
import {
  Animated,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  NativeModules,
} from 'react-native';

import DeviceInfo from 'react-native-device-info';
import Clipboard from '@react-native-clipboard/clipboard';
import {Text} from 'react-native-paper';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {BuildInfo} from 'llama.rn';

import {CopyIcon} from '../../assets/icons';

import {useTheme, useStaggerEntry} from '../../hooks';
import {createStyles} from './styles';
import {L10nContext} from '../../utils';
import {GITHUB_REPO_URL} from '../../utils/openSource';

// 构建时间（开发者预览版）：Android BuildInfoModule 常量注入；
// iOS/未注册时 undefined → UI 优雅省略。
const buildTimestamp: string | undefined = NativeModules.BuildInfo?.buildTimestamp;

export const AboutScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets);
  const l10n = useContext(L10nContext);
  // 页面入场（DESIGN_SPEC §5：一次性、不循环；JS driver）
  const entry = useStaggerEntry(0);

  const [appInfo, setAppInfo] = React.useState({
    version: '',
    build: '',
  });

  React.useEffect(() => {
    const version = DeviceInfo.getVersion();
    const buildNumber = DeviceInfo.getBuildNumber();
    setAppInfo({
      version,
      build: buildNumber,
    });
  }, []);

  const copyVersionToClipboard = () => {
    const versionString = `Version ${appInfo.version} (${appInfo.build})${
      buildTimestamp ? ` · 构建于 ${buildTimestamp}` : ''
    } · 开发者预览版`;
    Clipboard.setString(versionString);
    Alert.alert(
      l10n.about.versionCopiedTitle,
      l10n.about.versionCopiedDescription,
    );
  };

  const openGitHubRepo = () => {
    Linking.openURL(GITHUB_REPO_URL).catch(() => {
      Alert.alert(l10n.about.versionCopiedTitle, GITHUB_REPO_URL);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Animated.View style={entry}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text variant="titleLarge" style={styles.title}>
                小黄鸡
              </Text>
              <Text variant="bodyMedium" style={styles.description}>
                {l10n.about.description}
              </Text>
              <Text variant="bodyMedium" style={styles.bodyText}>
                {l10n.about.body}
              </Text>
              <Text variant="bodyMedium" style={styles.featuresTitle}>
                {l10n.about.featuresTitle}
              </Text>
              {l10n.about.features.map(feature => (
                <Text key={feature} style={styles.featureItem}>
                  {'\u2022  '}
                  {feature}
                </Text>
              ))}
              <Text variant="bodySmall" style={styles.openSourceText}>
                {l10n.about.openSourceBody}
              </Text>
              <View style={styles.versionContainer}>
                <TouchableOpacity
                  style={styles.versionButton}
                  onPress={copyVersionToClipboard}>
                  <Text style={styles.versionText}>
                    v{appInfo.version} ({appInfo.build})
                  </Text>
                  <CopyIcon
                    width={16}
                    height={16}
                    stroke={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {buildTimestamp ? (
                <Text style={styles.llamaBuildText}>
                  {`开发者预览版 · 构建于 ${buildTimestamp}`}
                </Text>
              ) : null}
              <Text style={styles.llamaBuildText}>
                llama.cpp {BuildInfo.number} ({BuildInfo.commit.substring(0, 7)}
                )
              </Text>
              <Text style={styles.basedOnText}>{l10n.about.basedOn}</Text>
              <View style={styles.githubSection}>
                <Text variant="bodySmall" style={styles.githubDescription}>
                  {l10n.about.githubRepoDescription}
                </Text>
                <TouchableOpacity
                  style={styles.githubButton}
                  onPress={openGitHubRepo}
                  testID="github-repo-button"
                  accessibilityRole="button"
                  accessibilityLabel={l10n.about.githubButton}>
                  <Text style={styles.githubButtonText}>
                    {l10n.about.githubButton}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};
