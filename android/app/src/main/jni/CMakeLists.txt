# PocketPal application CMake.
#
# Why this file exists at all: dropping `externalNativeBuild.cmake.path`
# in build.gradle disables the React Native plugin's auto-injection of
# its default-app-setup CMakeLists, so we own the `appmodules` library
# from here on. The `include(...)` below is what keeps autolinking,
# TurboModule registration, and prefab linkage to libreactnative.so
# working — i.e. it's what makes the app boot.
#
# Why our extra source lives in a subdirectory: RN's template at
# default-app-setup/ReactNative-application.cmake does
# `file(GLOB *.cpp)` non-recursively in this directory, treating the
# presence of any *.cpp here as "user owns OnLoad.cpp too." Keeping
# `hardware_info.cpp` under src/ leaves that glob empty so the upstream
# default-app-setup/OnLoad.cpp (PlatformConstants + autolinked
# TurboModules + Fabric registry) keeps being picked up. We then add
# our source explicitly via `target_sources` after the include.
# Net effect: no vendored Meta code, nothing to resync on RN bumps.

cmake_minimum_required(VERSION 3.13)

# Library name expected by RN; do not rename — SoLoader maps it at startup.
project(appmodules)

include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)

# ── stable-diffusion.cpp (P5.1 生图引擎) ──
# 引擎源码: src/stable-diffusion.cpp/ (含 ggml 子模块)
set(SD_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(SD_WEBP OFF CACHE BOOL "" FORCE)
set(SD_WEBM OFF CACHE BOOL "" FORCE)
set(SD_CUDA OFF CACHE BOOL "" FORCE)
set(SD_METAL OFF CACHE BOOL "" FORCE)
# P2 单后端（6.16 修正）：arm64-v8a 启用 OpenCL（Adreno 专用内核 + xmem GEMM）。
# 8-24 天玑提速攻坚 A 线：SD_VULKAN 唤醒（双后端同包，运行时由 manifest backend 单点决策选一，
# 非并行不混用）。依据：当初禁用结论（ggml-vulkan on Adreno 零成功案例）不适用于 Mali——
# Vulkan 是 ARM 主场，Mali Vulkan 驱动质量远优于其 OpenCL；探针负结果一行关回。
if (ANDROID_ABI STREQUAL "arm64-v8a")
    set(SD_VULKAN ON CACHE BOOL "" FORCE)
    set(SD_OPENCL ON CACHE BOOL "" FORCE)
    # 8-25 深水区探针：编译入算子级 profiling 代码，运行期由 env GGML_OPENCL_PROFILE 门控（不设零开销）。
    set(GGML_OPENCL_PROFILING ON CACHE BOOL "" FORCE)
else()
    set(SD_VULKAN OFF CACHE BOOL "" FORCE)
    set(SD_OPENCL OFF CACHE BOOL "" FORCE)
endif()

# ── Vulkan 补链（6.12）：NDK 原生资产（glslc/spirv-headers/libvulkan）+ Khronos 官方头 vendor ──
# 侦察结论：SPIRV-Headers 仅 find_package(CONFIG REQUIRED) 未被 link，真实需求是
# ggml-vulkan.cpp __has_include(<spirv/unified1/spirv.hpp>) 的 include path；host 端
# vulkan-shaders-gen.exe 需 cl.exe（不在 PATH，用 GGML_VULKAN_SHADERS_GEN_TOOLCHAIN 指定）。
if (SD_VULKAN AND ANDROID)
    set(_pp_spirv_inc "${ANDROID_NDK}/sources/third_party/shaderc/third_party/spirv-tools/external/spirv-headers/include")
    set(_pp_glslc "${ANDROID_NDK}/shader-tools/${ANDROID_HOST_TAG}/glslc${CMAKE_HOST_EXECUTABLE_SUFFIX}")
    # ① find_package(Vulkan COMPONENTS glslc) 预设 → FindVulkan 短路通过
    set(Vulkan_GLSLC_EXECUTABLE "${_pp_glslc}" CACHE FILEPATH "" FORCE)
    # Vulkan C 头（<vulkan/vulkan.h> 等）：Vulkan-Hpp 与 C 头必须同版本（vulkan.hpp 静态断言
    # VK_HEADER_VERSION == 359）。vendor Khronos 官方 Vulkan-Headers v1.4.359（1.4 世代，
    # Apache-2.0），目录约定 thirdparty/Vulkan-Headers/ = 上游 include/ 原样放入；缺失时明确报错（非静默）。
    if (NOT EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/thirdparty/Vulkan-Headers/include/vulkan/vulkan_core.h")
        message(FATAL_ERROR "Vulkan C headers (v1.4.359) missing. Vendor Khronos Vulkan-Headers v1.4.359 include/ into android/app/src/main/jni/thirdparty/Vulkan-Headers/")
    endif()
    set(Vulkan_INCLUDE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/thirdparty/Vulkan-Headers/include" CACHE PATH "" FORCE)
    # NDK 的 libvulkan.so stub 按 API 级别裁剪导出表（API 24/26 只导 1.0，1.1 core 如
    # vkGetPhysicalDeviceFeatures2 需 28+，1.2/1.3 core 需更高）。链接期专用 stub 用本机最高
    # API 级别保证导出表完整；运行时由设备 Vulkan loader 解析（现代设备 loader 全量导出）。
    set(Vulkan_LIBRARY "${CMAKE_SYSROOT}/usr/lib/${CMAKE_LIBRARY_ARCHITECTURE}/35/libvulkan.so" CACHE FILEPATH "" FORCE)
    # ② SPIRV-Headers Config（满足 find_package CONFIG REQUIRED）
    set(POCKETPAL_SPIRV_HEADERS_INCLUDE "${_pp_spirv_inc}")
    set(SPIRV-Headers_DIR "${CMAKE_CURRENT_SOURCE_DIR}/cmake" CACHE PATH "" FORCE)
    # ③ spirv.hpp + Vulkan-Hpp include 注入（ggml-vulkan.cpp __has_include 命中）
    include_directories("${_pp_spirv_inc}")
    # Vulkan-Hpp（vendored，大王选定）：ggml-vulkan.cpp L22 硬依赖 <vulkan/vulkan.hpp>；
    # vulkan.h(C API) 由 ① 处 vendor 的 Vulkan-Headers v1.4.359 同版本提供。
    include_directories("${CMAKE_CURRENT_SOURCE_DIR}/thirdparty/Vulkan-Hpp")
    # ④ host shader-gen toolchain（绕过 detect_host_compiler）
    set(GGML_VULKAN_SHADERS_GEN_TOOLCHAIN "${CMAKE_CURRENT_SOURCE_DIR}/cmake/host-toolchain.cmake" CACHE FILEPATH "" FORCE)
endif()

# ── OpenCL 补链（6.16）：Khronos OpenCL-Headers + libOpenCL.so stub ──
# FindOpenCL.cmake 预设：vendored 头文件 + arm64 stub 库 → find_package(OpenCL REQUIRED) 短路通过。
# GGML_OPENCL_USE_ADRENO_KERNELS 默认 ON（ggml/CMakeLists.txt）；
# GGML_OPENCL_EMBED_KERNELS 默认 ON（Python3 编译期嵌入 .cl → .h）。
if (SD_OPENCL AND ANDROID)
    set(_pp_opencl_inc "${CMAKE_CURRENT_SOURCE_DIR}/thirdparty/OpenCL-Headers")
    set(_pp_opencl_lib "${_pp_opencl_inc}/libOpenCL.so")
    if (NOT EXISTS "${_pp_opencl_inc}/CL/cl.h")
        message(FATAL_ERROR "OpenCL headers missing. Copy Khronos OpenCL-Headers CL/ into thirdparty/OpenCL-Headers/CL/")
    endif()
    if (NOT EXISTS "${_pp_opencl_lib}")
        message(FATAL_ERROR "libOpenCL.so missing. Copy Android arm64 stub into thirdparty/OpenCL-Headers/libOpenCL.so")
    endif()
    set(OpenCL_INCLUDE_DIR "${_pp_opencl_inc}" CACHE PATH "" FORCE)
    set(OpenCL_LIBRARY "${_pp_opencl_lib}" CACHE FILEPATH "" FORCE)
endif()

set(SD_BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
# NDK 交叉编译: 关掉 -march=native 类宿主指令
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)
add_subdirectory(../cpp/stable-diffusion.cpp sd-build)

target_sources(${CMAKE_PROJECT_NAME} PRIVATE src/hardware_info.cpp ../cpp/ImageGenJNI.cpp)

target_link_libraries(${CMAKE_PROJECT_NAME} stable-diffusion)

find_library(log-lib log)
target_link_libraries(${CMAKE_PROJECT_NAME} ${log-lib})
