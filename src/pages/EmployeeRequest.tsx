import React, { useState, useMemo } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { useAppContext } from '../store/AppContext';

export const EmployeeRequest: React.FC = () => {
  const { data, updateEmployee } = useAppContext();
  
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [currentDate, setCurrentDate] = useState(new Date());

  const yearMonth = format(currentDate, 'yyyy-MM');
  const dateStrings = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end }).map(d => format(d, 'yyyy-MM-dd'));
  }, [currentDate]);

  const branchEmployees = useMemo(() => {
    if (!selectedBranchId) return [];
    return data.employees.filter(e => e.branchId === selectedBranchId);
  }, [selectedBranchId, data.employees]);

  const selectedEmployee = data.employees.find(e => e.id === selectedEmployeeId);

  // Local state for the employee's desired off days to prevent immediate saving on every click
  const [localDesiredOffDays, setLocalDesiredOffDays] = useState<string[]>([]);

  // Initialize local state when employee or month changes
  React.useEffect(() => {
    if (selectedEmployee) {
      setLocalDesiredOffDays(selectedEmployee.desiredOffDays?.[yearMonth] || []);
    } else {
      setLocalDesiredOffDays([]);
    }
  }, [selectedEmployee, yearMonth]);

  const toggleOffDay = (dateStr: string) => {
    if (!selectedEmployee) return;
    setLocalDesiredOffDays(prev => {
      if (prev.includes(dateStr)) {
        return prev.filter(d => d !== dateStr);
      } else {
        return [...prev, dateStr];
      }
    });
  };

  const handleSave = () => {
    if (!selectedEmployee) return;
    updateEmployee({
      ...selectedEmployee,
      desiredOffDays: {
        ...(selectedEmployee.desiredOffDays || {}),
        [yearMonth]: localDesiredOffDays
      }
    });
    alert('希望休を提出しました！');
  };

  const getDayColor = (dateStr: string) => {
    const day = getDay(new Date(dateStr));
    if (day === 0) return 'text-red-500';
    if (day === 6) return 'text-blue-500';
    return 'text-gray-700';
  };

  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#FFD700] p-6 text-center">
          <h1 className="text-2xl font-bold text-[#1A1A1A]">希望休 提出フォーム</h1>
          <p className="text-[#1A1A1A] opacity-80 mt-1 text-sm font-medium">スマホから簡単申請</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Branch & Employee Selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">所属支店</label>
              <select
                className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:ring-2 focus:ring-[#FFD700] focus:border-transparent transition-all"
                value={selectedBranchId}
                onChange={e => {
                  setSelectedBranchId(e.target.value);
                  setSelectedEmployeeId('');
                }}
              >
                <option value="">支店を選択してください</option>
                {data.branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {selectedBranchId && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">氏名</label>
                <select
                  className="w-full border-gray-300 rounded-xl px-4 py-3 bg-gray-50 focus:ring-2 focus:ring-[#FFD700] focus:border-transparent transition-all"
                  value={selectedEmployeeId}
                  onChange={e => setSelectedEmployeeId(e.target.value)}
                >
                  <option value="">氏名を選択してください</option>
                  {branchEmployees.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Calendar Section */}
          {selectedEmployee && (
            <div className="mt-8 animate-fade-in">
              <div className="flex items-center justify-between mb-4 bg-gray-100 p-2 rounded-xl">
                <button
                  onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors font-bold text-gray-600"
                >
                  &lt; 前月
                </button>
                <h2 className="text-lg font-bold text-gray-800">
                  {format(currentDate, 'yyyy年 M月')}
                </h2>
                <button
                  onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors font-bold text-gray-600"
                >
                  次月 &gt;
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-2">
                {weekDays.map((day, i) => (
                  <div key={day} className={`text-center text-xs font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Add blank spaces for the first week to align dates properly */}
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: getDay(new Date(dateStrings[0])) }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                
                {dateStrings.map(dateStr => {
                  const isOff = localDesiredOffDays.includes(dateStr);
                  const isEvent = selectedEmployee.events?.[yearMonth]?.[dateStr] && selectedEmployee.events?.[yearMonth]?.[dateStr] !== '希望休';
                  const dateNum = format(new Date(dateStr), 'd');
                  
                  return (
                    <button
                      key={dateStr}
                      onClick={() => !isEvent && toggleOffDay(dateStr)}
                      disabled={!!isEvent}
                      className={`
                        aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-200
                        ${isEvent ? 'bg-gray-200 cursor-not-allowed opacity-50' : 
                          isOff ? 'bg-[#1A1A1A] text-white shadow-md transform scale-105' : 'bg-gray-50 hover:bg-gray-100 border border-gray-100'}
                      `}
                    >
                      <span className={`text-sm font-bold ${isOff ? 'text-white' : getDayColor(dateStr)}`}>
                        {dateNum}
                      </span>
                      <span className="text-xs font-bold mt-1 h-4 flex items-center justify-center">
                        {isEvent ? '-' : isOff ? '◎' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8">
                <button
                  onClick={handleSave}
                  className="w-full bg-[#FFD700] text-[#1A1A1A] font-bold py-4 rounded-xl shadow-lg hover:bg-yellow-400 transform transition-all active:scale-95 text-lg flex items-center justify-center gap-2"
                >
                  この内容で提出する
                </button>
                <p className="text-center text-xs text-gray-400 mt-3">
                  ※店長がシフトを確定する前であれば、何度でも修正可能です。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
