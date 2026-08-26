import React from 'react';
import {Image, StyleSheet, useWindowDimensions} from 'react-native';
import {
  CustomBlockRenderer,
  HTMLContentModel,
  HTMLElementModel,
} from 'react-native-render-html';
import {useTheme} from '../../hooks/useTheme';
import {Theme} from '../../utils/types';

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    image: {
      aspectRatio: 1.6,
      borderRadius: theme.radius.s,
      marginVertical: theme.spacing.xs,
      backgroundColor: theme.colors.surfaceContainerHighest,
    },
  });

/**
 * ImgRenderer — markdown 图片渲染（![]() / <img>）。
 * react-native-render-html 默认不渲染 img，需自定义 block renderer。
 * 宽度自适应消息宽度，固定宽高比避免布局抖动。
 */
const ImgRenderer: CustomBlockRenderer = ({tnode}) => {
  const {width} = useWindowDimensions();
  const theme = useTheme();
  const src = tnode.attributes?.src;
  if (!src) {
    return null;
  }
  const imgWidth = Math.max(120, width - 96);
  const styles = createStyles(theme);
  const imgStyle = {width: imgWidth};
  return (
    <Image
      source={{uri: src}}
      style={[styles.image, imgStyle]}
      resizeMode="cover"
      accessibilityLabel={tnode.attributes?.alt ?? 'markdown image'}
    />
  );
};

export const imageRenderers = {
  img: (props: any) => <ImgRenderer {...props} />,
};

/** 告诉渲染引擎把 img 当作 block 元素（默认 inline 会被丢弃） */
export const imageHTMLElementModels = {
  img: HTMLElementModel.fromCustomModel({
    tagName: 'img',
    contentModel: HTMLContentModel.block,
  }),
};
