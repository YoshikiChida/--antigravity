import React, { useEffect, useState } from 'react';
import { format, addMonths } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { calculateShiftScore } from '../utils/shiftLogic';
import { checkAndNotify, loadNotificationSettings } from '../utils/notifications';

export const StartupNotice: React.FC = () => {
  const { data } = useAppContext();
  const [notices, setNotices] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const key = `startupNoticeShown_${data.currentBranchId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');

    // プッシュ通知チェック（設定済みなら）
    checkAndNotify(loadNotificationSettings()).catch(console.error);

    const branchId = data.currentBranchId;
    if (!branchId) return;

    const courses = data.courses.filter(c => c.branchId === branchId);
    const employees = data.employees.filter(e => e.branchId === branchId);
    const now = new Date();
    const msgs: string[] = [];

    for (const ym of [format(now, 'yyyy-MM'), format(addMonths(now, 1), 'yyyy-MM')]) {
      const shift = data.shifts.find(s => s.branchId === branchId && s.yearMonth === ym);
      const label = `${Number(ym.split('-')[1])}月`;

      if (!shift) {
        msgs.push(`📋 ${label}の交番がまだ作成されていません`);
        continue;
      }

      const { violations } = calculateShiftScore(
        shift, employees, courses, ym, shift.requiredCourses
      );
      const unassigned = violations.filter(v => v.type === 'コース未割当').length;
      const errors = violations.filter(
        v => v.severity === 'error' && v.type !== 'コース未割当'
      ).length;

      if (unassigned > 0) msgs.push(`⚠️ ${label}に未割当コースが ${unassigned} 件あります`);
      if (errors > 0) msgs.push(`🔴 ${label}にルール違反が ${errors} 件あります`);
    }

    if (msgs.length > 0) {
      setNotices(msgs);
      setOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.currentBranchId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded-xl">
            <AlertTriangle size={22} className="text-yellow-600 dark:text-yellow-400" />
          </div>
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg">確認事項</h3>
        </div>
        <ul className="space-y-2">
          {notices.map((msg, i) => (
            <li
              key={i}
              className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
            >
              {msg}
            </li>
          ))}
        </ul>
        <button
          onClick={() => setOpen(false)}
          className="w-full bg-[#FFD700] text-[#1A1A1A] font-bold py-3 rounded-xl hover:bg-yellow-400 active:scale-95 transition-all"
        >
          確認しました
        </button>
      </div>
    </div>
  );
};
