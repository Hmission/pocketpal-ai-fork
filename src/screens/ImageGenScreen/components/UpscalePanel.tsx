import * as React from 'react';
import {Modal, Text, TouchableOpacity, View} from 'react-native';

import {useTheme} from '../../../hooks';
import {createStyles} from '../styles';

interface UpscalePanelProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (scale: 2 | 4, style: 'general' | 'anime') => void;
}

/**
 * UpscalePanel — 高清放大参数面板（P6-6 独立通用能力）。
 * 纯参数选择（底部弹层：模型风格 + 倍数），确认即关——放大进度走
 * ResultPreview running 任务页（与生图/编辑任务化 UX 一致），不在此重复展示。
 */
export const UpscalePanel: React.FC<UpscalePanelProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const theme = useTheme();
  const s = createStyles(theme);
  const [scale, setScale] = React.useState<2 | 4>(2);
  const [style, setStyle] = React.useState<'general' | 'anime'>('general');

  // 每次打开重置默认（2× + 通用写实——通用能力默认通用模型）
  React.useEffect(() => {
    if (visible) {
      setScale(2);
      setStyle('general');
    }
  }, [visible]);

  const sheet = {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.m,
    borderTopRightRadius: theme.radius.m,
    padding: 16,
    paddingBottom: 28,
  } as const;
  const overlay = {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  } as const;
  const scrimTouch = {flex: 1} as const;
  const sheetTitle = {
    ...theme.typography.titleS,
    color: theme.colors.onSurface,
    marginBottom: 12,
  } as const;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={overlay}>
        <TouchableOpacity
          style={scrimTouch}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={sheet}>
          <Text style={sheetTitle}>高清放大</Text>
          <Text style={s.promptHint}>
            模型风格（动漫图选动漫插画，推理快约 4 倍）
          </Text>
          <View style={s.paramRow}>
            {(['general', 'anime'] as const).map(v => (
              <TouchableOpacity
                key={v}
                style={[s.sizeBtn, style === v && s.sizeBtnSelected]}
                onPress={() => setStyle(v)}>
                <Text style={s.sizeBtnText}>
                  {v === 'general' ? '通用写实' : '动漫插画'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.promptHint}>放大倍数（2× 推荐，4× 更吃内存）</Text>
          <View style={s.paramRow}>
            {([2, 4] as const).map(v => (
              <TouchableOpacity
                key={v}
                style={[s.sizeBtn, scale === v && s.sizeBtnSelected]}
                onPress={() => setScale(v)}>
                <Text style={s.sizeBtnText}>{v}×</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.promptHint}>原图保留，放大图另存</Text>
          <Text style={s.promptHint}>
            CPU 端放大耗时较长（4× 约数分钟），进度见预览区，请勿反复点按
          </Text>
          <View style={s.buttonRow}>
            <TouchableOpacity
              style={[s.button, s.buttonEdit]}
              onPress={onClose}>
              <Text style={[s.buttonText, s.buttonTextOnInfo]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.button, s.buttonGen]}
              onPress={() => onConfirm(scale, style)}>
              <Text style={s.buttonText}>开始放大</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
