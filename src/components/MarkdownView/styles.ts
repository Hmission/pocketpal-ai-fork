import {StyleSheet} from 'react-native';

import {Theme} from '../../utils/types';

// Plain object (not via StyleSheet.create) because react-syntax-highlighter's
// customStyle is merged with Object.assign — a numeric StyleSheet id won't
// flatten the upstream white PreTag fallback. See MarkdownView for the why.
export const codeHighlighterPreOverride = {
  backgroundColor: 'transparent',
} as const;

export const createTagsStyles = (theme: Theme) => ({
  body: {
    color: theme.colors.text,
    fontSize: theme.typography.bodyM.fontSize, // B56③ fontSize→bodyM
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    padding: 0,
    paddingTop: 0,
    margin: 0,
    backgroundColor: 'transparent',
    // display: 'inline-block',
  },
  a: {
    color: theme.colors.secondary,
    textDecorationLine: 'underline' as const,
  },
  code: {
    fontFamily: 'Courier', // Change the font for code snippets
    backgroundColor: theme.colors.surface, // Custom background for code blocks
    padding: 4,
    borderRadius: theme.radius.xs,
    color: theme.colors.onSurface, // Color for code text
    fontSize: theme.typography.captionM.fontSize, // B56③ fontSize→captionM
    whiteSpace: 'pre' as const,
  },
  pre: {
    backgroundColor: theme.colors.surface, // Background for pre blocks
    padding: 8,
    borderRadius: theme.radius.s,
    marginVertical: 8,
    color: theme.colors.onPrimaryContainer,
    fontFamily: 'Courier',
    fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
    whiteSpace: 'pre' as const,
  },
  // Styles for thinking tags
  thinking: {
    color: theme.colors.thinkingBubbleText,
    fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
    lineHeight: 20,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  think: {
    color: theme.colors.thinkingBubbleText,
    fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
    lineHeight: 20,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  thought: {
    color: theme.colors.thinkingBubbleText,
    fontSize: theme.typography.bodyS.fontSize, // B56③ fontSize→bodyS
    lineHeight: 20,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
});

export const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    markdownContainer: {
      // Dynamic maxWidth will be applied via style prop
    },
    codeHighlighterText: {
      fontFamily: 'Courier',
    },
    codeHighlighterScrollContent: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.s,
      borderRadius: theme.radius.s,
      marginTop: theme.spacing.xs,
    },
  });
