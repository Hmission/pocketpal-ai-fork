import {StyleSheet} from 'react-native';

export const styles = StyleSheet.create({
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // §18.3 紧凑触区：36px、margin 0，与模型胶囊同组收紧
  // （IconButton 默认 40px 容器 + 内边距撑开间距，弃用）
  compactBtn: {
    width: 36,
    height: 36,
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
});
