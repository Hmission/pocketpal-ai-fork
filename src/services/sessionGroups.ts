/**
 * sessionGroups — ChatSession 会话日期分组纯函数（R3-P2 抽取）
 *
 * 自 ChatSessionStore.groupedSessions 原样迁出的核心算法（行为零变化）：
 * 按今天/昨天/本周/上周…/更早 分桶并按桶序排序。getter 侧保留
 * MobX computed facade（computed 不能迁出），内部转调本函数。
 * 依赖注入：sessions（原始数据）+ dateGroupNames（本地化分组名）。
 */
import {format, isToday, isYesterday} from 'date-fns';

import type {SessionMetaData} from '../store/ChatSessionStore';

export interface SessionGroup {
  [key: string]: SessionMetaData[];
}

// Default group names in English as fallback
export const DEFAULT_GROUP_NAMES = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This week',
  lastWeek: 'Last week',
  twoWeeksAgo: '2 weeks ago',
  threeWeeksAgo: '3 weeks ago',
  fourWeeksAgo: '4 weeks ago',
  lastMonth: 'Last month',
  older: 'Older',
};

/**
 * 按日期类别分组并按固定桶序输出有序对象。组内按会话日期降序。
 * 原 getter 依赖形状：sessions + dateGroupNames（见 ChatSessionStore）。
 */
export function groupSessionsByDate(
  sessions: SessionMetaData[],
  dateGroupNames: typeof DEFAULT_GROUP_NAMES,
): SessionGroup {
  const groups: SessionGroup = sessions.reduce((acc: SessionGroup, session) => {
    const date = new Date(session.date);
    let dateKey: string = format(date, 'MMMM dd, yyyy');
    const today = new Date();
    const daysAgo = Math.ceil(
      (today.getTime() - date.getTime()) / (1000 * 3600 * 24),
    );

    if (isToday(date)) {
      dateKey = dateGroupNames.today;
    } else if (isYesterday(date)) {
      dateKey = dateGroupNames.yesterday;
    } else if (daysAgo <= 6) {
      dateKey = dateGroupNames.thisWeek;
    } else if (daysAgo <= 13) {
      dateKey = dateGroupNames.lastWeek;
    } else if (daysAgo <= 20) {
      dateKey = dateGroupNames.twoWeeksAgo;
    } else if (daysAgo <= 27) {
      dateKey = dateGroupNames.threeWeeksAgo;
    } else if (daysAgo <= 34) {
      dateKey = dateGroupNames.fourWeeksAgo;
    } else if (daysAgo <= 60) {
      dateKey = dateGroupNames.lastMonth;
    } else {
      dateKey = dateGroupNames.older;
    }

    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(session);
    return acc;
  }, {});

  // Define the order of keys using the localized group names
  const orderedKeys = [
    dateGroupNames.today,
    dateGroupNames.yesterday,
    dateGroupNames.thisWeek,
    dateGroupNames.lastWeek,
    dateGroupNames.twoWeeksAgo,
    dateGroupNames.threeWeeksAgo,
    dateGroupNames.fourWeeksAgo,
    dateGroupNames.lastMonth,
    dateGroupNames.older,
  ];

  // Create a new object with keys in the desired order
  const orderedGroups: SessionGroup = {};
  orderedKeys.forEach(key => {
    if (groups[key]) {
      orderedGroups[key] = groups[key].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    }
  });

  // Add any remaining keys that weren't in our predefined list
  Object.keys(groups).forEach(key => {
    if (!orderedGroups[key]) {
      orderedGroups[key] = groups[key].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    }
  });

  return orderedGroups;
}
