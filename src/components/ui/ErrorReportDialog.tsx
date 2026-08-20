/**
 * ErrorReportDialog — 全局报错弹窗（开发者预览版诊断面）
 *
 * 与 ConfirmDialog 同一宿主模式：App 根挂载 <ErrorReportDialogHost />，
 * 命令式 showErrorReport({title, summary, detail}) 弹出。
 *
 * 内容：摘要 + 详情预览（滚动）+「一键复制报错」按钮
 *（复制完整报告 + 落盘 AIOS/logs，供测试员整段发出）。
 */
import * as React from 'react';
import {ScrollView, View, Text} from 'react-native';

import {useTheme} from '../../hooks';
import {copyAndSaveErrorReport} from '../../utils/errorReport';
import {L10nContext} from '../../utils';
import {t} from '../../locales';
import {OverlayCard} from './OverlayCard';
import {Button} from './Button';

export interface ErrorReportDialogOptions {
  title: string;
  /** 一句话摘要 */
  summary: string;
  /** 完整报告文本（buildErrorReport 产物） */
  detail: string;
}

type Listener = (opts: ErrorReportDialogOptions) => void;

let listener: Listener | null = null;

/** 命令式报错弹窗。Host 未挂载时仅打日志（不阻断主链路）。 */
export function showErrorReport(opts: ErrorReportDialogOptions): void {
  if (!listener) {
    console.warn('[ErrorReportDialog] host not mounted:', opts.summary);
    return;
  }
  listener(opts);
}

export const ErrorReportDialogHost: React.FC = () => {
  const theme = useTheme();
  const l10n = React.useContext(L10nContext);
  const [pending, setPending] = React.useState<ErrorReportDialogOptions | null>(
    null,
  );
  const [copiedHint, setCopiedHint] = React.useState<string | null>(null);

  React.useEffect(() => {
    listener = opts => {
      setCopiedHint(null);
      setPending(opts);
    };
    return () => {
      listener = null;
    };
  }, []);

  const close = () => setPending(null);

  const handleCopy = async () => {
    if (!pending) {
      return;
    }
    const path = await copyAndSaveErrorReport({
      summary: pending.summary,
      detail: pending.detail,
    });
    setCopiedHint(
      path
        ? t(l10n.errorReport.copiedSaved, {path})
        : l10n.errorReport.copiedFallback,
    );
  };

  return (
    <OverlayCard visible={pending !== null} onRequestClose={close} title={pending?.title}>
      <Text
        style={{
          ...theme.typography.bodyS,
          lineHeight: 20,
          color: theme.colors.onSurface,
        }}>
        {pending?.summary}
      </Text>
      <ScrollView
        style={{
          maxHeight: 220,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.s,
          borderWidth: 1,
          borderColor: theme.colors.outline,
        }}
        testID="error-report-detail">
        <Text
          style={{
            ...theme.typography.captionM,
            fontFamily: undefined,
            color: theme.colors.onSurfaceVariant,
            padding: theme.spacing.s,
          }}>
          {pending?.detail}
        </Text>
      </ScrollView>
      {copiedHint ? (
        <Text
          style={{
            ...theme.typography.captionM,
            color: theme.colors.primary,
          }}
          testID="error-report-copied-hint">
          {copiedHint}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.s,
          marginTop: theme.spacing.xs,
        }}>
        <Button
          variant="tertiary"
          label={l10n.errorReport.close}
          onPress={close}
          testID="error-report-close"
          style={{flex: 1}}
        />
        <Button
          variant="primary"
          label={l10n.errorReport.copy}
          onPress={handleCopy}
          testID="error-report-copy"
          style={{flex: 1.4}}
        />
      </View>
    </OverlayCard>
  );
};

ErrorReportDialogHost.displayName = 'ErrorReportDialogHost';
