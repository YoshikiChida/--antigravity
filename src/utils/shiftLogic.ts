import { addDays, format, subMonths } from 'date-fns';
import { type Course, type Employee, type Shift } from '../types';

export const getShiftDateRange = (yearMonth: string): Date[] => {
  // yearMonth format: "YYYY-MM" e.g., "2026-06"
  // Range is from prev month 16 to current month 15
  const currentMonthDate = new Date(`${yearMonth}-01T00:00:00`);
  const prevMonthDate = subMonths(currentMonthDate, 1);
  
  const start = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 16);
  const end = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 15);
  
  const dates: Date[] = [];
  let curr = start;
  while (curr <= end) {
    dates.push(new Date(curr));
    curr = addDays(curr, 1);
  }
  return dates;
};

// Helper to calculate minutes between HH:mm strings
export const calculateWorkMinutes = (startTime: string, endTime: string, breakMinutes: number): number => {
  if (!startTime || !endTime) return 0;
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  let totalMins = (eH * 60 + eM) - (sH * 60 + sM);
  if (totalMins < 0) totalMins += 24 * 60; // handle overnight
  return Math.max(0, totalMins - breakMinutes);
};

export type UnassignedSuggestion = {
  dateStr: string;
  courseName: string;
  reasons: string[];
};

export type GenerateResult = {
  assignments: Record<string, Record<string, string>>;
  suggestions: UnassignedSuggestion[];
};

// Auto-generation algorithm with Advanced Backtracking & Scoring
export const generateShift = (
  yearMonth: string,
  _branchId: string,
  courses: Course[],
  employees: Employee[],
  requiredCourses?: Record<string, string[]>,
  _previousMonthShift?: Shift,
  priorityRule: 'standard' | 'consecutive' | 'fairness' = 'standard',
  patternIndex = 0
): GenerateResult => {
  const dates = getShiftDateRange(yearMonth);
  const dateStrings = dates.map(d => format(d, 'yyyy-MM-dd'));
  
  const assignments: Record<string, Record<string, string>> = {};
  dates.forEach(d => {
    assignments[format(d, 'yyyy-MM-dd')] = {};
  });

  // Prepare linear tasks
  const tasks: { dateStr: string, dateObj: Date, course: Course }[] = [];
  dates.forEach(dateObj => {
    const dateStr = format(dateObj, 'yyyy-MM-dd');
    const req = requiredCourses?.[dateStr] || courses.map(c => c.id);
    courses.forEach(c => {
      if (req.includes(c.id)) {
        tasks.push({ dateStr, dateObj, course: c });
      }
    });
  });

  const workDays: Record<string, number> = {};
  const weekendDays: Record<string, number> = {};
  const totalMins: Record<string, number> = {};
  
  employees.forEach(e => {
    workDays[e.id] = 0;
    weekendDays[e.id] = 0;
    totalMins[e.id] = 0;
    
    // Add time and days for pre-scheduled events (会議, 研修, etc. but NOT 希望休)
    dateStrings.forEach(dateStr => {
      const eventType = e.events?.[yearMonth]?.[dateStr] || (e.desiredOffDays[yearMonth]?.includes(dateStr) ? '希望休' : '');
      if (eventType && eventType !== '希望休') {
        workDays[e.id]++;
        const dObj = dates[dateStrings.indexOf(dateStr)];
        const dayOfWeek = dObj.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          weekendDays[e.id]++;
        }
        totalMins[e.id] += 480; // Assuming 8 hours
      }
    });
  });

  // ── 最制約優先ソート: 日付順を保ちつつ各日内をeligible数昇順に ──
  const dateGroups = new Map<string, typeof tasks>();
  tasks.forEach(t => {
    if (!dateGroups.has(t.dateStr)) dateGroups.set(t.dateStr, []);
    dateGroups.get(t.dateStr)!.push(t);
  });
  const sortedTasks: typeof tasks = [];
  dateGroups.forEach(group => {
    group.sort((a, b) => {
      const cnt = (t: typeof tasks[0]) => employees.filter(e =>
        e.assignableCourseIds.includes(t.course.id) &&
        !(e.events?.[yearMonth]?.[t.dateStr] || e.desiredOffDays[yearMonth]?.includes(t.dateStr))
      ).length;
      return cnt(a) - cnt(b);
    });
    sortedTasks.push(...group);
  });

  // ── パターン多様性: パターンごとに重み戦略を変える ──────────────
  const diversityConfigs = [
    { wWk: 2.0, wMins: 2.0, wIso: 1.5, wCon: 1.5, noise: 50 },    // 0: 高精度バランス
    { wWk: 4.0, wMins: 1.0, wIso: 1.5, wCon: 1.5, noise: 30 },    // 1: 土日均等重視
    { wWk: 1.0, wMins: 4.0, wIso: 1.5, wCon: 1.5, noise: 30 },    // 2: 時間均等重視
    { wWk: 2.5, wMins: 2.5, wIso: 3.0, wCon: 2.5, noise: 40 },    // 3: パターン品質重視
    { wWk: 3.0, wMins: 3.0, wIso: 2.0, wCon: 2.0, noise: 60 },    // 4: バランス強化
  ] as const;
  const dc = diversityConfigs[patternIndex % 5];

  // 未割当提案収集
  const suggestions: UnassignedSuggestion[] = [];

  let bestAssignments: Record<string, Record<string, string>> | null = null;
  let maxAssignedTaskIndex = -1;
  let iterations = 0;
  const MAX_ITERATIONS = 200000; // Limits backtracking to prevent freezing

  const solve = (taskIndex: number): boolean => {
    if (iterations > MAX_ITERATIONS) return false;
    iterations++;

    if (taskIndex > maxAssignedTaskIndex) {
      maxAssignedTaskIndex = taskIndex;
      bestAssignments = JSON.parse(JSON.stringify(assignments));
    }

    if (taskIndex === sortedTasks.length) {
      return true; // Complete solution found!
    }

    const task = sortedTasks[taskIndex];
    const { dateStr, dateObj, course } = task;
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Filter eligible employees
    const eligible = employees.filter(emp => {
      if (!emp.assignableCourseIds.includes(course.id)) return false;
      if (assignments[dateStr][course.id]) return false;
      if (Object.values(assignments[dateStr]).includes(emp.id)) return false; // Already working another course today

      const eventType = emp.events?.[yearMonth]?.[dateStr] || (emp.desiredOffDays[yearMonth]?.includes(dateStr) ? '希望休' : '');
      if (eventType) return false; // Has event or off

      if (workDays[emp.id] >= emp.maxDaysPerMonth) return false;

      // Calculate consecutive days backward
      let consec = 0;
      let currObj = new Date(dateObj);
      currObj.setDate(currObj.getDate() - 1);
      
      while (true) {
        const prevStr = format(currObj, 'yyyy-MM-dd');
        if (!dateStrings.includes(prevStr)) break;

        const workedPrev = Object.values(assignments[prevStr] || {}).includes(emp.id);
        const eventPrev = emp.events?.[yearMonth]?.[prevStr] || (emp.desiredOffDays[yearMonth]?.includes(prevStr) ? '希望休' : '');
        const workedEvent = eventPrev && eventPrev !== '希望休';

        if (workedPrev || workedEvent) consec++;
        else break;
        
        currObj.setDate(currObj.getDate() - 1);
      }
      
      // Calculate consecutive days forward (if modifying past days, though we assign sequentially so forward is usually 0)
      // But for robustness, just restrict backward consec >= 5
      if (consec >= 4) return false; // 5連勤防止（4日連続の翌日は割当不可）

      return true;
    });

    // Forced skip if no one is eligible — 提案を収集してスキップ
    if (eligible.length === 0) {
      const courseObj = courses.find(c => c.id === task.course.id);
      const courseLabel = courseObj?.name ?? task.course.id;
      const [, mm, dd] = task.dateStr.split('-');
      const dateLabel = `${Number(mm)}/${Number(dd)}`;
      const reasons: string[] = [];
      const potentialEmps = employees.filter(e => e.assignableCourseIds.includes(task.course.id));
      if (potentialEmps.length === 0) {
        reasons.push(`【解決策】「${courseLabel}」に対応できる社員がいません → 社員管理で担当コースを追加してください。`);
      } else {
        potentialEmps.forEach(emp => {
          const ev = emp.events?.[yearMonth]?.[task.dateStr] ||
            (emp.desiredOffDays[yearMonth]?.includes(task.dateStr) ? '希望休' : '');
          if (ev === '希望休') {
            reasons.push(`【解決策】${emp.name}さんの${dateLabel}の希望休を解除 → 「予定」タブで希望休を削除すると割り当て可能になります。`);
          } else if (ev) {
            reasons.push(`【解決策】${emp.name}さんの${dateLabel}の「${ev}」を別日に移動 → 「予定」タブで${dateLabel}の${ev}を削除し、別の日に設定してください。`);
          } else if (workDays[emp.id] >= emp.maxDaysPerMonth) {
            reasons.push(`【解決策】${emp.name}さんの最大出勤日数を${emp.maxDaysPerMonth}日→${emp.maxDaysPerMonth + 1}日に変更 → 社員管理で上限を引き上げてください。`);
          } else {
            // 連勤チェック - 具体的にどの日が連勤かを表示
            let consecDays: string[] = [];
            let cObj = new Date(task.dateObj);
            cObj.setDate(cObj.getDate() - 1);
            while (true) {
              const pStr = format(cObj, 'yyyy-MM-dd');
              if (!dateStrings.includes(pStr)) break;
              const wPrev = Object.values(assignments[pStr] || {}).includes(emp.id) ||
                (emp.events?.[yearMonth]?.[pStr] && emp.events?.[yearMonth]?.[pStr] !== '希望休');
              if (wPrev) { consecDays.unshift(pStr); cObj.setDate(cObj.getDate() - 1); }
              else break;
            }
            if (consecDays.length >= 4) {
              const consecStart = consecDays[0].split('-');
              reasons.push(`【解決策】${emp.name}さんは${Number(consecStart[1])}/${Number(consecStart[2])}から${consecDays.length}連勤中 → 連勤中の1日を別の社員に振替えると割り当て可能になります。`);
            } else if (Object.values(assignments[task.dateStr]).includes(emp.id)) {
              reasons.push(`【解決策】${emp.name}さんは${dateLabel}に別コース割当済み → 日別コース設定でコース数を減らすか、社員を追加してください。`);
            } else {
              reasons.push(`${emp.name}さん：連勤回避または重複のため割り当て不可。`);
            }
          }
        });
      }
      if (!suggestions.find(s => s.dateStr === task.dateStr && s.courseName === courseLabel)) {
        suggestions.push({ dateStr: task.dateStr, courseName: courseLabel, reasons });
      }
      return solve(taskIndex + 1);
    }

    // Set weights based on priorityRule
    let weightWeekend = 5000;
    let weightMins = 1;
    let weightIsolated = 1000;
    let weightConsec = 2500;

    if (priorityRule === 'fairness') {
      weightWeekend = 10000;
      weightMins = 5;
      weightIsolated = 500;
      weightConsec = 1000;
    } else if (priorityRule === 'consecutive') {
      weightWeekend = 2000;
      weightMins = 1;
      weightIsolated = 2500;
      weightConsec = 5000;
    }

    // パターン多様性係数を適用
    weightWeekend  *= dc.wWk;
    weightMins     *= dc.wMins;
    weightIsolated *= dc.wIso;
    weightConsec   *= dc.wCon;

    // 土日理想値（偏差ベーススコアリング用）
    const totalWeekendInRange = dates.filter(d => { const dw = d.getDay(); return dw === 0 || dw === 6; }).length;
    const activeEmpCount = Math.max(1, employees.filter(e => e.assignableCourseIds.length > 0).length);
    const idealWeekend = totalWeekendInRange / activeEmpCount;

    // Score and sort (Lower is better)
    const scoredEligible = eligible.map(emp => {
      let score = Math.random() * dc.noise; // パターン多様性のランダム揺らぎ

      // [土日均等] 理想値との偏差ベース（絶対数ではなく超過分にペナルティ）
      if (isWeekend) {
        score += Math.max(0, weekendDays[emp.id] - idealWeekend + 0.5) * weightWeekend;
      }

      // [時間均等] 累計労働時間による重み
      score += totalMins[emp.id] * weightMins;

      // [Proposal D] Prevent specific isolated pattern (休み・出勤・休み・出勤の防止)
      let cObjPattern = new Date(dateObj);
      cObjPattern.setDate(cObjPattern.getDate() - 1);
      const prev1Str = format(cObjPattern, 'yyyy-MM-dd'); // 昨日 (休みを想定)
      
      cObjPattern.setDate(cObjPattern.getDate() - 1);
      const prev2Str = format(cObjPattern, 'yyyy-MM-dd'); // 一昨日 (出勤を想定)
      
      cObjPattern.setDate(cObjPattern.getDate() - 1);
      const prev3Str = format(cObjPattern, 'yyyy-MM-dd'); // 3日前 (休みを想定)

      if (dateStrings.includes(prev1Str) && dateStrings.includes(prev2Str) && dateStrings.includes(prev3Str)) {
        const worked1 = Object.values(assignments[prev1Str] || {}).includes(emp.id) || 
          (emp.events?.[yearMonth]?.[prev1Str] && emp.events?.[yearMonth]?.[prev1Str] !== '希望休');
        const worked2 = Object.values(assignments[prev2Str] || {}).includes(emp.id) || 
          (emp.events?.[yearMonth]?.[prev2Str] && emp.events?.[yearMonth]?.[prev2Str] !== '希望休');
        const worked3 = Object.values(assignments[prev3Str] || {}).includes(emp.id) || 
          (emp.events?.[yearMonth]?.[prev3Str] && emp.events?.[yearMonth]?.[prev3Str] !== '希望休');

        // 今日(出勤)を追加すると「休(prev3)・出(prev2)・休(prev1)・出(今日)」になるか判定
        if (!worked3 && worked2 && !worked1) {
          score += weightIsolated; // ペナルティ
        }
      }

      // Calculate consecutive days backward to check for 4-consec penalty
      let consecScore = 0;
      let cObj = new Date(dateObj);
      cObj.setDate(cObj.getDate() - 1);
      while (true) {
        const pStr = format(cObj, 'yyyy-MM-dd');
        if (!dateStrings.includes(pStr)) break;
        const wPrev = Object.values(assignments[pStr] || {}).includes(emp.id) || 
          (emp.events?.[yearMonth]?.[pStr] && emp.events?.[yearMonth]?.[pStr] !== '希望休');
        if (wPrev) consecScore++;
        else break;
        cObj.setDate(cObj.getDate() - 1);
      }

      // ペナルティ: 3連勤以上で段階的にペナルティを増加
      if (consecScore >= 3) {
        score += weightConsec * (consecScore - 2); // 3連勤=1倍, 4連勤=2倍
      }

      return { emp, score };
    });

    // Sort ascending by score
    scoredEligible.sort((a, b) => a.score - b.score);

    // Try assigning best candidates first [Proposal E: Backtracking]
    for (const { emp } of scoredEligible) {
      assignments[dateStr][course.id] = emp.id;
      workDays[emp.id]++;
      if (isWeekend) weekendDays[emp.id]++;
      const mins = calculateWorkMinutes(course.startTime, course.endTime, course.breakMinutes);
      totalMins[emp.id] += mins;

      if (solve(taskIndex + 1)) return true;

      // Undo assignment
      delete assignments[dateStr][course.id];
      workDays[emp.id]--;
      if (isWeekend) weekendDays[emp.id]--;
      totalMins[emp.id] -= mins;
    }

    return false; // Backtrack if all candidates failed
  };

  solve(0);

  // ── 局所探索（ポスト最適化）: スワップでスコアを改善 ──────────────
  const finalAssignments: Record<string, Record<string, string>> =
    JSON.parse(JSON.stringify(bestAssignments || assignments));

  (() => {
    // quickScore: 土日格差 + 労働時間格差 + 飛び石パターン + 連勤ペナルティ（低いほど良い）
    const quickScore = (a: Record<string, Record<string, string>>): number => {
      const wkMap: Record<string, number> = {};
      const minsMap: Record<string, number> = {};
      const schedMap: Record<string, boolean[]> = {};
      employees.forEach(e => { wkMap[e.id] = 0; minsMap[e.id] = 0; schedMap[e.id] = []; });
      dateStrings.forEach((ds, idx) => {
        const dow = dates[idx].getDay();
        const isWk = dow === 0 || dow === 6;
        employees.forEach(emp => {
          const assignedCourseId = Object.keys(a[ds] || {}).find(cId => a[ds][cId] === emp.id);
          const evType = emp.events?.[yearMonth]?.[ds] || (emp.desiredOffDays?.[yearMonth]?.includes(ds) ? '希望休' : '');
          const worked = !!assignedCourseId || (!!evType && evType !== '希望休');
          if (assignedCourseId && isWk) wkMap[emp.id]++;
          if (evType && evType !== '希望休' && isWk) wkMap[emp.id]++;
          if (assignedCourseId) {
            const c = courses.find(x => x.id === assignedCourseId);
            if (c) minsMap[emp.id] += calculateWorkMinutes(c.startTime, c.endTime, c.breakMinutes);
          } else if (evType && evType !== '希望休') {
            minsMap[emp.id] += 480;
          }
          schedMap[emp.id].push(worked);
        });
      });
      let s = 0;
      const activeEmps = employees.filter(e => e.assignableCourseIds.length > 0);
      // 土日格差ペナルティ（格差1日につき15点）
      const wkVals = activeEmps.map(e => wkMap[e.id]);
      if (wkVals.length >= 2) s += (Math.max(...wkVals) - Math.min(...wkVals)) * 15;
      // 労働時間格差ペナルティ（格差1時間につき3点）
      const hrVals = activeEmps.map(e => Math.round(minsMap[e.id] / 60));
      if (hrVals.length >= 2) s += (Math.max(...hrVals) - Math.min(...hrVals)) * 3;
      // 飛び石パターンペナルティ
      employees.forEach(emp => {
        const sc = schedMap[emp.id];
        for (let i = 0; i < sc.length - 3; i++) {
          if (!sc[i] && sc[i+1] && !sc[i+2] && sc[i+3]) s += 2;
        }
        // 5連勤ペナルティ
        let consec = 0;
        for (let i = 0; i < sc.length; i++) {
          if (sc[i]) { consec++; if (consec >= 5) s += 10; }
          else consec = 0;
        }
      });
      return s;
    };

    // 連勤チェック用ヘルパー
    const getConsecAt = (a: Record<string, Record<string, string>>, empId: string, dateIdx: number): number => {
      let consec = 0;
      for (let i = dateIdx; i >= 0; i--) {
        const ds = dateStrings[i];
        const worked = Object.values(a[ds] || {}).includes(empId) ||
          (employees.find(e => e.id === empId)?.events?.[yearMonth]?.[ds] &&
           employees.find(e => e.id === empId)?.events?.[yearMonth]?.[ds] !== '希望休');
        if (worked) consec++; else break;
      }
      for (let i = dateIdx + 1; i < dateStrings.length; i++) {
        const ds = dateStrings[i];
        const worked = Object.values(a[ds] || {}).includes(empId) ||
          (employees.find(e => e.id === empId)?.events?.[yearMonth]?.[ds] &&
           employees.find(e => e.id === empId)?.events?.[yearMonth]?.[ds] !== '希望休');
        if (worked) consec++; else break;
      }
      return consec;
    };

    const allPairs: { dateStr: string; courseId: string; empId: string }[] = [];
    dateStrings.forEach(ds => {
      Object.entries(finalAssignments[ds] || {}).forEach(([cId, eId]) => {
        allPairs.push({ dateStr: ds, courseId: cId, empId: eId });
      });
    });
    if (allPairs.length < 2) return;

    let bestScore = quickScore(finalAssignments);

    for (let iter = 0; iter < 6000; iter++) {
      const i1 = Math.floor(Math.random() * allPairs.length);
      let i2 = Math.floor(Math.random() * allPairs.length);
      while (i2 === i1) i2 = Math.floor(Math.random() * allPairs.length);
      const p1 = allPairs[i1], p2 = allPairs[i2];
      if (p1.dateStr === p2.dateStr || p1.empId === p2.empId) continue;

      const emp1 = employees.find(e => e.id === p1.empId);
      const emp2 = employees.find(e => e.id === p2.empId);
      if (!emp1 || !emp2) continue;
      if (!emp1.assignableCourseIds.includes(p2.courseId)) continue;
      if (!emp2.assignableCourseIds.includes(p1.courseId)) continue;

      // 同日重複チェック
      if (Object.entries(finalAssignments[p2.dateStr] || {}).some(([cId, eId]) => eId === emp1.id && cId !== p2.courseId)) continue;
      if (Object.entries(finalAssignments[p1.dateStr] || {}).some(([cId, eId]) => eId === emp2.id && cId !== p1.courseId)) continue;

      // イベントチェック
      const ev1 = emp1.events?.[yearMonth]?.[p2.dateStr] || (emp1.desiredOffDays?.[yearMonth]?.includes(p2.dateStr) ? '希望休' : '');
      if (ev1) continue;
      const ev2 = emp2.events?.[yearMonth]?.[p1.dateStr] || (emp2.desiredOffDays?.[yearMonth]?.includes(p1.dateStr) ? '希望休' : '');
      if (ev2) continue;

      // 連勤チェック（スワップ後に5連勤以上にならないか）
      const idx1 = dateStrings.indexOf(p1.dateStr);
      const idx2 = dateStrings.indexOf(p2.dateStr);

      // スワップ試行
      const old1 = finalAssignments[p1.dateStr][p1.courseId];
      const old2 = finalAssignments[p2.dateStr][p2.courseId];
      finalAssignments[p1.dateStr][p1.courseId] = p2.empId;
      finalAssignments[p2.dateStr][p2.courseId] = p1.empId;

      // 連勤5以上になったらロールバック
      const c1 = getConsecAt(finalAssignments, p2.empId, idx1);
      const c2 = getConsecAt(finalAssignments, p1.empId, idx2);
      if (c1 >= 5 || c2 >= 5) {
        finalAssignments[p1.dateStr][p1.courseId] = old1;
        finalAssignments[p2.dateStr][p2.courseId] = old2;
        continue;
      }

      const newScore = quickScore(finalAssignments);
      if (newScore < bestScore) {
        bestScore = newScore;
        allPairs[i1].empId = p2.empId;
        allPairs[i2].empId = p1.empId;
      } else {
        finalAssignments[p1.dateStr][p1.courseId] = old1;
        finalAssignments[p2.dateStr][p2.courseId] = old2;
      }
    }
  })();

  return { assignments: finalAssignments, suggestions };
};

// ── Shared score calculation (used by both ShiftManage and Dashboard) ──────

export type ScoreViolation = {
  employeeName: string;
  type: string;
  detail: string;
  severity: 'error' | 'warning';
};

export type ScoreResult = {
  score: number;
  violations: ScoreViolation[];
};

export const calculateShiftScore = (
  shift: Shift,
  employees: Employee[],
  courses: Course[],
  yearMonth: string,
  requiredCourses?: Record<string, string[]>,
  prevYM?: string,
  prevShift?: Shift,
  nextYM?: string,
  nextShift?: Shift,
): ScoreResult => {
  const dates = getShiftDateRange(yearMonth);
  const dateStrings = dates.map(d => format(d, 'yyyy-MM-dd'));

  let score = 100;
  const violations: ScoreViolation[] = [];

  // ── 未割当コース ──────────────────────────────────────────────
  dateStrings.forEach(dateStr => {
    const required = requiredCourses?.[dateStr] ?? courses.map(c => c.id);
    required.forEach(courseId => {
      if (!shift.assignments[dateStr]?.[courseId]) {
        const course = courses.find(c => c.id === courseId);
        const [, m, d] = dateStr.split('-');
        violations.push({
          employeeName: '—',
          type: 'コース未割当',
          detail: `${Number(m)}/${Number(d)} 「${course?.name ?? courseId}」`,
          severity: 'error',
        });
        score -= 20;
      }
    });
  });

  // ── 社員ごとの制約チェック ────────────────────────────────────
  const weekendWorkMap: Record<string, number> = {};
  const totalMinsMap:   Record<string, number> = {};

  employees.forEach(emp => {
    let workDays       = 0;
    let consec         = 0;
    let hasConsecErr   = false;
    let empWeekendWork = 0;
    let empTotalMins   = 0;
    const schedule: boolean[] = [];

    dateStrings.forEach((dateStr, idx) => {
      const assignedCourseId = Object.keys(shift.assignments[dateStr] ?? {}).find(
        cId => shift.assignments[dateStr][cId] === emp.id
      );
      const eventType = emp.events?.[yearMonth]?.[dateStr] ??
        (emp.desiredOffDays?.[yearMonth]?.includes(dateStr) ? '希望休' : '');
      const isWorking = !!(assignedCourseId || (eventType && eventType !== '希望休'));
      schedule.push(isWorking);

      if (isWorking) {
        workDays++;
        consec++;
        const dow = dates[idx].getDay();
        if (dow === 0 || dow === 6) empWeekendWork++;
        if (assignedCourseId) {
          const c = courses.find(c => c.id === assignedCourseId);
          if (c) empTotalMins += calculateWorkMinutes(c.startTime, c.endTime, c.breakMinutes);
        } else {
          empTotalMins += 480;
        }
        if (consec === 5) {
          violations.push({ employeeName: emp.name, type: '5連勤', detail: '5連勤発生', severity: 'warning' });
          score -= 3;
        }
      } else {
        if (consec >= 6 && !hasConsecErr) {
          violations.push({ employeeName: emp.name, type: '長期連勤', detail: `${consec}連勤`, severity: 'error' });
          score -= 5;
          hasConsecErr = true;
        }
        consec = 0;
      }
    });

    // 月末時点での連勤チェック
    if (consec >= 6 && !hasConsecErr) {
      violations.push({ employeeName: emp.name, type: '長期連勤', detail: `${consec}連勤`, severity: 'error' });
      score -= 5;
    }

    if (workDays > emp.maxDaysPerMonth) {
      violations.push({
        employeeName: emp.name,
        type: '勤務日数超過',
        detail: `上限 ${emp.maxDaysPerMonth}日 / 実績 ${workDays}日`,
        severity: 'error',
      });
      score -= 2;
    }

    // 飛び石パターン (休み→出勤→休み→出勤)
    let isolatedCount = 0;
    for (let i = 0; i < schedule.length - 3; i++) {
      if (!schedule[i] && schedule[i + 1] && !schedule[i + 2] && schedule[i + 3]) {
        isolatedCount++;
      }
    }
    if (isolatedCount > 0) {
      violations.push({
        employeeName: emp.name,
        type: '飛び石パターン',
        detail: `${isolatedCount}箇所`,
        severity: 'warning',
      });
      score -= isolatedCount;
    }

    weekendWorkMap[emp.id] = empWeekendWork;
    totalMinsMap[emp.id]   = empTotalMins;
  });

  // ── 土日格差・時間格差ペナルティ ──────────────────────────────
  if (employees.length >= 2) {
    const wkVals = employees.map(e => weekendWorkMap[e.id] ?? 0);
    const wkMax  = Math.max(...wkVals);
    const wkMin  = Math.min(...wkVals);
    const wkGap  = wkMax - wkMin;
    if (wkGap > 0) {
      violations.push({
        employeeName: '—',
        type: '土日格差',
        detail: `最大${wkMax}日 / 最小${wkMin}日（格差${wkGap}日）`,
        severity: 'warning',
      });
      score -= wkGap;
    }

    const hrVals   = employees.map(e => Math.round((totalMinsMap[e.id] ?? 0) / 60));
    const hrMax    = Math.max(...hrVals);
    const hrMin    = Math.min(...hrVals);
    const hrGap    = hrMax - hrMin;
    if (hrGap > 0) {
      const penalty = Math.round(hrGap * 0.5);
      violations.push({
        employeeName: '—',
        type: '時間格差',
        detail: `最大${hrMax}h / 最小${hrMin}h（格差${hrGap}h、-${penalty}点）`,
        severity: 'warning',
      });
      score -= penalty;
    }
  }

  // 月またぎ5連勤（-3点/件、通常の5連勤と同じペナルティ）
  if (prevYM !== undefined && nextYM !== undefined) {
    const crossVs = checkCrossMonthConsecutive(
      yearMonth, shift, prevYM, prevShift, nextYM, nextShift, employees
    ).map(v => ({ ...v, type: '5連勤（交番またぎ）' }));
    crossVs.forEach(() => { score -= 3; });
    violations.push(...crossVs);
  }

  return { score: Math.max(0, score), violations };
};

// ── 月またぎ連勤チェック（隣接期との境界：15日/16日） ──────────────
export const checkCrossMonthConsecutive = (
  currentYM: string,
  currentShift: Shift,
  prevYM: string,
  prevShift: Shift | undefined,
  nextYM: string,
  nextShift: Shift | undefined,
  employees: Employee[],
): ScoreViolation[] => {
  const violations: ScoreViolation[] = [];

  const isWorking = (emp: Employee, dateStr: string, shift: Shift, ym: string): boolean => {
    const assigned = Object.values(shift.assignments[dateStr] ?? {}).includes(emp.id);
    if (assigned) return true;
    const ev = emp.events?.[ym]?.[dateStr]
      ?? (emp.desiredOffDays?.[ym]?.includes(dateStr) ? '希望休' : '');
    return !!(ev && ev !== '希望休');
  };

  const checkBoundary = (
    shiftA: Shift, ymA: string, datesA: Date[],
    shiftB: Shift, ymB: string, datesB: Date[],
    label: string,
  ) => {
    // 前期の末尾4日 + 後期の先頭4日を確認
    const tailA = datesA.slice(-4).map(d => format(d, 'yyyy-MM-dd'));
    const headB = datesB.slice(0, 4).map(d => format(d, 'yyyy-MM-dd'));

    employees.forEach(emp => {
      // 前期末から遡って連続出勤日数をカウント
      let cntA = 0;
      for (let i = tailA.length - 1; i >= 0; i--) {
        if (isWorking(emp, tailA[i], shiftA, ymA)) cntA++;
        else break;
      }
      // 後期頭から順に連続出勤日数をカウント
      let cntB = 0;
      for (let i = 0; i < headB.length; i++) {
        if (isWorking(emp, headB[i], shiftB, ymB)) cntB++;
        else break;
      }
      const total = cntA + cntB;
      if (total < 5) return;

      const startDs = tailA[tailA.length - cntA];
      const endDs = headB[cntB - 1];
      const [, sm, sd] = startDs.split('-');
      const [, em, ed] = endDs.split('-');
      violations.push({
        employeeName: emp.name,
        type: '月またぎ連勤',
        detail: `${label} ${Number(sm)}/${Number(sd)}〜${Number(em)}/${Number(ed)}（${total}連勤）`,
        severity: 'warning',
      });
    });
  };

  if (prevShift) {
    checkBoundary(
      prevShift, prevYM, getShiftDateRange(prevYM),
      currentShift, currentYM, getShiftDateRange(currentYM),
      '前期末〜今期初',
    );
  }
  if (nextShift) {
    checkBoundary(
      currentShift, currentYM, getShiftDateRange(currentYM),
      nextShift, nextYM, getShiftDateRange(nextYM),
      '今期末〜次期初',
    );
  }

  return violations;
};
