/**
 * 录音单一入口（W2b：PHONE_SPEC §17 / MASTER_LOG §151）。
 *
 * 旧现实：ChatInput（按住说话）/ 电话 / 音频工坊三处各写一遍「PermissionsAndroid +
 * NativeModules.AudioRecord.startRecording/stopRecording」，失败语义还各不相同
 * （前两处 return、电话 throw）。真正致命的是原生 `startRecording` **遇忙直接
 * resolve 旧路径**：工坊正在录音时用户在聊天框按下说话，拿到的是同一个文件，松手
 * 停掉的是**别人那次录音**——幂等写法把并发误用掩盖成了看起来正常。
 *
 * 本模块的契约（锋利原则：把掩盖改成明确失败）：
 *   1. **同一时刻只有一个持有者**（owner）。抢不到 → `RecorderError('busy')`，绝不共享；
 *   2. 权限申请一份，拒绝 → `RecorderError('permission')`；
 *   3. 谁持有谁停：非持有者 stop 视为误用（busy），未持有者 stop 是 no-op（不打原生）；
 *   4. 启停一律走这里，日志前缀统一 `[AudioRecord]`，真机取证只 grep 一个词。
 *
 * 故意不上 MobX：没有任何 UI 需要订阅「谁在录音」，各消费方保留自己的本地态
 * （isListening / recording / session.status），这里只管一把锁（同 phoneCall/inCall 的取舍）。
 */
import {NativeModules, PermissionsAndroid, Platform} from 'react-native';

export type RecorderOwner = 'chat_input' | 'phone_call' | 'audio_workshop';

/** permission=用户拒授权；busy=别处正在录；native=原生层失败（含 iOS 无此模块） */
export type RecorderErrorCode = 'permission' | 'busy' | 'native';

export class RecorderError extends Error {
  readonly code: RecorderErrorCode;

  constructor(code: RecorderErrorCode, message: string) {
    super(message);
    this.name = 'RecorderError';
    this.code = code;
  }
}

const TAG = '[AudioRecord]';

let owner: RecorderOwner | null = null;
let startedAt = 0;

/** 仅供单测归零（正常路径靠 start/stop 配对，不需要它）。 */
export const _resetForTests = (): void => {
  owner = null;
  startedAt = 0;
};

export const currentRecorderOwner = (): RecorderOwner | null => owner;

async function ensureMicPermission(): Promise<void> {
  if (Platform.OS !== 'android') {
    // iOS 未接原生录音模块；交给上层按 native 错处理（见 start 的模块存在性检查）
    return;
  }
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  );
  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new RecorderError('permission', 'RECORD_AUDIO denied');
  }
}

/**
 * 开始录音，返回落盘 wav 路径。
 * 抛 RecorderError：busy（他处占用）/ permission（被拒）/ native（原生初始化或 IO 失败）。
 */
async function start(next: RecorderOwner): Promise<string> {
  if (owner !== null) {
    const message = `recording busy, held by ${owner}`;
    console.warn(`${TAG} start rejected owner=${next}: ${message}`);
    throw new RecorderError('busy', message);
  }
  const native = NativeModules.AudioRecord;
  if (!native?.startRecording) {
    throw new RecorderError('native', 'AudioRecord native module unavailable');
  }
  try {
    await ensureMicPermission();
  } catch (e) {
    if (e instanceof RecorderError) {
      console.warn(`${TAG} start rejected owner=${next}: permission`);
      throw e;
    }
    console.warn(
      `${TAG} start rejected owner=${next}: permission check threw`,
      e,
    );
    throw new RecorderError('permission', String(e));
  }
  try {
    const path = (await native.startRecording()) as string;
    owner = next;
    startedAt = Date.now();
    console.log(`${TAG} start owner=${next} path=${path}`);
    return path;
  } catch (e) {
    console.warn(`${TAG} start failed owner=${next}:`, e);
    throw new RecorderError('native', String(e));
  }
}

/**
 * 停止录音，返回 wav 路径（可能为 null：原生没给出文件）。
 * 未持有者调用 = no-op 返回 null（不打原生，避免停掉别人的录音）；
 * 传入的 owner 与持有者不一致 = RecorderError('busy')（这是调用方 bug，暴露而非吞掉）。
 */
async function stop(by: RecorderOwner): Promise<string | null> {
  if (owner === null) {
    return null;
  }
  if (owner !== by) {
    throw new RecorderError('busy', `recording held by ${owner}, not ${by}`);
  }
  const native = NativeModules.AudioRecord;
  try {
    const path = (await native.stopRecording()) as string | null;
    console.log(
      `${TAG} stop owner=${by} ms=${Date.now() - startedAt} path=${path ?? 'null'}`,
    );
    return path;
  } catch (e) {
    console.warn(`${TAG} stop failed owner=${by}:`, e);
    throw new RecorderError('native', String(e));
  } finally {
    // 无论成败都放锁：原生侧已停止写入，锁不释放会把麦克风永久焊死
    owner = null;
    startedAt = 0;
  }
}

export const audioRecorder = {start, stop};
