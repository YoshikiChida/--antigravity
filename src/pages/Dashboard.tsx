import React, { useState, useMemo, useEffect } from 'react';
import { format, addMonths, subMonths, parseISO } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { useAppContext } from '../store/AppContext';
import { getShiftDateRange, calculateWorkMinutes, calculateShiftScore } from '../utils/shiftLogic';
import {
  AlertTriangle, CheckCircle, Clock, CalendarDays, TrendingUp, ChevronDown,
} from 'lucide-react';
import { useCountUp } from '../hooks/useCountUp';

const parseLocalDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// ── Score ring ────────────────────────────────────────────────
const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const radius = 38;
  const circ = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circ);
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
  const animated = useCountUp(score, 1000);

  useEffect(() => {
    const t = setTimeout(() => {
      setOffset(circ - (score / 100) * circ);
    }, 100);
    return () => clearTimeout(t);
  }, [score, circ]);

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-gray-100 dark:text-gray-700" />
        <circle
          cx="48" cy="48" r={radius} fill="none"
          stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="score-ring-circle"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black leading-none" style={{ color }}>{animated}</span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-none mt-0.5">/ 100</span>
      </div>
    </div>
  );
};

// ── KPI card with count-up ────────────────────────────────────
const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | null;
  unit: string;
  iconBg: string;
  valueColor?: string;
}> = ({ icon, label, value, unit, iconBg, valueColor }) => {
  const animated = useCountUp(value ?? 0, 900);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex items-center gap-4 transition-colors">
      <div className={`p-3 rounded-2xl shrink-0 ${iconBg}`}>{icon}</div>
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        {value !== null ? (
          <p className={`text-3xl font-black leading-tight ${valueColor ?? 'text-gray-800 dark:text-gray-100'}`}>
            {animated}
            <span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-0.5">{unit}</span>
          </p>
        ) : (
          <p className="text-3xl font-black text-gray-300 dark:text-gray-600">—</p>
        )}
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { data } = useAppContext();

  const currentBranchId = data.currentBranchId;
  const employees = data.employees.filter(e => e.branchId === currentBranchId);
  const courses   = data.courses.filter(c => c.branchId === currentBranchId);

  const savedMonths = useMemo(() =>
    data.shifts.filter(s => s.branchId === currentBranchId).map(s => s.yearMonth),
    [data.shifts, currentBranchId]
  );

  const selectableMonths = useMemo(() => {
    const set = new Set(savedMonths);
    const nextMonth = format(addMonths(new Date(), 1), 'yyyy-MM');
    set.add(nextMonth);
    if (savedMonths.length > 0) {
      const sorted = [...savedMonths].sort();
      const [ey, em] = sorted[0].split('-').map(Number);
      const [ly, lm] = sorted[sorted.length - 1].split('-').map(Number);
      set.add(format(subMonths(new Date(ey, em - 1, 1), 1), 'yyyy-MM'));
      set.add(format(addMonths(new Date(ly, lm - 1, 1), 1), 'yyyy-MM'));
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [savedMonths]);

  const [selectedYM, setSelectedYM] = useState('');

  useEffect(() => {
    const nextMonth = format(addMonths(new Date(), 1), 'yyyy-MM');
    if (!selectedYM || !selectableMonths.includes(selectedYM)) {
      setSelectedYM(selectableMonths.includes(nextMonth) ? nextMonth : selectableMonths[0] ?? nextMonth);
    }
  }, [selectableMonths]);

  const selectedShift = useMemo(() =>
    data.shifts.find(s => s.branchId === currentBranchId && s.yearMonth === selectedYM) ?? null,
    [data.shifts, currentBranchId, selectedYM]
  );

  const dateStrings = useMemo(() =>
    selectedYM ? getShiftDateRange(selectedYM).map(d => format(d, 'yyyy-MM-dd')) : [],
    [selectedYM]
  );

  const analytics = useMemo(() => {
    if (!selectedShift || !selectedYM || employees.length === 0) return null;
    const prevYM = format(addMonths(parseISO(selectedYM + '-01'), -1), 'yyyy-MM');
    const nextYM = format(addMonths(parseISO(selectedYM + '-01'),  1), 'yyyy-MM');
    const prevShiftData = data.shifts.find(s => s.branchId === currentBranchId && s.yearMonth === prevYM);
    const nextShiftData = data.shifts.find(s => s.branchId === currentBranchId && s.yearMonth === nextYM);
    const { score, violations } = calculateShiftScore(
      selectedShift, employees, courses, selectedYM, selectedShift.requiredCourses,
      prevYM, prevShiftData, nextYM, nextShiftData,
    );
    const totalUnassigned = violations.filter(v => v.type === 'コース未割当').length;
    const empStats = employees.map(emp => {
      let weekendWork = 0, totalMins = 0, workDays = 0;
      dateStrings.forEach(dateStr => {
        const assignedCourseId = Object.keys(selectedShift.assignments[dateStr] ?? {}).find(
          cId => selectedShift.assignments[dateStr][cId] === emp.id
        );
        const eventType = emp.events?.[selectedYM]?.[dateStr] ??
          (emp.desiredOffDays?.[selectedYM]?.includes(dateStr) ? '希望休' : '');
        const isWorking = !!(assignedCourseId || (eventType && eventType !== '希望休'));
        if (isWorking) {
          workDays++;
          const dow = parseLocalDate(dateStr).getDay();
          if (dow === 0 || dow === 6) weekendWork++;
          if (assignedCourseId) {
            const course = courses.find(c => c.id === assignedCourseId);
            if (course) totalMins += calculateWorkMinutes(course.startTime, course.endTime, course.breakMinutes);
          } else {
            totalMins += 480;
          }
        }
      });
      return { name: emp.name, hours: Math.round(totalMins / 60), weekendWork, workDays };
    });
    return { empStats, totalUnassigned, score, violations };
  }, [selectedShift, employees, courses, dateStrings, selectedYM, data.shifts, currentBranchId]);

  if (selectableMonths.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 py-20 transition-colors">
        <TrendingUp size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200">データがありません</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">交番管理画面からシフトを生成してください。</p>
      </div>
    );
  }

  const avgHours = analytics
    ? analytics.empStats.reduce((a, e) => a + e.hours, 0) / (analytics.empStats.length || 1)
    : 0;

  const weekendGap = analytics && analytics.empStats.length > 1
    ? Math.max(...analytics.empStats.map(e => e.weekendWork)) -
      Math.min(...analytics.empStats.map(e => e.weekendWork))
    : null;

  const scoreLevel =
    !analytics           ? 'gray'   :
    analytics.score >= 80 ? 'green' :
    analytics.score >= 50 ? 'yellow' : 'red';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800 dark:text-gray-100">
          <TrendingUp className="text-[#FFD700]" />
          ダッシュボード
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">対象月</span>
          <div className="relative">
            <select
              value={selectedYM}
              onChange={e => setSelectedYM(e.target.value)}
              className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-xl pl-3 pr-8 py-2 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FFD700] cursor-pointer transition-colors"
            >
              {selectableMonths.map(ym => (
                <option key={ym} value={ym}>{ym}{savedMonths.includes(ym) ? '' : ' (未生成)'}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Score ring card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex items-center gap-4 transition-colors">
          <ScoreRing score={analytics?.score ?? 0} />
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">総合精度スコア</p>
            <p className={`text-sm font-bold mt-1 ${
              scoreLevel === 'green'  ? 'text-green-600'
              : scoreLevel === 'yellow' ? 'text-yellow-600'
              : scoreLevel === 'red'    ? 'text-red-600'
              : 'text-gray-400'
            }`}>
              {scoreLevel === 'green' ? '優良' : scoreLevel === 'yellow' ? '改善余地あり' : scoreLevel === 'red' ? '要改善' : '—'}
            </p>
          </div>
        </div>

        <KpiCard
          icon={<AlertTriangle size={24} className={(analytics?.totalUnassigned ?? 1) === 0 ? 'text-green-600' : 'text-red-500'} />}
          iconBg={(analytics?.totalUnassigned ?? 1) === 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}
          label="未割当コース"
          value={analytics?.totalUnassigned ?? null}
          unit="件"
          valueColor={(analytics?.totalUnassigned ?? 1) === 0 ? 'text-green-600' : 'text-red-600'}
        />

        <KpiCard
          icon={<CalendarDays size={24} className={(analytics?.violations.length ?? 1) === 0 ? 'text-green-600' : 'text-orange-500'} />}
          iconBg={(analytics?.violations.length ?? 1) === 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'}
          label="ルール違反件数"
          value={analytics?.violations.length ?? null}
          unit="件"
          valueColor={(analytics?.violations.length ?? 1) === 0 ? 'text-green-600' : 'text-orange-600'}
        />

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex items-center gap-4 transition-colors">
          <div className="p-3 rounded-2xl bg-purple-100 dark:bg-purple-900/30 shrink-0">
            <Clock size={24} className="text-purple-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">土日出勤 格差</p>
            {weekendGap !== null ? (
              <p className={`text-3xl font-black leading-tight ${weekendGap <= 2 ? 'text-green-600' : weekendGap <= 4 ? 'text-yellow-600' : 'text-red-600'}`}>
                {weekendGap}
                <span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-0.5">日差</span>
              </p>
            ) : (
              <p className="text-3xl font-black text-gray-300 dark:text-gray-600">—</p>
            )}
          </div>
        </div>
      </div>

      {!analytics && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4 text-yellow-700 dark:text-yellow-300 text-sm">
          選択した月のシフトデータが見つかりません。
        </div>
      )}

      {analytics && (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="text-blue-500" size={18} />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">月間労働時間 (h)</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.empStats} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150,150,150,0.15)" />
                    <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(150,150,150,0.08)' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.15)', fontSize: 12 }}
                      formatter={(v) => [`${v}h`, '月間労働時間']}
                    />
                    <ReferenceLine
                      y={Math.round(avgHours)} stroke="#9CA3AF" strokeDasharray="4 3"
                      label={{ value: `平均 ${Math.round(avgHours)}h`, fill: '#9CA3AF', fontSize: 10, position: 'insideTopRight' }}
                    />
                    <Bar dataKey="hours" name="月間労働時間" radius={[6, 6, 0, 0]}>
                      {analytics.empStats.map((e, i) => (
                        <Cell key={`h-${i}`} fill={
                          e.hours > avgHours + 20 ? '#EF4444' :
                          e.hours < avgHours - 20 ? '#FBBF24' : '#3B82F6'
                        } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                赤: 平均+20h超 &nbsp;|&nbsp; 黄: 平均-20h超 &nbsp;|&nbsp; 青: 適正範囲
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="text-purple-500" size={18} />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">土日出勤日数 (回)</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.empStats} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(150,150,150,0.15)" />
                    <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(150,150,150,0.08)' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.15)', fontSize: 12 }}
                      formatter={(v) => [`${v}回`, '土日出勤日数']}
                    />
                    <Bar dataKey="weekendWork" name="土日出勤日数" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Violations */}
          {analytics.violations.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 transition-colors">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="text-orange-500" size={18} />
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">ルール違反・警告一覧</h3>
                <span className="ml-auto text-xs bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300 font-bold px-2 py-0.5 rounded-full">
                  {analytics.violations.length} 件
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 dark:text-gray-400 uppercase">
                      <th className="text-left px-4 py-2 rounded-l font-semibold">社員名</th>
                      <th className="text-left px-4 py-2 font-semibold">種別</th>
                      <th className="text-left px-4 py-2 rounded-r font-semibold">詳細</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.violations.map((v, i) => (
                      <tr key={i} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{v.employeeName}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            v.severity === 'error'
                              ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                              : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'
                          }`}>
                            {v.severity === 'error' ? '⚠ エラー' : '△ 警告'}　{v.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{v.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-2xl p-4 flex items-center gap-3 text-green-700 dark:text-green-300">
              <CheckCircle size={20} />
              <span className="font-semibold text-sm">ルール違反は検出されませんでした</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
