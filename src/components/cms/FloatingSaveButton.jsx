import React from 'react';
import { Save, Loader2 } from 'lucide-react';
import Button from '../ui/Button';

const FloatingSaveButton = ({ onSave, saving, hasChanges, className = '' }) => {
  if (!hasChanges) return null;

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
      <Button
        onClick={onSave}
        disabled={saving}
        className="bg-[#160B53] hover:bg-[#12094A] text-white shadow-lg px-6 py-3 rounded-full flex items-center gap-2"
        size="lg"
      >
        {saving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            Save Changes
          </>
        )}
      </Button>
    </div>
  );
};

export default FloatingSaveButton;

