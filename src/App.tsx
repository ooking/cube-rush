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
  dnf?: boolean;
}

type InputMode = 'stackmat' | 'sensor';

const STORAGE_KEY = 'cube-rush-records';
const MODE_KEY = 'cube-rush-mode';
const HELP_SEEN_KEY = 'cube-rush-help-seen';

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

function loadMode(): InputMode {
  return (localStorage.getItem(MODE_KEY) as InputMode) || 'stackmat';
}

export default function App() {
  const [records, setRecords] = useState<SolveRecord[]>(loadRecords);
  const [scramble, setScramble] = useState(generateScramble);
  const [mode, setMode] = useState<InputMode>(loadMode);
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const [showHelp, setShowHelp] = useState(!localStorage.getItem(HELP_SEEN_KEY));
  const { time, phase, start, stop, reset, setReady, setPhase } = useTimer();
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 传感器模式：是否处于"就绪等待"状态（已停止，需要手动进入下一轮）
  const sensorLockedRef = useRef(false);

  // ── 关闭帮助 ──
  const dismissHelp = () => {
    setShowHelp(false);
    localStorage.setItem(HELP_SEEN_KEY, '1');
  };

  // ── 通用：记录成绩 ──
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
    },
    [scramble]
  );

  // ── 进入下一轮 ──
  const nextRound = useCallback(() => {
    setScramble(generateScramble());
    setPhase('idle');
    reset();
    sensorLockedRef.current = false;
  }, [setPhase, reset]);

  // ── 取消/DNF 当前计时 ──
  const cancelSolve = useCallback(() => {
    stop();
    reset();
    setPhase('idle');
    sensorLockedRef.current = false;
  }, [stop, reset, setPhase]);

  // ── 传感器模式：冲击检测回调 ──
  const handleImpact = useCallback(() => {
    if (mode !== 'sensor') return;
    // 已停止并锁定，不响应冲击，必须手动下一轮
    if (sensorLockedRef.current) return;

    if (phase === 'idle') {
      start();
    } else if (phase === 'running') {
      const finalTime = stop();
      recordSolve(finalTime);
      sensorLockedRef.current = true; // 锁定，防止自动进入下一轮
    }
  }, [mode, phase, start, stop, recordSolve]);

  const { sensorAvailable, permissionGranted, requestPermission, lastImpactStrength } =
    useSensor(handleImpact, mode === 'sensor');

  // ── 切换到传感器模式时检查权限 ──
  useEffect(() => {
    if (mode === 'sensor' && permissionGranted === null && sensorAvailable) {
      setShowPermissionBanner(true);
    }
  }, [mode, permissionGranted, sensorAvailable]);

  // ── Stackmat 触摸模式 ──
  const handleTouchStart = useCallback(
    (e: React.PointerEvent) => {
      if (mode !== 'stackmat') return;
      e.preventDefault();

      if (phase === 'running') {
        // 计时中 → 拍停
        const finalTime = stop();
        recordSolve(finalTime);
        return;
      }

      // 已停止 → 忽略，需要点"下一轮"
      if (phase === 'stopped') return;

      // idle → 按住准备
      readyTimerRef.current = setTimeout(() => {
        setReady();
      }, 400);
    },
    [mode, phase, stop, recordSolve, setReady]
  );

  const handleTouchEnd = useCallback(
    (e: React.PointerEvent) => {
      if (mode !== 'stackmat') return;
      e.preventDefault();

      if (readyTimerRef.current) {
        clearTimeout(readyTimerRef.current);
        readyTimerRef.current = null;
      }

      if (phase === 'ready') {
        start();
      }
    },
    [mode, phase, start]
  );

  // ── 键盘空格 (桌面调试) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (showHelp) return; // 帮助弹窗打开时忽略
      e.preventDefault();

      if (mode === 'stackmat') {
        if (phase === 'running') {
          const finalTime = stop();
          recordSolve(finalTime);
        } else if (phase === 'stopped') {
          // 停止后空格不做任何事
        } else if (phase === 'idle') {
          readyTimerRef.current = setTimeout(() => setReady(), 400);
        }
      } else {
        handleImpact();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (readyTimerRef.current) {
        clearTimeout(readyTimerRef.current);
        readyTimerRef.current = null;
      }
      if (phase === 'ready') start();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [mode, phase, start, stop, recordSolve, setReady, handleImpact, showHelp]);

  // ── 权限 ──
  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    setShowPermissionBanner(false);
    if (!granted) {
      setMode('stackmat');
      localStorage.setItem(MODE_KEY, 'stackmat');
    }
  };

  // ── 模式切换 ──
  const switchMode = (newMode: InputMode) => {
    setMode(newMode);
    localStorage.setItem(MODE_KEY, newMode);
    setPhase('idle');
    reset();
    sensorLockedRef.current = false;
    if (readyTimerRef.current) {
      clearTimeout(readyTimerRef.current);
      readyTimerRef.current = null;
    }
    if (newMode === 'sensor' && sensorAvailable && permissionGranted !== true) {
      setShowPermissionBanner(true);
    } else {
      setShowPermissionBanner(false);
    }
  };

  // ── 打乱 ──
  const refreshScramble = () => setScramble(generateScramble());

  // ── 删除 / 清空 ──
  const deleteRecord = (id: number) => {
    setRecords((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveRecords(next);
      return next;
    });
  };
  const clearRecords = () => {
    setRecords([]);
    saveRecords([]);
    setPhase('idle');
    reset();
    sensorLockedRef.current = false;
  };

  // ── 统计 ──
  const times = records.filter((r) => !r.dnf).map((r) => r.time);
  const bestTime = times.length > 0 ? Math.min(...times) : null;
  const ao5 = calcAoN(times, 5);
  const ao12 = calcAoN(times, 12);

  // ── 提示文案 ──
  const getHintText = () => {
    if (mode === 'sensor') {
      switch (phase) {
        case 'idle':
          return '轻拍手机或拿起魔方 → 开始计时';
        case 'running':
          return '还原后轻拍手机 → 停止计时';
        case 'stopped':
          return '';
        default:
          return '';
      }
    }
    switch (phase) {
      case 'idle':
        return '按住屏幕准备';
      case 'ready':
        return '松开手指 → 开始计时';
      case 'running':
        return '还原后拍一下屏幕停止';
      case 'stopped':
        return '';
      default:
        return '';
    }
  };

  // ── 唤醒锁定 ──
  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch { /* 忽略 */ }
    };
    requestWakeLock();
    return () => { if (wakeLock) wakeLock.release(); };
  }, []);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1 className="header__title">Cube Rush</h1>
        <div className="header__actions">
          <button className="header__help-btn" onClick={() => setShowHelp(true)}>
            ?
          </button>
          <div className="mode-toggle">
            <button
              className={`mode-toggle__btn ${mode === 'stackmat' ? 'mode-toggle__btn--active' : ''}`}
              onClick={() => switchMode('stackmat')}
            >
              🤚 Stackmat
            </button>
            <button
              className={`mode-toggle__btn ${mode === 'sensor' ? 'mode-toggle__btn--active' : ''}`}
              onClick={() => switchMode('sensor')}
            >
              📱 传感器
            </button>
          </div>
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
        {/* Stackmat 触摸区：只在 idle 和 running 时激活 */}
        {mode === 'stackmat' && (phase === 'idle' || phase === 'ready' || phase === 'running') && (
          <div
            className="touch-zone"
            onPointerDown={handleTouchStart}
            onPointerUp={handleTouchEnd}
          />
        )}

        <div className={`timer__time timer__time--${phase}`}>
          {phase === 'ready' ? '准备' : formatTime(time)}
        </div>

        <div className={`timer__hint ${phase === 'ready' ? 'timer__hint--accent' : ''}`}>
          {getHintText()}
        </div>

        {/* 计时中：取消按钮 */}
        {phase === 'running' && (
          <button className="action-btn action-btn--cancel" onClick={cancelSolve}>
            ✕ 取消本次
          </button>
        )}

        {/* 停止后：操作按钮区 */}
        {phase === 'stopped' && (
          <div className="stopped-actions">
            <button className="action-btn action-btn--next" onClick={nextRound}>
              ▶ 下一轮
            </button>
            <button
              className="action-btn action-btn--delete"
              onClick={() => {
                // 删除最近一条记录
                if (records.length > 0) {
                  deleteRecord(records[0].id);
                }
                nextRound();
              }}
            >
              🗑 删除此次
            </button>
          </div>
        )}

        {/* 传感器模式冲击指示 */}
        {mode === 'sensor' && lastImpactStrength > 0 && phase === 'running' && (
          <span className="sensor-info__strength">
            冲击: {lastImpactStrength}g
          </span>
        )}
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
                <button className="history__delete" onClick={() => deleteRecord(record.id)}>
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
            需要访问运动传感器以检测魔方放置和拿起时的振动
          </p>
          <button className="permission-banner__btn" onClick={handleRequestPermission}>
            授权传感器
          </button>
        </div>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="help-overlay" onClick={dismissHelp}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-modal__header">
              <h2 className="help-modal__title">使用说明</h2>
              <button className="help-modal__close" onClick={dismissHelp}>✕</button>
            </div>

            <div className="help-modal__content">
              <div className="help-section">
                <h3 className="help-section__title">🤚 Stackmat 模式</h3>
                <div className="help-steps">
                  <div className="help-step">
                    <span className="help-step__num">1</span>
                    <span>按照打乱公式打乱魔方</span>
                  </div>
                  <div className="help-step">
                    <span className="help-step__num">2</span>
                    <span><strong>按住屏幕</strong>不放，等待显示"准备"</span>
                  </div>
                  <div className="help-step">
                    <span className="help-step__num">3</span>
                    <span><strong>松开手指</strong>，计时开始，拿起魔方还原</span>
                  </div>
                  <div className="help-step">
                    <span className="help-step__num">4</span>
                    <span>还原后<strong>拍一下屏幕</strong>停止计时</span>
                  </div>
                  <div className="help-step">
                    <span className="help-step__num">5</span>
                    <span>点击 <strong>▶ 下一轮</strong> 继续</span>
                  </div>
                </div>
              </div>

              <div className="help-section">
                <h3 className="help-section__title">📱 传感器模式</h3>
                <div className="help-steps">
                  <div className="help-step">
                    <span className="help-step__num">1</span>
                    <span>手机<strong>平放桌上</strong>，魔方放在旁边</span>
                  </div>
                  <div className="help-step">
                    <span className="help-step__num">2</span>
                    <span><strong>轻拍手机</strong>或拿起魔方（振动触发），计时开始</span>
                  </div>
                  <div className="help-step">
                    <span className="help-step__num">3</span>
                    <span>还原后<strong>再次轻拍手机</strong>停止计时</span>
                  </div>
                  <div className="help-step">
                    <span className="help-step__num">4</span>
                    <span>点击 <strong>▶ 下一轮</strong> 继续</span>
                  </div>
                </div>
                <p className="help-note">⚠️ 传感器模式需要 HTTPS 环境</p>
              </div>

              <div className="help-section">
                <h3 className="help-section__title">💡 其他操作</h3>
                <div className="help-steps">
                  <div className="help-step">
                    <span className="help-step__num">✕</span>
                    <span>计时中点击 <strong>✕ 取消本次</strong> 可放弃当前还原</span>
                  </div>
                  <div className="help-step">
                    <span className="help-step__num">🗑</span>
                    <span>停止后点击 <strong>🗑 删除此次</strong> 可删除本次成绩</span>
                  </div>
                </div>
              </div>
            </div>

            <button className="help-modal__ok" onClick={dismissHelp}>
              知道了！
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
