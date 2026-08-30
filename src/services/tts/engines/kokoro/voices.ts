import type {Voice} from '../../types';

/**
 * Kokoro 82M v1.0 voice catalog (24 voices).
 *
 * IDs follow the `<lang><gender>_<name>` convention used by the upstream
 * repo: `a` = American English, `b` = British English, `e` = Spanish,
 * `f` = French, `h` = Hindi, `i` = Italian, `j` = Japanese, `p` =
 * Brazilian Portuguese, `z` = Mandarin Chinese. `f` = female, `m` = male.
 *
 * B38c：接入中文音色（zf_xiaobei 小北 / zm_yunjian 云见）——sherpa 生成链
 * 的 lang 参数按音色语言映射（zh→cmn / en→en-us / en-GB→en-gb），
 * espeak-ng-data 已含 cmn 词典 + lang/sit/cmn 语言定义（无需额外数据）。
 */
export const KOKORO_VOICES: Voice[] = [
  // American English — female
  {
    id: 'af_heart',
    name: 'Heart',
    engine: 'kokoro',
    language: 'en',
    gender: 'f',
  },
  {
    id: 'af_bella',
    name: 'Bella',
    engine: 'kokoro',
    language: 'en',
    gender: 'f',
  },
  {
    id: 'af_nicole',
    name: 'Nicole',
    engine: 'kokoro',
    language: 'en',
    gender: 'f',
  },
  {
    id: 'af_sarah',
    name: 'Sarah',
    engine: 'kokoro',
    language: 'en',
    gender: 'f',
  },
  {
    id: 'af_sky',
    name: 'Sky',
    engine: 'kokoro',
    language: 'en',
    gender: 'f',
  },
  {
    id: 'af_aoede',
    name: 'Aoede',
    engine: 'kokoro',
    language: 'en',
    gender: 'f',
  },
  {
    id: 'af_jessica',
    name: 'Jessica',
    engine: 'kokoro',
    language: 'en',
    gender: 'f',
  },
  {
    id: 'af_kore',
    name: 'Kore',
    engine: 'kokoro',
    language: 'en',
    gender: 'f',
  },
  {
    id: 'af_river',
    name: 'River',
    engine: 'kokoro',
    language: 'en',
    gender: 'f',
  },
  // American English — male
  {
    id: 'am_adam',
    name: 'Adam',
    engine: 'kokoro',
    language: 'en',
    gender: 'm',
  },
  {
    id: 'am_echo',
    name: 'Echo',
    engine: 'kokoro',
    language: 'en',
    gender: 'm',
  },
  {
    id: 'am_eric',
    name: 'Eric',
    engine: 'kokoro',
    language: 'en',
    gender: 'm',
  },
  {
    id: 'am_fenrir',
    name: 'Fenrir',
    engine: 'kokoro',
    language: 'en',
    gender: 'm',
  },
  {
    id: 'am_liam',
    name: 'Liam',
    engine: 'kokoro',
    language: 'en',
    gender: 'm',
  },
  {
    id: 'am_michael',
    name: 'Michael',
    engine: 'kokoro',
    language: 'en',
    gender: 'm',
  },
  {
    id: 'am_onyx',
    name: 'Onyx',
    engine: 'kokoro',
    language: 'en',
    gender: 'm',
  },
  {
    id: 'am_santa',
    name: 'Santa',
    engine: 'kokoro',
    language: 'en',
    gender: 'm',
  },
  // British English — female
  {
    id: 'bf_alice',
    name: 'Alice',
    engine: 'kokoro',
    language: 'en-GB',
    gender: 'f',
  },
  {
    id: 'bf_emma',
    name: 'Emma',
    engine: 'kokoro',
    language: 'en-GB',
    gender: 'f',
  },
  {
    id: 'bf_lily',
    name: 'Lily',
    engine: 'kokoro',
    language: 'en-GB',
    gender: 'f',
  },
  // British English — male
  {
    id: 'bm_george',
    name: 'George',
    engine: 'kokoro',
    language: 'en-GB',
    gender: 'm',
  },
  {
    id: 'bm_lewis',
    name: 'Lewis',
    engine: 'kokoro',
    language: 'en-GB',
    gender: 'm',
  },
  // Mandarin Chinese (B38c：中文音色接入，sherpa lang=cmn)
  {
    id: 'zf_xiaobei',
    name: '小北',
    engine: 'kokoro',
    language: 'zh',
    gender: 'f',
  },
  {
    id: 'zm_yunjian',
    name: '云见',
    engine: 'kokoro',
    language: 'zh',
    gender: 'm',
  },
];
