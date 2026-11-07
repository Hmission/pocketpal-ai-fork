# host-toolchain.cmake —— ggml-vulkan ExternalProject 编译 vulkan-shaders-gen（host 端工具，不跑在 Android 上）。
# 该 generator 需要 host 端 C/C++ 编译器（不是 Android NDK 交叉链），所以通过 toolchain 文件显式指定。
# 跨平台支持：Windows 走 MSVC cl.exe，Linux/macOS 走原生 gcc/clang。
#
# ⚠ Windows 前提（2026-11-07 本机实测）：必须在 VS Developer 环境里构建
#   （call vcvars64.bat 后再跑 gradlew，或在 VS Developer Prompt 内）。
#   本文件能定位 cl.exe，但 INCLUDE/LIB 与 rc/mt 仍要 vcvars 注入；裸 shell 下
#   配置期会红在 LNK1104: 无法打开文件 kernel32.lib（不是代码问题，是环境缺前提）。

# Ninja：Android SDK 自带。SDK 根的来源按环境不同——CI 显式导出 ANDROID_HOME，
# 本机 Gradle 只把 sdk.dir 用于自身、不传给 cmake 子进程，所以并试多个来源。
set(_pp_sdk_candidates "")
foreach(_var ANDROID_HOME ANDROID_SDK_ROOT LOCALAPPDATA HOME)
    if (DEFINED ENV{${_var}})
        if (_var STREQUAL "LOCALAPPDATA")
            list(APPEND _pp_sdk_candidates "$ENV{LOCALAPPDATA}/Android/Sdk")
        elseif (_var STREQUAL "HOME")
            list(APPEND _pp_sdk_candidates "$ENV{HOME}/Android/Sdk" "$ENV{HOME}/Library/Android/sdk")
        else()
            list(APPEND _pp_sdk_candidates "$ENV{${_var}}")
        endif()
    endif()
endforeach()
set(_pp_sdk "")
foreach(_root IN LISTS _pp_sdk_candidates)
    if (IS_DIRECTORY "${_root}/cmake")
        set(_pp_sdk "${_root}")
        break()
    endif()
endforeach()
if (_pp_sdk)
    file(GLOB _pp_ninja "${_pp_sdk}/cmake/*/bin/ninja" "${_pp_sdk}/cmake/*/bin/ninja.exe")
    if (_pp_ninja)
        list(SORT _pp_ninja)
        list(GET _pp_ninja -1 _pp_ninja_exe)
        set(CMAKE_MAKE_PROGRAM "${_pp_ninja_exe}" CACHE FILEPATH "" FORCE)
    endif()
endif()

if (WIN32)
    # ====== Windows：使用 MSVC cl.exe ======
    set(CMAKE_SYSTEM_NAME Windows)

    file(GLOB _pp_msvc_cl LIST_DIRECTORIES false
        "C:/Program Files/Microsoft Visual Studio/*/Community/VC/Tools/MSVC/*/bin/Hostx64/x64/cl.exe"
        "C:/Program Files/Microsoft Visual Studio/*/Professional/VC/Tools/MSVC/*/bin/Hostx64/x64/cl.exe"
        "C:/Program Files/Microsoft Visual Studio/*/Enterprise/VC/Tools/MSVC/*/bin/Hostx64/x64/cl.exe"
        "C:/Program Files (x86)/Microsoft Visual Studio/*/Community/VC/Tools/MSVC/*/bin/Hostx64/x64/cl.exe")
    if (_pp_msvc_cl)
        list(SORT _pp_msvc_cl)
        list(GET _pp_msvc_cl -1 _pp_cl)
        # FORCE：VS 工具集升级会抹掉旧版本号目录，缓存里钉死的 cl.exe/lib.exe 路径
        # 会变成不存在的编译器（本机实测：14.43 被 14.44 顶掉后配置期直接红）。
        set(CMAKE_C_COMPILER "${_pp_cl}" CACHE FILEPATH "" FORCE)
        set(CMAKE_CXX_COMPILER "${_pp_cl}" CACHE FILEPATH "" FORCE)
    endif()
else()
    # ====== Linux / macOS：使用原生 host 编译器 ======
    # 不设 CMAKE_SYSTEM_NAME → cmake 走 native toolchain，不会注入 Windows 链接参数
    find_program(_pp_host_cc  NAMES cc  gcc  clang)
    find_program(_pp_host_cxx NAMES c++ g++ clang++)
    if (_pp_host_cc)
        set(CMAKE_C_COMPILER "${_pp_host_cc}")
    endif()
    if (_pp_host_cxx)
        set(CMAKE_CXX_COMPILER "${_pp_host_cxx}")
    endif()
endif()
