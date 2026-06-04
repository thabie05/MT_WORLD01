import React from 'react';

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[3000] p-5" onClick={onCancel}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
        <div className="text-4xl mb-3">⚠️</div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">Are you sure?</h3>
        <p className="text-slate-500 text-sm mb-5">{message}</p>
        <div className="flex gap-2.5">
          <button 
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 bg-slate-100 border border-slate-200 rounded-xl font-semibold text-sm text-slate-600 hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;