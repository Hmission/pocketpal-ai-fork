import * as React from 'react';
import {View, ScrollView, Text, StyleSheet, Alert, Platform} from 'react-native';
import {Appbar, Button, TextInput, List, Divider, IconButton} from 'react-native-paper';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {pick, types} from '@react-native-documents/picker';
import {
  AIOS_SOUL_FILE,
  AIOS_USER_FILE,
  AIOS_AGENTS_FILE,
  AIOS_MEMORY_FILE,
  AIOS_WORKSPACE_DIR,
} from '../../utils/paths';

const FILES = [
  {label: 'SOUL.md (人设)', path: AIOS_SOUL_FILE},
  {label: 'USER.md (大王画像)', path: AIOS_USER_FILE},
  {label: 'AGENTS.md (规范)', path: AIOS_AGENTS_FILE},
  {label: 'MEMORY.md (长期记忆)', path: AIOS_MEMORY_FILE},
];

export function WorkspaceScreen({navigation}: any) {
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null);
  const [content, setContent] = React.useState('');
  const [original, setOriginal] = React.useState('');
  const [saving, setSaving] = React.useState(false);

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
      const exportDir = Platform.OS === 'android'
        ? `${RNFS.ExternalStorageDirectoryPath}/Download`
        : RNFS.DocumentDirectoryPath;
      const exportPath = `${exportDir}/${fileName}`;
      await RNFS.copyFile(filePath, exportPath);
      Alert.alert('导出成功', `文件已导出到:\n${exportPath}`);
    } catch (e) {
      Alert.alert('导出失败', e instanceof Error ? e.message : String(e));
    }
  };

  const handleImport = async (targetPath: string) => {
    try {
      const [file] = await pick({
        type: Platform.OS === 'ios' ? 'public.data' : types.allFiles,
      });
      if (file) {
        await RNFS.copyFile(file.uri, targetPath);
        Alert.alert('导入成功', '文件已导入到 workspace。');
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
        <Appbar.Content title="Workspace" />
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
          {isDirty && (
            <Text style={styles.dirtyHint}>未保存变更</Text>
          )}
          <Button
            mode="text"
            onPress={() => { setSelectedFile(null); setContent(''); setOriginal(''); }}>
            返回文件列表
          </Button>
        </View>
      ) : (
        <ScrollView>
          <List.Section>
            <List.Subheader>{AIOS_WORKSPACE_DIR}</List.Subheader>
            {FILES.map(f => (
              <React.Fragment key={f.path}>
                <List.Item
                  title={f.label}
                  description={f.path.split('/').pop()}
                  left={props => (
                    <List.Icon {...props} icon="file-document-outline" />
                  )}
                  right={props => (
                    <View style={{flexDirection: 'row'}}>
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
                  )}
                  onPress={() => loadFile(f.path)}
                />
                <Divider />
              </React.Fragment>
            ))}
          </List.Section>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  editorContainer: {flex: 1, padding: 12},
  filePath: {fontSize: 11, color: '#888', marginBottom: 8},
  importExportRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  editor: {flex: 1, textAlignVertical: 'top', fontSize: 13},
  dirtyHint: {color: '#FF9800', fontSize: 11, marginTop: 4, textAlign: 'right'},
});
