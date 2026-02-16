import { useEffect, useRef, useCallback, useState } from 'react';

interface SensorConfig {
    /** 冲击检测阈值：加速度偏离重力的最小值 */
    impactThreshold: number;
    /** 冲击后的冷却时间 (ms)，避免一次振动触发多次 */
    cooldownMs: number;
}

const DEFAULT_CONFIG: SensorConfig = {
    impactThreshold: 1.2,
    cooldownMs: 600,
};

/**
 * 传感器 Hook（冲击检测模式）：
 * 
 * 手机平放在桌上，检测加速度的短暂冲击（魔方放上/拿起时的振动）。
 * 每次检测到冲击时触发 onImpact 回调。
 */
export function useSensor(
    onImpact: () => void,
    enabled: boolean,
    config: Partial<SensorConfig> = {}
) {
    const { impactThreshold, cooldownMs } = { ...DEFAULT_CONFIG, ...config };
    const [sensorAvailable, setSensorAvailable] = useState<boolean | null>(null);
    const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
    const [lastImpactStrength, setLastImpactStrength] = useState(0);

    const onImpactRef = useRef(onImpact);
    const enabledRef = useRef(enabled);
    const lastImpactTimeRef = useRef(0);

    onImpactRef.current = onImpact;
    enabledRef.current = enabled;

    const handleMotion = useCallback(
        (event: DeviceMotionEvent) => {
            if (!enabledRef.current) return;

            const acc = event.accelerationIncludingGravity;
            if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

            // 计算加速度总量
            const magnitude = Math.sqrt(
                (acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2
            );

            // 与静止状态（重力≈9.8）的偏差
            const deviation = Math.abs(magnitude - 9.8);

            if (deviation > impactThreshold) {
                const now = Date.now();
                // 冷却时间内不重复触发
                if (now - lastImpactTimeRef.current > cooldownMs) {
                    lastImpactTimeRef.current = now;
                    setLastImpactStrength(parseFloat(deviation.toFixed(1)));
                    onImpactRef.current();
                }
            }
        },
        [impactThreshold, cooldownMs]
    );

    const requestPermission = useCallback(async () => {
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
        };
    }, [handleMotion]);

    return {
        sensorAvailable,
        permissionGranted,
        requestPermission,
        lastImpactStrength,
    };
}
