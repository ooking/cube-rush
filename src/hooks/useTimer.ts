import { useState, useRef, useCallback } from 'react';

export type TimerPhase =
    | 'idle'       // 等待中，显示上次成绩
    | 'ready'      // 手放在手机上/正在检测
    | 'running'    // 计时中
    | 'stopped';   // 刚停止

export function useTimer() {
    const [time, setTime] = useState(0);
    const [phase, setPhase] = useState<TimerPhase>('idle');
    const startTimeRef = useRef(0);
    const rafRef = useRef<number>(0);

    const tick = useCallback(() => {
        setTime(performance.now() - startTimeRef.current);
        rafRef.current = requestAnimationFrame(tick);
    }, []);

    const start = useCallback(() => {
        startTimeRef.current = performance.now();
        setTime(0);
        setPhase('running');
        rafRef.current = requestAnimationFrame(tick);
    }, [tick]);

    const stop = useCallback((): number => {
        cancelAnimationFrame(rafRef.current);
        const finalTime = performance.now() - startTimeRef.current;
        setTime(finalTime);
        setPhase('stopped');
        return finalTime;
    }, []);

    const reset = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        setTime(0);
        setPhase('idle');
    }, []);

    const setReady = useCallback(() => {
        setPhase('ready');
    }, []);

    return { time, phase, start, stop, reset, setReady, setPhase };
}
