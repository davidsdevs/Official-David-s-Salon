import Button from "../ui/Button"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isBranchActive, setIsBranchActive] = useState(false)

  const isActive = (path) => {
    return location.pathname === path
  }

  // Check if branches section is in view
  useEffect(() => {
    const handleScroll = () => {
      const branchesSection = document.getElementById('branches')
      if (branchesSection && location.pathname === '/') {
        const rect = branchesSection.getBoundingClientRect()
        const isInView = rect.top <= 100 && rect.bottom >= 100
        setIsBranchActive(isInView)
      } else {
        setIsBranchActive(false)
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Check initial state

    return () => window.removeEventListener('scroll', handleScroll)
  }, [location.pathname])

  const handleBranchClick = (e) => {
    e.preventDefault()
    
    const scrollToBranches = () => {
      const branchesSection = document.getElementById('branches')
      if (branchesSection) {
        const targetPosition = branchesSection.offsetTop - 20 // Add some offset from top
        const startPosition = window.pageYOffset
        const distance = targetPosition - startPosition
        const duration = 1000 // 1 second for a little faster scroll
        let start = null

        const animation = (currentTime) => {
          if (start === null) start = currentTime
          const timeElapsed = currentTime - start
          const run = easeInOutQuad(timeElapsed, startPosition, distance, duration)
          window.scrollTo(0, run)
          if (timeElapsed < duration) requestAnimationFrame(animation)
        }

        const easeInOutQuad = (t, b, c, d) => {
          t /= d / 2
          if (t < 1) return c / 2 * t * t + b
          t--
          return -c / 2 * (t * (t - 2) - 1) + b
        }

        requestAnimationFrame(animation)
      }
    }
    
    if (location.pathname === '/') {
      // We're already on homepage, just scroll to branches section
      scrollToBranches()
    } else {
      // Navigate to homepage first, then scroll to branches section
      navigate('/')
      setTimeout(() => {
        scrollToBranches()
      }, 200)
    }
  }


  return (
    <nav className="w-full bg-white fixed top-0 z-50" style={{ height: '122px', minHeight: '122px', boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)' }}>
        <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between px-2 sm:px-4">
        <div className="flex items-center">
          <Link to="/">
            <img
              src="/logo.jpg"
              alt="David's Salon Logo"
              className="h-12 sm:h-16"
            />
          </Link>
        </div>

        <div className="hidden md:flex items-center" style={{ gap: '50px' }}>
          <Link 
            to="/" 
            className={`font-poppins font-medium text-base ${
              isActive('/') 
                ? 'text-[#160B53] border-b-2 border-[#160B53] pb-1' 
                : 'text-gray-700 hover:text-[#160B53]'
            }`}
          >
            HOME
          </Link>
          <a 
            href="#branches" 
            onClick={handleBranchClick}
            className={`font-poppins font-medium text-base cursor-pointer ${
              isBranchActive 
                ? 'text-[#160B53] border-b-2 border-[#160B53] pb-1' 
                : 'text-gray-700 hover:text-[#160B53]'
            }`}
          >
            BRANCH
          </a>
          <Link 
            to="/about" 
            className={`font-poppins font-medium text-base ${
              isActive('/about') 
                ? 'text-[#160B53] border-b-2 border-[#160B53] pb-1' 
                : 'text-gray-700 hover:text-[#160B53]'
            }`}
          >
            ABOUT
          </Link>
          <Link 
            to="/products" 
            className={`font-poppins font-medium text-base ${
              isActive('/products') 
                ? 'text-[#160B53] border-b-2 border-[#160B53] pb-1' 
                : 'text-gray-700 hover:text-[#160B53]'
            }`}
          >
            PRODUCTS
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          <Link to="/register">
            <Button 
              variant="outline"
              className="bg-white border-[#160B53] text-[#160B53] hover:bg-[#160B53] hover:text-white font-poppins font-semibold"
            >
              REGISTER
            </Button>
          </Link>
          <Link to="/login">
            <Button 
              className="bg-[#160B53] hover:bg-[#160B53]/90 text-white font-poppins font-semibold"
            >
              LOGIN
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}

