import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Play, Pause, RotateCcw, SkipForward, CheckCircle2, Loader2, 
  HardDrive, Database, Gauge, Plus, X, StepForward,
  BarChart2, FlaskConical, Trophy, TrendingDown, TrendingUp, AlertCircle
} from 'lucide-react';

const DEFAULT_HDD = {
  requests: '93,45,1950,912,1090,130,10,2250',
  head: 93,
  maxCylinder: 2250,
  direction: 'left',
  nStep: 3,
  deadlines: '5,10,15,20,25,30,35,40',
  priorities: '2,1,3,2,1,3,2,1',
  anticipatoryWindow: 50
};

const DEFAULT_SSD = [
  { id: 'R1', arrivalTime: 0, type: 'read', size: 4, processId: 'P1', priority: 'high', deadline: 10 },
  { id: 'R2', arrivalTime: 1, type: 'write', size: 8, processId: 'P2', priority: 'low', deadline: 20 },
  { id: 'R3', arrivalTime: 2, type: 'read', size: 2, processId: 'P1', priority: 'high', deadline: 15 },
  { id: 'R4', arrivalTime: 3, type: 'write', size: 4, processId: 'P3', priority: 'medium', deadline: 25 }
];

const HDD_NAMES = {
  fcfs: '1. FCFS',
  sstf: '2. SSTF',
  scan: '3. SCAN',
  cscan: '4. C-SCAN',
  look: '5. LOOK',
  clook: '6. C-LOOK',
  nstep: '7. N-Step SCAN',
  fscan: '8. FSCAN',
  edf: '9. EDF',
  fdscan: '10. FD-SCAN',
  priority: '11. Priority SCAN',
  anticipatory: '12. Anticipatory'
};

const SSD_NAMES = {
  noop: '1. NOOP (FIFO)',
  mqdeadline: '2. MQ-Deadline',
  bfq: '3. BFQ',
  kyber: '4. Kyber'
};

const SPEED_PRESETS = { snail: 1800, slow: 1100, normal: 650, fast: 280 };

// HDD algorithm metadata for analysis
const HDD_META = {
  fcfs:        { full: 'First Come First Served',       strength: 'Simple, fair, no starvation',           weakness: 'High seek time, no optimization' },
  sstf:        { full: 'Shortest Seek Time First',      strength: 'Low avg seek time',                     weakness: 'Starvation of distant requests' },
  scan:        { full: 'SCAN (Elevator)',                strength: 'Fair, predictable, no starvation',      weakness: 'Far-end requests wait longer' },
  cscan:       { full: 'Circular SCAN',                 strength: 'Uniform wait time',                     weakness: 'Wastes time on empty cylinder end' },
  look:        { full: 'LOOK',                          strength: 'Like SCAN but avoids empty travel',      weakness: 'Slight unfairness at extremes' },
  clook:       { full: 'C-LOOK',                        strength: 'Uniform wait, no wasted travel',        weakness: 'Jump-back overhead' },
  nstep:       { full: 'N-Step SCAN',                   strength: 'Prevents indefinite postponement',      weakness: 'Batch size tuning required' },
  fscan:       { full: 'FSCAN',                         strength: 'Freezes new requests mid-sweep',        weakness: 'Increased latency for new arrivals' },
  edf:         { full: 'Earliest Deadline First',       strength: 'Meets real-time deadlines',             weakness: 'Ignores seek distance, can thrash' },
  fdscan:      { full: 'Feedback SCAN',                 strength: 'Adapts speed to load',                  weakness: 'Heuristic, less predictable' },
  priority:    { full: 'Priority SCAN',                 strength: 'Serves critical requests first',        weakness: 'Low-priority starvation risk' },
  anticipatory:{ full: 'Anticipatory Scheduling',       strength: 'Reduces seek thrash on locality',       weakness: 'Wait window adds latency' },
};

const SSD_META = {
  noop:       { full: 'NOOP / FIFO',       strength: 'Minimal CPU overhead, suits SSDs',           weakness: 'No ordering optimization' },
  mqdeadline: { full: 'MQ-Deadline',       strength: 'Deadline enforcement, read priority',        weakness: 'Complex tuning for mixed loads' },
  bfq:        { full: 'Budget Fair Queuing',strength: 'Fair per-process bandwidth',                weakness: 'Higher latency, complex implementation' },
  kyber:      { full: 'Kyber',             strength: 'Low-latency reads, bounded write batching',  weakness: 'Less suitable for write-heavy loads' },
};

// HDDChart  (unchanged from original)
function HDDChart({ sequence, maxCylinder, totalSteps, isActive }) {
  if (!sequence || sequence.length < 1) return null;
  const width = 320, height = 176, padding = 30;
  const max = maxCylinder || Math.max(...sequence, 1);
  const chartW = width - 2 * padding, chartH = height - 2 * padding;
  const denom = Math.max((totalSteps || sequence.length) - 1, 1);
  const points = sequence.map((val, idx) => ({
    x: padding + (idx / denom) * chartW,
    y: height - padding - (val / max) * chartH,
    val
  }));
  const lastIdx = points.length - 1;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="axis-line" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="axis-line" />
      {points.map((p, idx) => {
        if (idx === 0) return null;
        const prev = points[idx - 1];
        const len = Math.max(Math.hypot(p.x - prev.x, p.y - prev.y), 0.01);
        return <line key={`seg-${idx}`} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y} className="chart-segment" style={{ strokeDasharray: len, strokeDashoffset: len }} />;
      })}
      {points.map((p, idx) => (
        <g key={`pt-${idx}`} className="chart-point">
          <circle cx={p.x} cy={p.y} r="3.6" className="chart-dot" />
          <text x={p.x} y={p.y - 9} className="chart-label">{p.val}</text>
        </g>
      ))}
      {isActive && (
        <g className="seek-head" style={{ transform: `translate(${points[lastIdx].x}px, ${points[lastIdx].y}px)` }}>
          <circle r="8" className="seek-ring" />
          <path d="M0,-5 L5,0 L0,5 L-5,0 Z" className="seek-diamond" />
        </g>
      )}
      <text x={width / 2} y={height - 7} className="axis-caption">step →</text>
      <text x={11} y={height / 2} className="axis-caption" transform={`rotate(-90, 11, ${height / 2})`}>cylinder</text>
    </svg>
  );
}


// SSDGantt  (unchanged from original)
function SSDGantt({ schedule, fullMaxEnd }) {
  if (!schedule || schedule.length === 0) {
    return (
      <div className="gantt-empty">
        <Loader2 size={14} className="spin" /> waiting for first request…
      </div>
    );
  }
  const maxEnd = fullMaxEnd || Math.max(...schedule.map(s => s.endTime)) || 1;
  const width = 320, rowHeight = 30, barHeight = 18, leftMargin = 46;
  const chartW = width - leftMargin - 10;
  const bottom = schedule.length * rowHeight + 26;
  return (
    <svg viewBox={`0 0 ${width} ${bottom + 16}`} className="chart-svg">
      {schedule.map((s, i) => {
        const x = leftMargin + (s.startTime / maxEnd) * chartW;
        const w = Math.max(((s.endTime - s.startTime) / maxEnd) * chartW, 2);
        const cls = s.type === 'read' ? 'bar-read' : 'bar-write';
        return (
          <g key={i} className="gantt-row" transform={`translate(0, ${i * rowHeight + 14})`}>
            <text x={2} y={14} className="gantt-id">{s.id}</text>
            <rect x={x} y={2} width={w} height={barHeight} rx="3" className={`gantt-bar ${cls}`} />
            <text x={x + w / 2} y={14} className="gantt-duration">{s.endTime - s.startTime}</text>
          </g>
        );
      })}
      <line x1={leftMargin} y1={bottom} x2={width - 10} y2={bottom} className="axis-line" />
      <text x={leftMargin} y={bottom + 12} className="axis-caption-sm">0</text>
      <text x={width - 12} y={bottom + 12} textAnchor="end" className="axis-caption-sm">{maxEnd}</text>
    </svg>
  );
}

function StatusPill({ done }) {
  return done ? (
    <span className="status-pill done"><CheckCircle2 size={13} /> done</span>
  ) : (
    <span className="status-pill running"><span className="led" /> running</span>
  );
}

function HDDResultCard({ name, data, stepIndex, maxCylinder }) {
  const visibleRows = Math.min(stepIndex, data.table.length);
  const isDone = visibleRows >= data.table.length;
  const visibleSeq = data.sequence.slice(0, visibleRows + 1);
  const runningTotal = data.table.slice(0, visibleRows).reduce((acc, r) => acc + r.distance, 0);
  return (
    <div className={`card ${isDone ? 'card-done' : 'card-active'}`}>
      <div className="card-header">
        <h3>{name}</h3>
        <StatusPill done={isDone} />
      </div>
      <div className="table-wrap">
        <table className="result-table">
          <thead><tr><th>Start</th><th>End</th><th>Distance</th></tr></thead>
          <tbody>
            {visibleRows === 0 && <tr className="row-pending"><td colSpan="3">waiting to start…</td></tr>}
            {data.table.slice(0, visibleRows).map((row, i) => (
              <tr key={i} className={i === visibleRows - 1 && !isDone ? 'row-active' : 'row-settled'}>
                <td>{row.start}</td><td>{row.end}</td><td>{row.distance}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan="2"><strong>Total</strong></td>
              <td><strong>{isDone ? data.total : runningTotal}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="chart-wrap">
        <HDDChart sequence={visibleSeq} maxCylinder={maxCylinder} totalSteps={data.sequence.length} isActive={!isDone} />
      </div>
      {data.speedMode && <div className="badge">speed mode: {data.speedMode}</div>}
    </div>
  );
}

function SSDCard({ name, data, stepIndex }) {
  const visibleCount = Math.min(stepIndex, data.schedule.length);
  const isDone = visibleCount >= data.schedule.length;
  const visibleSchedule = data.schedule.slice(0, visibleCount);
  const hasStatus = !!data.schedule[0]?.status;
  const totalWaitSoFar = visibleSchedule.reduce((a, r) => a + r.waitTime, 0);
  const avgTatSoFar = visibleSchedule.length
    ? visibleSchedule.reduce((a, r) => a + r.turnaroundTime, 0) / visibleSchedule.length : 0;
  const fullMaxEnd = Math.max(...data.schedule.map(s => s.endTime)) || 1;
  return (
    <div className={`card ${isDone ? 'card-done' : 'card-active'}`}>
      <div className="card-header">
        <h3>{name}</h3>
        <StatusPill done={isDone} />
      </div>
      <div className="table-wrap">
        <table className="result-table">
          <thead>
            <tr>
              <th>ID</th><th>Type</th><th>Arrival</th><th>Start</th><th>End</th><th>Wait</th><th>TAT</th>
              {hasStatus && <th>Status</th>}
            </tr>
          </thead>
          <tbody>
            {visibleCount === 0 && <tr className="row-pending"><td colSpan={hasStatus ? 8 : 7}>waiting to start…</td></tr>}
            {visibleSchedule.map((row, i) => (
              <tr key={i} className={i === visibleCount - 1 && !isDone ? 'row-active' : 'row-settled'}>
                <td>{row.id}</td>
                <td className={`type-${row.type}`}>{row.type}</td>
                <td>{row.arrivalTime}</td><td>{row.startTime}</td><td>{row.endTime}</td>
                <td>{row.waitTime}</td><td>{row.turnaroundTime}</td>
                {row.status && <td><span className={`badge-pill badge-${row.status}`}>{row.status}</span></td>}
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan="5"><strong>Total Wait / Avg TAT</strong></td>
              <td><strong>{isDone ? data.totalWait : totalWaitSoFar}</strong></td>
              <td><strong>{(isDone ? data.avgTurnaround : avgTatSoFar).toFixed(2)}</strong></td>
              {hasStatus && <td></td>}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="chart-wrap">
        <SSDGantt schedule={visibleSchedule} fullMaxEnd={fullMaxEnd} />
      </div>
    </div>
  );
}

//Mini horizontal bar chart for analysis
function MiniBar({ value, max, color, best }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <div style={{ flex: 1, background: 'var(--surface-alt)', borderRadius: 6, height: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: best ? 'var(--done)' : color, borderRadius: 6, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: best ? 'var(--done)' : 'var(--ink)', fontWeight: best ? 700 : 400, minWidth: 40, textAlign: 'right' }}>{value}</span>
      {best && <Trophy size={13} color="var(--done)" />}
    </div>
  );
}

// HDD Analysis Tab
function HDDAnalysis({ results }) {
  const hddData = results?.hdd;
  if (!hddData) return null;

  const entries = Object.entries(HDD_NAMES).map(([key, name]) => {
    const d = hddData[key];
    return { key, name, total: d?.total ?? 0, steps: d?.sequence?.length ?? 0 };
  });

  const maxTotal = Math.max(...entries.map(e => e.total));
  const minTotal = Math.min(...entries.map(e => e.total));
  const sorted = [...entries].sort((a, b) => a.total - b.total);
  const winner = sorted[0];
  const worst = sorted[sorted.length - 1];
  const avgTotal = Math.round(entries.reduce((s, e) => s + e.total, 0) / entries.length);
  const saving = worst.total > 0 ? Math.round(((worst.total - winner.total) / worst.total) * 100) : 0;

  return (
    <div className="analysis-section">
      {/* Summary cards */}
      <div className="analysis-kpi-row">
        <div className="kpi-card kpi-best">
          <Trophy size={18} />
          <div>
            <div className="kpi-label">Best Algorithm</div>
            <div className="kpi-value">{winner.name}</div>
            <div className="kpi-sub">{winner.total} total seek distance</div>
          </div>
        </div>
        <div className="kpi-card kpi-worst">
          <TrendingUp size={18} />
          <div>
            <div className="kpi-label">Worst Algorithm</div>
            <div className="kpi-value">{worst.name}</div>
            <div className="kpi-sub">{worst.total} total seek distance</div>
          </div>
        </div>
        <div className="kpi-card kpi-neutral">
          <BarChart2 size={18} />
          <div>
            <div className="kpi-label">Average Seek Distance</div>
            <div className="kpi-value">{avgTotal}</div>
            <div className="kpi-sub">across 12 algorithms</div>
          </div>
        </div>
        <div className="kpi-card kpi-saving">
          <TrendingDown size={18} />
          <div>
            <div className="kpi-label">Best vs Worst Saving</div>
            <div className="kpi-value">{saving}%</div>
            <div className="kpi-sub">fewer cylinders traversed</div>
          </div>
        </div>
      </div>

      {/* Bar comparison */}
      <div className="analysis-card">
        <div className="analysis-card-title"><BarChart2 size={15} /> Seek Distance Comparison (lower is better)</div>
        <div className="bar-compare-list">
          {sorted.map(e => (
            <div key={e.key} className="bar-compare-row">
              <div className="bar-algo-name">{e.name}</div>
              <MiniBar value={e.total} max={maxTotal} color="var(--accent)" best={e.key === winner.key} />
            </div>
          ))}
        </div>
      </div>

      {/* Ranked table */}
      <div className="analysis-card">
        <div className="analysis-card-title"><Trophy size={15} /> Full Ranking</div>
        <table className="analysis-table">
          <thead>
            <tr><th>Rank</th><th>Algorithm</th><th>Full Name</th><th>Seek Distance</th><th>Steps</th><th>vs Best</th></tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => {
              const delta = e.total - winner.total;
              const pctWorse = winner.total > 0 ? ((delta / winner.total) * 100).toFixed(1) : '0.0';
              return (
                <tr key={e.key} className={i === 0 ? 'rank-best-row' : i === sorted.length - 1 ? 'rank-worst-row' : ''}>
                  <td className="rank-num">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </td>
                  <td><strong>{e.name}</strong></td>
                  <td style={{ color: 'var(--ink-dim)', fontSize: 12 }}>{HDD_META[e.key]?.full}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{e.total}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{e.steps}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: delta === 0 ? 'var(--done)' : 'var(--ink-dim)' }}>
                    {delta === 0 ? '—' : `+${delta} (+${pctWorse}%)`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="analysis-card">
        <div className="analysis-card-title"><FlaskConical size={15} /> Algorithm Characteristics</div>
        <div className="char-grid">
          {Object.entries(HDD_META).map(([key, meta]) => {
            const d = hddData[key];
            const total = d?.total ?? 0;
            const isBest = key === winner.key;
            return (
              <div key={key} className={`char-card ${isBest ? 'char-card-best' : ''}`}>
                <div className="char-card-top">
                  <span className="char-name">{HDD_NAMES[key]}</span>
                  {isBest && <span className="char-winner-badge">Best</span>}
                  <span className="char-total">{total}</span>
                </div>
                <div className="char-full">{meta.full}</div>
                <div className="char-row char-strength">{meta.strength}</div>
                <div className="char-row char-weakness">{meta.weakness}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Use-case recommendation */}
      <div className="analysis-card">
        <div className="analysis-card-title">💡 When to Use Which</div>
        <div className="recommendation-grid">
          <div className="rec-item"><strong>General purpose, low traffic</strong><span>SSTF or LOOK</span></div>
          <div className="rec-item"><strong>High throughput, fairness needed</strong><span>C-LOOK or SCAN</span></div>
          <div className="rec-item"><strong>Real-time / deadline-constrained</strong><span>EDF</span></div>
          <div className="rec-item"><strong>Mixed priority workloads</strong><span>Priority SCAN</span></div>
          <div className="rec-item"><strong>Burst-heavy traffic</strong><span>N-Step SCAN or FSCAN</span></div>
          <div className="rec-item"><strong>Locality-heavy sequential IO</strong><span>Anticipatory</span></div>
        </div>
      </div>
    </div>
  );
}

// SSD Analysis Tab
function SSDAnalysis({ results }) {
  const ssdData = results?.ssd;
  if (!ssdData) return null;

  const entries = Object.entries(SSD_NAMES).map(([key, name]) => {
    const d = ssdData[key];
    return { key, name, totalWait: d?.totalWait ?? 0, avgTat: d?.avgTurnaround ?? 0 };
  });

  const minWait = Math.min(...entries.map(e => e.totalWait));
  const maxWait = Math.max(...entries.map(e => e.totalWait));
  const minTat  = Math.min(...entries.map(e => e.avgTat));
  const bestWait = entries.find(e => e.totalWait === minWait);
  const bestTat  = entries.find(e => e.avgTat  === minTat);
  const sortedByWait = [...entries].sort((a, b) => a.totalWait - b.totalWait);

  return (
    <div className="analysis-section">
      {/* KPIs */}
      <div className="analysis-kpi-row">
        <div className="kpi-card kpi-best">
          <Trophy size={18} />
          <div>
            <div className="kpi-label">Lowest Total Wait</div>
            <div className="kpi-value">{bestWait?.name}</div>
            <div className="kpi-sub">wait = {bestWait?.totalWait}</div>
          </div>
        </div>
        <div className="kpi-card kpi-neutral">
          <TrendingDown size={18} />
          <div>
            <div className="kpi-label">Best Avg Turnaround</div>
            <div className="kpi-value">{bestTat?.name}</div>
            <div className="kpi-sub">avg TAT = {bestTat?.avgTat.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Bar comparison — wait */}
      <div className="analysis-card">
        <div className="analysis-card-title"><BarChart2 size={15} /> Total Wait Time Comparison (lower is better)</div>
        <div className="bar-compare-list">
          {sortedByWait.map(e => (
            <div key={e.key} className="bar-compare-row">
              <div className="bar-algo-name">{e.name}</div>
              <MiniBar value={e.totalWait} max={maxWait} color="var(--write)" best={e.key === bestWait?.key} />
            </div>
          ))}
        </div>
      </div>

      {/* Bar comparison — TAT */}
      <div className="analysis-card">
        <div className="analysis-card-title"><BarChart2 size={15} /> Avg Turnaround Time Comparison (lower is better)</div>
        <div className="bar-compare-list">
          {[...entries].sort((a, b) => a.avgTat - b.avgTat).map(e => (
            <div key={e.key} className="bar-compare-row">
              <div className="bar-algo-name">{e.name}</div>
              <MiniBar value={parseFloat(e.avgTat.toFixed(2))} max={Math.max(...entries.map(x => x.avgTat))} color="var(--accent)" best={e.key === bestTat?.key} />
            </div>
          ))}
        </div>
      </div>

      {/* Full table */}
      <div className="analysis-card">
        <div className="analysis-card-title"><Trophy size={15} /> Full Comparison Table</div>
        <table className="analysis-table">
          <thead>
            <tr><th>Algorithm</th><th>Full Name</th><th>Total Wait</th><th>Avg TAT</th><th>vs Best Wait</th></tr>
          </thead>
          <tbody>
            {sortedByWait.map((e, i) => {
              const delta = e.totalWait - minWait;
              return (
                <tr key={e.key} className={i === 0 ? 'rank-best-row' : i === sortedByWait.length - 1 ? 'rank-worst-row' : ''}>
                  <td><strong>{i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : ''}{e.name}</strong></td>
                  <td style={{ color: 'var(--ink-dim)', fontSize: 12 }}>{SSD_META[e.key]?.full}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{e.totalWait}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{e.avgTat.toFixed(2)}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: delta === 0 ? 'var(--done)' : 'var(--ink-dim)' }}>
                    {delta === 0 ? '—' : `+${delta}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Characteristics */}
      <div className="analysis-card">
        <div className="analysis-card-title"><FlaskConical size={15} /> Algorithm Characteristics</div>
        <div className="char-grid char-grid-ssd">
          {Object.entries(SSD_META).map(([key, meta]) => {
            const d = ssdData[key];
            const isBest = key === bestWait?.key;
            return (
              <div key={key} className={`char-card ${isBest ? 'char-card-best' : ''}`}>
                <div className="char-card-top">
                  <span className="char-name">{SSD_NAMES[key]}</span>
                  {isBest && <span className="char-winner-badge">Best Wait</span>}
                </div>
                <div className="char-full">{meta.full}</div>
                <div className="char-row char-strength">✅ {meta.strength}</div>
                <div className="char-row char-weakness">⚠️ {meta.weakness}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      <div className="analysis-card">
        <div className="analysis-card-title">💡 When to Use Which</div>
        <div className="recommendation-grid">
          <div className="rec-item"><strong>NVMe / low-latency SSD</strong><span>NOOP or Kyber</span></div>
          <div className="rec-item"><strong>Mixed read-write workloads</strong><span>MQ-Deadline</span></div>
          <div className="rec-item"><strong>Multi-process fairness</strong><span>BFQ</span></div>
          <div className="rec-item"><strong>Deadline-sensitive writes</strong><span>MQ-Deadline</span></div>
        </div>
      </div>
    </div>
  );
}

// Main App
export default function App() {
  const [activeTab, setActiveTab] = useState('simulation');
  const [hdd, setHdd] = useState(DEFAULT_HDD);
  const [ssdRequests, setSsdRequests] = useState(DEFAULT_SSD);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const [stepIndex, setStepIndex] = useState(0);
  const [maxSteps, setMaxSteps] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [speed, setSpeed] = useState('normal');

  const simulationComplete = results && stepIndex >= maxSteps;

  const handleHddChange = (field, value) => setHdd(p => ({ ...p, [field]: value }));

  const handleSsdChange = (i, field, value) => {
    const upd = [...ssdRequests];
    upd[i] = { ...upd[i], [field]: value };
    setSsdRequests(upd);
  };

  const addSsd = () => setSsdRequests([...ssdRequests, {
    id: `R${ssdRequests.length + 1}`, arrivalTime: 0, type: 'read', size: 4, processId: 'P1', priority: 'medium', deadline: 30
  }]);

  const removeSsd = (i) => {
    if (ssdRequests.length <= 1) return;
    setSsdRequests(ssdRequests.filter((_, idx) => idx !== i));
  };

  const computeMaxSteps = (data) => {
    let m = 0;
    Object.values(data.hdd || {}).forEach(d => { if (d?.table) m = Math.max(m, d.table.length); });
    Object.values(data.ssd || {}).forEach(d => { if (d?.schedule) m = Math.max(m, d.schedule.length); });
    return m;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setResults(null);
    setAnimating(false);
    setStepIndex(0);
    setActiveTab('simulation');
    try {
      const payload = {
        hdd: {
          requests: hdd.requests.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
          head: parseInt(hdd.head),
          maxCylinder: parseInt(hdd.maxCylinder),
          direction: hdd.direction,
          nStep: parseInt(hdd.nStep) || 3,
          deadlines: hdd.deadlines.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
          priorities: hdd.priorities.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
          anticipatoryWindow: parseInt(hdd.anticipatoryWindow) || 50
        },
        ssd: { requests: ssdRequests }
      };
      const res = await fetch('http://localhost:5000/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setResults(data);
      setMaxSteps(computeMaxSteps(data));
      setStepIndex(0);
      setAnimating(true);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!animating) return;
    if (stepIndex >= maxSteps) { setAnimating(false); return; }
    const t = setTimeout(() => setStepIndex(s => s + 1), SPEED_PRESETS[speed]);
    return () => clearTimeout(t);
  }, [animating, stepIndex, maxSteps, speed]);

  const togglePlayPause = () => setAnimating(a => !a);
  const handleReplay = () => { setStepIndex(0); setAnimating(true); };
  const handleSkip = () => { setStepIndex(maxSteps); setAnimating(false); };
  const handleStepForward = () => {
    if (stepIndex < maxSteps) {
      setStepIndex(s => s + 1);
      if (animating) setAnimating(false);
    }
  };

  const progressPct = maxSteps > 0 ? (Math.min(stepIndex, maxSteps) / maxSteps) * 100 : 0;

  return (
    <div className="app">
      <style>{STYLES}</style>

      <header className="app-header">
        <div className="title-row">
          <Gauge size={26} />
          <div>
            <h1>Disk Scheduling Simulator</h1>
            <p>12 HDD algorithms + 4 SSD algorithms</p>
          </div>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'simulation' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('simulation')}
        >
          <Play size={14} /> Simulation
        </button>
        <button
          className={`tab-btn ${activeTab === 'analysis' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          <BarChart2 size={14} /> Analysis &amp; Comparison
          {simulationComplete && <span className="tab-badge">Ready</span>}
        </button>
      </div>

      {/* SIMULATION TAB */}
      {activeTab === 'simulation' && (
        <>
          <div className="input-section">
            <div className="panel">
              <h2><HardDrive size={17} /> HDD Input</h2>
              <div className="form-grid">
                <div className="field span-2">
                  <label>Requests <span className="hint">comma separated cylinder numbers</span></label>
                  <input type="text" value={hdd.requests} onChange={e => handleHddChange('requests', e.target.value)} />
                </div>
                <div className="field">
                  <label>Head Position</label>
                  <input type="number" value={hdd.head} onChange={e => handleHddChange('head', e.target.value)} />
                </div>
                <div className="field">
                  <label>Max Cylinder</label>
                  <input type="number" value={hdd.maxCylinder} onChange={e => handleHddChange('maxCylinder', e.target.value)} />
                </div>
                <div className="field">
                  <label>Direction</label>
                  <select value={hdd.direction} onChange={e => handleHddChange('direction', e.target.value)}>
                    <option value="left">Left / Down</option>
                    <option value="right">Right / Up</option>
                  </select>
                </div>
                <div className="field">
                  <label>N-Step Size</label>
                  <input type="number" value={hdd.nStep} onChange={e => handleHddChange('nStep', e.target.value)} />
                </div>
                <div className="field span-2">
                  <label>Deadlines <span className="hint">comma separated, one per request</span></label>
                  <input type="text" value={hdd.deadlines} onChange={e => handleHddChange('deadlines', e.target.value)} />
                </div>
                <div className="field span-2">
                  <label>Priorities <span className="hint">comma separated, one per request</span></label>
                  <input type="text" value={hdd.priorities} onChange={e => handleHddChange('priorities', e.target.value)} />
                </div>
                <div className="field">
                  <label>Anticipatory Window</label>
                  <input type="number" value={hdd.anticipatoryWindow} onChange={e => handleHddChange('anticipatoryWindow', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="panel">
              <h2><Database size={17} /> SSD Input</h2>
              <div className="ssd-table-wrap">
                <table className="ssd-input-table">
                  <thead>
                    <tr><th>ID</th><th>Arrival</th><th>Type</th><th>Size</th><th>Process</th><th>Priority</th><th>Deadline</th><th></th></tr>
                  </thead>
                  <tbody>
                    {ssdRequests.map((req, i) => (
                      <tr key={i}>
                        <td><input value={req.id} onChange={e => handleSsdChange(i, 'id', e.target.value)} /></td>
                        <td><input type="number" value={req.arrivalTime} onChange={e => handleSsdChange(i, 'arrivalTime', parseInt(e.target.value) || 0)} /></td>
                        <td>
                          <select value={req.type} onChange={e => handleSsdChange(i, 'type', e.target.value)}>
                            <option value="read">Read</option>
                            <option value="write">Write</option>
                          </select>
                        </td>
                        <td><input type="number" value={req.size} onChange={e => handleSsdChange(i, 'size', parseInt(e.target.value) || 0)} /></td>
                        <td><input value={req.processId} onChange={e => handleSsdChange(i, 'processId', e.target.value)} /></td>
                        <td><input value={req.priority} onChange={e => handleSsdChange(i, 'priority', e.target.value)} /></td>
                        <td><input type="number" value={req.deadline} onChange={e => handleSsdChange(i, 'deadline', parseInt(e.target.value) || 0)} /></td>
                        <td><button className="btn-icon btn-danger" onClick={() => removeSsd(i)} title="Remove"><X size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn-small" onClick={addSsd}><Plus size={14} /> Add Request</button>
            </div>
          </div>

          <div className="actions">
            <button className="btn-primary" onClick={handleSubmit} disabled={loading || animating}>
              {loading ? <><Loader2 size={16} className="spin" /> Running Simulation…</> : <><Play size={16} /> Run Simulation</>}
            </button>
          </div>

          {results && (
            <div className="progress-panel">
              <div className="progress-info">
                <span className="progress-count">Step {Math.min(stepIndex, maxSteps)} / {maxSteps}</span>
                <div className="progress-controls">
                  <select value={speed} onChange={e => setSpeed(e.target.value)} title="Playback speed">
                    <option value="snail">Snail</option>
                    <option value="slow">Slow</option>
                    <option value="normal">Normal</option>
                    <option value="fast">Fast</option>
                  </select>
                  <button className="btn-icon" onClick={togglePlayPause} title={animating ? 'Pause' : 'Play'}>
                    {animating ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <button className="btn-icon" onClick={handleStepForward} title="Step forward" disabled={stepIndex >= maxSteps}>
                    <StepForward size={15} />
                  </button>
                  <button className="btn-icon" onClick={handleReplay} title="Replay"><RotateCcw size={15} /></button>
                  <button className="btn-icon" onClick={handleSkip} title="Skip to end"><SkipForward size={15} /></button>
                </div>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
              {simulationComplete && (
                <div className="sim-complete-hint">
                  <CheckCircle2 size={14} color="var(--done)" />
                  Simulation complete — <button className="link-btn" onClick={() => setActiveTab('analysis')}>view Analysis &amp; Comparison →</button>
                </div>
              )}
            </div>
          )}

          {results && (
            <div className="results">
              <h2 className="section-title">HDD Results — 12 Algorithms</h2>
              <div className="grid-hdd">
                {Object.entries(HDD_NAMES).map(([key, name]) => {
                  const data = results.hdd?.[key];
                  if (!data) return null;
                  return <HDDResultCard key={key} name={name} data={data} stepIndex={stepIndex} maxCylinder={parseInt(hdd.maxCylinder)} />;
                })}
              </div>
              <h2 className="section-title" style={{ marginTop: 40 }}>SSD Results — 4 Algorithms</h2>
              <div className="grid-ssd">
                {Object.entries(SSD_NAMES).map(([key, name]) => {
                  const data = results.ssd?.[key];
                  if (!data) return null;
                  return <SSDCard key={key} name={name} data={data} stepIndex={stepIndex} />;
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ANALYSIS TAB */}
      {activeTab === 'analysis' && (
        <div className="analysis-root">
          {!results ? (
            <div className="analysis-empty">
              <AlertCircle size={36} color="var(--ink-dim)" />
              <h3>No simulation data yet</h3>
              <p>Run the simulation first using the <strong>Simulation</strong> tab, then come back here for a full comparison.</p>
              <button className="btn-primary" onClick={() => setActiveTab('simulation')}><Play size={15} /> Go to Simulation</button>
            </div>
          ) : !simulationComplete ? (
            <div className="analysis-empty">
              <Loader2 size={36} color="var(--accent)" className="spin" />
              <h3>Simulation still in progress</h3>
              <p>Please complete all simulation steps before viewing the analysis. You can skip to the end using the <strong>⏭ Skip</strong> button in the Simulation tab.</p>
              <button className="btn-primary" onClick={() => setActiveTab('simulation')}><BarChart2 size={15} /> Back to Simulation</button>
            </div>
          ) : (
            <>
              <div className="analysis-tabs">
                <AnalysisSubTabs results={results} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* Sub-tabs inside Analysis */
function AnalysisSubTabs({ results }) {
  const [sub, setSub] = useState('hdd');
  return (
    <>
      <div className="sub-tab-bar">
        <button className={`sub-tab-btn ${sub === 'hdd' ? 'sub-tab-active' : ''}`} onClick={() => setSub('hdd')}>
          <HardDrive size={13} /> HDD — 12 Algorithms
        </button>
        <button className={`sub-tab-btn ${sub === 'ssd' ? 'sub-tab-active' : ''}`} onClick={() => setSub('ssd')}>
          <Database size={13} /> SSD — 4 Algorithms
        </button>
      </div>
      {sub === 'hdd' ? <HDDAnalysis results={results} /> : <SSDAnalysis results={results} />}
    </>
  );
}

const STYLES = `
:root {
  --bg: #f4f6fa;
  --surface: #ffffff;
  --surface-alt: #eef1f7;
  --border: #dbe1ea;
  --ink: #131a26;
  --ink-dim: #5b6576;
  --accent: #2f5fe0;
  --accent-soft: #e8edfc;
  --read: #0f9d72;
  --write: #e07b1f;
  --danger: #d63a52;
  --done: #1aa368;
  --font-display: 'Space Grotesk', 'Segoe UI', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
}

.app {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  padding: 28px 32px 60px;
  min-height: 100vh;
  box-sizing: border-box;
}
.app * { box-sizing: border-box; }

.app-header { margin-bottom: 20px; }
.title-row { display: flex; align-items: center; gap: 14px; color: var(--accent); }
.title-row h1 {
  font-family: var(--font-display);
  font-size: 26px; margin: 0; color: var(--ink); letter-spacing: -0.01em;
}
.title-row p { margin: 2px 0 0; color: var(--ink-dim); font-size: 13.5px; }

/* ── Tabs ── */
.tab-bar {
  display: flex; gap: 4px; margin-bottom: 22px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 5px; width: fit-content;
}
.tab-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 20px; border-radius: 9px; border: none; cursor: pointer;
  font-family: var(--font-display); font-size: 13.5px; font-weight: 600;
  background: transparent; color: var(--ink-dim);
  transition: background 0.15s, color 0.15s;
  position: relative;
}
.tab-btn:hover { background: var(--surface-alt); color: var(--ink); }
.tab-active { background: var(--accent) !important; color: #fff !important; box-shadow: 0 2px 8px rgba(47,95,224,0.3); }
.tab-badge {
  background: var(--done); color: #fff; font-size: 9.5px; font-weight: 700;
  padding: 2px 7px; border-radius: 99px; letter-spacing: 0.03em;
}

.input-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
@media (max-width: 880px) { .input-section { grid-template-columns: 1fr; } }

.panel {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 14px; padding: 20px 22px;
  box-shadow: 0 1px 2px rgba(20,30,50,0.04);
}
.panel h2 {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font-display); font-size: 15px; margin: 0 0 16px;
  color: var(--ink); padding-bottom: 10px; border-bottom: 1px solid var(--border);
}

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 16px; }
.field.span-2 { grid-column: 1 / -1; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 12.5px; font-weight: 600; color: var(--ink-dim); display: flex; flex-direction: column; gap: 2px; }
.field label .hint { font-weight: 400; font-size: 11px; color: #93a0b3; text-transform: none; }

input, select {
  font-family: var(--font-mono); font-size: 13.5px; padding: 9px 11px;
  border: 1.5px solid var(--border); border-radius: 8px;
  background: var(--surface-alt); color: var(--ink); outline: none;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s; width: 100%;
}
input:focus, select:focus {
  border-color: var(--accent); background: var(--surface); box-shadow: 0 0 0 3px var(--accent-soft);
}
select { font-family: var(--font-body); cursor: pointer; }

.ssd-table-wrap { overflow-x: auto; margin-bottom: 12px; border: 1px solid var(--border); border-radius: 10px; }
.ssd-input-table { width: 100%; border-collapse: collapse; min-width: 620px; }
.ssd-input-table th {
  font-family: var(--font-display); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--ink-dim); text-align: left; padding: 9px 8px;
  background: var(--surface-alt); border-bottom: 1px solid var(--border);
}
.ssd-input-table td { padding: 6px 8px; border-bottom: 1px solid var(--border); }
.ssd-input-table tr:last-child td { border-bottom: none; }
.ssd-input-table input, .ssd-input-table select { padding: 6px 8px; font-size: 12.5px; min-width: 64px; }

.btn-primary {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-display); background: var(--accent); color: #fff;
  border: none; padding: 12px 26px; border-radius: 10px; font-size: 14px;
  font-weight: 600; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s, opacity 0.12s;
  box-shadow: 0 4px 14px rgba(47,95,224,0.3);
}
.btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(47,95,224,0.38); }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }

.actions { margin: 22px 0 0; }

.btn-small {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--surface-alt); color: var(--ink);
  border: 1.5px solid var(--border); border-radius: 8px;
  padding: 7px 13px; font-size: 12.5px; font-weight: 600;
  cursor: pointer; transition: background 0.15s, border-color 0.15s;
}
.btn-small:hover { background: var(--accent-soft); border-color: var(--accent); }

.btn-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px;
  background: var(--surface-alt); border: 1.5px solid var(--border); border-radius: 7px;
  color: var(--ink); cursor: pointer; transition: background 0.15s, border-color 0.15s;
}
.btn-icon:hover { background: var(--accent-soft); border-color: var(--accent); }
.btn-icon.btn-danger { color: var(--danger); }
.btn-icon.btn-danger:hover { background: #fdebee; border-color: var(--danger); }
.btn-icon:disabled { opacity: 0.4; cursor: not-allowed; }

.link-btn {
  background: none; border: none; cursor: pointer; padding: 0;
  color: var(--accent); font-family: var(--font-body); font-size: 13px; font-weight: 600;
  text-decoration: underline;
}
.link-btn:hover { color: #1a3fa8; }

.progress-panel {
  margin-top: 18px; background: var(--surface);
  border: 1px solid var(--border); border-radius: 12px; padding: 14px 18px;
}
.progress-info { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 10px; }
.progress-count { font-family: var(--font-mono); font-size: 13px; font-weight: 600; color: var(--ink); }
.progress-controls { display: flex; align-items: center; gap: 8px; }
.progress-controls select { padding: 6px 9px; font-size: 12px; width: auto; }
.progress-track { height: 8px; border-radius: 99px; background: var(--surface-alt); overflow: hidden; }
.progress-fill {
  height: 100%; border-radius: 99px;
  background: linear-gradient(90deg, var(--accent), #6f95ff);
  transition: width 0.25s ease;
}
.sim-complete-hint {
  display: flex; align-items: center; gap: 7px;
  margin-top: 10px; font-size: 13px; color: var(--ink-dim);
}

.section-title { font-family: var(--font-display); font-size: 18px; margin: 30px 0 16px; color: var(--ink); }

.grid-hdd, .grid-ssd { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 18px; }

.card {
  background: var(--surface); border: 1.5px solid var(--border); border-radius: 14px;
  padding: 16px 18px 18px; animation: fadeInUp 0.35s ease; transition: border-color 0.3s;
}
.card-active { border-color: #c4d2f7; }
.card-done { border-color: #bfe6d3; }

.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; gap: 8px; }
.card-header h3 { font-family: var(--font-display); font-size: 13.5px; margin: 0; color: var(--ink); }

.status-pill {
  display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.03em; padding: 4px 9px; border-radius: 99px; white-space: nowrap;
}
.status-pill.running { background: var(--accent-soft); color: var(--accent); }
.status-pill.done { background: #e3f6ec; color: var(--done); }
.led {
  width: 7px; height: 7px; border-radius: 50%; background: var(--accent);
  box-shadow: 0 0 0 0 rgba(47,95,224,0.5); animation: ledPulse 1.1s ease-in-out infinite;
}

.table-wrap { overflow-x: auto; margin-bottom: 10px; }
.result-table { width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 12px; }
.result-table th {
  text-align: left; padding: 6px 7px; background: var(--surface-alt);
  font-family: var(--font-body); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.03em;
  color: var(--ink-dim); border-bottom: 1px solid var(--border);
}
.result-table td { padding: 5.5px 7px; border-bottom: 1px solid var(--border); }
.result-table tr.row-pending td { color: #9aa6b8; font-style: italic; font-family: var(--font-body); font-size: 12px; }
.result-table tr.row-settled, .result-table tr.row-active { animation: rowIn 0.3s ease; }
.result-table tr.row-active {
  background: rgba(47,95,224,0.08); animation: rowIn 0.3s ease, pulseRow 1.1s ease-in-out infinite;
  box-shadow: inset 3px 0 0 var(--accent);
}
.total-row td { border-top: 1.5px solid var(--ink); border-bottom: none; padding-top: 7px; }
.type-read { color: var(--read); font-weight: 600; }
.type-write { color: var(--write); font-weight: 600; }

.badge { display: inline-block; margin-top: 4px; font-size: 10.5px; color: var(--ink-dim); background: var(--surface-alt); padding: 3px 9px; border-radius: 99px; }
.badge-pill { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 99px; background: var(--surface-alt); color: var(--ink-dim); text-transform: capitalize; }
.badge-pill.badge-on_time, .badge-pill.badge-ontime, .badge-pill.badge-met { background: #e3f6ec; color: var(--done); }
.badge-pill.badge-late, .badge-pill.badge-missed { background: #fdebee; color: var(--danger); }

.chart-wrap { display: flex; justify-content: center; margin-top: 4px; }
.chart-svg { width: 100%; max-width: 320px; overflow: visible; }
.axis-line { stroke: var(--border); stroke-width: 1; }
.axis-caption { font-size: 9px; fill: #9aa6b8; font-family: var(--font-body); text-anchor: middle; }
.axis-caption-sm { font-size: 8.5px; fill: #9aa6b8; font-family: var(--font-body); }

.chart-segment { stroke: var(--accent); stroke-width: 2.2; fill: none; animation: drawSeg 0.4s ease forwards; }
.chart-point { animation: popDot 0.3s cubic-bezier(.34,1.56,.64,1) forwards; transform-box: fill-box; transform-origin: center; }
.chart-dot { fill: #fff; stroke: var(--accent); stroke-width: 2; }
.chart-label { font-size: 8.5px; fill: var(--ink-dim); font-family: var(--font-mono); text-anchor: middle; }

.seek-head { transition: transform 0.35s ease; }
.seek-ring { fill: none; stroke: var(--accent); stroke-width: 1.4; opacity: 0.5; animation: seekPulse 1.1s ease-in-out infinite; }
.seek-diamond { fill: var(--accent); }

.gantt-row { animation: fadeInRow 0.3s ease; }
.gantt-id { font-size: 10px; font-family: var(--font-mono); font-weight: 600; fill: var(--ink); }
.gantt-bar { transform-box: fill-box; transform-origin: 0% 50%; animation: growBar 0.4s ease forwards; opacity: 0.92; }
.bar-read { fill: var(--read); }
.bar-write { fill: var(--write); }
.gantt-duration { font-size: 9px; fill: #fff; font-family: var(--font-mono); font-weight: 600; text-anchor: middle; }
.gantt-empty { font-size: 12px; color: var(--ink-dim); display: flex; align-items: center; gap: 6px; justify-content: center; padding: 18px 0; }

.spin { animation: spin 0.9s linear infinite; }

/* ════ ANALYSIS STYLES ════ */
.analysis-root { padding-top: 4px; }

.analysis-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; padding: 70px 24px; text-align: center;
  background: var(--surface); border: 1px solid var(--border); border-radius: 16px;
}
.analysis-empty h3 { font-family: var(--font-display); font-size: 20px; margin: 0; color: var(--ink); }
.analysis-empty p { margin: 0; color: var(--ink-dim); font-size: 14px; max-width: 400px; line-height: 1.6; }

.sub-tab-bar {
  display: flex; gap: 4px; margin-bottom: 20px;
  border-bottom: 1.5px solid var(--border); padding-bottom: 0;
}
.sub-tab-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 18px; border: none; cursor: pointer; border-radius: 10px 10px 0 0;
  font-family: var(--font-display); font-size: 13px; font-weight: 600;
  background: transparent; color: var(--ink-dim);
  border-bottom: 2px solid transparent; margin-bottom: -1.5px;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.sub-tab-btn:hover { color: var(--ink); background: var(--surface-alt); }
.sub-tab-active { color: var(--accent) !important; border-bottom-color: var(--accent) !important; background: var(--surface) !important; }

.analysis-section { display: flex; flex-direction: column; gap: 20px; }

.analysis-kpi-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
.kpi-card {
  display: flex; align-items: flex-start; gap: 14px; padding: 16px 18px;
  background: var(--surface); border: 1.5px solid var(--border); border-radius: 14px;
}
.kpi-best  { border-color: #bfe6d3; background: #f4fbf8; }
.kpi-worst { border-color: #f4cdd3; background: #fdf4f5; }
.kpi-neutral { border-color: #c4d2f7; background: #f0f4fd; }
.kpi-saving { border-color: #d5e8fb; background: #f2f8fe; }
.kpi-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-dim); margin-bottom: 4px; }
.kpi-value { font-family: var(--font-display); font-size: 15px; font-weight: 700; color: var(--ink); }
.kpi-sub { font-size: 11.5px; color: var(--ink-dim); margin-top: 2px; }

.analysis-card {
  background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 18px 20px;
}
.analysis-card-title {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--font-display); font-size: 13.5px; font-weight: 700;
  color: var(--ink); margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid var(--border);
}

.bar-compare-list { display: flex; flex-direction: column; gap: 10px; }
.bar-compare-row { display: grid; grid-template-columns: 180px 1fr; align-items: center; gap: 14px; }
.bar-algo-name { font-family: var(--font-display); font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.analysis-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.analysis-table th {
  text-align: left; padding: 8px 10px; background: var(--surface-alt);
  font-family: var(--font-body); font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em;
  color: var(--ink-dim); border-bottom: 1px solid var(--border);
}
.analysis-table td { padding: 9px 10px; border-bottom: 1px solid var(--border); font-size: 13px; }
.analysis-table tr:last-child td { border-bottom: none; }
.rank-best-row td { background: #f4fbf8; }
.rank-worst-row td { background: #fdf4f5; }
.rank-num { font-size: 15px; }

.char-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 14px; }
.char-grid-ssd { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
.char-card {
  border: 1.5px solid var(--border); border-radius: 12px; padding: 14px 16px;
  background: var(--surface-alt);
}
.char-card-best { border-color: #bfe6d3; background: #f4fbf8; }
.char-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; flex-wrap: wrap; }
.char-name { font-family: var(--font-display); font-size: 13px; font-weight: 700; color: var(--ink); }
.char-winner-badge { background: var(--done); color: #fff; font-size: 9.5px; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
.char-total { margin-left: auto; font-family: var(--font-mono); font-size: 13px; font-weight: 700; color: var(--accent); }
.char-full { font-size: 11.5px; color: var(--ink-dim); margin-bottom: 8px; }
.char-row { font-size: 12px; line-height: 1.5; }
.char-strength { color: #1a6b4a; }
.char-weakness { color: #7a3a14; margin-top: 3px; }

.recommendation-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.rec-item {
  display: flex; flex-direction: column; gap: 4px;
  background: var(--surface-alt); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px;
}
.rec-item strong { font-size: 12.5px; color: var(--ink); }
.rec-item span { font-family: var(--font-mono); font-size: 12.5px; color: var(--accent); font-weight: 600; }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes rowIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes pulseRow { 0%, 100% { background-color: rgba(47,95,224,0.06); } 50% { background-color: rgba(47,95,224,0.16); } }
@keyframes ledPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(47,95,224,0.45); } 50% { box-shadow: 0 0 0 5px rgba(47,95,224,0); } }
@keyframes drawSeg { to { stroke-dashoffset: 0; } }
@keyframes popDot { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
@keyframes seekPulse { 0%, 100% { transform: scale(1); opacity: 0.55; } 50% { transform: scale(1.5); opacity: 0.15; } }
@keyframes growBar { from { transform: scaleX(0); opacity: 0; } to { transform: scaleX(1); opacity: 0.92; } }
@keyframes fadeInRow { from { opacity: 0; } to { opacity: 1; } }
`;