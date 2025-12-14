import Button from "../ui/Button"
import { Link, useLocation } from "react-router-dom"
import { useState, useEffect } from "react"

export default function BranchNavigation({ branchName = "Makati Branch" }) {
  const location = useLocation()
  const branchSlug = location.pathname.split('/')[2] // Get branch slug from URL
  const [activeSection, setActiveSection] = useState('')

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

  return (
    <nav className="w-full bg-white fixed top-0 z-50" style={{ height: '122px', minHeight: '122px', boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)' }}>
      <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between px-2 sm:px-4">
        {/* Logo and Branch Name */}
        <div className="flex items-center space-x-4">
          <Link to="/">
            <img
              src="/logo.jpg"
              alt="David's Salon Logo"
              className="h-12 sm:h-16"
            />
          </Link>
          <div className="bg-white text-gray-700 px-3 py-1 rounded-full text-sm font-poppins font-medium border border-gray-300 shadow-sm">
            {branchName}
          </div>
        </div>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center" style={{ gap: '50px' }}>
          <Link 
            to={`/branch/${branchSlug}`}
            className={`font-poppins font-medium text-base ${
              location.pathname === `/branch/${branchSlug}`
                ? 'text-[#160B53] border-b-2 border-[#160B53] pb-1' 
                : 'text-gray-700 hover:text-[#160B53]'
            }`}
          >
            HOME
          </Link>
          <Link
            to={`/branch/${branchSlug}/services`}
            className={`font-poppins font-medium text-base ${
              location.pathname.includes('/services')
                ? 'text-[#160B53] border-b-2 border-[#160B53] pb-1' 
                : 'text-gray-700 hover:text-[#160B53]'
            }`}
          >
            SERVICES
          </Link>
          <Link
            to={`/branch/${branchSlug}/stylists`}
            className={`font-poppins font-medium text-base ${
              location.pathname.includes('/stylists')
                ? 'text-[#160B53] border-b-2 border-[#160B53] pb-1' 
                : 'text-gray-700 hover:text-[#160B53]'
            }`}
          >
            STYLISTS
          </Link>
          <Link
            to={`/branch/${branchSlug}/gallery`}
            className={`font-poppins font-medium text-base ${
              location.pathname.includes('/gallery')
                ? 'text-[#160B53] border-b-2 border-[#160B53] pb-1' 
                : 'text-gray-700 hover:text-[#160B53]'
            }`}
          >
            GALLERY
          </Link>
          <Link 
            to={`/branch/${branchSlug}/products`}
            className={`font-poppins font-medium text-base ${
              location.pathname.includes('/products')
                ? 'text-[#160B53] border-b-2 border-[#160B53] pb-1' 
                : 'text-gray-700 hover:text-[#160B53]'
            }`}
          >
            PRODUCTS
          </Link>
        </div>

        {/* Book Now Button */}
        <div className="flex items-center">
          <Button className="bg-[#160B53] hover:bg-[#160B53]/90 text-white font-poppins font-semibold px-6 py-2 rounded-lg">
            BOOK NOW
          </Button>
        </div>
      </div>
    </nav>
  )
}

