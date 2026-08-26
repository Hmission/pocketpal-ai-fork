import React, {useContext, useEffect, useState} from 'react';
import {Animated, ScrollView, StyleSheet, View} from 'react-native';
import {Text} from 'react-native-paper';
import {SafeAreaView} from 'react-native-safe-area-context';
import {observer} from 'mobx-react-lite';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {pickDirectory} from '@react-native-documents/picker';

import {useTheme, useStaggerEntry} from '../../hooks';
import {infoDialog} from '../../components/ui/InfoDialog';
import {confirmDialog} from '../../components/ui/ConfirmDialog';
import {L10nContext} from '../../utils';
import {Theme} from '../../utils/types';
import {modelStore} from '../../store';
import {DEFAULT_MODELS_DIR} from '../../utils/paths';
import {
  getCustomModelDirs,
  addCustomModelDir,
  removeCustomModelDir,
} from '../../utils/modelDirs';
import {ensureCustomDirAccess} from '../../utils/androidPermission';
import {Surface, PressableScale, IconTile} from '../../components/ui';
import {BrowserIcon} from '../../assets/icons';

/**
 * B15 模型目录管理（ADR-0004 双轨）：
 * - 默认目录（getExternalFilesDir/models）：HF 下载落点，零权限
 * - 自定义目录列表：扫描范围扩展，默认注册 AIOS 共享目录
 * 添加走系统目录选择器（SAF，只能选文件夹）；增删后立即触发扫描。
 */

/** SAF tree URI → 文件系统绝对路径（primary: → /storage/emulated/0/）。 */
function treeUriToPath(uri: string): string | null {
  try {
    const m = uri.match(/\/tree\/([^/?#]+)/);
    if (!m) {
      return null;
    }
    const tree = decodeURIComponent(m[1]); // e.g. primary:Documents/AIOS/models
    const idx = tree.indexOf(':');
    if (idx < 0) {
      return null;
    }
    const volume = tree.slice(0, idx);
    const rel = tree.slice(idx + 1);
    if (volume === 'primary') {
      return `/storage/emulated/0/${rel}`;
    }
    return `/storage/${volume}/${rel}`;
  } catch {
    return null;
  }
}

export const ModelDirsScreen: React.FC = observer(() => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const l10n = useContext(L10nContext);
  const t = l10n.components.modelDirs;
  const entry = useStaggerEntry(0);

  const [customDirs, setCustomDirs] = useState<string[]>([]);

  const refresh = async () => {
    const dirs = await getCustomModelDirs();
    setCustomDirs(dirs);
  };

  useEffect(() => {
    refresh();
  }, []);

  const onAdd = async () => {
    // 系统目录选择器（SAF）：Android 上只能选中文件夹
    let res;
    try {
      res = await pickDirectory();
    } catch {
      return; // 用户取消
    }
    if (!res) {
      return;
    }
    const dir = treeUriToPath(res.uri);
    if (!dir) {
      infoDialog({title: t.invalidDir});
      return;
    }
    // 权限引导：目录不可读时弹「所有文件访问」（不阻塞，扫描兜底）
    await ensureCustomDirAccess(dir);
    let exists = false;
    try {
      exists = await RNFS.exists(dir);
    } catch {
      exists = false;
    }
    if (!exists) {
      infoDialog({title: t.invalidDir});
      return;
    }
    const next = await addCustomModelDir(dir);
    setCustomDirs(next);
    modelStore.scanLocalModels();
  };

  const onRemove = async (dir: string) => {
    const ok = await confirmDialog({
      title: t.removeConfirm,
      message: dir,
      confirmText: l10n.common.delete,
      cancelText: l10n.common.cancel,
      destructive: true,
    });
    if (ok) {
      const next = await removeCustomModelDir(dir);
      setCustomDirs(next);
      modelStore.scanLocalModels();
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 默认目录（规范路径，零权限） */}
        <Animated.View style={[styles.section, entry]}>
          <Text style={styles.sectionTitle}>{t.defaultDirLabel}</Text>
          <Surface radius="l" elevation={0} style={styles.card}>
            <View style={styles.row}>
              <IconTile icon={BrowserIcon} color={theme.colors.primary} />
              <View style={styles.rowBody}>
                <View style={styles.rowTitleLine}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {DEFAULT_MODELS_DIR}
                  </Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{t.defaultBadge}</Text>
                  </View>
                </View>
                <Text style={styles.rowHint}>{t.defaultDirHint}</Text>
              </View>
            </View>
          </Surface>
        </Animated.View>

        {/* 自定义目录列表 */}
        <Animated.View style={[styles.section, entry]}>
          <Text style={styles.sectionTitle}>{t.customDirsLabel}</Text>
          <Surface radius="l" elevation={0} style={styles.card}>
            {customDirs.map(dir => (
              <PressableScale
                key={dir}
                testID="model-dir-item"
                style={styles.row}
                onPress={() => onRemove(dir)}>
                <IconTile icon={BrowserIcon} color={theme.colors.secondary} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {dir}
                  </Text>
                  <Text style={styles.rowHint}>{t.customDirsHint}</Text>
                </View>
              </PressableScale>
            ))}
            <PressableScale
              testID="model-dir-add"
              style={styles.addBtn}
              onPress={onAdd}>
              <Text style={styles.addBtnText}>{t.addDirButton}</Text>
            </PressableScale>
          </Surface>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: theme.spacing.m,
      gap: theme.spacing.l,
    },
    section: {
      gap: theme.spacing.s,
    },
    sectionTitle: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
      marginHorizontal: theme.spacing.xs,
    },
    card: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: theme.spacing.m,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    rowBody: {
      flex: 1,
      gap: 2,
    },
    rowTitleLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xs,
    },
    rowTitle: {
      flex: 1,
      ...theme.typography.bodyM,
      color: theme.colors.onSurface,
    },
    rowHint: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
    },
    badge: {
      borderRadius: theme.radius[theme.shapeRoles.pill],
      paddingHorizontal: 6,
      paddingVertical: 1,
      backgroundColor: theme.colors.primaryContainer,
    },
    badgeText: {
      ...theme.typography.captionS,
      color: theme.colors.onPrimaryContainer,
    },
    addBtn: {
      borderRadius: theme.radius[theme.shapeRoles.inputSmall],
      backgroundColor: theme.colors.primary,
      paddingVertical: theme.spacing.sm,
      marginVertical: theme.spacing.sm,
      alignItems: 'center',
    },
    addBtnText: {
      ...theme.typography.bodyM,
      color: theme.colors.onPrimary,
    },
  });
