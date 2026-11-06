# host-toolchain.cmake —— ggml-vulkan ExternalProject 编译 vulkan-shaders-gen（host 端工具，不跑在 Android 上）。
# 该 generator 需要 host 端 C/C++ 编译器（不是 Android NDK 交叉链），所以通过 toolchain 文件显式指定。
# 跨平台支持：Windows 走 MSVC cl.exe，Linux/macOS 走原生 gcc/clang。

# Ninja：Android SDK 自带，跨平台可用
if (ANDROID_HOME AND EXISTS "$ENV{ANDROID_HOME}/cmake")
    file(GLOB _pp_ninja "$ENV{ANDROID_HOME}/cmake/*/bin/ninja")
    if (NOT _pp_ninja)
        file(GLOB _pp_ninja "$ENV{ANDROID_HOME}/cmake/*/bin/ninja.exe")
    endif()
    if (_pp_ninja)
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
        set(CMAKE_C_COMPILER "${_pp_cl}")
        set(CMAKE_CXX_COMPILER "${_pp_cl}")
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
