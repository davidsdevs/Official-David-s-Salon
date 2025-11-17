import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import HomePage from '../public/HomePage';
import AboutPage from '../public/AboutPage';
import {
  Home,
  FileText,
  ArrowLeft
} from 'lucide-react';

const ContentManagement = () => {
  const { userData } = useAuth();
  const [selectedPage, setSelectedPage] = useState(null);

  const landingPages = [
    {
      id: 'homepage',
      title: 'Homepage',
      description: 'Main landing page - the first page visitors see',
      icon: Home,
      component: HomePage,
      path: '/'
    },
    {
      id: 'about',
      title: 'About Us',
      description: 'Company story, team, and mission',
      icon: FileText,
      component: AboutPage,
      path: '/about'
    }
  ];

  const handlePageSelect = (page) => {
    setSelectedPage(page);
  };

  const handleBack = () => {
    setSelectedPage(null);
  };

  if (selectedPage) {
    const PageComponent = selectedPage.component;
    return (
      <div className="space-y-4">
        {/* Back Button */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Pages
          </Button>
          <div className="text-sm text-gray-600">
            <span className="font-medium">Tip:</span> Click on any text to edit it inline
          </div>
        </div>

        {/* Embedded Page Container */}
        <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white shadow-lg" style={{ minHeight: 'calc(100vh - 250px)' }}>
          <div className="w-full h-full overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
            {/* Render page without Navigation/Footer since it's embedded */}
            <div className="relative">
              <PageComponent embedded={true} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Content Management</h1>
        <p className="text-gray-600">
          Manage your public-facing landing pages. Click on any page to edit its content inline.
        </p>
      </div>

      {/* Landing Pages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {landingPages.map((page) => {
          const Icon = page.icon;
          return (
            <Card
              key={page.id}
              className="p-6 hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-[#160B53] group"
              onClick={() => handlePageSelect(page)}
            >
              <div className="flex flex-col h-full">
                {/* Icon and Title */}
                <div className="flex items-center space-x-4 mb-4">
                  <div className="p-3 rounded-lg bg-green-100 text-green-600 group-hover:scale-110 transition-transform">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#160B53] transition-colors">
                      {page.title}
                    </h3>
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-600 mb-6 flex-grow">
                  {page.description}
                </p>

                {/* Action Button */}
                <Button
                  className="w-full bg-[#160B53] hover:bg-[#160B53]/90 text-white group-hover:bg-[#160B53] transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePageSelect(page);
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Edit {page.title}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Instructions */}
      <Card className="p-6 bg-blue-50 border-l-4 border-blue-400">
        <h3 className="font-semibold text-blue-900 mb-2">How to Edit</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Click on any page card above to view and edit it</li>
          <li>Once on the page, hover over any text to see it's editable</li>
          <li>Click on the text to edit it inline</li>
          <li>Use the floating "Save Changes" button to save your edits</li>
          <li>Changes will appear immediately for all visitors</li>
        </ul>
      </Card>
    </div>
  );
};

export default ContentManagement;

