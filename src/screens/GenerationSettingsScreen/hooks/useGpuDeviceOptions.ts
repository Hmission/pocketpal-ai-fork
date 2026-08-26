import {useEffect, useState} from 'react';
import {Platform} from 'react-native';

import {toJS} from 'mobx';

import {modelStore} from '../../../store';
import {checkGpuSupport} from '../../../utils/deviceCapabilities';
import {getDeviceOptions, DeviceOption} from '../../../utils/deviceSelection';
import {inferBackendType} from '../../../utils/flashAttnCompatibility';

export type BackendType = 'metal' | 'opencl' | 'hexagon' | 'cpu' | 'blas';

/**
 * GPU/设备选项状态与加载（R3-P1 从 GenerationSettingsScreen 原样迁出）：
 * gpuSupported / deviceOptions / currentBackend + 三个 effect，
 * 零行为变化——纯剪切-粘贴。
 */
export const useGpuDeviceOptions = () => {
  const [gpuSupported, setGpuSupported] = useState(false);
  const [deviceOptions, setDeviceOptions] = useState<DeviceOption[]>([]);
  const [currentBackend, setCurrentBackend] = useState<BackendType>(
    Platform.OS === 'ios' ? 'metal' : 'cpu',
  );

  // Check for GPU support (Metal on iOS 18+, OpenCL on Android with Adreno + CPU features)
  useEffect(() => {
    const checkGpuCapabilities = async () => {
      const gpuCapabilities = await checkGpuSupport();
      setGpuSupported(gpuCapabilities.isSupported);
    };

    checkGpuCapabilities().catch(error => {
      console.warn('Failed to check GPU capabilities:', error);
      setGpuSupported(false);
    });
  }, []);

  // Load available device options
  useEffect(() => {
    const loadDeviceOptions = async () => {
      try {
        const options = await getDeviceOptions();
        setDeviceOptions(options);
      } catch (error) {
        console.warn('Failed to load device options:', error);
      }
    };

    loadDeviceOptions();
  }, []);

  // Compute current backend type based on device selection
  // Convert MobX observable to plain JS for dependency tracking
  const devicesKey = JSON.stringify(toJS(modelStore.contextInitParams.devices));
  useEffect(() => {
    const updateBackend = async () => {
      const backend = await inferBackendType(
        modelStore.contextInitParams.devices,
      );
      setCurrentBackend(backend);
    };

    updateBackend();
  }, [devicesKey]);

  const handleDeviceSelect = (option: DeviceOption) => {
    modelStore.setDevices(option.devices);

    // Only update flash attention if current value is not valid for the selected device
    const currentFlashAttn =
      modelStore.contextInitParams.flash_attn_type ??
      (Platform.OS === 'ios' ? 'auto' : 'off');

    if (!option.valid_flash_attn_types.includes(currentFlashAttn)) {
      // Current setting is invalid for this device, use the default
      modelStore.setFlashAttnType(option.default_flash_attn_type);
    }
    // Otherwise, keep the user's current flash attention preference
  };

  const getCurrentDeviceId = (): string => {
    const devices = modelStore.contextInitParams.devices;
    const nGpuLayers = modelStore.contextInitParams.n_gpu_layers ?? 0;

    // iOS
    if (Platform.OS === 'ios') {
      if (!devices || devices.length === 0) {
        return nGpuLayers === 0 ? 'cpu' : 'auto';
      }
      if (devices[0] === 'Metal') {
        return 'gpu';
      }
      if (devices[0] === 'CPU') {
        return 'cpu';
      }
      return 'auto';
    }

    // Android
    // No auto mode on Android - always explicit device selection
    if (!devices || devices.length === 0 || devices[0] === 'CPU') {
      return 'cpu';
    }

    if (devices[0].startsWith('HTP')) {
      return 'hexagon';
    }

    // GPU device (Adreno, etc.)
    return 'gpu';
  };

  return {
    gpuSupported,
    deviceOptions,
    currentBackend,
    handleDeviceSelect,
    getCurrentDeviceId,
  };
};
