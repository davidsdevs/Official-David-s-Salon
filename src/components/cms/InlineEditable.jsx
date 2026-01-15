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
  enabled = true,
  isEditing = false,
  onEditStart,
  onEditCancel
}) => {
  const [isEditingLocal, setIsEditingLocal] = useState(isEditing);
  const [editValue, setEditValue] = useState(value || '');
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!isEditingLocal) {
      setEditValue(value || '');
    }
  }, [value, isEditingLocal]);

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
      <div className={`inline-flex items-center gap-2 ${className}`} data-cms-allow-interaction="true">
        {multiline ? (
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => {
              const nextValue = e.target.value;
              setEditValue(nextValue);
              if (onSave) {
                onSave(fieldPath, nextValue);
              }
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="min-w-[200px] px-2 py-1 border-2 border-blue-500 rounded bg-white text-gray-900 placeholder:text-gray-400 caret-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
            rows={3}
            placeholder={placeholder}
            style={{ resize: 'vertical' }}
          />
        ) : (
          <input
            ref={inputRef}
            type={type}
            value={editValue}
            onChange={(e) => {
              const nextValue = e.target.value;
              setEditValue(nextValue);
              if (onSave) {
                onSave(fieldPath, nextValue);
              }
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="min-w-[200px] px-2 py-1 border-2 border-blue-500 rounded bg-white text-gray-900 placeholder:text-gray-400 caret-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
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

  if (!enabled) {
    return <span className={className}>{children || value || placeholder}</span>;
  }

  return (
    <span
      onClick={handleClick}
      className={`inline-block cursor-pointer border border-dashed border-blue-300 hover:bg-blue-50 rounded px-1 transition-all relative group ${className}`}
      title="Click to edit"
      data-cms-allow-interaction="true"
    >
      {children || value || placeholder}
      <Edit2 className="w-3 h-3 inline-block ml-1 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </span>
  );
};

export default InlineEditable;

