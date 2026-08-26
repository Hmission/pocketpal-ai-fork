import React from 'react';
import {View, Linking, Text} from 'react-native';

import {OverlayCard} from '../ui/OverlayCard';
import type {ActionConfig} from '../ui/OverlayCard';
import {Model} from '../../utils/types';
import {useTheme} from '../../hooks/useTheme';
import {L10nContext} from '../../utils';
import {t} from '../../locales';
import {ErrorState} from '../../utils/errors';
import {createStyles} from './styles';
import {CheckCircleIcon} from '../../assets/icons';
import {hfStore} from '../../store';

const CheckIcon = ({color}: {color: string}) => (
  <CheckCircleIcon width={16} height={16} stroke={color} />
);

interface DownloadErrorDialogProps {
  visible: boolean;
  onDismiss: () => void;
  error: ErrorState | null;
  model?: Model;
  onGoToSettings?: () => void;
  onTryAgain?: () => void;
}

export const DownloadErrorDialog: React.FC<DownloadErrorDialogProps> = ({
  visible,
  onDismiss,
  error,
  model,
  onGoToSettings,
  onTryAgain,
}) => {
  const theme = useTheme();
  const l10n = React.useContext(L10nContext);
  const alerts = l10n.components.downloadErrorDialog;

  // Check if this is the case where token exists but is disabled
  const isTokenDisabledWhenAuthError =
    error?.code === 'authentication' &&
    hfStore.isTokenPresent &&
    !hfStore.useHfToken;

  const isTokenPresentWhenAuthError =
    error?.code === 'authentication' &&
    hfStore.isTokenPresent &&
    hfStore.useHfToken;

  const notEnoughSpace = error?.code === 'storage';

  const getErrorType = ():
    | 'unauthorized'
    | 'forbidden'
    | 'noToken'
    | 'other' => {
    if (!error) {
      return 'other';
    }

    if (error.code === 'authentication') {
      if (error.message?.includes('Token is missing')) {
        return 'noToken';
      }
      return 'unauthorized';
    } else if (error.code === 'authorization') {
      return 'forbidden';
    } else if (error.code === 'server') {
      return 'forbidden';
    }
    return 'other';
  };

  const errorType = getErrorType();

  const getDialogTitle = () => {
    if (isTokenDisabledWhenAuthError) {
      return alerts.tokenDisabledTitle;
    }

    if (isTokenPresentWhenAuthError) {
      return alerts.unauthorizedTitle;
    }

    switch (errorType) {
      case 'unauthorized':
        return alerts.unauthorizedTitle;
      case 'forbidden':
        return alerts.forbiddenTitle;
      case 'noToken':
        return alerts.getTokenTitle;
      default:
        return alerts.downloadFailedTitle;
    }
  };

  const getDialogMessage = () => {
    if (isTokenDisabledWhenAuthError) {
      return alerts.tokenDisabledMessage;
    }

    if (isTokenPresentWhenAuthError) {
      return alerts.unauthorizedMessage;
    }

    switch (errorType) {
      case 'unauthorized':
        return alerts.unauthorizedMessage;
      case 'forbidden':
        return alerts.forbiddenMessage;
      case 'noToken':
        return alerts.getTokenMessage;
      default:
        return !error?.message
          ? t(alerts.downloadFailedMessage, {message: ''})
          : undefined;
    }
  };

  const getSteps = () => {
    if (isTokenDisabledWhenAuthError) {
      return [];
    }

    if (isTokenPresentWhenAuthError) {
      return [];
    }

    switch (errorType) {
      case 'forbidden':
        return alerts.forbiddenSteps;
      case 'noToken':
        return alerts.getTokenSteps;
      default:
        return [];
    }
  };

  const handleEnableToken = () => {
    hfStore.setUseHfToken(true);
    if (onTryAgain) {
      onTryAgain();
    }
  };

  const getActions = () => {
    // B46 迁移：OverlayCard 动作槽契约 = primary/secondary 两档（§12.1），
    // 多动作（viewOnHuggingFace）下沉 body 链接；dismiss 由遮罩/标题关闭承担。
    const actions: {primary?: ActionConfig; secondary?: ActionConfig} = {};

    if (isTokenDisabledWhenAuthError) {
      actions.primary = {
        label: alerts.enableAndRetry,
        onPress: handleEnableToken,
      };
    } else if (onTryAgain) {
      actions.primary = {
        label: alerts.tryAgain,
        onPress: onTryAgain,
      };
    }

    if (
      ['unauthorized', 'forbidden', 'noToken'].includes(errorType) &&
      onGoToSettings
    ) {
      actions.secondary = {
        label: alerts.goToSettings,
        onPress: onGoToSettings,
      };
    } else if (
      isTokenDisabledWhenAuthError ||
      isTokenPresentWhenAuthError ||
      notEnoughSpace
    ) {
      actions.secondary = {
        label: l10n.common.dismiss,
        onPress: onDismiss,
      };
    }

    return actions;
  };

  const showHfLink =
    !!model?.hfUrl && !isTokenDisabledWhenAuthError && !notEnoughSpace;

  const steps = getSteps();
  const message = getDialogMessage();
  const styles = createStyles(theme);
  const {primary, secondary} = getActions();

  return (
    <OverlayCard
      visible={visible}
      onRequestClose={onDismiss}
      testID="download-error-dialog"
      title={getDialogTitle()}
      actions={
        primary || secondary
          ? {
              primary,
              secondary,
            }
          : undefined
      }>
      <View>
        {message && <Text style={styles.bodyText}>{message}</Text>}

        {steps.length > 0 && (
          <View style={styles.stepsContainer}>
            {steps.map((step, index) => (
              <View key={index} style={styles.stepItem}>
                <View style={styles.stepRow}>
                  <CheckIcon color={theme.colors.primary} />
                  <View style={styles.textContainer}>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {showHfLink && (
          <Text
            style={styles.hfLink}
            onPress={() => Linking.openURL(model!.hfUrl!)}
            testID="view-on-hf-link">
            {alerts.viewOnHuggingFace}
          </Text>
        )}

        {errorType === 'other' && error?.message && (
          <View style={styles.errorDetails}>
            <Text style={styles.errorText} testID="error-message-text">
              {error.message}
            </Text>
          </View>
        )}
      </View>
    </OverlayCard>
  );
};
