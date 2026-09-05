/**
 * phoneCall/inCall — 「此刻是否在通话中」的单一事实源（W2）。
 *
 * 为什么要换掉 `metadata.phoneMode`：旧写法把标记挂在用户消息上，靠
 * `wrappedSendPress` 逐路径透传。但一次回复可以从 8 条不同路径产生
 * （管家直答 / 任务路由 / 聊天内闭环生图 / 升级重答 / 队列补写 …），那些路径
 * 都不带这个标记 → 电话里那些轮次既不强制播报、也不通知收口，只能等 90s
 * 看门狗回到聆听态（真机观感：「它说完就哑了」）。
 *
 * 换成状态源一判：**通话页开着时产生的每一轮回复都属于这一通电话**——这与
 * ChatScreen 一直在用的「取最新一条回复」口径完全一致，且以后新增发送路径
 * 自动被覆盖，不需要再补一次透传（根治，不是打补丁）。
 *
 * 不做成 MobX：当前没有任何 UI 需要订阅它（通话页状态由 PhoneCallSession
 * 的 `notify` 通道驱动）。等真需要响应式时再升级，不预先造状态。
 */
let active = false;

/** 通话页开合的唯一登记口（ChatScreen 的 `phoneVisible` effect 负责成对调用）。 */
export const setInCall = (value: boolean): void => {
  active = value;
};

/** 本轮回复是否属于一通电话（useChatSession 在发送时一次性读）。 */
export const isInCall = (): boolean => active;
