import * as React from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import {
  Appbar,
  Button,
  TextInput,
  Divider,
  IconButton,
} from 'react-native-paper';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {pick, types} from '@react-native-documents/picker';
import {
  AIOS_SOUL_FILE,
  AIOS_USER_FILE,
  AIOS_AGENTS_FILE,
  AIOS_MEMORY_FILE,
  AIOS_WORKSPACE_DIR,
  AIOS_DIARY_DIR,
} from '../../utils/paths';
import {listDiaries} from '../../services/aiosMemory/rituals';
import {useTheme} from '../../hooks/useTheme';
import {useStaggerEntry} from '../../hooks/useStaggerEntry';
import type {Theme} from '../../utils/types';
import {IconTile, ListItem} from '../../components/ui';
import {infoDialog} from '../../components/ui/InfoDialog';
import {EditBoxIcon, PencilLineIcon} from '../../assets/icons';

const FILES = [
  {label: 'SOUL.md (人设)', path: AIOS_SOUL_FILE},
  {label: 'USER.md (大王画像)', path: AIOS_USER_FILE},
  {label: 'AGENTS.md (规范)', path: AIOS_AGENTS_FILE},
  {label: 'MEMORY.md (长期记忆)', path: AIOS_MEMORY_FILE},
];

export function WorkspaceScreen({navigation}: any) {
  const theme = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  // 文件列表分组错峰入场（DESIGN_SPEC §5：一次性、不循环）
  const staggerList = useStaggerEntry(0);
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null);
  const [content, setContent] = React.useState('');
  const [original, setOriginal] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  // 小鸡日记（P9，INNERLIFE_SPEC）：收尾仪式写就的每日日记列表
  const [diaries, setDiaries] = React.useState<{date: string; path: string}[]>(
    [],
  );

  const refreshDiaries = React.useCallback(async () => {
    try {
      setDiaries(await listDiaries());
    } catch (e) {
      console.warn('[WorkspaceScreen] list diaries failed:', e);
    }
  }, []);

  React.useEffect(() => {
    refreshDiaries();
  }, [refreshDiaries]);

  const loadFile = async (path: string) => {
    try {
      const text = await RNFS.readFile(path, 'utf8');
      setContent(text);
      setOriginal(text);
      setSelectedFile(path);
    } catch (e) {
      console.warn('[WorkspaceScreen] load failed:', e);
      setContent('');
      setSelectedFile(path);
    }
  };

  const saveFile = async () => {
    if (!selectedFile) {
      return;
    }
    setSaving(true);
    try {
      await RNFS.writeFile(selectedFile, content, 'utf8');
      setOriginal(content);
      console.log('[WorkspaceScreen] saved:', selectedFile);
    } catch (e) {
      console.warn('[WorkspaceScreen] save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (filePath: string) => {
    try {
      const fileName = filePath.split('/').pop() || 'workspace_file.md';
      const exportDir =
        Platform.OS === 'android'
          ? `${RNFS.ExternalStorageDirectoryPath}/Download`
          : RNFS.DocumentDirectoryPath;
      const exportPath = `${exportDir}/${fileName}`;
      await RNFS.copyFile(filePath, exportPath);
      infoDialog({
        title: '导出成功',
        message: `文件已导出到:\n${exportPath}`,
      });
    } catch (e) {
      infoDialog({
        title: '导出失败',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleImport = async (targetPath: string) => {
    try {
      const [file] = await pick({
        type: Platform.OS === 'ios' ? 'public.data' : types.allFiles,
      });
      if (file) {
        await RNFS.copyFile(file.uri, targetPath);
        infoDialog({title: '导入成功', message: '文件已导入到 workspace。'});
        // If currently viewing this file, reload it
        if (selectedFile === targetPath) {
          await loadFile(targetPath);
        }
      }
    } catch (e) {
      console.warn('[WorkspaceScreen] import failed:', e);
    }
  };

  const isDirty = content !== original;

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation?.goBack()} />
        <Appbar.Content
          title={
            <View style={styles.appbarTitleRow}>
              <IconTile
                icon={EditBoxIcon}
                color={theme.colors.domain.workspace}
                size="s"
              />
              <Text style={styles.appbarTitle}>智能体</Text>
            </View>
          }
        />
        {selectedFile && (
          <Appbar.Action
            icon="content-save"
            onPress={saveFile}
            disabled={!isDirty || saving}
          />
        )}
      </Appbar.Header>

      {selectedFile ? (
        <View style={styles.editorContainer}>
          <Text style={styles.filePath}>{selectedFile}</Text>
          <View style={styles.importExportRow}>
            <Button
              mode="outlined"
              compact
              icon="download"
              onPress={() => handleExport(selectedFile)}>
              导出
            </Button>
            <Button
              mode="outlined"
              compact
              icon="upload"
              onPress={() => handleImport(selectedFile)}>
              导入
            </Button>
          </View>
          <TextInput
            value={content}
            onChangeText={setContent}
            style={styles.editor}
            multiline
            mode="outlined"
            dense={false}
          />
          {isDirty && <Text style={styles.dirtyHint}>未保存变更</Text>}
          <Button
            mode="text"
            onPress={() => {
              setSelectedFile(null);
              setContent('');
              setOriginal('');
            }}>
            返回文件列表
          </Button>
        </View>
      ) : (
        <ScrollView>
          {/* 子页统一模板（DESIGN_SPEC §4b）：分组标题 + ListItem 行 */}
          <Animated.View style={staggerList}>
            <Text style={styles.sectionTitle}>{AIOS_WORKSPACE_DIR}</Text>
            {FILES.map(f => (
              <React.Fragment key={f.path}>
                <ListItem
                  title={f.label}
                  subtitle={f.path.split('/').pop()}
                  Icon={EditBoxIcon}
                  color={theme.colors.domain.workspace}
                  right={
                    <View style={styles.rowActions}>
                      <IconButton
                        icon="download-outline"
                        size={18}
                        onPress={() => handleExport(f.path)}
                      />
                      <IconButton
                        icon="upload-outline"
                        size={18}
                        onPress={() => handleImport(f.path)}
                      />
                    </View>
                  }
                  onPress={() => loadFile(f.path)}
                />
                <Divider />
              </React.Fragment>
            ))}
          </Animated.View>

          {/* 小鸡日记（P9，INNERLIFE_SPEC §5）：收尾仪式写就，点击查看（复用编辑器） */}
          <Animated.View style={staggerList}>
            <Text style={styles.sectionTitle}>{AIOS_DIARY_DIR}</Text>
            {diaries.length === 0 ? (
              <Text style={styles.emptyDiary}>
                还没有日记。当日对话满 15 轮后，收尾仪式会自动写一篇。
              </Text>
            ) : (
              diaries.map(d => (
                <React.Fragment key={d.date}>
                  <ListItem
                    title={`${d.date} 日记`}
                    subtitle={d.path.split('/').pop()}
                    Icon={PencilLineIcon}
                    color={theme.colors.domain.workspace}
                    onPress={() => loadFile(d.path)}
                  />
                  <Divider />
                </React.Fragment>
              ))
            )}
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {flex: 1, backgroundColor: theme.colors.surface},
    appbarTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.s,
    },
    sectionTitle: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
      paddingHorizontal: theme.spacing.m,
      paddingBottom: theme.spacing.s,
      paddingTop: theme.spacing.m,
    },
    appbarTitle: {
      ...theme.typography.titleM,
      color: theme.colors.onSurface,
    },
    editorContainer: {flex: 1, padding: theme.spacing.sm},
    filePath: {
      ...theme.typography.captionS,
      color: theme.colors.onSurfaceVariant,
      marginBottom: theme.spacing.s,
    },
    importExportRow: {
      flexDirection: 'row',
      gap: theme.spacing.s,
      marginBottom: theme.spacing.s,
    },
    rowActions: {flexDirection: 'row'},
    editor: {
      flex: 1,
      textAlignVertical: 'top',
      ...theme.typography.bodyS,
    },
    dirtyHint: {
      ...theme.typography.captionS,
      color: theme.colors.warning,
      marginTop: theme.spacing.xs,
      textAlign: 'right',
    },
    emptyDiary: {
      ...theme.typography.captionM,
      color: theme.colors.onSurfaceVariant,
      paddingHorizontal: theme.spacing.m,
      paddingVertical: theme.spacing.sm,
    },
  });
