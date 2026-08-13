@echo off
rem Pre-test for 6.12 Vulkan host chain: activate MSVC x64 env and compile the
rem vulkan-shaders-gen host tool source directly. This is the exact file the
rem ggml ExternalProject builds on the host; it needs no Vulkan headers.
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" x64 >nul 2>&1
if errorlevel 1 (echo VCVARSALL_FAILED & exit /b 1)
cd /d F:\pp\android\app\src\main\cpp\stable-diffusion.cpp\ggml\src\ggml-vulkan\vulkan-shaders
cl /nologo /std:c++17 /EHsc /c vulkan-shaders-gen.cpp
if errorlevel 1 (echo CL_COMPILE_FAILED & exit /b 1)
echo CL_COMPILE_OK
