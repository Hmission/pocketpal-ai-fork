import React from 'react';
import {Image, useWindowDimensions} from 'react-native';
import {
  CustomBlockRenderer,
  HTMLContentModel,
  HTMLElementModel,
} from 'react-native-render-html';

/**
 * ImgRenderer — markdown 图片渲染（![]() / <img>）。
 * react-native-render-html 默认不渲染 img，需自定义 block renderer。
 * 宽度自适应消息宽度，固定宽高比避免布局抖动。
 */
const ImgRenderer: CustomBlockRenderer = ({tnode}) => {
  const {width} = useWindowDimensions();
  const src = tnode.attributes?.src;
  if (!src) {
    return null;
  }
  const imgWidth = Math.max(120, width - 96);
  return (
    <Image
      source={{uri: src}}
      style={{
        width: imgWidth,
        aspectRatio: 1.6,
        borderRadius: 8,
        marginVertical: 6,
        backgroundColor: '#00000010',
      }}
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
