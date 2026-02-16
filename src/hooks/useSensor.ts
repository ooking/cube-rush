import { useEffect, useRef, useCallback, useState } from 'react';

interface SensorConfig {
    /** 加速度阈值，超过即认为有运动 */
    motionThreshold: number;
    /** 静止判定的时间窗口 (ms) */
    stillDuration: number;
}

const DEFAULT_CONFIG: SensorConfig = {
    motionThreshold: 1.5,
    stillDuration: 300,
};

/**
 * 传感器 Hook:
 * - 检测手机拿起（加速度突变）→ 触发 onPickup
 * - 检测手机放回桌面（持续静止）→ 触发 onPutDown
 */
export function useSensor(
    onPickup: () => void,
    onPutDown: () => void,
    enabled: boolean,
    config: Partial<SensorConfig> = {}
) {
    const { motionThreshold, stillDuration } = { ...DEFAULT_CONFIG, ...config };
    const [sensorAvailable, setSensorAvailable] = useState<boolean | null>(null);
    const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

    const lastMotionRef = useRef(0);
    const isMovingRef = useRef(false);
    const onPickupRef = useRef(onPickup);
    const onPutDownRef = useRef(onPutDown);
    const enabledRef = useRef(enabled);
    const stillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    onPickupRef.current = onPickup;
    onPutDownRef.current = onPutDown;
    enabledRef.current = enabled;

    const handleMotion = useCallback(
        (event: DeviceMotionEvent) => {
            if (!enabledRef.current) return;

            const acc = event.accelerationIncludingGravity;
            if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

            // 计算加速度变化量（去除重力后的净加速度近似）
            const magnitude = Math.sqrt(
                (acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2
            );

            // 与重力加速度(约9.8)的偏移量
            const deviation = Math.abs(magnitude - 9.8);

            if (deviation > motionThreshold) {
                lastMotionRef.current = Date.now();

                if (stillTimerRef.current) {
                    clearTimeout(stillTimerRef.current);
                    stillTimerRef.current = null;
                }

                if (!isMovingRef.current) {
                    isMovingRef.current = true;
                    onPickupRef.current();
                }
            } else if (isMovingRef.current && !stillTimerRef.current) {
                // 开始静止计时
                stillTimerRef.current = setTimeout(() => {
                    if (Date.now() - lastMotionRef.current >= stillDuration) {
                        isMovingRef.current = false;
                        stillTimerRef.current = null;
                        onPutDownRef.current();
                    }
                }, stillDuration);
            }
        },
        [motionThreshold, stillDuration]
    );

    const requestPermission = useCallback(async () => {
        // iOS 13+ 需要用户手势触发权限请求
        if (
            typeof (DeviceMotionEvent as any).requestPermission === 'function'
        ) {
            try {
                const result = await (DeviceMotionEvent as any).requestPermission();
                setPermissionGranted(result === 'granted');
                return result === 'granted';
            } catch {
                setPermissionGranted(false);
                return false;
            }
        }
        // Android 和旧版 iOS 不需要请求权限
        setPermissionGranted(true);
        return true;
    }, []);

    useEffect(() => {
        const available = 'DeviceMotionEvent' in window;
        setSensorAvailable(available);

        if (!available) return;

        window.addEventListener('devicemotion', handleMotion);
        return () => {
            window.removeEventListener('devicemotion', handleMotion);
            if (stillTimerRef.current) {
                clearTimeout(stillTimerRef.current);
            }
        };
    }, [handleMotion]);

    const resetSensor = useCallback(() => {
        isMovingRef.current = false;
        if (stillTimerRef.current) {
            clearTimeout(stillTimerRef.current);
            stillTimerRef.current = null;
        }
    }, []);

    return {
        sensorAvailable,
        permissionGranted,
        requestPermission,
        resetSensor,
    };
}
