import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../store/AppContext';
import { Building, Plus, Trash2 } from 'lucide-react';

export const BranchSelect: React.FC = () => {
  const { data, setCurrentBranch, addBranch, deleteBranch } = useAppContext();
  const navigate = useNavigate();
  const [newBranchName, setNewBranchName] = useState('');

  const handleSelect = (id: string) => {
    setCurrentBranch(id);
    navigate('/');
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    addBranch({ id: uuidv4(), name: newBranchName.trim() });
    setNewBranchName('');
  };

  return (
    <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 bg-[#FFD700] rounded-full flex items-center justify-center">
          <Building size={32} className="text-[#1A1A1A]" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100 mb-8">営業所を選択</h1>

      <div className="space-y-4 mb-8">
        {data.branches.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">営業所が登録されていません</p>
        ) : (
          data.branches.map((branch) => (
            <div
              key={branch.id}
              className="flex items-center justify-between p-4 border dark:border-gray-600 rounded-lg hover:border-[#FFD700] hover:bg-yellow-50 dark:hover:bg-yellow-900/10 cursor-pointer transition-colors group"
              onClick={() => handleSelect(branch.id)}
            >
              <span className="font-semibold dark:text-gray-100">{branch.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('本当に削除しますか？')) deleteBranch(branch.id);
                }}
                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleAdd} className="border-t dark:border-gray-700 pt-6">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">新規営業所の追加</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            placeholder="営業所名 (例: 渋谷センター)"
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
          />
          <button
            type="submit"
            disabled={!newBranchName.trim()}
            className="bg-[#1A1A1A] text-white px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1"
          >
            <Plus size={18} />
            追加
          </button>
        </div>
      </form>
    </div>
  );
};
