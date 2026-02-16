/**
 * 将毫秒格式化为 mm:ss.ms 或 ss.ms 格式
 */
export function formatTime(ms: number): string {
    if (ms < 0) ms = 0;

    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);

    const secStr = seconds.toString().padStart(2, '0');
    const csStr = centiseconds.toString().padStart(2, '0');

    if (minutes > 0) {
        return `${minutes}:${secStr}.${csStr}`;
    }
    return `${secStr}.${csStr}`;
}

/**
 * 计算平均值 (去掉最高和最低)
 */
export function calcAverage(times: number[]): number | null {
    if (times.length < 3) return null;
    const sorted = [...times].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

/**
 * 计算最近 N 次的 Average of N
 */
export function calcAoN(times: number[], n: number): number | null {
    if (times.length < n) return null;
    return calcAverage(times.slice(0, n));
}
