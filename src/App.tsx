import { useState, useCallback, useEffect, useRef } from 'react';
import { useTimer } from './hooks/useTimer';
import { useSensor } from './hooks/useSensor';
import { generateScramble } from './utils/scrambleGenerator';
import { formatTime, calcAoN } from './utils/timeFormat';
import './index.css';

interface SolveRecord {
  id: number;
  time: number;
  scramble: string;
  date: number;
}

type InputMode = 'sensor' | 'touch';

const STORAGE_KEY = 'cube-rush-records';

function loadRecords(): SolveRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecords(records: SolveRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export default function App() {
  const [records, setRecords] = useState<SolveRecord[]>(loadRecords);
  const [scramble, setScramble] = useState(generateScramble);
  const [mode, setMode] = useState<InputMode>('touch');
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const { time, phase, start, stop, reset, setReady, setPhase } = useTimer();
  const touchStartRef = useRef(0);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 记录并保存成绩
  const recordSolve = useCallback(
    (solveTime: number) => {
      const record: SolveRecord = {
        id: Date.now(),
        time: solveTime,
        scramble,
        date: Date.now(),
      };
      setRecords((prev) => {
        const next = [record, ...prev];
        saveRecords(next);
        return next;
      });
      setScramble(generateScramble());
    },
    [scramble]
  );

  // 传感器模式的回调
  const handlePickup = useCallback(() => {
    if (phase === 'idle' || phase === 'stopped') {
      start();
    }
  }, [phase, start]);

  const handlePutDown = useCallback(() => {
    if (phase === 'running') {
      const finalTime = stop();
      recordSolve(finalTime);
    }
  }, [phase, stop, recordSolve]);

  const { sensorAvailable, permissionGranted, requestPermission, resetSensor } =
    useSensor(handlePickup, handlePutDown, mode === 'sensor' && phase !== 'ready');

  // 切换到传感器模式时检查权限
  useEffect(() => {
    if (mode === 'sensor' && permissionGranted === null && sensorAvailable) {
      setShowPermissionBanner(true);
    }
  }, [mode, permissionGranted, sensorAvailable]);

  // 触摸模式处理
  const handleTouchStart = useCallback(() => {
    if (mode !== 'touch') return;

    if (phase === 'running') {
      const finalTime = stop();
      recordSolve(finalTime);
      return;
    }

    touchStartRef.current = Date.now();
    readyTimerRef.current = setTimeout(() => {
      setReady();
    }, 300);
  }, [mode, phase, stop, recordSolve, setReady]);

  const handleTouchEnd = useCallback(() => {
    if (mode !== 'touch') return;

    if (readyTimerRef.current) {
      clearTimeout(readyTimerRef.current);
      readyTimerRef.current = null;
    }

    if (phase === 'ready') {
      start();
    } else if (phase === 'stopped') {
      setPhase('idle');
    }
  }, [mode, phase, start, setPhase]);

  // 键盘空格键支持（桌面调试）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      handleTouchStart();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      handleTouchEnd();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleTouchStart, handleTouchEnd]);

  // 请求传感器权限
  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    setShowPermissionBanner(false);
    if (!granted) {
      setMode('touch');
    }
  };

  // 刷新打乱
  const refreshScramble = () => {
    setScramble(generateScramble());
  };

  // 删除单条记录
  const deleteRecord = (id: number) => {
    setRecords((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveRecords(next);
      return next;
    });
  };

  // 清空所有记录
  const clearRecords = () => {
    setRecords([]);
    saveRecords([]);
    reset();
    resetSensor();
  };

  // 切换模式
  const switchMode = (newMode: InputMode) => {
    setMode(newMode);
    reset();
    resetSensor();
    if (newMode === 'sensor' && sensorAvailable && permissionGranted !== true) {
      setShowPermissionBanner(true);
    } else {
      setShowPermissionBanner(false);
    }
  };

  // 统计
  const times = records.map((r) => r.time);
  const bestTime = times.length > 0 ? Math.min(...times) : null;
  const ao5 = calcAoN(times, 5);
  const ao12 = calcAoN(times, 12);

  // 提示文字
  const getHintText = () => {
    if (mode === 'sensor') {
      switch (phase) {
        case 'idle':
        case 'stopped':
          return '拿起手机开始计时';
        case 'running':
          return '放回桌面停止计时';
        default:
          return '';
      }
    }
    switch (phase) {
      case 'idle':
        return '长按屏幕准备，松开开始';
      case 'ready':
        return '松开手指开始计时';
      case 'running':
        return '点击任意位置停止';
      case 'stopped':
        return '点击任意位置继续';
      default:
        return '';
    }
  };

  // 尝试唤醒锁定
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch {
        // 忽略
      }
    };
    requestWakeLock();
    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, []);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1 className="header__title">Cube Rush</h1>
        <div className="mode-toggle">
          <button
            className={`mode-toggle__btn ${mode === 'touch' ? 'mode-toggle__btn--active' : ''}`}
            onClick={() => switchMode('touch')}
          >
            ✋ 触摸
          </button>
          <button
            className={`mode-toggle__btn ${mode === 'sensor' ? 'mode-toggle__btn--active' : ''}`}
            onClick={() => switchMode('sensor')}
          >
            📱 传感器
          </button>
        </div>
      </header>

      {/* Scramble */}
      <section className="scramble">
        <div className="scramble__container">
          <div className="scramble__label">打乱公式</div>
          <div className="scramble__text">{scramble}</div>
          <button className="scramble__refresh" onClick={refreshScramble}>
            🔄 换一个
          </button>
        </div>
      </section>

      {/* Timer Display */}
      <main className="timer-area">
        {mode === 'touch' && phase !== 'running' && (
          <div
            className="touch-zone"
            onPointerDown={handleTouchStart}
            onPointerUp={handleTouchEnd}
          />
        )}
        {mode === 'touch' && phase === 'running' && (
          <div className="touch-zone" onPointerDown={handleTouchStart} />
        )}

        <div className={`timer__time timer__time--${phase}`}>
          {phase === 'ready' ? '准备' : formatTime(time)}
        </div>

        <div className={`timer__hint ${phase === 'ready' ? 'timer__hint--accent' : ''}`}>
          {getHintText()}
        </div>
      </main>

      {/* Stats */}
      <div className="stats">
        <div className="stats__item">
          <div className="stats__label">最佳</div>
          <div className={`stats__value ${bestTime !== null ? 'stats__value--highlight' : ''}`}>
            {bestTime !== null ? formatTime(bestTime) : '--'}
          </div>
        </div>
        <div className="stats__item">
          <div className="stats__label">Ao5</div>
          <div className="stats__value">{ao5 !== null ? formatTime(ao5) : '--'}</div>
        </div>
        <div className="stats__item">
          <div className="stats__label">Ao12</div>
          <div className="stats__value">{ao12 !== null ? formatTime(ao12) : '--'}</div>
        </div>
        <div className="stats__item">
          <div className="stats__label">总次数</div>
          <div className="stats__value">{records.length}</div>
        </div>
      </div>

      {/* History */}
      <section className="history">
        <div className="history__header">
          <span className="history__title">历史记录</span>
          {records.length > 0 && (
            <button className="history__clear" onClick={clearRecords}>
              清空
            </button>
          )}
        </div>

        {records.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🎲</div>
            <span>还没有记录，开始你的第一次还原吧！</span>
          </div>
        ) : (
          <div className="history__list">
            {records.map((record, index) => (
              <div
                key={record.id}
                className={`history__item ${record.time === bestTime ? 'history__item--best' : ''}`}
              >
                <span className="history__index">#{records.length - index}</span>
                <span className="history__time">{formatTime(record.time)}</span>
                <button
                  className="history__delete"
                  onClick={() => deleteRecord(record.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Permission Banner */}
      {showPermissionBanner && (
        <div className="permission-banner">
          <p className="permission-banner__text">
            需要访问运动传感器以检测手机的拾起和放下动作
          </p>
          <button className="permission-banner__btn" onClick={handleRequestPermission}>
            授权传感器
          </button>
        </div>
      )}
    </div>
  );
}
