import React, { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../store/AppContext';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { type Employee } from '../types';

export const EmployeeManage: React.FC = () => {
  const { data, addEmployee, updateEmployee, deleteEmployee } = useAppContext();
  const currentBranchId = data.currentBranchId;
  const employees = data.employees.filter((e) => e.branchId === currentBranchId);
  const courses = data.courses.filter((c) => c.branchId === currentBranchId);
  const topRef = useRef<HTMLDivElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee>>({
    name: '',
    employeeId: '',
    assignableCourseIds: [],
    minDaysPerMonth: 15,
    maxDaysPerMonth: 22,
    maxDaysPerWeek: 5,
    desiredOffDays: {},
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBranchId || !editingEmployee.name || !editingEmployee.employeeId) return;

    if (editingEmployee.id) {
      updateEmployee(editingEmployee as Employee);
    } else {
      addEmployee({
        ...editingEmployee,
        id: uuidv4(),
        branchId: currentBranchId,
      } as Employee);
    }
    setIsEditing(false);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsEditing(true);
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    if (confirm('本当にこの社員を削除しますか？')) {
      deleteEmployee(id);
    }
  };

  const toggleCourse = (courseId: string) => {
    setEditingEmployee((prev) => {
      const current = prev.assignableCourseIds || [];
      const updated = current.includes(courseId)
        ? current.filter((id) => id !== courseId)
        : [...current, courseId];
      return { ...prev, assignableCourseIds: updated };
    });
  };

  return (
    <div className="space-y-6" ref={topRef}>
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold dark:text-gray-100">社員管理</h2>
        <button
          onClick={() => {
            setEditingEmployee({
              name: '',
              employeeId: '',
              assignableCourseIds: [],
              minDaysPerMonth: 15,
              maxDaysPerMonth: 22,
              maxDaysPerWeek: 5,
              desiredOffDays: {},
            });
            setIsEditing(true);
            topRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="bg-[#1A1A1A] text-white px-4 py-2 rounded-lg hover:bg-gray-800 flex items-center gap-2"
        >
          <Plus size={20} />
          新規社員追加
        </button>
      </div>

      {isEditing && (
        <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-[#FFD700]">
          <h3 className="text-lg font-bold mb-4 dark:text-gray-100">{editingEmployee.id ? '社員編集' : '新規社員追加'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">氏名 *</label>
              <input
                type="text"
                required
                value={editingEmployee.name || ''}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:ring-[#FFD700]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">社員番号 *</label>
              <input
                type="text"
                required
                value={editingEmployee.employeeId || ''}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, employeeId: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:ring-[#FFD700]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">月間最小出勤日数</label>
              <input
                type="number"
                min="0"
                max="31"
                value={editingEmployee.minDaysPerMonth || 0}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, minDaysPerMonth: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-md focus:ring-[#FFD700]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">月間最大出勤日数</label>
              <input
                type="number"
                min="0"
                max="31"
                value={editingEmployee.maxDaysPerMonth || 0}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, maxDaysPerMonth: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-md focus:ring-[#FFD700]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">1週間の最大勤務数</label>
              <input
                type="number"
                min="0"
                max="7"
                value={editingEmployee.maxDaysPerWeek || 0}
                onChange={(e) => setEditingEmployee({ ...editingEmployee, maxDaysPerWeek: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-md focus:ring-[#FFD700]"
              />
            </div>

            <div className="md:col-span-2 mt-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">担当可能コース</label>
              {courses.length === 0 ? (
                <p className="text-sm text-red-500">先にコースを登録してください。</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {courses.map((course) => {
                    const isSelected = editingEmployee.assignableCourseIds?.includes(course.id);
                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => toggleCourse(course.id)}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                          isSelected
                            ? 'bg-[#FFD700] border-[#FFD700] text-[#1A1A1A] font-semibold'
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-[#FFD700]'
                        }`}
                      >
                        {course.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200"
            >
              キャンセル
            </button>
            <button type="submit" className="bg-[#FFD700] text-[#1A1A1A] font-bold px-4 py-2 rounded-lg hover:bg-yellow-400">
              保存
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">社員番号</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">氏名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">出勤日数(最小〜最大)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">週最大</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">担当コース</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  社員が登録されていません
                </td>
              </tr>
            ) : (
              employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{employee.employeeId}</td>
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{employee.name}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                    {employee.minDaysPerMonth} 〜 {employee.maxDaysPerMonth} 日
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{employee.maxDaysPerWeek} 日</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {employee.assignableCourseIds.length === 0 ? (
                        <span className="text-gray-400 text-xs">なし</span>
                      ) : (
                        employee.assignableCourseIds.map(courseId => {
                          const course = courses.find(c => c.id === courseId);
                          return course ? (
                            <span key={courseId} className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-xs rounded-full font-medium whitespace-nowrap">
                              {course.name}
                            </span>
                          ) : null;
                        })
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEdit(employee)}
                      className="text-blue-600 hover:text-blue-900 mx-2"
                      title="編集"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(employee.id)}
                      className="text-red-600 hover:text-red-900"
                      title="削除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
