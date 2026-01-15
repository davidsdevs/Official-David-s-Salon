import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import HomePage from '../public/HomePage';
import AboutPage from '../public/AboutPage';
import ProductsPage from '../public/Products';
import BranchContentManagement from './BranchContentManagement';
import BranchProductsContentManagement from './BranchProductsContentManagement';
import ServicesContentManagement from './ServicesContentManagement';
import StylistsContentManagement from './StylistsContentManagement';
import StylistPortfolioContentManagement from './StylistPortfolioContentManagement';
import {
  Home,
  FileText,
  ArrowLeft,
  Edit2,
  Eye,
  Map,
  Package,
  Scissors,
  Users,
  Image,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';

const ContentManagement = () => {
  const { userData } = useAuth();
  const [selectedPage, setSelectedPage] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageFilter, setPageFilter] = useState('all');

  const landingPages = [
    {
      id: 'homepage',
      title: 'Homepage',
      description: 'Main landing page - the first page visitors see',
      icon: Home,
      component: HomePage,
      path: '/',
      type: 'public'
    },
    {
      id: 'about',
      title: 'About Us',
      description: 'Company story, team, and mission',
      icon: FileText,
      component: AboutPage,
      path: '/about',
      type: 'public'
    },
    {
      id: 'products',
      title: 'Products Page',
      description: 'Products catalog listing (search + category filter)',
      icon: Package,
      component: ProductsPage,
      path: '/products',
      type: 'public'
    },
    {
      id: 'branch',
      title: 'Branch Page',
      description: 'Branch landing page content (per location)',
      icon: Map,
      component: BranchContentManagement,
      path: '/admin/branch-content',
      type: 'branch'
    },
    {
      id: 'branch-products',
      title: 'Branch Products Page',
      description: 'Branch products page content (per location)',
      icon: Package,
      component: BranchProductsContentManagement,
      path: '/branch/:slug/products',
      type: 'branch'
    },
    {
      id: 'services',
      title: 'Services Page',
      description: 'Branch services page content (per location)',
      icon: Scissors,
      component: ServicesContentManagement,
      path: '/admin/services-content',
      type: 'branch'
    },
    {
      id: 'stylists',
      title: 'Stylists Page',
      description: 'Branch stylists page content (per location)',
      icon: Users,
      component: StylistsContentManagement,
      path: '/admin/stylists-content',
      type: 'branch'
    },
    {
      id: 'stylist-portfolio',
      title: 'Stylist Portfolio Page',
      description: 'Manage stylist portfolio images per branch (filter/search by stylist)',
      icon: Image,
      component: StylistPortfolioContentManagement,
      path: '/admin/stylist-portfolio-content',
      type: 'branch'
    }
  ];

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredLandingPages = landingPages.filter((page) => {
    const matchesType = pageFilter === 'all' ? true : page.type === pageFilter;
    if (!matchesType) return false;
    if (!normalizedQuery) return true;
    const haystack = `${page.title} ${page.description}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const handlePageSelect = (page) => {
    setSelectedPage(page);
  };

  const handleBack = () => {
    setSelectedPage(null);
    setEditMode(false);
    setFullScreen(false);
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setFullScreen(false);
      }
    };

    if (fullScreen) {
      window.addEventListener('keydown', onKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [fullScreen]);

  if (selectedPage) {
    const PageComponent = selectedPage.component;

    if (selectedPage.id === 'branch' || selectedPage.id === 'branch-products' || selectedPage.id === 'services' || selectedPage.id === 'stylists' || selectedPage.id === 'stylist-portfolio') {
      return (
        <div className="space-y-4">
          {/* Back Button */}
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Pages
            </Button>
          </div>

          <PageComponent />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Back Button */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Pages
          </Button>
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Tip:</span> Toggle Edit Mode to enable click-to-edit
            </div>
            <Button
              onClick={() => setEditMode(!editMode)}
              className="flex items-center gap-2"
              variant={editMode ? 'default' : 'outline'}
            >
              {editMode ? <Eye className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
              {editMode ? 'Preview Mode' : 'Edit Mode'}
            </Button>
            <Button
              onClick={() => setFullScreen(!fullScreen)}
              className="flex items-center gap-2"
              variant="outline"
            >
              {fullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {fullScreen ? 'Exit Full Screen' : 'Full Screen'}
            </Button>
          </div>
        </div>

        {/* Embedded Page Container */}
        <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white shadow-lg" style={{ minHeight: 'calc(100vh - 250px)' }}>
          <div className="w-full h-full overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
            <div className="relative">
              <PageComponent embedded={true} cmsEditMode={editMode} />
            </div>
          </div>
        </div>

        {fullScreen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/60" onClick={() => setFullScreen(false)} />
            <div className="absolute inset-4 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="font-semibold text-gray-900">{selectedPage.title}</div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setEditMode(!editMode)}
                    className="flex items-center gap-2"
                    variant={editMode ? 'default' : 'outline'}
                  >
                    {editMode ? <Eye className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                    {editMode ? 'Preview Mode' : 'Edit Mode'}
                  </Button>
                  <Button
                    onClick={() => setFullScreen(false)}
                    className="flex items-center gap-2"
                    variant="outline"
                  >
                    <X className="h-4 w-4" />
                    Close
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <div className="relative">
                  <PageComponent embedded={true} cmsEditMode={editMode} />
                </div>
              </div>
            </div>
          </div>
        )}
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

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="w-full sm:w-56">
          <select
            value={pageFilter}
            onChange={(e) => setPageFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="all">All</option>
            <option value="public">Public Pages</option>
            <option value="branch">Branch Pages</option>
          </select>
        </div>
      </div>

      {/* Landing Pages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLandingPages.map((page) => {
          const Icon = page.icon;
          const scopeLabel = page.type === 'branch' ? 'Per Branch' : 'Public';
          const scopeBadgeClass = page.type === 'branch'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-blue-50 text-blue-700 border-blue-200';
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#160B53] transition-colors">
                      {page.title}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${scopeBadgeClass}`}>
                        {scopeLabel}
                      </span>
                    </div>
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
    </div>
  );
};

export default ContentManagement;

