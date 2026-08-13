# SPIRV-HeadersConfig.cmake —— PocketPal 极简 Config（docs 6.12 Vulkan 补链）。
# 指向 NDK vendored spirv-headers（纯头文件库）。ggml-vulkan 仅 find_package(... CONFIG REQUIRED)，
# 其 SPIRV-Headers::SPIRV-Headers target 并未被 link；真实的 spirv.hpp include path 由
# jni/CMakeLists.txt 的 include_directories 注入。此 Config 仅为满足 find_package REQUIRED。
if(NOT TARGET SPIRV-Headers::SPIRV-Headers)
    add_library(SPIRV-Headers::SPIRV-Headers INTERFACE IMPORTED)
    if(POCKETPAL_SPIRV_HEADERS_INCLUDE)
        set_target_properties(SPIRV-Headers::SPIRV-Headers PROPERTIES
            INTERFACE_INCLUDE_DIRECTORIES "${POCKETPAL_SPIRV_HEADERS_INCLUDE}")
    endif()
endif()
set(SPIRV-Headers_FOUND TRUE)
