import React, { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../store/AppContext';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { type Course } from '../types';

export const CourseManage: React.FC = () => {
  const { data, addCourse, updateCourse, deleteCourse } = useAppContext();
  const currentBranchId = data.currentBranchId;
  const courses = data.courses.filter((c) => c.branchId === currentBranchId);
  const topRef = useRef<HTMLDivElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Partial<Course>>({
    name: '',
    startTime: '08:00',
    endTime: '17:00',
    breakMinutes: 60,
    notes: '',
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBranchId || !editingCourse.name) return;

    if (editingCourse.id) {
      updateCourse(editingCourse as Course);
    } else {
      addCourse({
        ...editingCourse,
        id: uuidv4(),
        branchId: currentBranchId,
      } as Course);
    }
    setIsEditing(false);
    setEditingCourse({ name: '', startTime: '08:00', endTime: '17:00', breakMinutes: 60, notes: '' });
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setIsEditing(true);
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDelete = (id: string) => {
    if (confirm('本当にこのコースを削除しますか？\n（このコースに紐づくシフト等の整合性に影響が出る場合があります）')) {
      deleteCourse(id);
    }
  };

  return (
    <div className="space-y-6" ref={topRef}>
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold dark:text-gray-100">コース管理</h2>
        <button
          onClick={() => {
            setEditingCourse({ name: '', startTime: '08:00', endTime: '17:00', breakMinutes: 60, notes: '' });
            setIsEditing(true);
            topRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="bg-[#1A1A1A] text-white px-4 py-2 rounded-lg hover:bg-gray-800 flex items-center gap-2"
        >
          <Plus size={20} />
          新規コース追加
        </button>
      </div>

      {isEditing && (
        <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-[#FFD700]">
          <h3 className="text-lg font-bold mb-4 dark:text-gray-100">{editingCourse.id ? 'コース編集' : '新規コース追加'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">コース名 *</label>
              <input
                type="text"
                required
                value={editingCourse.name || ''}
                onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:ring-[#FFD700]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">休憩時間 (分)</label>
              <input
                type="number"
                min="0"
                value={editingCourse.breakMinutes || 0}
                onChange={(e) => setEditingCourse({ ...editingCourse, breakMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-md focus:ring-[#FFD700]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">出勤時間</label>
              <input
                type="time"
                value={editingCourse.startTime || '08:00'}
                onChange={(e) => setEditingCourse({ ...editingCourse, startTime: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:ring-[#FFD700]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">退勤時間</label>
              <input
                type="time"
                value={editingCourse.endTime || '17:00'}
                onChange={(e) => setEditingCourse({ ...editingCourse, endTime: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:ring-[#FFD700]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">備考</label>
              <textarea
                value={editingCourse.notes || ''}
                onChange={(e) => setEditingCourse({ ...editingCourse, notes: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:ring-[#FFD700]"
                rows={2}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
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

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">コース名</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">時間</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">休憩</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">備考</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {courses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  コースが登録されていません
                </td>
              </tr>
            ) : (
              courses.map((course) => (
                <tr key={course.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{course.name}</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                    {course.startTime} - {course.endTime}
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{course.breakMinutes} 分</td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 truncate max-w-xs">{course.notes}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEdit(course)}
                      className="text-blue-600 hover:text-blue-900 mx-2"
                      title="編集"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(course.id)}
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
