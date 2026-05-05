import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { format, addMonths, parseISO } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../store/AppContext';
import { useToast } from '../components/Toast';
import { getShiftDateRange, generateShift, calculateWorkMinutes, calculateShiftScore, type ScoreViolation, type UnassignedSuggestion } from '../utils/shiftLogic';
import { Calendar, Users, Building, Settings as SettingsIcon, Printer, Download, Cog, AlertTriangle, Loader2, X } from 'lucide-react';
import { type Shift, type Employee } from '../types';

export const ShiftManage: React.FC = () => {
  const { data, saveShift, updateEmployee } = useAppContext();
  const currentBranchId = data.currentBranchId;
  const courses = data.courses.filter((c) => c.branchId === currentBranchId);
  const employees = data.employees.filter((e) => e.branchId === currentBranchId);

  const [yearMonth, setYearMonth] = useState(format(addMonths(new Date(), 1), 'yyyy-MM'));
  const [viewMode, setViewMode] = useState<'staff' | 'calendar' | 'course' | 'daily' | 'offdays'>('staff');

  const currentShift = data.shifts.find(
    (s) => s.branchId === currentBranchId && s.yearMonth === yearMonth
  );

  const [localRequiredCourses, setLocalRequiredCourses] = useState<Record<string, string[]>>({});
  const [priorityRule, setPriorityRule] = useState<'standard' | 'consecutive' | 'fairness'>('standard');
  const [draftPatterns, setDraftPatterns] = useState<Record<string, Record<string, string>>[]>([]);
  const [activeDraftIndex, setActiveDraftIndex] = useState<number>(-1);
  const [draftSuggestions, setDraftSuggestions] = useState<UnassignedSuggestion[][]>([]);

  // ── Drag & Drop ─────────────────────────────────────────────
  // courseId: 割当済みセル / empId: 休み(○)セル
  type DndCell = { dateStr: string; courseId?: string; empId?: string };
  const dragSourceRef = useRef<DndCell | null>(null);
  const dropTargetRef = useRef<DndCell | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapRef = useRef<(s: DndCell, t: DndCell) => void>(() => {});
  const autoScrollRafRef = useRef<number | null>(null);
  const touchPosRef = useRef<{ x: number; y: number } | null>(null);
  const [dragSource, setDragSource] = useState<DndCell | null>(null);
  const [dropTarget, setDropTarget] = useState<DndCell | null>(null);
  const [ghostInfo, setGhostInfo] = useState<{ visible: boolean; x: number; y: number; text: string }>({
    visible: false, x: 0, y: 0, text: '',
  });
  const [empModalId, setEmpModalId] = useState<string | null>(null);
  const [dayDetailDate, setDayDetailDate] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [draftViolationModal, setDraftViolationModal] = useState<{
    patternIndex: number;
    mode: 'violations' | 'unassigned';
  } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setDraftPatterns([]);
    setActiveDraftIndex(-1);
    setDraftSuggestions([]);
  }, [yearMonth]);

  useEffect(() => {
    if (currentShift?.requiredCourses) {
      setLocalRequiredCourses(currentShift.requiredCourses);
    } else {
      const defaults: Record<string, string[]> = {};
      const ds = getShiftDateRange(yearMonth);
      const allCourseIds = courses.map(c => c.id);
      ds.forEach(d => { defaults[format(d, 'yyyy-MM-dd')] = [...allCourseIds]; });
      setLocalRequiredCourses(defaults);
    }
  }, [currentShift?.id, yearMonth, courses.length]);

  // Document-level touch drag listeners — active only while a drag is in progress
  useEffect(() => {
    if (!dragSource) return;

    const stopAutoScroll = () => {
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
    };

    const scheduleAutoScroll = () => {
      if (autoScrollRafRef.current !== null) return;
      const loop = () => {
        const pos = touchPosRef.current;
        if (!pos) { autoScrollRafRef.current = null; return; }
        const container = document.querySelector<HTMLElement>('[data-table-scroll]');
        if (container) {
          const rect = container.getBoundingClientRect();
          const EDGE = 60, SPEED = 8;
          let dx = 0, dy = 0;
          if (pos.x < rect.left + EDGE) dx = -SPEED;
          else if (pos.x > rect.right - EDGE) dx = SPEED;
          if (pos.y < rect.top + EDGE) dy = -SPEED;
          else if (pos.y > rect.bottom - EDGE) dy = SPEED;
          if (dx !== 0 || dy !== 0) {
            container.scrollLeft += dx;
            container.scrollTop += dy;
          } else {
            autoScrollRafRef.current = null;
            return;
          }
        }
        autoScrollRafRef.current = requestAnimationFrame(loop);
      };
      autoScrollRafRef.current = requestAnimationFrame(loop);
    };

    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      touchPosRef.current = { x: t.clientX, y: t.clientY };
      setGhostInfo(g => ({ ...g, x: t.clientX, y: t.clientY }));
      scheduleAutoScroll();
      const el = document.elementFromPoint(t.clientX, t.clientY)?.closest<HTMLElement>('[data-dnd-cell]');
      if (el?.dataset.date) {
        let tgt: DndCell | null = null;
        if (el.dataset.course) {
          tgt = { dateStr: el.dataset.date, courseId: el.dataset.course };
        } else if (el.dataset.emp) {
          tgt = { dateStr: el.dataset.date, empId: el.dataset.emp };
        }
        dropTargetRef.current = tgt;
        setDropTarget(tgt);
      } else {
        dropTargetRef.current = null;
        setDropTarget(null);
      }
    };

    const onEnd = () => {
      touchPosRef.current = null;
      stopAutoScroll();
      if (dragSourceRef.current && dropTargetRef.current)
        swapRef.current(dragSourceRef.current, dropTargetRef.current);
      dragSourceRef.current = null;
      dropTargetRef.current = null;
      setDragSource(null);
      setDropTarget(null);
      setGhostInfo(g => ({ ...g, visible: false }));
    };

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    return () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      touchPosRef.current = null;
      stopAutoScroll();
    };
  }, [dragSource]);

  const dates = useMemo(() => getShiftDateRange(yearMonth), [yearMonth]);
  const dateStrings = dates.map((d) => format(d, 'yyyy-MM-dd'));
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  const unassignedCount = useMemo(() => {
    if (!currentShift) return 0;
    return dateStrings.reduce((total, dateStr) => {
      const req = localRequiredCourses[dateStr] || [];
      return total + req.filter(cId => !currentShift.assignments[dateStr]?.[cId]).length;
    }, 0);
  }, [currentShift, dateStrings, localRequiredCourses]);

  // ── 提案比較メトリクス（5パターン全て採点）───────────────────
  const draftMetrics = useMemo(() => {
    if (draftPatterns.length === 0 || !currentBranchId) return null;
    const ds = getShiftDateRange(yearMonth);
    const dsStr = ds.map(d => format(d, 'yyyy-MM-dd'));
    const branchCourses = data.courses.filter(c => c.branchId === currentBranchId);
    const branchEmps = data.employees.filter(e => e.branchId === currentBranchId);

    const items = draftPatterns.map((assignments, idx) => {
      const tempShift: Shift = {
        id: `draft-${idx}`,
        branchId: currentBranchId,
        yearMonth,
        assignments,
        requiredCourses: localRequiredCourses,
      };
      const { score, violations } = calculateShiftScore(
        tempShift, branchEmps, branchCourses, yearMonth, localRequiredCourses
      );
      const unassignedList = violations.filter(v => v.type === 'コース未割当');
      const violationList  = violations.filter(v => v.type !== 'コース未割当');
      const unassigned = unassignedList.length;
      const errors = violationList.length;

      const weekendMap: Record<string, number> = {};
      const minsMap: Record<string, number> = {};
      branchEmps.forEach(e => { weekendMap[e.id] = 0; minsMap[e.id] = 0; });
      dsStr.forEach((dateStr, i) => {
        const dow = ds[i].getDay();
        const isWeekend = dow === 0 || dow === 6;
        Object.entries(assignments[dateStr] ?? {}).forEach(([cId, eId]) => {
          const c = branchCourses.find(x => x.id === cId);
          if (!c) return;
          if (isWeekend) weekendMap[eId] = (weekendMap[eId] ?? 0) + 1;
          minsMap[eId] = (minsMap[eId] ?? 0) + calculateWorkMinutes(c.startTime, c.endTime, c.breakMinutes);
        });
      });

      const activeEmps = branchEmps.filter(e => e.assignableCourseIds.length > 0);
      const wkVals = activeEmps.map(e => weekendMap[e.id] ?? 0);
      const hrVals = activeEmps.map(e => minsMap[e.id] ?? 0);
      const weekendGap = wkVals.length >= 2 ? Math.max(...wkVals) - Math.min(...wkVals) : 0;
      const hoursGapH = hrVals.length >= 2
        ? Math.round((Math.max(...hrVals) - Math.min(...hrVals)) / 60) : 0;

      return { score, unassigned, unassignedList, errors, violationList, weekendGap, hoursGapH };
    });

    return {
      items,
      best: {
        score:      Math.max(...items.map(x => x.score)),
        unassigned: Math.min(...items.map(x => x.unassigned)),
        errors:     Math.min(...items.map(x => x.errors)),
        weekendGap: Math.min(...items.map(x => x.weekendGap)),
        hoursGapH:  Math.min(...items.map(x => x.hoursGapH)),
      },
    };
  }, [draftPatterns, data.courses, data.employees, currentBranchId, yearMonth, localRequiredCourses]);

  // Always keep swapRef pointing at the latest closure so the effect never goes stale
  swapRef.current = (src, tgt) => {
    if (!currentShift) return;
    const newA: Record<string, Record<string, string>> = JSON.parse(JSON.stringify(currentShift.assignments));
    if (!newA[src.dateStr]) newA[src.dateStr] = {};
    if (!newA[tgt.dateStr]) newA[tgt.dateStr] = {};

    if (src.courseId && tgt.courseId) {
      // ── 割当済み ↔ 割当済み：従来のスワップ ──
      if (src.dateStr === tgt.dateStr && src.courseId === tgt.courseId) return;
      const se = newA[src.dateStr][src.courseId];
      const te = newA[tgt.dateStr][tgt.courseId];
      if (te) newA[src.dateStr][src.courseId] = te; else delete newA[src.dateStr][src.courseId];
      if (se) newA[tgt.dateStr][tgt.courseId] = se; else delete newA[tgt.dateStr][tgt.courseId];
    } else if (src.courseId && tgt.empId) {
      // ── 割当済み → 休み(○)：コースと休みを入れ替え ──
      const srcEmpId = newA[src.dateStr][src.courseId];
      if (!srcEmpId || srcEmpId === tgt.empId) return;
      delete newA[src.dateStr][src.courseId];       // 先に解除（同日同コースでも上書きされない）
      newA[tgt.dateStr][src.courseId] = tgt.empId; // 移動先の社員に割り当て
    } else {
      return;
    }

    if (activeDraftIndex >= 0) {
      const nd = [...draftPatterns];
      nd[activeDraftIndex] = newA;
      setDraftPatterns(nd);
    }
    saveShift({ ...currentShift, assignments: newA });
  };

  // ── Desktop HTML5 drag handlers ─────────────────────────────
  const handleDragStart = (e: React.DragEvent<HTMLTableCellElement>, dateStr: string, courseId: string) => {
    dragSourceRef.current = { dateStr, courseId };
    setDragSource({ dateStr, courseId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${dateStr}|${courseId}`);
  };
  const handleDragOver = (e: React.DragEvent<HTMLTableCellElement>, dateStr: string, courseId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTarget?.dateStr !== dateStr || dropTarget?.courseId !== courseId)
      setDropTarget({ dateStr, courseId });
  };
  const handleDrop = (e: React.DragEvent<HTMLTableCellElement>, dateStr: string, courseId: string) => {
    e.preventDefault();
    if (dragSourceRef.current) swapRef.current(dragSourceRef.current, { dateStr, courseId });
    dragSourceRef.current = null;
    dropTargetRef.current = null;
    setDragSource(null);
    setDropTarget(null);
  };
  const handleDragEnd = () => {
    dragSourceRef.current = null;
    dropTargetRef.current = null;
    setDragSource(null);
    setDropTarget(null);
  };

  // ── Mobile long-press drag start ─────────────────────────────
  const handleCellTouchStart = (dateStr: string, courseId: string, empName: string) =>
    (e: React.TouchEvent<HTMLTableCellElement>) => {
      if ((e.target as HTMLElement).tagName === 'SELECT') return;
      const touch = e.touches[0];
      const sx = touch.clientX;
      const sy = touch.clientY;
      const cell = e.currentTarget;
      if (longPressRef.current) clearTimeout(longPressRef.current);
      const cleanup = () => {
        cell.removeEventListener('touchmove', onMove);
        cell.removeEventListener('touchend', onCancel);
      };
      const onMove = (me: TouchEvent) => {
        if (Math.hypot(me.touches[0].clientX - sx, me.touches[0].clientY - sy) > 8) {
          if (longPressRef.current) clearTimeout(longPressRef.current);
          cleanup();
        }
      };
      const onCancel = () => {
        if (longPressRef.current) clearTimeout(longPressRef.current);
        cleanup();
      };
      cell.addEventListener('touchmove', onMove, { passive: true });
      cell.addEventListener('touchend', onCancel);
      longPressRef.current = setTimeout(() => {
        cleanup();
        dragSourceRef.current = { dateStr, courseId };
        setDragSource({ dateStr, courseId });
        setGhostInfo({ visible: true, x: sx, y: sy, text: empName || '未割当' });
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(30);
      }, 500);
    };

  // ── Existing handlers (unchanged) ───────────────────────────
  const handleGenerate = useCallback(async () => {
    if (courses.length === 0 || employees.length === 0) {
      toast('コースと社員を登録してください。', 'warning');
      return;
    }
    setIsGenerating(true);
    await new Promise(r => setTimeout(r, 40));
    const patterns: Record<string, Record<string, string>>[] = [];
    const allSuggestions: UnassignedSuggestion[][] = [];
    for (let i = 0; i < 5; i++) {
      const result = generateShift(yearMonth, currentBranchId!, courses, employees, localRequiredCourses, undefined, priorityRule, i);
      patterns.push(result.assignments);
      allSuggestions.push(result.suggestions);
    }
    setDraftPatterns(patterns);
    setDraftSuggestions(allSuggestions);
    setActiveDraftIndex(0);
    const newShift: Shift = {
      id: currentShift?.id || uuidv4(),
      branchId: currentBranchId!,
      yearMonth,
      assignments: patterns[0],
      requiredCourses: localRequiredCourses,
    };
    saveShift(newShift);
    setIsGenerating(false);
    toast('交番を自動生成しました（5パターン）', 'success');
  }, [courses, employees, yearMonth, currentBranchId, localRequiredCourses, priorityRule, currentShift, saveShift, toast]);

  const handleTabChange = (index: number) => {
    setActiveDraftIndex(index);
    const newShift: Shift = {
      id: currentShift?.id || uuidv4(),
      branchId: currentBranchId!,
      yearMonth,
      assignments: draftPatterns[index],
      requiredCourses: localRequiredCourses,
    };
    saveShift(newShift);
  };

  const handleClear = () => {
    if (!currentShift) return;
    if (!window.confirm('割り当てられたシフトをすべてクリアしますか？（予定やコース設定は維持されます）')) return;
    const clearedAssignments: Record<string, Record<string, string>> = {};
    dateStrings.forEach(d => { clearedAssignments[d] = {}; });
    setDraftPatterns([]);
    setActiveDraftIndex(-1);
    saveShift({ ...currentShift, assignments: clearedAssignments });
    toast('シフトをクリアしました', 'info');
  };

  const handleCopyFromPrevMonth = () => {
    const prevYm = format(addMonths(parseISO(yearMonth + '-01'), -1), 'yyyy-MM');
    const prevShift = data.shifts.find(s => s.branchId === currentBranchId && s.yearMonth === prevYm);
    if (!prevShift) {
      toast(`${prevYm}の交番データが見つかりません。`, 'warning');
      return;
    }
    if (!window.confirm(`${prevYm}の日別コース設定を${yearMonth}にコピーしますか？`)) return;
    const prevDates = getShiftDateRange(prevYm);
    const prevReq = prevShift.requiredCourses || {};
    const dowMap: Record<number, string[]> = {};
    prevDates.forEach(d => {
      const dow = d.getDay();
      const ds = format(d, 'yyyy-MM-dd');
      dowMap[dow] = prevReq[ds] ?? courses.map(c => c.id);
    });
    const newReq: Record<string, string[]> = {};
    dates.forEach(d => {
      newReq[format(d, 'yyyy-MM-dd')] = dowMap[d.getDay()] ?? courses.map(c => c.id);
    });
    setLocalRequiredCourses(newReq);
    if (currentShift) saveShift({ ...currentShift, requiredCourses: newReq });
    toast('前月の日別コース設定をコピーしました', 'success');
  };

  const updateAssignment = (dateStr: string, courseId: string, employeeId: string | null) => {
    if (!currentShift) return;
    const newAssignments = { ...currentShift.assignments };
    if (!newAssignments[dateStr]) newAssignments[dateStr] = {};
    if (employeeId) {
      newAssignments[dateStr][courseId] = employeeId;
    } else {
      delete newAssignments[dateStr][courseId];
    }
    if (activeDraftIndex >= 0) {
      const newDrafts = [...draftPatterns];
      newDrafts[activeDraftIndex] = newAssignments;
      setDraftPatterns(newDrafts);
    }
    saveShift({ ...currentShift, assignments: newAssignments });
  };

  const toggleRequiredCourseCell = (dateStr: string, courseId: string) => {
    setLocalRequiredCourses(prev => {
      const current = prev[dateStr] || [];
      const updated = current.includes(courseId)
        ? current.filter(id => id !== courseId)
        : [...current, courseId];
      return { ...prev, [dateStr]: updated };
    });
  };

  const toggleRequiredCourseRow = (courseId: string) => {
    setLocalRequiredCourses(prev => {
      const next = { ...prev };
      const allEnabled = dateStrings.every(dateStr => (next[dateStr] || []).includes(courseId));
      dateStrings.forEach(dateStr => {
        const current = next[dateStr] || [];
        if (allEnabled) {
          next[dateStr] = current.filter(id => id !== courseId);
        } else {
          if (!current.includes(courseId)) next[dateStr] = [...current, courseId];
        }
      });
      return next;
    });
  };

  const toggleRequiredCourseCol = (dateStr: string) => {
    setLocalRequiredCourses(prev => {
      const next = { ...prev };
      const current = next[dateStr] || [];
      const allEnabled = courses.every(c => current.includes(c.id));
      if (allEnabled) next[dateStr] = [];
      else next[dateStr] = courses.map(c => c.id);
      return next;
    });
  };

  const EVENT_OPTIONS = ['', '希望休', '会議', '研修', '添乗', '応援', 'その他'];

  const updateEvent = (employee: Employee, dateStr: string, eventType: string) => {
    const currentEvents = { ...(employee.events || {}) };
    const monthEvents = { ...(currentEvents[yearMonth] || {}) };
    if (eventType === '') {
      delete monthEvents[dateStr];
    } else {
      monthEvents[dateStr] = eventType;
    }
    currentEvents[yearMonth] = monthEvents;
    updateEmployee({ ...employee, events: currentEvents });
  };

  const exportCSV = () => {
    if (!currentShift) return;
    const BOM = '﻿';
    let csv = '';
    const headers = ['社員名', ...dateStrings.map(d => `'${d}`), '出勤', '休日', '土日', '労働時間(分)'];
    csv += headers.join(',') + '\n';
    employees.forEach(emp => {
      let workDays = 0, weekendWork = 0, totalWorkMinutes = 0;
      const row = [emp.name];
      dateStrings.forEach((dateStr, idx) => {
        const assignedCourseId = Object.keys(currentShift.assignments[dateStr] || {}).find(
          (cId) => currentShift.assignments[dateStr][cId] === emp.id
        );
        const course = courses.find(c => c.id === assignedCourseId);
        const eventType = emp.events?.[yearMonth]?.[dateStr] || (emp.desiredOffDays?.[yearMonth]?.includes(dateStr) ? '希望休' : '');
        const d = dates[idx];
        const dayOfWeek = d.getDay();
        if (assignedCourseId && course) {
          workDays++;
          if (dayOfWeek === 0 || dayOfWeek === 6) weekendWork++;
          totalWorkMinutes += calculateWorkMinutes(course.startTime, course.endTime, course.breakMinutes);
          row.push(course.name);
        } else if (eventType === '希望休') {
          row.push('◎');
        } else if (eventType) {
          workDays++;
          if (dayOfWeek === 0 || dayOfWeek === 6) weekendWork++;
          totalWorkMinutes += 480;
          row.push(eventType);
        } else {
          row.push('');
        }
      });
      row.push(workDays.toString(), (dates.length - workDays).toString(), weekendWork.toString(), totalWorkMinutes.toString());
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shift_${yearMonth}.csv`;
    link.click();
  };

  // ── Views ────────────────────────────────────────────────────
  // 社員ビュー — コースが割り当て済みのセルでドラッグ＆ドロップ対応
  const renderStaffView = () => {
    return (
      <div className="flex flex-col bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 print:border-none print:block">
        <div className="hidden md:flex p-3 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 items-start gap-2 print:hidden shrink-0">
          <span className="shrink-0 mt-0.5">💡</span>
          <span>
            <strong>手動入れ替え:</strong>{' '}
            コース名が表示されているセルをスマホは<strong>0.5秒長押し</strong>してから別のセルへドラッグ、
            PCはそのままドラッグすると担当者を入れ替えられます。
          </span>
        </div>
        <div
          data-table-scroll="true"
          className="overflow-auto max-h-[55vh] landscape:max-h-[calc(100vh-155px)] md:max-h-[calc(100vh-280px)] print:max-h-none print:overflow-visible"
          onDragOver={(e) => {
            const c = e.currentTarget;
            const r = c.getBoundingClientRect();
            const EDGE = 60, SPEED = 10;
            if (e.clientX < r.left + EDGE) c.scrollLeft -= SPEED;
            else if (e.clientX > r.right - EDGE) c.scrollLeft += SPEED;
            if (e.clientY < r.top + EDGE) c.scrollTop -= SPEED;
            else if (e.clientY > r.bottom - EDGE) c.scrollTop += SPEED;
          }}
        >
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0 z-20">
            <tr>
              <th className="px-2 md:px-4 py-2 text-left font-medium text-gray-500 border-r sticky left-0 bg-gray-50 z-30 text-xs md:text-sm">社員名</th>
              {dates.map((d) => {
                const dayOfWeek = d.getDay();
                let colorClass = '';
                if (dayOfWeek === 0) colorClass = 'text-red-600 bg-red-50';
                else if (dayOfWeek === 6) colorClass = 'text-blue-600 bg-blue-50';
                else colorClass = 'bg-green-50';
                return (
                  <th
                    key={d.toISOString()}
                    className={`px-1 py-1 text-center border-r min-w-[44px] md:min-w-[50px] ${colorClass} ${currentShift ? 'cursor-pointer hover:opacity-70 transition-opacity' : ''} select-none`}
                    onClick={() => currentShift && setDayDetailDate(format(d, 'yyyy-MM-dd'))}
                    title="タップで日別詳細"
                  >
                    <div className="text-xs">{format(d, 'd')}</div>
                    <div className="text-[10px]">{weekdays[dayOfWeek]}</div>
                  </th>
                );
              })}
              <th className="px-1.5 md:px-3 py-2 text-center font-medium text-gray-500 border-l bg-gray-50 text-xs md:text-sm">出勤</th>
              <th className="px-1.5 md:px-3 py-2 text-center font-medium text-gray-500 bg-gray-50 text-xs md:text-sm">休日</th>
              <th className="px-1.5 md:px-3 py-2 text-center font-medium text-gray-500 bg-gray-50 text-xs md:text-sm">土日</th>
              <th className="px-1.5 md:px-3 py-2 text-right font-medium text-gray-500 bg-gray-50 sticky right-0 text-xs md:text-sm whitespace-nowrap">労働時間</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {employees.map((emp) => {
              let workDays = 0, weekendWork = 0, totalWorkMinutes = 0;
              return (
                <tr key={emp.id} className="hover:bg-yellow-50 transition-colors">
                  <td
                    className="px-2 md:px-4 py-1.5 md:py-2 font-medium border-r sticky left-0 bg-white z-10 cursor-pointer hover:text-blue-600 hover:underline underline-offset-2 select-none text-xs md:text-sm"
                    onClick={() => setEmpModalId(emp.id)}
                  >{emp.name}</td>
                  {dateStrings.map((dateStr, idx) => {
                    const assignedCourseId = currentShift
                      ? Object.keys(currentShift.assignments[dateStr] || {}).find(
                          (cId) => currentShift.assignments[dateStr][cId] === emp.id
                        )
                      : null;
                    const course = courses.find(c => c.id === assignedCourseId);
                    const d = dates[idx];
                    const dayOfWeek = d.getDay();
                    if (assignedCourseId && course) {
                      workDays++;
                      if (dayOfWeek === 0 || dayOfWeek === 6) weekendWork++;
                      totalWorkMinutes += calculateWorkMinutes(course.startTime, course.endTime, course.breakMinutes);
                    }
                    const eventType = emp.events?.[yearMonth]?.[dateStr] || (emp.desiredOffDays?.[yearMonth]?.includes(dateStr) ? '希望休' : '');
                    if (!assignedCourseId && eventType && eventType !== '希望休') {
                      workDays++;
                      if (dayOfWeek === 0 || dayOfWeek === 6) weekendWork++;
                      totalWorkMinutes += 480;
                    }
                    const baseBg = dayOfWeek === 0 ? 'bg-red-50' : dayOfWeek === 6 ? 'bg-blue-50' : 'bg-green-50';

                    // Drag visual feedback (only for cells with a course assignment)
                    const isDragSrc = !!assignedCourseId
                      && dragSource?.dateStr === dateStr && dragSource?.courseId === assignedCourseId;
                    const isDropTgt = !!assignedCourseId && !!dragSource
                      && dropTarget?.dateStr === dateStr && dropTarget?.courseId === assignedCourseId;

                    // 休み(○)セルをドロップ先として認識するかどうか
                    const isEmptyDroppable = !assignedCourseId && !eventType && !!dragSource?.courseId;
                    const isDropTgtEmpty = isEmptyDroppable
                      && dropTarget?.dateStr === dateStr && dropTarget?.empId === emp.id;

                    const cellBg = isDragSrc
                      ? 'drag-source bg-yellow-200'
                      : isDropTgt || isDropTgtEmpty
                        ? 'drop-target-highlight'
                        : (eventType === '希望休' || (!assignedCourseId && !eventType))
                          ? 'bg-gray-100 dark:bg-gray-700'
                          : baseBg;

                    return (
                      <td
                        key={dateStr}
                        data-dnd-cell="true"
                        data-date={dateStr}
                        {...(assignedCourseId
                          ? { 'data-course': assignedCourseId }
                          : isEmptyDroppable
                            ? { 'data-emp': emp.id }
                            : {})}
                        className={`px-1 py-1 text-center border-r transition-all ripple-cell ${assignedCourseId ? 'cursor-grab select-none' : isEmptyDroppable ? 'cursor-copy' : ''} ${cellBg}`}
                        draggable={!!assignedCourseId && !!currentShift}
                        onDragStart={assignedCourseId ? (e) => handleDragStart(e, dateStr, assignedCourseId) : undefined}
                        onDragEnd={assignedCourseId ? handleDragEnd : undefined}
                        onDragOver={assignedCourseId
                          ? (e) => handleDragOver(e, dateStr, assignedCourseId)
                          : isEmptyDroppable
                            ? (e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                if (dropTarget?.dateStr !== dateStr || dropTarget?.empId !== emp.id)
                                  setDropTarget({ dateStr, empId: emp.id });
                              }
                            : undefined}
                        onDrop={assignedCourseId
                          ? (e) => handleDrop(e, dateStr, assignedCourseId)
                          : isEmptyDroppable
                            ? (e) => {
                                e.preventDefault();
                                if (dragSourceRef.current) swapRef.current(dragSourceRef.current, { dateStr, empId: emp.id });
                                dragSourceRef.current = null;
                                dropTargetRef.current = null;
                                setDragSource(null);
                                setDropTarget(null);
                              }
                            : undefined}
                        onTouchStart={assignedCourseId ? handleCellTouchStart(dateStr, assignedCourseId, emp.name) : undefined}
                      >
                        {assignedCourseId ? (
                          <div className="bg-[#1A1A1A] text-white text-[11px] md:text-xs py-0.5 px-1 rounded truncate leading-tight pointer-events-none" title={course?.name}>
                            {course?.name.substring(0, 4)}
                          </div>
                        ) : eventType === '希望休' ? (
                          <span className="text-gray-400 font-bold">◎</span>
                        ) : eventType ? (
                          <span className="text-blue-600 font-bold text-xs">{eventType === 'その他' ? '他' : eventType.substring(0, 3)}</span>
                        ) : (
                          <span className={`font-bold ${isDropTgtEmpty ? 'text-yellow-500' : 'text-gray-400'}`}>○</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-1.5 md:px-3 py-1.5 md:py-2 text-center font-bold border-l bg-white text-xs md:text-sm">
                    <span className={`${workDays < emp.minDaysPerMonth || workDays > emp.maxDaysPerMonth ? 'text-red-500' : 'text-green-600'}`}>{workDays}</span>
                    <span className="text-[9px] md:text-[10px] text-gray-500 block">/ {emp.maxDaysPerMonth}</span>
                  </td>
                  <td className="px-1.5 md:px-3 py-1.5 md:py-2 text-center font-medium bg-white text-gray-700 text-xs md:text-sm">{dates.length - workDays}</td>
                  <td className="px-1.5 md:px-3 py-1.5 md:py-2 text-center font-medium bg-white text-gray-700 text-xs md:text-sm">{weekendWork}</td>
                  <td className="px-1.5 md:px-3 py-1.5 md:py-2 text-right font-medium bg-white sticky right-0 text-gray-800 text-xs md:text-sm whitespace-nowrap">
                    {Math.floor(totalWorkMinutes / 60)}h{totalWorkMinutes % 60 > 0 ? `${totalWorkMinutes % 60}m` : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    );
  };

  // コース名ビュー（旧カレンダービュー）— ドラッグ＆ドロップ対応
  const renderCalendarView = () => {
    return (
      <div className="flex flex-col bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 print:border-none print:block">
        <div className="hidden md:flex p-3 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 items-start gap-2 print:hidden shrink-0">
          <span className="shrink-0 mt-0.5">💡</span>
          <span>
            <strong>手動入れ替え:</strong>{' '}
            スマホは各セルを<strong>0.5秒長押し</strong>してから別のセルへドラッグすると担当者を入れ替えられます。
            PCはセルをそのままドラッグするか、プルダウンから直接選択してください。
          </span>
        </div>
        <div
          data-table-scroll="true"
          className="overflow-auto max-h-[55vh] landscape:max-h-[calc(100vh-155px)] md:max-h-[calc(100vh-280px)] print:max-h-none print:overflow-visible"
          onDragOver={(e) => {
            const c = e.currentTarget;
            const r = c.getBoundingClientRect();
            const EDGE = 60, SPEED = 10;
            if (e.clientX < r.left + EDGE) c.scrollLeft -= SPEED;
            else if (e.clientX > r.right - EDGE) c.scrollLeft += SPEED;
            if (e.clientY < r.top + EDGE) c.scrollTop -= SPEED;
            else if (e.clientY > r.bottom - EDGE) c.scrollTop += SPEED;
          }}
        >
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0 z-20">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500 border-r sticky left-0 bg-gray-50 z-30">コース名</th>
              {dates.map((d) => {
                const dayOfWeek = d.getDay();
                let colorClass = '';
                if (dayOfWeek === 0) colorClass = 'text-red-600 bg-red-50';
                else if (dayOfWeek === 6) colorClass = 'text-blue-600 bg-blue-50';
                else colorClass = 'bg-green-50';
                return (
                  <th
                    key={d.toISOString()}
                    className={`px-2 py-1 text-center border-r min-w-[80px] ${colorClass} ${currentShift ? 'cursor-pointer hover:opacity-70 transition-opacity' : ''} select-none`}
                    onClick={() => currentShift && setDayDetailDate(format(d, 'yyyy-MM-dd'))}
                    title="タップで日別詳細"
                  >
                    <div>{format(d, 'd')}</div>
                    <div className="text-[10px]">{weekdays[dayOfWeek]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {courses.map((course) => (
              <tr key={course.id} className="hover:bg-yellow-50">
                <td className="px-4 py-2 font-medium border-r sticky left-0 bg-white z-10">{course.name}</td>
                {dateStrings.map((dateStr, idx) => {
                  const dayOfWeek = dates[idx].getDay();
                  const baseBg = dayOfWeek === 0 ? 'bg-red-50' : dayOfWeek === 6 ? 'bg-blue-50' : 'bg-green-50';
                  const isRequired = localRequiredCourses[dateStr]?.includes(course.id) ?? true;
                  if (!isRequired) {
                    return (
                      <td key={dateStr} className="px-1 py-1 border-r bg-gray-100 text-center text-gray-300 text-xs">
                        不要
                      </td>
                    );
                  }
                  const assignedEmpId = currentShift?.assignments[dateStr]?.[course.id];
                  const assignedEmp = employees.find(e => e.id === assignedEmpId);
                  const isDragSrc = dragSource?.dateStr === dateStr && dragSource?.courseId === course.id;
                  const isDropTgt = dropTarget?.dateStr === dateStr && dropTarget?.courseId === course.id && !!dragSource;
                  const cellBg = isDragSrc
                    ? 'bg-yellow-200 opacity-50'
                    : isDropTgt
                      ? 'bg-yellow-100 ring-2 ring-inset ring-yellow-500'
                      : !assignedEmpId
                        ? 'bg-red-100'
                        : baseBg;
                  return (
                    <td
                      key={dateStr}
                      data-dnd-cell="true"
                      data-date={dateStr}
                      data-course={course.id}
                      className={`px-1 py-1 border-r transition-colors select-none cursor-grab ${cellBg}`}
                      draggable={!!currentShift}
                      onDragStart={(e) => handleDragStart(e, dateStr, course.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, dateStr, course.id)}
                      onDrop={(e) => handleDrop(e, dateStr, course.id)}
                      onTouchStart={handleCellTouchStart(dateStr, course.id, assignedEmp?.name || '')}
                    >
                      {assignedEmp && (
                        <div className="text-center text-[10px] font-bold text-gray-700 leading-tight pb-0.5 pointer-events-none">
                          {assignedEmp.name}
                        </div>
                      )}
                      <select
                        value={assignedEmpId || ''}
                        onChange={(e) => updateAssignment(dateStr, course.id, e.target.value || null)}
                        onTouchStart={(e) => e.stopPropagation()}
                        className={`w-full text-[10px] p-0.5 rounded border-transparent hover:border-gray-300 focus:border-[#FFD700] focus:ring-0 bg-transparent ${!assignedEmpId ? 'text-red-500' : 'text-gray-600'}`}
                      >
                        <option value="">未割当</option>
                        {employees
                          .filter(e => e.assignableCourseIds.includes(course.id))
                          .map(e => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                          ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    );
  };

  const renderDailyCourseView = () => {
    return (
      <div className="flex flex-col bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 print:border-none print:block">
        <div className="hidden md:block p-4 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 text-sm text-gray-700 dark:text-gray-300 shrink-0 print:hidden">
          <strong>日別コース設定:</strong> 自動生成の対象とするコースを日別に設定できます。コース名や日付をクリックすると一括でON/OFFを切り替えられます。（変更後、再度「自動生成」を実行してください）
        </div>
        <div
          data-table-scroll="true"
          className="overflow-auto max-h-[55vh] landscape:max-h-[calc(100vh-155px)] md:max-h-[calc(100vh-280px)] print:max-h-none print:overflow-visible"
          onDragOver={(e) => {
            const c = e.currentTarget;
            const r = c.getBoundingClientRect();
            const EDGE = 60, SPEED = 10;
            if (e.clientX < r.left + EDGE) c.scrollLeft -= SPEED;
            else if (e.clientX > r.right - EDGE) c.scrollLeft += SPEED;
            if (e.clientY < r.top + EDGE) c.scrollTop -= SPEED;
            else if (e.clientY > r.bottom - EDGE) c.scrollTop += SPEED;
          }}
        >
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0 z-20">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500 border-r sticky left-0 bg-gray-50 z-30">コース名</th>
              {dates.map((d) => {
                const dayOfWeek = d.getDay();
                let colorClass = '';
                if (dayOfWeek === 0) colorClass = 'text-red-600 bg-red-50 cursor-pointer hover:bg-red-100';
                else if (dayOfWeek === 6) colorClass = 'text-blue-600 bg-blue-50 cursor-pointer hover:bg-blue-100';
                else colorClass = 'bg-green-50 cursor-pointer hover:bg-green-100';
                return (
                  <th
                    key={d.toISOString()}
                    className={`px-2 py-1 text-center border-r min-w-[40px] transition-colors ${colorClass}`}
                    onClick={() => toggleRequiredCourseCol(format(d, 'yyyy-MM-dd'))}
                    title="この日を一括切替"
                  >
                    <div>{format(d, 'd')}</div>
                    <div className="text-[10px]">{weekdays[dayOfWeek]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {courses.map((course) => (
              <tr key={course.id} className="hover:bg-gray-50">
                <td
                  className="px-4 py-2 font-medium border-r sticky left-0 bg-white z-10 cursor-pointer hover:bg-yellow-100 transition-colors"
                  onClick={() => toggleRequiredCourseRow(course.id)}
                  title="このコースを一括切替"
                >
                  {course.name}
                </td>
                {dateStrings.map((dateStr, idx) => {
                  const dayOfWeek = dates[idx].getDay();
                  const baseBg = dayOfWeek === 0 ? 'bg-red-50' : dayOfWeek === 6 ? 'bg-blue-50' : 'bg-green-50';
                  const isRequired = localRequiredCourses[dateStr]?.includes(course.id) ?? false;
                  return (
                    <td key={dateStr} className={`px-1 py-2 text-center border-r cursor-pointer hover:brightness-95 ${baseBg}`} onClick={() => toggleRequiredCourseCell(dateStr, course.id)}>
                      <input
                        type="checkbox"
                        checked={isRequired}
                        onChange={() => {}}
                        className="w-4 h-4 text-[#FFD700] rounded focus:ring-[#FFD700] cursor-pointer pointer-events-none"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    );
  };

  const renderEventsView = () => {
    return (
      <div className="flex flex-col bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 print:border-none print:block">
        <div className="hidden md:block p-4 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 text-sm text-gray-700 dark:text-gray-300 shrink-0 print:hidden">
          <strong>予定:</strong> 各社員の予定（希望休、会議、研修など）を設定できます。
        </div>
        <div
          data-table-scroll="true"
          className="overflow-auto max-h-[55vh] landscape:max-h-[calc(100vh-155px)] md:max-h-[calc(100vh-280px)] print:max-h-none print:overflow-visible"
          onDragOver={(e) => {
            const c = e.currentTarget;
            const r = c.getBoundingClientRect();
            const EDGE = 60, SPEED = 10;
            if (e.clientX < r.left + EDGE) c.scrollLeft -= SPEED;
            else if (e.clientX > r.right - EDGE) c.scrollLeft += SPEED;
            if (e.clientY < r.top + EDGE) c.scrollTop -= SPEED;
            else if (e.clientY > r.bottom - EDGE) c.scrollTop += SPEED;
          }}
        >
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0 z-20">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500 border-r sticky left-0 bg-gray-50 z-30">社員名</th>
              {dates.map((d) => {
                const dayOfWeek = d.getDay();
                let colorClass = '';
                if (dayOfWeek === 0) colorClass = 'text-red-600 bg-red-50';
                else if (dayOfWeek === 6) colorClass = 'text-blue-600 bg-blue-50';
                else colorClass = 'bg-green-50';
                return (
                  <th key={d.toISOString()} className={`px-2 py-1 text-center border-r min-w-[60px] ${colorClass}`}>
                    <div>{format(d, 'd')}</div>
                    <div className="text-[10px]">{weekdays[dayOfWeek]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-yellow-50 transition-colors">
                <td className="px-4 py-2 font-medium border-r sticky left-0 bg-white z-10">{emp.name}</td>
                {dateStrings.map((dateStr, idx) => {
                  const dayOfWeek = dates[idx].getDay();
                  const baseBg = dayOfWeek === 0 ? 'bg-red-50' : dayOfWeek === 6 ? 'bg-blue-50' : 'bg-green-50';
                  const eventType = emp.events?.[yearMonth]?.[dateStr] || (emp.desiredOffDays?.[yearMonth]?.includes(dateStr) ? '希望休' : '');
                  return (
                    <td
                      key={dateStr}
                      className={`px-1 py-1 text-center border-r transition-colors ${eventType === '希望休' ? 'bg-gray-100' : eventType ? 'bg-yellow-50' : baseBg}`}
                    >
                      <select
                        value={eventType}
                        onChange={(e) => updateEvent(emp, dateStr, e.target.value)}
                        className={`w-full text-[10px] p-1 rounded border-transparent hover:border-gray-300 focus:border-[#FFD700] focus:ring-0 ${eventType === '希望休' ? 'text-red-600 font-bold' : eventType ? 'text-blue-600 font-bold' : 'text-gray-400'}`}
                        title="予定を選択"
                      >
                        {EVENT_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt || '-'}</option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    );
  };

  // コース偏差ビュー（旧コース別ビュー）
  const renderCourseView = () => {
    const counts: Record<string, Record<string, number>> = {};
    courses.forEach(c => {
      counts[c.id] = {};
      employees.forEach(e => { counts[c.id][e.id] = 0; });
    });
    if (currentShift) {
      dateStrings.forEach(dateStr => {
        const assignmentsForDate = currentShift.assignments[dateStr] || {};
        Object.entries(assignmentsForDate).forEach(([courseId, empId]) => {
          if (counts[courseId] && counts[courseId][empId] !== undefined) {
            counts[courseId][empId]++;
          }
        });
      });
    }
    return (
      <div className="flex flex-col bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 print:border-none print:block">
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 text-sm text-gray-700 dark:text-gray-300 shrink-0 print:hidden">
          <strong>コース偏差:</strong> 各コースを誰が何回担当しているかを集計します。平均より明らかに多い場合は赤でハイライトされます。
        </div>
        <div
          data-table-scroll="true"
          className="overflow-auto max-h-[55vh] landscape:max-h-[calc(100vh-155px)] md:max-h-[calc(100vh-280px)] print:max-h-none print:overflow-visible"
          onDragOver={(e) => {
            const c = e.currentTarget;
            const r = c.getBoundingClientRect();
            const EDGE = 60, SPEED = 10;
            if (e.clientX < r.left + EDGE) c.scrollLeft -= SPEED;
            else if (e.clientX > r.right - EDGE) c.scrollLeft += SPEED;
            if (e.clientY < r.top + EDGE) c.scrollTop -= SPEED;
            else if (e.clientY > r.bottom - EDGE) c.scrollTop += SPEED;
          }}
        >
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0 z-20">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-500 border-r sticky left-0 bg-gray-50 z-30">コース名</th>
              <th className="px-4 py-2 text-center font-medium text-gray-500 border-r">合計割当回数</th>
              {employees.map(e => (
                <th key={e.id} className="px-2 py-2 text-center font-medium text-gray-500 border-r min-w-[60px]">{e.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {courses.map(course => {
              const totalAssigned = employees.reduce((sum, e) => sum + counts[course.id][e.id], 0);
              const assignableEmps = employees.filter(e => e.assignableCourseIds.includes(course.id));
              const avg = assignableEmps.length > 0 ? totalAssigned / assignableEmps.length : 0;
              return (
                <tr key={course.id} className="hover:bg-yellow-50">
                  <td className="px-4 py-2 font-medium border-r sticky left-0 bg-white z-10">{course.name}</td>
                  <td className="px-4 py-2 text-center font-bold border-r text-gray-700">{totalAssigned}</td>
                  {employees.map(emp => {
                    const count = counts[course.id][emp.id];
                    const canAssign = emp.assignableCourseIds.includes(course.id);
                    let bgColorClass = '', textColorClass = 'text-gray-700';
                    if (!canAssign) {
                      bgColorClass = 'bg-gray-100'; textColorClass = 'text-gray-300';
                    } else if (count > 0 && avg > 0 && count >= avg + 2) {
                      bgColorClass = 'bg-red-100'; textColorClass = 'text-red-700 font-bold';
                    } else if (count > 0) {
                      bgColorClass = 'bg-green-50';
                    }
                    return (
                      <td key={emp.id} className={`px-2 py-2 text-center border-r ${bgColorClass} ${textColorClass}`}>
                        {!canAssign ? '-' : count}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    );
  };

  // ── 日別詳細モーダル ────────────────────────────────────────
  const renderDayDetailModal = () => {
    if (!dayDetailDate) return null;
    const [y, mo, dy] = dayDetailDate.split('-').map(Number);
    const d = new Date(y, mo - 1, dy);
    const dow = d.getDay();
    const dowLabel = weekdays[dow];

    const requiredCourseIds = localRequiredCourses[dayDetailDate] || [];
    const assignments = currentShift?.assignments[dayDetailDate] || {};

    const courseRows = requiredCourseIds.map(courseId => {
      const course = courses.find(c => c.id === courseId);
      const empId = assignments[courseId];
      const emp = employees.find(e => e.id === empId);
      return { course, emp, courseId };
    });

    const assignedEmpIds = new Set(Object.values(assignments));
    const eventRows = employees
      .filter(emp => {
        if (assignedEmpIds.has(emp.id)) return false;
        const ev = emp.events?.[yearMonth]?.[dayDetailDate];
        return ev && ev !== '希望休';
      })
      .map(emp => ({ emp, eventType: emp.events![yearMonth]![dayDetailDate] }));

    const assignedCount = courseRows.filter(r => r.emp).length + eventRows.length;
    const unassignedCount = courseRows.filter(r => !r.emp).length;
    const totalMins =
      courseRows
        .filter(r => r.emp && r.course)
        .reduce((s, r) => s + calculateWorkMinutes(r.course!.startTime, r.course!.endTime, r.course!.breakMinutes), 0) +
      eventRows.length * 480;

    const headerBg =
      dow === 0 ? 'bg-gradient-to-br from-red-500 to-red-700'
      : dow === 6 ? 'bg-gradient-to-br from-blue-500 to-blue-700'
      : 'bg-gradient-to-br from-gray-800 to-gray-950';

    return (
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={() => setDayDetailDate(null)}
      >
        <div
          className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-slide-up"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`${headerBg} px-5 py-4 text-white shrink-0`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-3xl font-black tracking-tight leading-tight">
                  {mo}月{dy}日
                  <span className="text-xl font-bold ml-2 opacity-70">（{dowLabel}）</span>
                </p>
                <p className="text-xs opacity-60 mt-0.5">{yearMonth.replace('-', '年')}月</p>
              </div>
              <button
                onClick={() => setDayDetailDate(null)}
                className="text-white/50 hover:text-white w-8 h-8 flex items-center justify-center text-xl shrink-0 mt-1"
              >✕</button>
            </div>

            <div className="flex gap-2 mt-3 flex-wrap">
              <div className="bg-white/20 rounded-xl px-3 py-1.5 text-center min-w-[64px]">
                <p className="text-[10px] opacity-70 leading-none mb-0.5">出勤</p>
                <p className="text-xl font-black leading-none">
                  {assignedCount}<span className="text-xs font-normal ml-0.5">名</span>
                </p>
              </div>
              {unassignedCount > 0 && (
                <div className="bg-red-400/40 border border-red-300/50 rounded-xl px-3 py-1.5 text-center min-w-[64px]">
                  <p className="text-[10px] opacity-70 leading-none mb-0.5">未割当</p>
                  <p className="text-xl font-black leading-none">
                    {unassignedCount}<span className="text-xs font-normal ml-0.5">件</span>
                  </p>
                </div>
              )}
              <div className="bg-white/20 rounded-xl px-3 py-1.5 text-center min-w-[64px] ml-auto">
                <p className="text-[10px] opacity-70 leading-none mb-0.5">合計時間</p>
                <p className="text-xl font-black leading-none">
                  {Math.floor(totalMins / 60)}<span className="text-xs font-normal">h</span>
                  {totalMins % 60 > 0 && <>{totalMins % 60}<span className="text-xs font-normal">m</span></>}
                </p>
              </div>
            </div>
          </div>

          {/* List */}
          <div className="overflow-auto flex-1 min-h-0 p-4 space-y-2 bg-gray-50">
            {courseRows.length === 0 && eventRows.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                <p className="text-4xl mb-3">🌴</p>
                <p className="font-medium">この日は全員お休みです</p>
              </div>
            ) : (
              <>
                {courseRows.map(({ course, emp, courseId }) => (
                  <div
                    key={courseId}
                    className={`rounded-xl flex items-center gap-3 p-3.5 ${
                      emp
                        ? 'bg-white border border-gray-100 shadow-sm'
                        : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    {emp && course ? (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 text-sm leading-tight">{emp.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="px-2 py-0.5 bg-[#1A1A1A] text-white text-[11px] rounded-md font-semibold leading-tight">
                              {course.name}
                            </span>
                            <span className="text-[11px] text-gray-400">
                              {course.startTime}〜{course.endTime}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {(() => {
                            const mins = calculateWorkMinutes(course.startTime, course.endTime, course.breakMinutes);
                            return (
                              <>
                                <p className="text-2xl font-black text-gray-800 leading-none">
                                  {Math.floor(mins / 60)}<span className="text-sm font-normal text-gray-400">h</span>
                                  {mins % 60 > 0 && <>{mins % 60}<span className="text-xs font-normal text-gray-400">m</span></>}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">実働時間</p>
                              </>
                            );
                          })()}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-red-500 w-full">
                        <AlertTriangle size={15} className="shrink-0" />
                        <div>
                          <p className="font-bold text-sm leading-tight">未割当</p>
                          <p className="text-xs text-red-400">{course?.name}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {eventRows.map(({ emp, eventType }) => (
                  <div
                    key={emp.id}
                    className="rounded-xl flex items-center gap-3 p-3.5 bg-white border border-indigo-100 shadow-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm leading-tight">{emp.name}</p>
                      <span className="mt-1 inline-block px-2 py-0.5 bg-indigo-600 text-white text-[11px] rounded-md font-semibold">
                        {eventType}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-black text-gray-800 leading-none">
                        8<span className="text-sm font-normal text-gray-400">h</span>
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">実働時間</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── 月またぎ連勤用隣接シフトデータ ──────────────────────────
  const prevYM = format(addMonths(parseISO(yearMonth + '-01'), -1), 'yyyy-MM');
  const nextYM = format(addMonths(parseISO(yearMonth + '-01'),  1), 'yyyy-MM');
  const prevShiftData = data.shifts.find(s => s.branchId === currentBranchId && s.yearMonth === prevYM);
  const nextShiftData = data.shifts.find(s => s.branchId === currentBranchId && s.yearMonth === nextYM);

  // ── Score / Validation（月またぎ含む）──────────────────────
  const { score: shiftScore, violations: scoreViolations } = currentShift
    ? calculateShiftScore(
        currentShift, employees, courses, yearMonth, localRequiredCourses,
        prevYM, prevShiftData, nextYM, nextShiftData,
      )
    : { score: 100, violations: [] };

  const crossMonthViolations = scoreViolations.filter(v => v.type === '5連勤（交番またぎ）');
  const regularViolations    = scoreViolations.filter(v => v.type !== '5連勤（交番またぎ）');

  const validationErrors = regularViolations.map(v =>
    v.employeeName !== '—'
      ? `${v.employeeName}さん: ${v.type}（${v.detail}）`
      : v.type === 'コース未割当'
        ? `${v.detail} が未割当`
        : `${v.type}：${v.detail}`
  );

  const totalBadgeCount = scoreViolations.length;

  return (
    <div className="space-y-4 flex flex-col print:bg-white print:m-0 print:p-0 print:block">
      {currentShift && (
        <div className="hidden md:flex flex-col bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 print:hidden gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
              <AlertTriangle className={totalBadgeCount > 0 ? 'text-yellow-500' : 'text-green-500'} size={20} />
              シフト診断
            </h3>
            <div className="text-lg font-bold dark:text-gray-100">
              交番精度スコア: <span className={shiftScore >= 80 ? 'text-green-600' : shiftScore >= 50 ? 'text-yellow-600' : 'text-red-600'}>{shiftScore}</span> / 100点
            </div>
          </div>
          {validationErrors.length > 0 ? (
            <ul className="text-sm text-red-600 list-disc list-inside bg-red-50 p-3 rounded-md max-h-40 overflow-y-auto">
              {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          ) : (
            <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
              すべての必須コースが割り当てられ、ルール違反もありません！
            </div>
          )}
          {crossMonthViolations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                <AlertTriangle size={13} className="text-amber-500" />
                月またぎ連勤（隣接期との境界チェック）
              </p>
              <ul className="text-sm text-amber-800 list-disc list-inside bg-amber-50 border border-amber-200 p-3 rounded-md max-h-32 overflow-y-auto">
                {crossMonthViolations.map((v, i) => (
                  <li key={i}>{v.employeeName}さん: {v.detail}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white dark:bg-gray-800 p-2 md:p-4 rounded-lg shadow-sm gap-2 md:gap-4 shrink-0 print:hidden">
        <div className="flex flex-wrap items-center gap-2 md:gap-4">
          <h2 className="hidden md:flex text-xl font-bold items-center gap-2">
            <Calendar size={24} />
            交番管理
          </h2>
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="border rounded-md px-3 py-1.5 focus:ring-[#FFD700]"
          />
          <span className="hidden md:inline text-sm text-gray-500 dark:text-gray-400">
            ({format(dates[0], 'M月d日')} 〜 {format(dates[dates.length - 1], 'M月d日')})
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={priorityRule}
            onChange={e => setPriorityRule(e.target.value as 'standard' | 'consecutive' | 'fairness')}
            className="border border-gray-300 rounded-md px-2 py-1.5 md:px-3 md:py-2 text-xs md:text-sm focus:ring-[#FFD700] bg-white font-medium"
            title="自動生成の優先ルール"
          >
            <option value="standard">標準（バランス重視）</option>
            <option value="consecutive">連休・飛び石防止重視</option>
            <option value="fairness">公平性（土日・時間）重視</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-[#FFD700] text-[#1A1A1A] font-bold px-3 py-1.5 md:px-4 md:py-2 rounded-lg hover:bg-yellow-400 text-sm flex items-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
          >
            {isGenerating ? (
              <><Loader2 size={15} className="animate-spin-ui" />生成中…</>
            ) : '自動生成'}
          </button>
          <button onClick={handleCopyFromPrevMonth} className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium px-3 py-1.5 md:px-4 md:py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-1.5 text-sm">
            前月コピー
          </button>
          <button onClick={handleClear} className="bg-white dark:bg-gray-700 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 font-bold px-3 py-1.5 md:px-4 md:py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-sm">
            クリア
          </button>
          <button
            onClick={exportCSV}
            disabled={!currentShift}
            className="flex bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium px-3 py-1.5 md:px-4 md:py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Download size={16} />
            CSV
          </button>
          <button
            onClick={() => window.print()}
            disabled={!currentShift}
            className="flex bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium px-3 py-1.5 md:px-4 md:py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Printer size={16} />
            <span className="hidden md:inline">印刷</span>
            <span className="md:hidden">PDF</span>
          </button>
        </div>
      </div>

      {draftMetrics && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-indigo-100 dark:border-indigo-900 p-3 print:hidden">
          <p className="font-bold text-indigo-800 dark:text-indigo-300 text-sm mb-2">📊 提案比較（行をタップして切り替え）</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm border-collapse">
              <thead>
                <tr className="bg-indigo-50">
                  <th className="px-2 py-1.5 text-left border border-indigo-100 font-semibold text-indigo-700 whitespace-nowrap">提案</th>
                  <th className="px-2 py-1.5 text-center border border-indigo-100 font-semibold text-indigo-700 whitespace-nowrap">スコア</th>
                  <th className="px-2 py-1.5 text-center border border-indigo-100 font-semibold text-indigo-700 whitespace-nowrap">未割当</th>
                  <th className="px-2 py-1.5 text-center border border-indigo-100 font-semibold text-indigo-700 whitespace-nowrap">違反</th>
                  <th className="px-2 py-1.5 text-center border border-indigo-100 font-semibold text-indigo-700 whitespace-nowrap">土日格差</th>
                  <th className="px-2 py-1.5 text-center border border-indigo-100 font-semibold text-indigo-700 whitespace-nowrap">時間差</th>
                </tr>
              </thead>
              <tbody>
                {draftMetrics.items.map((m, i) => {
                  const isActive = activeDraftIndex === i;
                  const { best } = draftMetrics;
                  return (
                    <tr
                      key={i}
                      onClick={() => handleTabChange(i)}
                      className={`cursor-pointer transition-colors ${
                        isActive ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-500' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className={`px-2 py-2 border border-gray-200 font-bold whitespace-nowrap ${isActive ? 'text-indigo-700' : 'text-gray-600'}`}>
                        提案{i + 1}{isActive ? ' ✓' : ''}
                      </td>
                      <td className={`px-2 py-2 border border-gray-200 text-center font-bold ${m.score === best.score ? 'bg-green-100 text-green-700' : 'text-gray-600'}`}>
                        {m.score}点
                      </td>
                      <td
                        className={`px-2 py-2 border border-gray-200 text-center ${m.unassigned === best.unassigned ? 'bg-green-100 text-green-700 font-bold' : m.unassigned > 0 ? 'text-red-600 font-bold' : 'text-gray-600'} ${m.unassigned > 0 ? 'cursor-pointer hover:opacity-70' : ''}`}
                        onClick={(e) => { e.stopPropagation(); if (m.unassigned > 0) setDraftViolationModal({ patternIndex: i, mode: 'unassigned' }); }}
                      >
                        {m.unassigned}件{m.unassigned > 0 && <span className="ml-0.5 text-[10px]">🔍</span>}
                      </td>
                      <td
                        className={`px-2 py-2 border border-gray-200 text-center ${m.errors === best.errors && m.errors === 0 ? 'bg-green-100 text-green-700 font-bold' : m.errors > 0 ? 'text-yellow-700 font-bold' : 'text-gray-600'} ${m.errors > 0 ? 'cursor-pointer hover:opacity-70' : ''}`}
                        onClick={(e) => { e.stopPropagation(); if (m.errors > 0) setDraftViolationModal({ patternIndex: i, mode: 'violations' }); }}
                      >
                        {m.errors}件{m.errors > 0 && <span className="ml-0.5 text-[10px]">🔍</span>}
                      </td>
                      <td className={`px-2 py-2 border border-gray-200 text-center ${m.weekendGap === best.weekendGap ? 'bg-green-100 text-green-700 font-bold' : 'text-gray-600'}`}>
                        {m.weekendGap}日
                      </td>
                      <td className={`px-2 py-2 border border-gray-200 text-center ${m.hoursGapH === best.hoursGapH ? 'bg-green-100 text-green-700 font-bold' : 'text-gray-600'}`}>
                        {m.hoursGapH}h
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">緑 = 各指標の最良値　🔍 = タップして詳細確認</p>
        </div>
      )}

      {/* 未割当提案パネル */}
      {draftSuggestions[activeDraftIndex]?.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-3 print:hidden">
          <p className="font-bold text-amber-800 dark:text-amber-300 text-sm mb-2 flex items-center gap-1.5">
            <AlertTriangle size={15} />
            提案{activeDraftIndex + 1} の未割当を解消するには
          </p>
          <div className="space-y-2">
            {draftSuggestions[activeDraftIndex].map((s, i) => {
              const [, m, d] = s.dateStr.split('-');
              return (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1">
                    {Number(m)}/{Number(d)}「{s.courseName}」
                  </p>
                  <ul className="space-y-0.5">
                    {s.reasons.map((r, j) => (
                      <li key={j} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1">
                        <span className="text-amber-500 shrink-0 mt-0.5">→</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 md:gap-2 shrink-0 bg-white dark:bg-gray-800 p-1 rounded-lg shadow-sm self-start print:hidden">
        <button
          onClick={() => setViewMode('staff')}
          className={`px-2.5 py-1.5 md:px-4 md:py-2 rounded-md font-medium flex items-center gap-1.5 md:gap-2 transition-colors text-sm ${viewMode === 'staff' ? 'bg-[#1A1A1A] text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
          <Users size={16} />
          社員
          {validationErrors.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 leading-5 min-w-[20px] text-center">
              {validationErrors.length > 99 ? '99+' : validationErrors.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setViewMode('calendar')}
          className={`px-2.5 py-1.5 md:px-4 md:py-2 rounded-md font-medium flex items-center gap-1.5 md:gap-2 transition-colors text-sm ${viewMode === 'calendar' ? 'bg-[#1A1A1A] text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
          <Calendar size={16} />
          <span className="md:hidden">コース</span>
          <span className="hidden md:inline">コース名</span>
          {unassignedCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 leading-5 min-w-[20px] text-center">
              {unassignedCount > 99 ? '99+' : unassignedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setViewMode('course')}
          className={`px-2.5 py-1.5 md:px-4 md:py-2 rounded-md font-medium flex items-center gap-1.5 md:gap-2 transition-colors text-sm ${viewMode === 'course' ? 'bg-[#1A1A1A] text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
          <Building size={16} />
          <span className="md:hidden">偏差</span>
          <span className="hidden md:inline">コース偏差</span>
        </button>
        <div className="w-px bg-gray-300 mx-0.5 md:mx-1"></div>
        <button
          onClick={() => setViewMode('daily')}
          className={`px-2.5 py-1.5 md:px-4 md:py-2 rounded-md font-medium flex items-center gap-1.5 md:gap-2 transition-colors text-sm ${viewMode === 'daily' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
          <SettingsIcon size={16} />
          日別コース設定
        </button>
        <button
          onClick={() => setViewMode('offdays')}
          className={`px-2.5 py-1.5 md:px-4 md:py-2 rounded-md font-medium flex items-center gap-1.5 md:gap-2 transition-colors text-sm ${viewMode === 'offdays' ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
          <Cog size={16} />
          予定
        </button>
      </div>

      {viewMode === 'daily' ? (
        <div className="flex flex-col pb-4 print:overflow-visible">
          {renderDailyCourseView()}
        </div>
      ) : viewMode === 'offdays' ? (
        <div className="flex flex-col pb-4 print:overflow-visible">
          {renderEventsView()}
        </div>
      ) : viewMode === 'course' ? (
        <div className="flex flex-col pb-4 print:overflow-visible">
          {renderCourseView()}
        </div>
      ) : !currentShift ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 print:hidden">
          <Calendar size={48} className="mb-4 opacity-50 text-gray-400" />
          <p>交番が作成されていません。</p>
          <p className="text-sm">「自動生成」ボタンを押して作成してください。</p>
        </div>
      ) : (
        <div className="flex flex-col pb-4 print:overflow-visible">
          {viewMode === 'staff' && renderStaffView()}
          {viewMode === 'calendar' && renderCalendarView()}
        </div>
      )}

      {/* Mobile drag ghost — follows finger during long-press drag */}
      {ghostInfo.visible && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 text-white text-sm font-bold px-3 py-2 rounded-lg shadow-2xl border-2 border-yellow-400"
          style={{ left: ghostInfo.x, top: ghostInfo.y - 56, transform: 'translateX(-50%)' }}
        >
          {ghostInfo.text}
        </div>
      )}

      {/* Draft violation / unassigned detail modal */}
      {draftViolationModal && draftMetrics && (() => {
        const { mode, patternIndex } = draftViolationModal;
        const item = draftMetrics.items[patternIndex];
        const list: ScoreViolation[] = mode === 'violations' ? item.violationList : item.unassignedList;
        const title = mode === 'violations'
          ? `提案${patternIndex + 1} の違反 (${list.length}件)`
          : `提案${patternIndex + 1} の未割当コース (${list.length}件)`;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setDraftViolationModal(null)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 max-h-[75vh] flex flex-col animate-slide-up"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm">{title}</h3>
                <button onClick={() => setDraftViolationModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1">
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4 space-y-2">
                {list.map((v, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-3 py-2.5 flex items-start gap-2 ${
                      v.severity === 'error' || mode === 'unassigned'
                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                    }`}
                  >
                    <AlertTriangle size={14} className={`shrink-0 mt-0.5 ${v.severity === 'error' || mode === 'unassigned' ? 'text-red-500' : 'text-yellow-500'}`} />
                    <div className="min-w-0">
                      {v.employeeName !== '—' && (
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-0.5">{v.employeeName}</p>
                      )}
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{v.type}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{v.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Day detail modal */}
      {dayDetailDate && renderDayDetailModal()}

      {/* Employee detail modal */}
      {empModalId && (() => {
        const emp = employees.find(e => e.id === empModalId);
        if (!emp) return null;
        let modalWorkDays = 0, modalWeekendWork = 0, modalTotalMinutes = 0;
        const modalRows = dateStrings.map((dateStr, idx) => {
          const d = dates[idx];
          const dow = d.getDay();
          const assignedCourseId = currentShift
            ? Object.keys(currentShift.assignments[dateStr] || {}).find(cId => currentShift.assignments[dateStr][cId] === emp.id)
            : undefined;
          const course = courses.find(c => c.id === assignedCourseId);
          const eventType = emp.events?.[yearMonth]?.[dateStr] || (emp.desiredOffDays?.[yearMonth]?.includes(dateStr) ? '希望休' : '');
          if (assignedCourseId && course) {
            modalWorkDays++;
            if (dow === 0 || dow === 6) modalWeekendWork++;
            modalTotalMinutes += calculateWorkMinutes(course.startTime, course.endTime, course.breakMinutes);
          } else if (eventType && eventType !== '希望休') {
            modalWorkDays++;
            if (dow === 0 || dow === 6) modalWeekendWork++;
            modalTotalMinutes += 480;
          }
          return { dateStr, d, dow, course, eventType, assignedCourseId };
        });
        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
            onClick={() => setEmpModalId(null)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm max-h-[88vh] overflow-hidden flex flex-col shadow-2xl animate-slide-up"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-3 bg-[#1A1A1A] text-white flex items-center justify-between shrink-0">
                <div>
                  <p className="font-bold text-base">{emp.name}</p>
                  <p className="text-[11px] text-gray-400">{yearMonth.replace('-', '年')}月</p>
                </div>
                <button onClick={() => setEmpModalId(null)} className="text-gray-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center">✕</button>
              </div>
              {/* Stats */}
              <div className="grid grid-cols-4 divide-x divide-gray-200 dark:divide-gray-700 border-b border-gray-200 dark:border-gray-700 shrink-0">
                {[
                  { label: '出勤', value: modalWorkDays, sub: `/ ${emp.maxDaysPerMonth}日`, warn: modalWorkDays > emp.maxDaysPerMonth || modalWorkDays < emp.minDaysPerMonth },
                  { label: '休日', value: dates.length - modalWorkDays, sub: '日', warn: false },
                  { label: '土日出勤', value: modalWeekendWork, sub: '日', warn: false },
                  { label: '労働時間', value: `${Math.floor(modalTotalMinutes / 60)}h`, sub: `${modalTotalMinutes % 60}m`, warn: false },
                ].map(({ label, value, sub, warn }) => (
                  <div key={label} className="py-3 text-center">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
                    <p className={`text-lg font-bold leading-tight ${warn ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}`}>{value}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</p>
                  </div>
                ))}
              </div>
              {/* Day list */}
              <div className="overflow-auto flex-1 min-h-0">
                {modalRows.map(({ dateStr, d, dow, course, eventType, assignedCourseId }) => (
                  <div
                    key={dateStr}
                    className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 ${dow === 0 ? 'bg-red-50' : dow === 6 ? 'bg-blue-50' : ''}`}
                  >
                    <div className={`w-9 text-center shrink-0 ${dow === 0 ? 'text-red-600' : dow === 6 ? 'text-blue-600' : 'text-gray-700'}`}>
                      <p className="font-bold text-sm leading-tight">{format(d, 'd')}</p>
                      <p className="text-[10px] leading-tight">{weekdays[dow]}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      {assignedCourseId && course ? (
                        <span className="inline-block bg-[#1A1A1A] text-white text-xs px-2 py-0.5 rounded font-medium">{course.name}</span>
                      ) : eventType === '希望休' ? (
                        <span className="text-gray-500 text-sm">◎ 希望休</span>
                      ) : eventType ? (
                        <span className="text-blue-600 text-sm font-medium">{eventType}</span>
                      ) : (
                        <span className="text-gray-300 text-sm">○ 休み</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
