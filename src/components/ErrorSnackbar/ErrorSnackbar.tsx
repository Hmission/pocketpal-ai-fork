import React from 'react';
import {View} from 'react-native';
import {Portal, Snackbar, Text} from 'react-native-paper';

import {AlertIcon, EyeOffIcon, ShieldMdIcon, WifiOffIcon} from '../../assets/icons';
import {useTheme} from '../../hooks';
import {ErrorState} from '../../utils/errors';
import {createStyles} from './styles';

interface ErrorSnackbarProps {
  error: ErrorState | null;
  onDismiss: () => void;
  onRetry?: () => void;
  onSettings?: () => void;
  onReport?: () => void;
}

export const ErrorSnackbar: React.FC<ErrorSnackbarProps> = ({
  error,
  onDismiss,
  onRetry,
  onSettings,
  onReport,
}) => {
  const theme = useTheme();

  if (!error) {
    return null;
  }

  const styles = createStyles(theme);

  // 自绘图标（DESIGN_SPEC §12.5 图标铁律：一律 assets/icons；语义收敛 8→4）
  const getIcon = (): React.ReactNode => {
    const iconColor = getIconColor();
    // Service-specific icons for auth errors
    if (error.code === 'authentication' || error.code === 'authorization') {
      return <ShieldMdIcon testID="icon-shield" width={20} height={20} stroke={iconColor} />;
    }

    // For other error types
    switch (error.code) {
      case 'network':
        return <WifiOffIcon testID="icon-wifi-off" width={20} height={20} stroke={iconColor} />;
      case 'multimodal':
        return <EyeOffIcon testID="icon-eye-off" width={20} height={20} stroke={iconColor} />;
      // storage/server 无专属自绘，统一 alert 兜底（B23 登记）
      case 'storage':
      case 'server':
      default:
        return <AlertIcon testID="icon-alert" width={20} height={20} stroke={iconColor} />;
    }
  };

  // Get the appropriate action based on error type, context, and service
  const getAction = () => {
    // For auth errors, customize based on service
    if (
      (error.code === 'authentication' || error.code === 'authorization') &&
      onSettings
    ) {
      const label = error.service === 'huggingface' ? 'Add Token' : 'Settings';

      return {
        label,
        onPress: onSettings,
        labelStyle: {color: theme.colors.primary},
      };
    }

    // For model init errors, show report option
    if (error.context === 'modelInit' && onReport) {
      return {
        label: 'Report',
        onPress: onReport,
        labelStyle: {color: theme.colors.primary},
      };
    }

    // For recoverable errors, show retry button
    if (error.recoverable && onRetry) {
      return {
        label: 'Retry',
        onPress: onRetry,
        labelStyle: {color: theme.colors.primary},
      };
    }

    // Default action is just to dismiss
    return {
      label: 'Dismiss',
      onPress: onDismiss,
      labelStyle: {color: theme.colors.primary},
    };
  };

  // Calculate duration based on error type and severity
  const getDuration = () => {
    if (error.severity === 'warning') {
      return 8000; // 8 seconds for warnings
    }
    if (
      error.code === 'authentication' ||
      error.code === 'authorization' ||
      error.code === 'storage'
    ) {
      return 20000; // 20 seconds for critical errors
    }
    return 10000; // 10 seconds for regular errors
  };

  // Get the appropriate icon color based on severity
  const getIconColor = () => {
    if (error.severity === 'warning') {
      return theme.colors.onSurfaceVariant; // More subtle color for warnings
    }
    return theme.colors.error; // Standard error color
  };

  return (
    <Portal>
      <Snackbar
        testID="error-snackbar"
        visible={true}
        onDismiss={onDismiss}
        duration={getDuration()}
        style={styles.snackbar}
        wrapperStyle={styles.wrapper} // Ensure it's above everything
        action={getAction()}>
        <View style={styles.content}>
          {getIcon()}
          <Text style={styles.message}>{error.message}</Text>
        </View>
      </Snackbar>
    </Portal>
  );
};
