#!/bin/bash

# Run patch-package first
npx patch-package

# Clone OpenCL headers if building llama.rn from source
OPENCL_HEADERS_DIR="node_modules/llama.rn/third_party/OpenCL-Headers"
if [ ! -d "$OPENCL_HEADERS_DIR" ]; then
    echo "Cloning OpenCL headers for llama.rn build from source..."
    mkdir -p "node_modules/llama.rn/third_party"
    git clone --depth 1 https://github.com/KhronosGroup/OpenCL-Headers.git "$OPENCL_HEADERS_DIR"
    echo "OpenCL headers cloned successfully."
else
    echo "OpenCL headers already present."
fi

# Restore llama.rn native libs if missing. llama.rn 0.12.7 upstream mismatch:
# official prebuilt lacks librnllama_jni_*.so expected by RNLlama.java, so the
# project depends on locally-built _jni variants that live outside git.
# This check turns silent loss ("JSI bindings not installed") into
# auto-restore or an explicit failure. (added 2026-08-17, see
# scripts/restore-llamarn-jnilibs.js)
node scripts/restore-llamarn-jnilibs.js || echo "[postinstall] WARNING: llama.rn jniLibs restore failed — check logs above"
