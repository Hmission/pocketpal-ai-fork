import {StyleSheet} from 'react-native';

export const styles = StyleSheet.create({
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // task-6ad §20.3：三控件（模型胶囊/新建会话/菜单）水平等距。
    // 胶囊 paddingHorizontal 8 叠加后视觉等距：胶囊↔加号 = 加号↔三点 = 10px。
    // displayMemUsage 开启时 UsageStats 同组生效，属预期。
    gap: 10,
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
