import React from 'react';
import Navigation from '../../components/landing/Navigation';
import Footer from '../../components/landing/Footer';

export default function LayoutContentManagement({ embedded = false, cmsEditMode } = {}) {
  return (
    <div>
      <Navigation embedded={embedded} cmsEditMode={cmsEditMode} />
      <main className="w-full bg-white flex items-center justify-center" style={{ height: '420px' }}>
        <div className="text-sm text-gray-500">Header & Footer Preview</div>
      </main>
      <Footer embedded={embedded} cmsEditMode={cmsEditMode} />
    </div>
  );
}
