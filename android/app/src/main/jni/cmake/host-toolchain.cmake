# host-toolchain.cmake —— ggml-vulkan ExternalProject 编译 vulkan-shaders-gen.exe（host 工具）。
# 绕过 detect_host_compiler：MSVC cl.exe 不在 PATH（NO_CMAKE_FIND_ROOT_PATH 也找不到），需显式指定。
# 风险（docs 6.12）：裸 cl.exe 需 MSVC INCLUDE/LIB 环境（vcvarsall）。若 Gradle 构建进程未继承
# 该环境，shader-gen.exe 编译会失败 → 需大王构建前激活 vcvarsall，或在 VS Developer Prompt 内构建。
set(CMAKE_SYSTEM_NAME Windows)

# host shader-gen 子项目继承 Ninja generator，但 host 环境 PATH 无 ninja →
# 指向 Android SDK 自带 ninja（%LOCALAPPDATA%/Android/Sdk/cmake/*/bin/ninja.exe）。
set(_pp_sdk "$ENV{LOCALAPPDATA}/Android/Sdk")
file(GLOB _pp_ninja "${_pp_sdk}/cmake/*/bin/ninja.exe")
if (_pp_ninja)
    list(GET _pp_ninja -1 _pp_ninja_exe)
    set(CMAKE_MAKE_PROGRAM "${_pp_ninja_exe}" CACHE FILEPATH "" FORCE)
endif()

file(GLOB _pp_msvc_cl LIST_DIRECTORIES false
    "C:/Program Files/Microsoft Visual Studio/*/Community/VC/Tools/MSVC/*/bin/Hostx64/x64/cl.exe"
    "C:/Program Files/Microsoft Visual Studio/*/Professional/VC/Tools/MSVC/*/bin/Hostx64/x64/cl.exe"
    "C:/Program Files/Microsoft Visual Studio/*/Enterprise/VC/Tools/MSVC/*/bin/Hostx64/x64/cl.exe"
    "C:/Program Files (x86)/Microsoft Visual Studio/*/Community/VC/Tools/MSVC/*/bin/Hostx64/x64/cl.exe")
if (_pp_msvc_cl)
    list(SORT _pp_msvc_cl)
    list(GET _pp_msvc_cl -1 _pp_cl)   # 取最新 MSVC 工具链
    set(CMAKE_C_COMPILER "${_pp_cl}")
    set(CMAKE_CXX_COMPILER "${_pp_cl}")
endif()
