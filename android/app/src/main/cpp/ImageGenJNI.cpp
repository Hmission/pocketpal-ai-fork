// ImageGenJNI.cpp - JNI bridge: stable-diffusion.cpp -> RN (P5.1/P5.2)
//
// Singleton engine, mutually exclusive with the chat model (unload chat
// model before loading SD, see ImageGenStore.ts).
// Chain: RN (ImageGenModule) -> JNI -> stable-diffusion.cpp (sd_ctx_t) -> PNG
#include <jni.h>
#include <mutex>
#include <string>
#include <thread>
#include <algorithm>
#include <cstring>
#include <chrono>
#include <cstdio>
#include <cstdarg>

#include <android/log.h>

#include "stable-diffusion.h"
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"

namespace {

std::mutex g_mutex;
sd_ctx_t* g_ctx = nullptr;

// Cached model path (new_sd_ctx needs it each time)
std::string g_model_path;

// JavaVM + cached jclass/jmethodID for RN event emission
JavaVM* g_jvm = nullptr;
jclass g_imageGenClass = nullptr;
jmethodID g_onLogMid = nullptr;
jmethodID g_onProgressMid = nullptr;

// Log 透传节流：高频 log 回调每次透传都要 Attach/DetachCurrentThread，
// 500ms 窗口控制 JNI 开销（推拉反转后 RN 侧无事件风暴，此阀纯为开销控制）
auto g_lastLogForward = std::chrono::steady_clock::time_point::min();

// ---- 持久化崩溃取证日志 ----
// logcat 会轮转、静默 OOM kill 不写 tombstone，故用落盘日志：每行 fflush，
// 进程被 SIGKILL/OOM 杀掉后最后一行仍保留，可精确定位死在哪一步。
const char* kDbgLogPath = "/sdcard/Documents/AIOS/imagegen_debug.log";
void dbg_log(const char* fmt, ...) {
  FILE* f = fopen(kDbgLogPath, "a");
  if (!f) {
    return;
  }
  char line[512];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(line, sizeof(line), fmt, ap);
  va_end(ap);
  auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                std::chrono::steady_clock::now().time_since_epoch())
                .count();
  fprintf(f, "[%lld] %s\n", (long long)ms, line);
  fflush(f);
  fclose(f);
}
// 记录当前 RSS（KB）追踪内存 buildup → OOM
void dbg_mem(const char* tag) {
  FILE* f = fopen("/proc/self/status", "r");
  if (!f) {
    return;
  }
  char buf[64];
  long rss_kb = -1;
  while (fgets(buf, sizeof(buf), f)) {
    if (strncmp(buf, "VmRSS:", 6) == 0) {
      sscanf(buf + 6, "%ld", &rss_kb);
      break;
    }
  }
  fclose(f);
  dbg_log("MEM %s VmRSS=%ld KB", tag, rss_kb);
}

/// Cache jclass + jmethodIDs once (called from nativeLoadModel).
/// Must be called with a valid JNIEnv (on the JS thread).
void cacheJniRefs(JNIEnv* env) {
  if (g_imageGenClass) {
    return;  // already cached
  }
  jclass local = env->FindClass("com/pocketpal/ImageGenModule");
  if (local) {
    g_imageGenClass = static_cast<jclass>(env->NewGlobalRef(local));
    env->DeleteLocalRef(local);
  }
  if (g_imageGenClass) {
    g_onLogMid = env->GetStaticMethodID(
        g_imageGenClass, "onLogFromNative", "(ILjava/lang/String;)V");
    g_onProgressMid = env->GetStaticMethodID(
        g_imageGenClass, "onProgressFromNative", "(IIF)V");
  }
}

// RAII helper for JNI string access
struct JStr {
  JNIEnv* env_;
  jstring js_;
  const char* c_;
  JStr(JNIEnv* env, jstring js) : env_(env), js_(js), c_(nullptr) {
    if (js_) {
      c_ = env_->GetStringUTFChars(js_, nullptr);
    }
  }
  ~JStr() {
    if (c_) {
      env_->ReleaseStringUTFChars(js_, c_);
    }
  }
  bool empty() const { return !c_ || !c_[0]; }
  const char* c_str() const { return c_ ? c_ : ""; }
};

void sd_log_cb(enum sd_log_level_t level, const char* text, void* /*data*/) {
  __android_log_print(
      level == SD_LOG_ERROR ? ANDROID_LOG_ERROR : ANDROID_LOG_INFO,
      "ImageGen", "%s", text ? text : "");
  // 阶段日志透传 RN：WARN/ERROR 全透传；INFO 只透关键阶段行（防刷屏）
  if (!g_jvm || !g_imageGenClass || !g_onLogMid || !text || !text[0]) {
    return;
  }
  bool forward = (level == SD_LOG_ERROR || level == SD_LOG_WARN);
  if (!forward) {
    static const char* kStageKeys[] = {
        "loading",  "load ",   "params memory", "prepar",
        "weights",  "generate_image", "sampling", "denoise",
        "vae",      "VAE",     "opencl",  "OpenCL",
        "backend",  "Version", "eval",    "encode",
    };
    for (const char* k : kStageKeys) {
      if (strstr(text, k)) {
        forward = true;
        break;
      }
    }
  }
  if (!forward) {
    return;
  }
  // 节流：log 回调高频（采样循环内部），每次透传都要 Attach/DetachCurrentThread，
  // 500ms 窗口控制 JNI 开销（推拉反转后 RN 侧无事件风暴，此阀纯为开销控制）
  auto now = std::chrono::steady_clock::now();
  auto msSinceLast = std::chrono::duration_cast<std::chrono::milliseconds>(
      now - g_lastLogForward).count();
  if (msSinceLast < 500) {
    return;
  }
  g_lastLogForward = now;
  JNIEnv* env = nullptr;
  bool attached = false;
  jint st = g_jvm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6);
  if (st == JNI_EDETACHED) {
    if (g_jvm->AttachCurrentThread(&env, nullptr) != JNI_OK) {
      return;
    }
    attached = true;
  }
  if (env) {
    jstring jtext = env->NewStringUTF(text);
    env->CallStaticVoidMethod(g_imageGenClass, g_onLogMid,
                               static_cast<jint>(level), jtext);
    env->DeleteLocalRef(jtext);
    if (env->ExceptionCheck()) {
      env->ExceptionClear();
    }
  }
  if (attached) {
    g_jvm->DetachCurrentThread();
  }
}

// Progress callback → Kotlin companion onProgressFromNative(step, steps, time)
// 每步一次回调，频率天然低（每步秒级），无需节流
void sd_progress_cb(int step, int steps, float time, void* /*data*/) {
  if (!g_jvm || !g_imageGenClass || !g_onProgressMid) {
    return;
  }
  JNIEnv* env = nullptr;
  bool attached = false;
  jint st = g_jvm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6);
  if (st == JNI_EDETACHED) {
    if (g_jvm->AttachCurrentThread(&env, nullptr) != JNI_OK) {
      return;
    }
    attached = true;
  }
  if (env) {
    env->CallStaticVoidMethod(g_imageGenClass, g_onProgressMid,
                               step, steps, time);
    if (env->ExceptionCheck()) {
      env->ExceptionClear();
    }
  }
  if (attached) {
    g_jvm->DetachCurrentThread();
  }
}

}  // namespace

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_pocketpal_ImageGenModule_nativeLoadModel(JNIEnv* env, jobject /*thiz*/,
                                              jstring modelPath,
                                              jstring clipLPath, jstring clipGPath,
                                              jstring llmPath, jstring vaePath,
                                              jstring backend) {
  std::lock_guard<std::mutex> lock(g_mutex);
  env->GetJavaVM(&g_jvm);
  cacheJniRefs(env);  // cache jclass + jmethodID once (fix weak-ref overflow)
  dbg_log("==== loadModel begin ====");
  dbg_mem("loadModel entry");
  JStr model(env, modelPath);
  JStr clip_l(env, clipLPath);
  JStr clip_g(env, clipGPath);
  JStr llm(env, llmPath);
  JStr vae(env, vaePath);
  JStr backend_s(env, backend);
  if (model.empty()) {
    return JNI_FALSE;
  }

  if (g_ctx) {
    free_sd_ctx(g_ctx);
    g_ctx = nullptr;
  }

  sd_ctx_params_t params;
  sd_ctx_params_init(&params);
  if (!llm.empty()) {
    // Z-Image 系：拆分式（DiT + Qwen3-4B 文本编码器 + FLUX VAE）
    params.diffusion_model_path = model.c_str();
    params.llm_path = llm.c_str();
    if (!vae.empty()) {
      params.vae_path = vae.c_str();
    }
  } else if (!clip_l.empty() || !clip_g.empty()) {
    // SD3/3.5 系：拆分式（DiT + clip_l/clip_g，端侧不带 T5）
    params.diffusion_model_path = model.c_str();
    if (!clip_l.empty()) {
      params.clip_l_path = clip_l.c_str();
    }
    if (!clip_g.empty()) {
      params.clip_g_path = clip_g.c_str();
    }
    if (!vae.empty()) {
      params.vae_path = vae.c_str();
    }
  } else {
    // 一体式（SDXL Turbo 等单文件模型）
    params.model_path = model.c_str();
  }
  // 探测核数（big.LITTLE 取上限 6 避免小核竞争），fallback 4
  unsigned int hw = std::thread::hardware_concurrency();
  params.n_threads = hw ? std::min(hw, 6u) : 4;
  params.wtype = SD_TYPE_Q4_K;
  params.enable_mmap = true;
  // P2 后端决策：backend 由 manifest defaults 透传（RN → Kotlin → JNI 一条数据流），
  // JNI 不决策。空则用引擎默认（sd_ctx_params_init 清零 → backend null → CPU）。
  // 单后端无 fallback：Vulkan 挂机风险由 JS 侧 120s 无事件超时判定兜底（干净失败）。
  if (!backend_s.empty()) {
    params.backend = backend_s.c_str();
  }

  sd_set_log_callback(sd_log_cb, nullptr);
  sd_set_progress_callback(sd_progress_cb, nullptr);
  dbg_mem("before new_sd_ctx");
  dbg_log("new_sd_ctx begin backend=%s n_threads=%u", params.backend,
          params.n_threads);
  g_ctx = new_sd_ctx(&params);
  dbg_log("new_sd_ctx ret=%p", (void*)g_ctx);
  dbg_mem("after new_sd_ctx");

  if (!g_ctx) {
    dbg_log("==== loadModel FAILED (ctx null) ====");
    return JNI_FALSE;
  }
  g_model_path = std::string(model.c_str());
  dbg_log("==== loadModel OK ====");
  return JNI_TRUE;
}

JNIEXPORT jboolean JNICALL
Java_com_pocketpal_ImageGenModule_nativeUnloadModel(JNIEnv* /*env*/, jobject /*thiz*/) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (g_ctx) {
    free_sd_ctx(g_ctx);
    g_ctx = nullptr;
  }
  g_model_path.clear();
  return JNI_TRUE;
}

JNIEXPORT jstring JNICALL
Java_com_pocketpal_ImageGenModule_nativeTxt2img(
    JNIEnv* env, jobject /*thiz*/, jstring prompt, jstring negativePrompt,
    jlong seed, jint steps, jfloat cfg, jint width, jint height,
    jstring loraPath, jfloat loraMultiplier, jstring outPath) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (!g_ctx) {
    dbg_log("txt2img ERR_NO_MODEL");
    return env->NewStringUTF("ERR_NO_MODEL");
  }
  dbg_log("==== txt2img begin %dx%d steps=%d cfg=%.2f seed=%lld ====", width,
          height, steps, cfg, (long long)seed);
  dbg_mem("txt2img entry");
  const char* promptStr = env->GetStringUTFChars(prompt, nullptr);
  const char* negStr = env->GetStringUTFChars(negativePrompt, nullptr);
  const char* outStr = env->GetStringUTFChars(outPath, nullptr);
  JStr lora(env, loraPath);
  if (!promptStr || !outStr) {
    if (promptStr) env->ReleaseStringUTFChars(prompt, promptStr);
    if (negStr) env->ReleaseStringUTFChars(negativePrompt, negStr);
    if (outStr) env->ReleaseStringUTFChars(outPath, outStr);
    return env->NewStringUTF("ERR_ARGS");
  }

  sd_img_gen_params_t gen;
  sd_img_gen_params_init(&gen);
  gen.prompt = promptStr;
  gen.negative_prompt = negStr;
  gen.width = width;
  gen.height = height;
  gen.seed = seed;
  gen.batch_count = 1;
  // 参数由 manifest defaults + RN store 默认值保证有值，JNI 不重复防御
  gen.sample_params.sample_steps = steps;
  gen.sample_params.guidance.txt_cfg = cfg;

  // 加速 LoRA 通道（sd.cpp 原生 sd_lora_t）：manifest 声明即插即用
  sd_lora_t loraArr[1];
  if (!lora.empty()) {
    loraArr[0].is_high_noise = false;
    loraArr[0].multiplier = loraMultiplier;
    loraArr[0].path = lora.c_str();
    gen.loras = loraArr;
    gen.lora_count = 1;
    dbg_log("txt2img with lora=%s mult=%.2f", lora.c_str(), loraArr[0].multiplier);
  }

  sd_image_t* images = nullptr;
  int numImages = 0;
  dbg_mem("before generate_image");
  dbg_log("generate_image begin");
  const bool ok = generate_image(g_ctx, &gen, &images, &numImages);
  dbg_log("generate_image ret=%d numImages=%d", (int)ok, numImages);
  dbg_mem("after generate_image");

  env->ReleaseStringUTFChars(prompt, promptStr);
  env->ReleaseStringUTFChars(negativePrompt, negStr);
  if (!ok || numImages <= 0 || !images) {
    dbg_log("txt2img ERR_GENERATE");
    env->ReleaseStringUTFChars(outPath, outStr);
    return env->NewStringUTF("ERR_GENERATE");
  }

  const sd_image_t& img = images[0];
  dbg_log("write_png begin %s (%dx%d ch%d)", outStr, img.width, img.height,
          img.channel);
  const int writeOk =
      stbi_write_png(outStr, (int)img.width, (int)img.height, (int)img.channel,
                     img.data, (int)img.width * (int)img.channel);
  dbg_log("write_png ret=%d", writeOk);
  free_sd_images(images, numImages);
  env->ReleaseStringUTFChars(outPath, outStr);
  dbg_mem("after write_png");
  dbg_log("==== txt2img done ret=%s ====", writeOk ? "OK" : "ERR_WRITE");

  return env->NewStringUTF(writeOk ? outStr : "ERR_WRITE");
}

}  // extern "C"


