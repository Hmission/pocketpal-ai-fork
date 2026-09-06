import {useEffect, useState, useContext} from 'react';

import DeviceInfo from 'react-native-device-info';

import {formatBytes, hasEnoughSpace} from '../utils';
import {safeInterval} from '../utils/safeInterval';
import {L10nContext} from '../utils';
import {t} from '../locales';

import {Model, ModelOrigin} from '../utils/types';

interface StorageCheckOptions {
  /**
   * Whether to periodically check storage.
   * If false, storage will only be checked once.
   * @default true
   */
  enablePeriodicCheck?: boolean;
  /**
   * Interval in milliseconds for storage checks when periodic checking is enabled
   * @default 10000 (10 seconds)
   */
  checkInterval?: number;
}

export const useStorageCheck = (
  model: Model,
  options: StorageCheckOptions = {},
) => {
  const {enablePeriodicCheck = true, checkInterval = 10000} = options;
  const l10n = useContext(L10nContext);

  const [storageStatus, setStorageStatus] = useState({
    isOk: true,
    message: '',
  });
  //const [freeDiskStorage, setFreeDiskStorage] = useState<number | null>(null);

  // Effect to check storage and set up periodic checking if enabled
  useEffect(() => {
    const abortController = new AbortController();

    const checkStorage = async () => {
      try {
        if (
          model.isDownloaded ||
          model.isLocal ||
          model.origin === ModelOrigin.LOCAL
        ) {
          return;
        }

        const isEnoughSpace = await hasEnoughSpace(model);
        if (abortController.signal.aborted) {
          return;
        }

        if (!isEnoughSpace) {
          const freeDisk = await DeviceInfo.getFreeDiskStorage('important');
          if (abortController.signal.aborted) {
            return;
          }

          // Use localized template string with variables
          const message = t(l10n.storage.lowStorage, {
            modelSize: formatBytes(model.size),
            freeSpace: formatBytes(freeDisk),
          });

          setStorageStatus({
            isOk: false,
            message,
          });
        } else {
          setStorageStatus({
            isOk: true,
            message: '',
          });
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Storage check failed:', error);
          setStorageStatus({isOk: false, message: l10n.storage.checkFailed});
        }
      }
    };

    checkStorage();
    let stop: (() => void) | null = null;
    if (enablePeriodicCheck) {
      // 周期检查走收口原语；首调用的失败已在 checkStorage 内部转成 UI 状态（有业务语义，不交原语上报）
      stop = safeInterval('storage_check', checkStorage, checkInterval);
    }

    return () => {
      abortController.abort();
      if (stop) {
        stop();
      }
    };
  }, [model, enablePeriodicCheck, checkInterval, l10n]);

  return storageStatus;
};
