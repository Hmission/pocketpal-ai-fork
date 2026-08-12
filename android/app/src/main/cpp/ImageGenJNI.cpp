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

#include <android/log.h>

#include "stable-diffusion.h"
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"

namespace {

std::mutex g_mutex;
sd_ctx_t* g_ctx = nullptr;

// Cached model path (new_sd_ctx needs it each time)
std::string g_model_path;

// JavaVM + progress emitter for RN events
JavaVM* g_jvm = nullptr;

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
}

// Progress callback → Kotlin companion onProgressFromNative(step, steps)
void sd_progress_cb(int step, int steps, float /*time*/, void* /*data*/) {
  if (!g_jvm) {
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
    jclass cls = env->FindClass("com/pocketpal/ImageGenModule");
    if (cls) {
      jmethodID mid = env->GetStaticMethodID(
          cls, "onProgressFromNative", "(II)V");
      if (mid) {
        env->CallStaticVoidMethod(cls, mid, step, steps);
      }
    }
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
                                              jstring llmPath, jstring vaePath) {
  std::lock_guard<std::mutex> lock(g_mutex);
  env->GetJavaVM(&g_jvm);
  JStr model(env, modelPath);
  JStr clip_l(env, clipLPath);
  JStr clip_g(env, clipGPath);
  JStr llm(env, llmPath);
  JStr vae(env, vaePath);
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
  // 后端：CPU 先行。OpenCL 接入需 CMake SD_OPENCL=ON + NDK sysroot 补
  // OpenCL headers/ICD loader（见 docs/POCKETPAL_IMAGE_GEN_UPGRADE_PLAN.md P2）
  params.backend = "CPU";

  sd_set_log_callback(sd_log_cb, nullptr);
  sd_set_progress_callback(sd_progress_cb, nullptr);
  g_ctx = new_sd_ctx(&params);

  if (!g_ctx) {
    return JNI_FALSE;
  }
  g_model_path = std::string(model.c_str());
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
    jstring outPath) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (!g_ctx) {
    return env->NewStringUTF("ERR_NO_MODEL");
  }
  const char* promptStr = env->GetStringUTFChars(prompt, nullptr);
  const char* negStr = env->GetStringUTFChars(negativePrompt, nullptr);
  const char* outStr = env->GetStringUTFChars(outPath, nullptr);
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
  // SDXL Turbo: default euler + 1-4 steps is enough
  gen.sample_params.sample_steps = steps > 0 ? steps : 2;
  gen.sample_params.guidance.txt_cfg = cfg > 0 ? cfg : 2.0f;

  sd_image_t* images = nullptr;
  int numImages = 0;
  const bool ok = generate_image(g_ctx, &gen, &images, &numImages);

  env->ReleaseStringUTFChars(prompt, promptStr);
  env->ReleaseStringUTFChars(negativePrompt, negStr);
  if (!ok || numImages <= 0 || !images) {
    env->ReleaseStringUTFChars(outPath, outStr);
    return env->NewStringUTF("ERR_GENERATE");
  }

  const sd_image_t& img = images[0];
  const int writeOk =
      stbi_write_png(outStr, (int)img.width, (int)img.height, (int)img.channel,
                     img.data, (int)img.width * (int)img.channel);
  free_sd_images(images, numImages);
  env->ReleaseStringUTFChars(outPath, outStr);

  return env->NewStringUTF(writeOk ? outStr : "ERR_WRITE");
}

}  // extern "C"


