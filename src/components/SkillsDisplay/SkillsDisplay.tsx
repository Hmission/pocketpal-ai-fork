import React from 'react';
import {View, TouchableOpacity} from 'react-native';
import {Text, IconButton} from 'react-native-paper';

import {useTheme} from '../../hooks';
import {getModelSkills, SkillItem} from '../../utils';
import {L10nContext} from '../../utils';

import {createStyles} from './styles';

interface SkillsDisplayProps {
  model: {
    capabilities?: string[];
    supportsMultimodal?: boolean;
  };
  onVisionPress?: () => void;
  showLabel?: boolean;
  compact?: boolean;
  hasProjectionModelWarning?: boolean;
  onProjectionWarningPress?: () => void;
  visionEnabled?: boolean; // Whether vision is enabled for this model
  visionAvailable?: boolean; // Whether vision is available (projection model downloaded)
}

export const SkillsDisplay: React.FC<SkillsDisplayProps> = ({
  model,
  onVisionPress,
  showLabel = true,
  compact = false,
  hasProjectionModelWarning = false,
  onProjectionWarningPress,
  visionEnabled = true,
  // TODO: we need to find out if we need this?
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  visionAvailable = true,
}) => {
  const l10n = React.useContext(L10nContext);
  const theme = useTheme();
  const styles = createStyles(theme, compact);

  const skills = getModelSkills(model);

  if (!skills.length) {
    return null;
  }

  const renderSkillItem = (skill: SkillItem) => {
    const isVision = skill.key === 'vision';
    const isClickable = isVision && onVisionPress;

    // Determine vision badge state and color
    let color = theme.colors[skill.color || 'primary'];
    let iconName = skill.icon;

    if (isVision) {
      if (!visionEnabled) {
        // Vision disabled - use muted color and different icon
        color = theme.colors.textSecondary;
        iconName = 'eye-off';
        /* } else if (!visionAvailable) {
       //   // Vision enabled but not available - use warning color
       //   color = theme.colors.error;
         iconName = 'eye-off'; */
      } else {
        // Vision enabled and available - use primary color
        color = color;
        iconName = 'eye';
      }
    }

    const showWarning = isVision && hasProjectionModelWarning;

    // Get localized label
    const label =
      l10n.models.modelCapabilities[
        skill.labelKey as keyof typeof l10n.models.modelCapabilities
      ] || skill.labelKey;

    const skillContent = (
      <View style={[styles.skillItem, skill.isSpecial && styles.specialSkill]}>
        {(skill.icon || iconName) && (
          <IconButton
            icon={(iconName || skill.icon) as string}
            size={compact ? 10 : 12}
            iconColor={color}
            style={styles.skillIcon}
          />
        )}
        <Text
          style={[
            styles.skillText,
            skill.isSpecial && styles.specialSkillText,
            {color},
          ]}>
          {label}
        </Text>
        {/* Show warning badge for vision skill when projection model is missing */}
        {showWarning && (
          <TouchableOpacity
            testID="projection-warning-badge"
            onPress={onProjectionWarningPress}
            style={styles.warningBadge}
            activeOpacity={0.7}>
            <View style={styles.warningContent}>
              <IconButton
                icon="alert-circle"
                size={compact ? 12 : 14}
                iconColor={theme.colors.error}
                style={styles.warningIcon}
              />
              <Text variant="labelSmall" style={styles.warningText}>
                {l10n.models.multimodal.projectionMissingShort}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    );

    if (isClickable) {
      return (
        <TouchableOpacity
          testID="vision-skill-touchable"
          key={skill.key}
          onPress={onVisionPress}
          activeOpacity={0.7}>
          {skillContent}
        </TouchableOpacity>
      );
    }

    return <View key={skill.key}>{skillContent}</View>;
  };

  const renderSkillsText = () => {
    const textSkills = skills.filter(skill => !skill.isSpecial);
    if (!textSkills.length) {
      return null;
    }

    const hasSpecialSkills = skills.some(skill => skill.isSpecial);
    const prefix = hasSpecialSkills ? '• ' : '';

    return (
      <Text style={styles.skillsText}>
        {prefix}
        {textSkills
          .map(skill => {
            const label =
              l10n.models.modelCapabilities[
                skill.labelKey as keyof typeof l10n.models.modelCapabilities
              ] || skill.labelKey;
            return label;
          })
          .join(', ')}
      </Text>
    );
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={model.supportsMultimodal ? onVisionPress : undefined}
      activeOpacity={model.supportsMultimodal ? 0.7 : 1}>
      <View style={styles.skillsRow}>
        {showLabel && (
          <Text style={styles.skillsLabel}>
            {l10n.models.modelCard.labels.skills}
          </Text>
        )}

        {/* Render special skills (like vision) with icons */}
        {skills
          .filter(skill => skill.isSpecial)
          .map(skill => renderSkillItem(skill))}

        {/* Render regular skills as text */}
        {renderSkillsText()}
      </View>
    </TouchableOpacity>
  );
};
