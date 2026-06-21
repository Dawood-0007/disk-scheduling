const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ========== HELPERS ==========
function cleanSeq(seq) {
  return seq.filter((val, idx, arr) => idx === 0 || val !== arr[idx - 1]);
}

function generateTable(seq) {
  const clean = cleanSeq(seq);
  const table = [];
  for (let i = 0; i < clean.length - 1; i++) {
    const start = clean[i];
    const end = clean[i + 1];
    table.push({ start, end, distance: Math.abs(end - start) });
  }
  const total = table.reduce((sum, row) => sum + row.distance, 0);
  return { sequence: clean, table, total };
}

// ========== HDD ALGORITHMS ==========

// 1. FCFS
function fcfs(requests, head) {
  return generateTable([head, ...requests]);
}

// 2. SSTF
function sstf(requests, head) {
  const remaining = [...requests];
  const seq = [head];
  let current = head;
  while (remaining.length > 0) {
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dist = Math.abs(remaining[i] - current);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    current = remaining[closestIdx];
    seq.push(current);
    remaining.splice(closestIdx, 1);
  }
  return generateTable(seq);
}

// 3. SCAN
function scan(requests, head, max, direction) {
  const sorted = [...requests].sort((a, b) => a - b);
  const seq = [head];
  if (direction === 'right' || direction === 'up') {
    const right = sorted.filter(r => r >= head);
    const left = sorted.filter(r => r < head).sort((a, b) => b - a);
    seq.push(...right);
    if (seq[seq.length - 1] !== max) seq.push(max);
    seq.push(...left);
  } else {
    const left = sorted.filter(r => r <= head).sort((a, b) => b - a);
    const right = sorted.filter(r => r > head).sort((a, b) => a - b);
    seq.push(...left);
    if (seq[seq.length - 1] !== 0) seq.push(0);
    seq.push(...right);
  }
  return generateTable(seq);
}

// 4. C-SCAN
function cscan(requests, head, max, direction) {
  const sorted = [...requests].sort((a, b) => a - b);
  const seq = [head];
  if (direction === 'right' || direction === 'up') {
    const right = sorted.filter(r => r >= head);
    const left = sorted.filter(r => r < head).sort((a, b) => a - b);
    seq.push(...right);
    if (seq[seq.length - 1] !== max) seq.push(max);
    seq.push(0);
    seq.push(...left);
  } else {
    const left = sorted.filter(r => r <= head).sort((a, b) => b - a);
    const right = sorted.filter(r => r > head).sort((a, b) => b - a);
    seq.push(...left);
    if (seq[seq.length - 1] !== 0) seq.push(0);
    seq.push(max);
    seq.push(...right);
  }
  return generateTable(seq);
}

// 5. LOOK
function look(requests, head, direction) {
  const sorted = [...requests].sort((a, b) => a - b);
  const seq = [head];
  if (direction === 'right' || direction === 'up') {
    const right = sorted.filter(r => r >= head);
    const left = sorted.filter(r => r < head).sort((a, b) => b - a);
    seq.push(...right);
    seq.push(...left);
  } else {
    const left = sorted.filter(r => r <= head).sort((a, b) => b - a);
    const right = sorted.filter(r => r > head).sort((a, b) => a - b);
    seq.push(...left);
    seq.push(...right);
  }
  return generateTable(seq);
}

// 6. C-LOOK
function clook(requests, head, direction) {
  const sorted = [...requests].sort((a, b) => a - b);
  const seq = [head];
  if (direction === 'right' || direction === 'up') {
    const right = sorted.filter(r => r >= head);
    const left = sorted.filter(r => r < head).sort((a, b) => a - b);
    seq.push(...right);
    seq.push(...left);
  } else {
    const left = sorted.filter(r => r <= head).sort((a, b) => b - a);
    const right = sorted.filter(r => r > head).sort((a, b) => b - a);
    seq.push(...left);
    seq.push(...right);
  }
  return generateTable(seq);
}

// 7. N-Step SCAN
function nStepScan(requests, head, max, direction, n) {
  const seq = [head];
  let current = head;
  let remaining = [...requests];
  while (remaining.length > 0) {
    const batch = remaining.slice(0, n);
    remaining = remaining.slice(n);
    const sorted = [...batch].sort((a, b) => a - b);
    if (direction === 'right' || direction === 'up') {
      const right = sorted.filter(r => r >= current);
      const left = sorted.filter(r => r < current).sort((a, b) => b - a);
      seq.push(...right);
      if (remaining.length > 0 && seq[seq.length - 1] !== max) seq.push(max);
      seq.push(...left);
    } else {
      const left = sorted.filter(r => r <= current).sort((a, b) => b - a);
      const right = sorted.filter(r => r > current).sort((a, b) => a - b);
      seq.push(...left);
      if (remaining.length > 0 && seq[seq.length - 1] !== 0) seq.push(0);
      seq.push(...right);
    }
    current = seq[seq.length - 1];
  }
  return generateTable(seq);
}

// 8. FSCAN
function fscan(requests, head, max, direction) {
  const mid = Math.ceil(requests.length / 2);
  const currentQueue = requests.slice(0, mid);
  const newQueue = requests.slice(mid);
  const seq = [head];

  // SCAN current queue
  const sorted1 = [...currentQueue].sort((a, b) => a - b);
  if (direction === 'right' || direction === 'up') {
    const right = sorted1.filter(r => r >= head);
    const left = sorted1.filter(r => r < head).sort((a, b) => b - a);
    seq.push(...right);
    if (seq[seq.length - 1] !== max) seq.push(max);
    seq.push(...left);
  } else {
    const left = sorted1.filter(r => r <= head).sort((a, b) => b - a);
    const right = sorted1.filter(r => r > head).sort((a, b) => a - b);
    seq.push(...left);
    if (seq[seq.length - 1] !== 0) seq.push(0);
    seq.push(...right);
  }

  // SCAN new queue from last position
  if (newQueue.length > 0) {
    const lastPos = seq[seq.length - 1];
    const sorted2 = [...newQueue].sort((a, b) => a - b);
    if (direction === 'right' || direction === 'up') {
      const right = sorted2.filter(r => r >= lastPos);
      const left = sorted2.filter(r => r < lastPos).sort((a, b) => b - a);
      seq.push(...right);
      seq.push(...left);
    } else {
      const left = sorted2.filter(r => r <= lastPos).sort((a, b) => b - a);
      const right = sorted2.filter(r => r > lastPos).sort((a, b) => a - b);
      seq.push(...left);
      seq.push(...right);
    }
  }
  return generateTable(seq);
}

// 9. EDF
function edf(requests, head, deadlines) {
  const paired = requests.map((r, i) => ({ req: r, deadline: deadlines[i] || 9999 }));
  paired.sort((a, b) => a.deadline - b.deadline);
  const seq = [head, ...paired.map(p => p.req)];
  return generateTable(seq);
}

// 10. FD-SCAN
function fdscan(requests, head, max, direction) {
  const speed = requests.length > 5 ? 'fast' : 'normal';
  const result = scan(requests, head, max, direction);
  return { ...result, speedMode: speed };
}

// 11. Priority SCAN
function priorityScan(requests, head, max, direction, priorities) {
  const paired = requests.map((r, i) => ({ req: r, priority: priorities[i] || 1 }));
  const groups = {};
  for (let p of paired) {
    if (!groups[p.priority]) groups[p.priority] = [];
    groups[p.priority].push(p.req);
  }
  const seq = [head];
  let current = head;
  const sortedPriorities = Object.keys(groups).map(Number).sort((a, b) => a - b);
  for (let pri of sortedPriorities) {
    const group = groups[pri];
    const sorted = [...group].sort((a, b) => a - b);
    if (direction === 'right' || direction === 'up') {
      const right = sorted.filter(r => r >= current);
      const left = sorted.filter(r => r < current).sort((a, b) => b - a);
      seq.push(...right);
      seq.push(...left);
    } else {
      const left = sorted.filter(r => r <= current).sort((a, b) => b - a);
      const right = sorted.filter(r => r > current).sort((a, b) => a - b);
      seq.push(...left);
      seq.push(...right);
    }
    current = seq[seq.length - 1];
  }
  return generateTable(seq);
}

// 12. Anticipatory Scheduling
function anticipatory(requests, head, window = 50) {
  const seq = [head];
  let current = head;
  const remaining = [...requests];
  while (remaining.length > 0) {
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dist = Math.abs(remaining[i] - current);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    seq.push(remaining[closestIdx]);
    current = remaining[closestIdx];
    remaining.splice(closestIdx, 1);
    // Check nearby within window
    if (remaining.length > 0) {
      let nearbyIdx = -1;
      for (let i = 0; i < remaining.length; i++) {
        if (Math.abs(remaining[i] - current) <= window) {
          nearbyIdx = i;
          break;
        }
      }
      if (nearbyIdx !== -1) {
        seq.push(remaining[nearbyIdx]);
        current = remaining[nearbyIdx];
        remaining.splice(nearbyIdx, 1);
      }
    }
  }
  return generateTable(seq);
}

// ========== SSD ALGORITHMS ==========

function ssdNoop(requests) {
  const sorted = [...requests].sort((a, b) => a.arrivalTime - b.arrivalTime);
  let currentTime = 0;
  const result = [];
  for (let r of sorted) {
    const start = Math.max(currentTime, r.arrivalTime);
    const duration = r.type === 'read' ? r.size * 1 : r.size * 2;
    const end = start + duration;
    result.push({ ...r, startTime: start, endTime: end, waitTime: start - r.arrivalTime, turnaroundTime: end - r.arrivalTime });
    currentTime = end;
  }
  const totalWait = result.reduce((s, r) => s + r.waitTime, 0);
  const avgTurnaround = result.reduce((s, r) => s + r.turnaroundTime, 0) / result.length;
  return { schedule: result, totalWait, avgTurnaround };
}

function ssdMqDeadline(requests) {
  const reads = requests.filter(r => r.type === 'read').sort((a, b) => a.arrivalTime - b.arrivalTime);
  const writes = requests.filter(r => r.type === 'write').sort((a, b) => a.arrivalTime - b.arrivalTime);
  let currentTime = 0;
  const result = [];
  let rIdx = 0, wIdx = 0;
  while (rIdx < reads.length || wIdx < writes.length) {
    let urgent = null;
    if (wIdx < writes.length && writes[wIdx].deadline <= currentTime) {
      urgent = writes[wIdx++];
    }
    if (urgent) {
      const start = Math.max(currentTime, urgent.arrivalTime);
      const end = start + urgent.size * 2;
      result.push({ ...urgent, startTime: start, endTime: end, waitTime: start - urgent.arrivalTime, turnaroundTime: end - urgent.arrivalTime, status: 'urgent' });
      currentTime = end;
      continue;
    }
    if (rIdx < reads.length && reads[rIdx].arrivalTime <= currentTime) {
      const r = reads[rIdx++];
      const end = currentTime + r.size * 1;
      result.push({ ...r, startTime: currentTime, endTime: end, waitTime: currentTime - r.arrivalTime, turnaroundTime: end - r.arrivalTime, status: 'normal' });
      currentTime = end;
    } else if (wIdx < writes.length && writes[wIdx].arrivalTime <= currentTime) {
      const w = writes[wIdx++];
      const end = currentTime + w.size * 2;
      result.push({ ...w, startTime: currentTime, endTime: end, waitTime: currentTime - w.arrivalTime, turnaroundTime: end - w.arrivalTime, status: 'normal' });
      currentTime = end;
    } else {
      const nextR = rIdx < reads.length ? reads[rIdx].arrivalTime : Infinity;
      const nextW = wIdx < writes.length ? writes[wIdx].arrivalTime : Infinity;
      currentTime = Math.min(nextR, nextW);
    }
  }
  const totalWait = result.reduce((s, r) => s + r.waitTime, 0);
  const avgTurnaround = result.reduce((s, r) => s + r.turnaroundTime, 0) / result.length;
  return { schedule: result, totalWait, avgTurnaround };
}

function ssdBfq(requests) {
  const byProcess = {};
  for (let r of requests) {
    if (!byProcess[r.processId]) byProcess[r.processId] = [];
    byProcess[r.processId].push(r);
  }
  const processes = Object.keys(byProcess);
  const queue = [];
  let maxLen = 0;
  for (let p of processes) maxLen = Math.max(maxLen, byProcess[p].length);
  for (let i = 0; i < maxLen; i++) {
    for (let p of processes) {
      if (byProcess[p][i]) queue.push(byProcess[p][i]);
    }
  }
  let currentTime = 0;
  const result = [];
  for (let r of queue) {
    const start = Math.max(currentTime, r.arrivalTime);
    const duration = r.type === 'read' ? r.size * 1 : r.size * 2;
    const end = start + duration;
    result.push({ ...r, startTime: start, endTime: end, waitTime: start - r.arrivalTime, turnaroundTime: end - r.arrivalTime });
    currentTime = end;
  }
  const totalWait = result.reduce((s, r) => s + r.waitTime, 0);
  const avgTurnaround = result.reduce((s, r) => s + r.turnaroundTime, 0) / result.length;
  return { schedule: result, totalWait, avgTurnaround };
}

function ssdKyber(requests) {
  const reads = requests.filter(r => r.type === 'read').sort((a, b) => a.arrivalTime - b.arrivalTime);
  const writes = requests.filter(r => r.type === 'write').sort((a, b) => a.arrivalTime - b.arrivalTime);
  let currentTime = 0;
  const result = [];
  let rIdx = 0, wIdx = 0;
  let writeCount = 0;
  while (rIdx < reads.length || wIdx < writes.length) {
    if (rIdx < reads.length && reads[rIdx].arrivalTime <= currentTime) {
      const r = reads[rIdx++];
      const end = currentTime + r.size * 1;
      result.push({ ...r, startTime: currentTime, endTime: end, waitTime: currentTime - r.arrivalTime, turnaroundTime: end - r.arrivalTime, status: 'read' });
      currentTime = end;
      writeCount = 0;
    } else if (wIdx < writes.length && writes[wIdx].arrivalTime <= currentTime && writeCount < 3) {
      const w = writes[wIdx++];
      const end = currentTime + w.size * 2;
      result.push({ ...w, startTime: currentTime, endTime: end, waitTime: currentTime - w.arrivalTime, turnaroundTime: end - w.arrivalTime, status: 'write' });
      currentTime = end;
      writeCount++;
    } else {
      const nextR = rIdx < reads.length ? reads[rIdx].arrivalTime : Infinity;
      const nextW = wIdx < writes.length ? writes[wIdx].arrivalTime : Infinity;
      currentTime = Math.min(nextR, nextW);
      writeCount = 0;
    }
  }
  const totalWait = result.reduce((s, r) => s + r.waitTime, 0);
  const avgTurnaround = result.reduce((s, r) => s + r.turnaroundTime, 0) / result.length;
  return { schedule: result, totalWait, avgTurnaround };
}

// ========== API ==========
app.post('/api/simulate', (req, res) => {
  try {
    const { hdd, ssd } = req.body;
    const hddResults = {};
    if (hdd) {
      const { requests, head, maxCylinder, direction, nStep, deadlines, priorities, anticipatoryWindow } = hdd;
      hddResults.fcfs = fcfs(requests, head);
      hddResults.sstf = sstf(requests, head);
      hddResults.scan = scan(requests, head, maxCylinder, direction);
      hddResults.cscan = cscan(requests, head, maxCylinder, direction);
      hddResults.look = look(requests, head, direction);
      hddResults.clook = clook(requests, head, direction);
      hddResults.nstep = nStepScan(requests, head, maxCylinder, direction, nStep || 3);
      hddResults.fscan = fscan(requests, head, maxCylinder, direction);
      hddResults.edf = edf(requests, head, deadlines || requests.map((_, i) => i + 1));
      hddResults.fdscan = fdscan(requests, head, maxCylinder, direction);
      hddResults.priority = priorityScan(requests, head, maxCylinder, direction, priorities || requests.map(() => 1));
      hddResults.anticipatory = anticipatory(requests, head, anticipatoryWindow || 50);
    }
    const ssdResults = {};
    if (ssd) {
      const { requests } = ssd;
      ssdResults.noop = ssdNoop(requests);
      ssdResults.mqdeadline = ssdMqDeadline(requests);
      ssdResults.bfq = ssdBfq(requests);
      ssdResults.kyber = ssdKyber(requests);
    }
    res.json({ hdd: hddResults, ssd: ssdResults });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
