@echo off
rem 6.12 Vulkan build wrapper: activate MSVC x64 env (host-side cl.exe compiling
rem vulkan-shaders-gen.exe needs INCLUDE/LIB, which Gradle externalNativeBuild
rem does not inherit by default), then run the requested Gradle tasks.
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat" x64 >nul 2>&1
if errorlevel 1 (echo VCVARSALL_FAILED & exit /b 1)
cd /d f:\pp\android
call gradlew.bat %*
