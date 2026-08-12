// ImageGenJNI.cpp - JNI bridge: stable-diffusion.cpp -> RN (P5.1/P5.2)
//
// Singleton engine, mutually exclusive with the chat model (unload chat
// model before loading SD, see ImageGenStore.ts).
// Chain: RN (ImageGenModule) -> JNI -> stable-diffusion.cpp (sd_ctx_t) -> PNG
#include <jni.h>
#include <mutex>
#include <string>

#include <android/log.h>

#include "stable-diffusion.h"
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include "stb_image_write.h"

namespace {

std::mutex g_mutex;
sd_ctx_t* g_ctx = nullptr;

// Cached model path (new_sd_ctx needs it each time)
std::string g_model_path;

void sd_log_cb(enum sd_log_level_t level, const char* text, void* /*data*/) {
  __android_log_print(
      level == SD_LOG_ERROR ? ANDROID_LOG_ERROR : ANDROID_LOG_INFO,
      "ImageGen", "%s", text ? text : "");
}

}  // namespace

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_pocketpal_ImageGenModule_loadModel(JNIEnv* env, jobject /*thiz*/,
                                              jstring modelPath) {
  std::lock_guard<std::mutex> lock(g_mutex);
  const char* path = env->GetStringUTFChars(modelPath, nullptr);
  if (!path) {
    return JNI_FALSE;
  }

  if (g_ctx) {
    free_sd_ctx(g_ctx);
    g_ctx = nullptr;
  }

  sd_ctx_params_t params;
  sd_ctx_params_init(&params);
  params.model_path = path;
  params.n_threads = 4;  // conservative threads on mobile
  params.wtype = SD_TYPE_Q4_K;
  params.enable_mmap = true;
  params.backend = "CPU";  // P5.1 CPU first; OpenCL/Vulkan later

  sd_set_log_callback(sd_log_cb, nullptr);
  g_ctx = new_sd_ctx(&params);
  env->ReleaseStringUTFChars(modelPath, path);

  if (!g_ctx) {
    return JNI_FALSE;
  }
  g_model_path = std::string(path);
  return JNI_TRUE;
}

JNIEXPORT jboolean JNICALL
Java_com_pocketpal_ImageGenModule_unloadModel(JNIEnv* /*env*/, jobject /*thiz*/) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (g_ctx) {
    free_sd_ctx(g_ctx);
    g_ctx = nullptr;
  }
  g_model_path.clear();
  return JNI_TRUE;
}

JNIEXPORT jstring JNICALL
Java_com_pocketpal_ImageGenModule_txt2img(
    JNIEnv* env, jobject /*thiz*/, jstring prompt, jlong seed, jint steps,
    jfloat cfg, jint width, jint height, jstring outPath) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (!g_ctx) {
    return env->NewStringUTF("ERR_NO_MODEL");
  }
  const char* promptStr = env->GetStringUTFChars(prompt, nullptr);
  const char* outStr = env->GetStringUTFChars(outPath, nullptr);
  if (!promptStr || !outStr) {
    if (promptStr) env->ReleaseStringUTFChars(prompt, promptStr);
    if (outStr) env->ReleaseStringUTFChars(outPath, outStr);
    return env->NewStringUTF("ERR_ARGS");
  }

  sd_img_gen_params_t gen;
  sd_img_gen_params_init(&gen);
  gen.prompt = promptStr;
  gen.negative_prompt = "";
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

