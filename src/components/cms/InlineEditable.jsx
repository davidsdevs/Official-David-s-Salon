import React, { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X } from 'lucide-react';

const InlineEditable = ({ 
  value, 
  onSave, 
  fieldPath, 
  type = 'text',
  className = '',
  placeholder = '',
  multiline = false,
  children,
  isEditing = false,
  onEditStart,
  onEditCancel
}) => {
  const [isEditingLocal, setIsEditingLocal] = useState(isEditing);
  const [editValue, setEditValue] = useState(value || '');
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    setEditValue(value || '');
  }, [value]);

  useEffect(() => {
    if (isEditingLocal) {
      if (multiline && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      } else if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [isEditingLocal, multiline]);

  const handleClick = (e) => {
    if (!isEditingLocal) {
      e.stopPropagation();
      setIsEditingLocal(true);
      if (onEditStart) onEditStart();
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave(fieldPath, editValue);
    }
    setIsEditingLocal(false);
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditingLocal(false);
    if (onEditCancel) onEditCancel();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !multiline && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditingLocal) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        {multiline ? (
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="min-w-[200px] px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={3}
            placeholder={placeholder}
            style={{ resize: 'vertical' }}
          />
        ) : (
          <input
            ref={inputRef}
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="min-w-[200px] px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder={placeholder}
          />
        )}
        <button
          onClick={handleSave}
          className="p-1 text-green-600 hover:bg-green-50 rounded"
          title="Save"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 text-red-600 hover:bg-red-50 rounded"
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <span
      onClick={handleClick}
      className={`inline-block cursor-pointer hover:bg-blue-50 hover:outline hover:outline-2 hover:outline-blue-300 rounded px-1 transition-all relative group ${className}`}
      title="Click to edit"
    >
      {children || value || placeholder}
      <Edit2 className="w-3 h-3 inline-block ml-1 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </span>
  );
};

export default InlineEditable;

