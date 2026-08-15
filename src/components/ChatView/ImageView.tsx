import * as React from 'react';
import {ImageRequireSource, ImageURISource, View} from 'react-native';

interface Props {
  imageIndex: number;
  images: Array<ImageURISource | ImageRequireSource>;
  onRequestClose: () => void;
  visible: boolean;
  /** P5：全屏查看器底部自定义操作区（「编辑此图片」按钮），android/ios 走库组件 Footer */
  Footer?: (props: {
    image: ImageURISource | ImageRequireSource;
    index: number;
  }) => React.ReactElement;
}

const ImageView = (_: Props) => {
  return <View />;
};

export default ImageView;
