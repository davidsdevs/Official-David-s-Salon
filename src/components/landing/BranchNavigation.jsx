import Button from "../ui/Button"
import { Link, useLocation } from "react-router-dom"
import { useState, useEffect } from "react"
import InlineEditable from "../cms/InlineEditable"
import { Menu, X } from "lucide-react"

export default function BranchNavigation({
  branchName = "Makati Branch",
  branchSlug: branchSlugProp,
  cmsEditable = false,
  onContentUpdate,
  navigationContent
}) {
  const location = useLocation()
  const branchSlug =
    branchSlugProp ||
    location.pathname.split('/')[2] // Get branch slug from URL
  const [activeSection, setActiveSection] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const effectiveNavigationContent = navigationContent || {}
  const navLinks = effectiveNavigationContent.links || {}
  const labels = {
    home: navLinks.home || 'HOME',
    services: navLinks.services || 'SERVICES',
    stylists: navLinks.stylists || 'STYLISTS',
    gallery: navLinks.gallery || 'GALLERY',
    products: navLinks.products || 'PRODUCTS'
  }

  useEffect(() => {
    const handleScroll = () => {
      const sections = ['services', 'stylists', 'gallery']
      const scrollPosition = window.scrollY + 100

      for (const section of sections) {
        const element = document.getElementById(section)
        if (element) {
          const { offsetTop, offsetHeight } = element
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Handle mobile menu scroll lock
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isMobileMenuOpen])

  return (
    <>
      <nav className="w-full bg-white fixed top-0 z-50" style={{ height: '80px', minHeight: '80px', boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)' }}>
        <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo and Branch Name */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link to="/">
              <img
                src="/logo.jpg"
                alt="David's Salon Logo"
                className="h-10 sm:h-12 md:h-14"
              />
            </Link>
            <div className="bg-white text-gray-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-poppins font-medium border border-gray-300 shadow-sm whitespace-nowrap">
              {branchName}
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-6 xl:gap-12">
            <Link 
              to={`/branch/${branchSlug}`}
              className={`font-poppins font-medium text-sm xl:text-base ${
                location.pathname === `/branch/${branchSlug}`
                  ? 'text-[#160B53] border-b-2 border-[#160B53] pb-1' 
                  : 'text-gray-700 hover:text-[#160B53]'
              }`}
            >
              {cmsEditable ? (
                <InlineEditable
                  enabled={cmsEditable}
                  value={labels.home}
                  onSave={onContentUpdate}
                  fieldPath="navigation.links.home"
                  className="text-[#160B53]"
                />
              ) : (
                labels.home
              )}
            </Link>
            <Link
              to={`/branch/${branchSlug}/services`}
              className={`font-poppins font-medium text-sm xl:text-base ${
                location.pathname.includes('/services')
                  ? 'text-[#160B53] border-b-2 border-[#160B53] pb-1' 
                  : 'text-gray-700 hover:text-[#160B53]'
              }`}
            >
              {cmsEditable ? (
                <InlineEditable
                  enabled={cmsEditable}
                  value={labels.services}
                  onSave={onContentUpdate}
                  fieldPath="navigation.links.services"
                  className="text-[#160B53]"
                />
              ) : (
                labels.services
              )}
            </Link>
            <Link
              to={`/branch/${branchSlug}/stylists`}
              className={`font-poppins font-medium text-sm xl:text-base ${
                location.pathname.includes('/stylists')
                  ? 'text-[#160B53] border-b-2 border-[#160B53] pb-1' 
                  : 'text-gray-700 hover:text-[#160B53]'
              }`}
            >
              {cmsEditable ? (
                <InlineEditable
                  enabled={cmsEditable}
                  value={labels.stylists}
                  onSave={onContentUpdate}
                  fieldPath="navigation.links.stylists"
                  className="text-[#160B53]"
                />
              ) : (
                labels.stylists
              )}
            </Link>
            <Link
              to={`/branch/${branchSlug}/gallery`}
              className={`font-poppins font-medium text-sm xl:text-base ${
                location.pathname.includes('/gallery')
                  ? 'text-[#160B53] border-b-2 border-[#160B53] pb-1' 
                  : 'text-gray-700 hover:text-[#160B53]'
              }`}
            >
              {cmsEditable ? (
                <InlineEditable
                  enabled={cmsEditable}
                  value={labels.gallery}
                  onSave={onContentUpdate}
                  fieldPath="navigation.links.gallery"
                  className="text-[#160B53]"
                />
              ) : (
                labels.gallery
              )}
            </Link>
            <Link 
              to={`/branch/${branchSlug}/products`}
              className={`font-poppins font-medium text-sm xl:text-base ${
                location.pathname.includes('/products')
                  ? 'text-[#160B53] border-b-2 border-[#160B53] pb-1' 
                  : 'text-gray-700 hover:text-[#160B53]'
              }`}
            >
              {cmsEditable ? (
                <InlineEditable
                  enabled={cmsEditable}
                  value={labels.products}
                  onSave={onContentUpdate}
                  fieldPath="navigation.links.products"
                  className="text-[#160B53]"
                />
              ) : (
                labels.products
              )}
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6 text-gray-700" />
            ) : (
              <Menu className="h-6 w-6 text-gray-700" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-64 sm:w-80 bg-white z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ boxShadow: '-4px 0 6px rgba(0, 0, 0, 0.1)' }}
      >
        <div className="flex flex-col h-full">
          {/* Mobile Menu Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-2">
              <img
                src="/logo.jpg"
                alt="David's Salon Logo"
                className="h-10"
              />
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-md hover:bg-gray-100"
              aria-label="Close menu"
            >
              <X className="h-6 w-6 text-gray-700" />
            </button>
          </div>

          {/* Mobile Menu Links */}
          <div className="flex-1 overflow-y-auto py-4">
            <div className="flex flex-col space-y-1 px-4">
              <Link
                to={`/branch/${branchSlug}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`font-poppins font-medium text-base py-3 px-4 rounded-md transition-colors ${
                  location.pathname === `/branch/${branchSlug}`
                    ? 'bg-[#160B53] text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {labels.home}
              </Link>
              <Link
                to={`/branch/${branchSlug}/services`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`font-poppins font-medium text-base py-3 px-4 rounded-md transition-colors ${
                  location.pathname.includes('/services')
                    ? 'bg-[#160B53] text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {labels.services}
              </Link>
              <Link
                to={`/branch/${branchSlug}/stylists`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`font-poppins font-medium text-base py-3 px-4 rounded-md transition-colors ${
                  location.pathname.includes('/stylists')
                    ? 'bg-[#160B53] text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {labels.stylists}
              </Link>
              <Link
                to={`/branch/${branchSlug}/gallery`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`font-poppins font-medium text-base py-3 px-4 rounded-md transition-colors ${
                  location.pathname.includes('/gallery')
                    ? 'bg-[#160B53] text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {labels.gallery}
              </Link>
              <Link
                to={`/branch/${branchSlug}/products`}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`font-poppins font-medium text-base py-3 px-4 rounded-md transition-colors ${
                  location.pathname.includes('/products')
                    ? 'bg-[#160B53] text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {labels.products}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

