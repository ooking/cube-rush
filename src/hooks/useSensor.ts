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
 *
 * 权限逻辑：
 * - 非 iOS 浏览器：DeviceMotionEvent.requestPermission 不存在，直接可用
 * - iOS 13+：需要用户手势触发 requestPermission()，一次授权后永久生效
 * - 自动检测：挂载时即判断权限状态，无需用户手动触发
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

            const magnitude = Math.sqrt(
                (acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2
            );

            const deviation = Math.abs(magnitude - 9.8);

            if (deviation > impactThreshold) {
                const now = Date.now();
                if (now - lastImpactTimeRef.current > cooldownMs) {
                    lastImpactTimeRef.current = now;
                    setLastImpactStrength(parseFloat(deviation.toFixed(1)));
                    onImpactRef.current();
                }
            }
        },
        [impactThreshold, cooldownMs]
    );

    // iOS 手势触发权限请求
    const requestPermission = useCallback(async () => {
        if (
            typeof (DeviceMotionEvent as any).requestPermission === 'function'
        ) {
            try {
                const result = await (DeviceMotionEvent as any).requestPermission();
                const granted = result === 'granted';
                setPermissionGranted(granted);
                return granted;
            } catch {
                setPermissionGranted(false);
                return false;
            }
        }
        // 非 iOS：不需要请求
        setPermissionGranted(true);
        return true;
    }, []);

    useEffect(() => {
        const available = 'DeviceMotionEvent' in window;
        setSensorAvailable(available);

        if (!available) {
            setPermissionGranted(false);
            return;
        }

        // 自动检测权限状态
        if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
            // iOS 13+：需要用户手势触发，先标记为需要请求
            // 但如果之前已经授权，devicemotion 事件会直接触发
            // 我们通过监听事件来探测权限状态
            let detected = false;
            const probe = () => {
                if (!detected) {
                    detected = true;
                    setPermissionGranted(true);
                }
            };
            window.addEventListener('devicemotion', probe);
            // 如果 500ms 内没收到事件，说明需要请求权限
            const timer = setTimeout(() => {
                if (!detected) {
                    setPermissionGranted(false);
                }
                window.removeEventListener('devicemotion', probe);
            }, 500);

            return () => {
                clearTimeout(timer);
                window.removeEventListener('devicemotion', probe);
            };
        } else {
            // 非 iOS：不需要权限，直接可用
            setPermissionGranted(true);
        }
    }, []); // 只在挂载时运行一次

    // 注册实际的 motion 监听
    useEffect(() => {
        if (!sensorAvailable) return;

        window.addEventListener('devicemotion', handleMotion);
        return () => {
            window.removeEventListener('devicemotion', handleMotion);
        };
    }, [sensorAvailable, handleMotion]);

    return {
        sensorAvailable,
        permissionGranted,
        requestPermission,
        lastImpactStrength,
    };
}
