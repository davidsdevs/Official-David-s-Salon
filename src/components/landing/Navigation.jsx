import Button from "../ui/Button"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { marketingContentService } from "../../services/marketingContentService"
import { useAuth } from "../../context/AuthContext"
import { USER_ROLES } from "../../utils/constants"
import InlineEditable from "../cms/InlineEditable"
import FloatingSaveButton from "../cms/FloatingSaveButton"

export default function Navigation({ embedded = false, cmsEditMode } = {}) {
  const { userData, userRoles } = useAuth()
  const isSystemAdmin =
    userRoles?.includes(USER_ROLES.SYSTEM_ADMIN) ||
    userRoles?.includes('system_admin') ||
    userData?.role === USER_ROLES.SYSTEM_ADMIN ||
    userData?.role === 'system_admin'
  const effectiveEditMode = typeof cmsEditMode === 'boolean' ? cmsEditMode : true

  const location = useLocation()
  const navigate = useNavigate()
  const [isBranchActive, setIsBranchActive] = useState(false)

  const [content, setContent] = useState(null)
  const [localContent, setLocalContent] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)

  const isActive = (path) => {
    return location.pathname === path
  }

  useEffect(() => {
    const loadContent = async () => {
      try {
        const result = await marketingContentService.getLayoutContent()
        if (result.success && result.content) {
          setContent(result.content)
          if (!hasChanges) {
            setLocalContent(result.content)
          }
        }
      } catch (error) {
        console.error('Error loading layout content:', error)
      }
    }

    const unsubscribe = marketingContentService.subscribeToContent('layout', 'layout', (result) => {
      if (result.success && result.content) {
        setContent(result.content)
        if (!hasChanges) {
          setLocalContent(result.content)
        }
      }
    })

    loadContent()
    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (content && !localContent) {
      setLocalContent(content)
    }
  }, [content, localContent])

  const handleContentUpdate = (fieldPath, value) => {
    if (!localContent) return

    const keys = fieldPath.split('.')
    const newContent = { ...localContent }
    let current = newContent

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {}
      }
      current = current[keys[i]]
    }

    current[keys[keys.length - 1]] = value
    setLocalContent(newContent)
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!localContent || !userData) return

    try {
      setSaving(true)
      const payload = {
        navigation: (localContent?.navigation || {})
      }
      const result = await marketingContentService.updateContent('layout', 'layout', {
        ...payload,
        updatedBy: userData.uid
      })
      if (result.success) {
        setContent(localContent)
        setHasChanges(false)
      }
    } catch (error) {
      console.error('Error saving layout content:', error)
    } finally {
      setSaving(false)
    }
  }

  const displayContent = hasChanges ? localContent : content
  const nav = displayContent?.navigation || {}
  const links = nav.links || {}
  const buttons = nav.buttons || {}

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
    <>
      {isSystemAdmin && embedded && (
        <FloatingSaveButton
          onSave={handleSave}
          saving={saving}
          hasChanges={hasChanges}
        />
      )}

      <nav
        className={`w-full bg-white ${embedded ? '' : 'fixed top-0 z-50'}`}
        style={{ height: '122px', minHeight: '122px', boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)' }}
      >
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
            <InlineEditable
              value={links.home || 'HOME'}
              onSave={handleContentUpdate}
              fieldPath="navigation.links.home"
              enabled={isSystemAdmin && effectiveEditMode}
              className="font-poppins font-medium text-base"
            />
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
            <InlineEditable
              value={links.branch || 'BRANCH'}
              onSave={handleContentUpdate}
              fieldPath="navigation.links.branch"
              enabled={isSystemAdmin && effectiveEditMode}
              className="font-poppins font-medium text-base"
            />
          </a>
          <Link 
            to="/about" 
            className={`font-poppins font-medium text-base ${
              isActive('/about') 
                ? 'text-[#160B53] border-b-2 border-[#160B53] pb-1' 
                : 'text-gray-700 hover:text-[#160B53]'
            }`}
          >
            <InlineEditable
              value={links.about || 'ABOUT'}
              onSave={handleContentUpdate}
              fieldPath="navigation.links.about"
              enabled={isSystemAdmin && effectiveEditMode}
              className="font-poppins font-medium text-base"
            />
          </Link>
          <Link 
            to="/products" 
            className={`font-poppins font-medium text-base ${
              isActive('/products') 
                ? 'text-[#160B53] border-b-2 border-[#160B53] pb-1' 
                : 'text-gray-700 hover:text-[#160B53]'
            }`}
          >
            <InlineEditable
              value={links.products || 'PRODUCTS'}
              onSave={handleContentUpdate}
              fieldPath="navigation.links.products"
              enabled={isSystemAdmin && effectiveEditMode}
              className="font-poppins font-medium text-base"
            />
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          <Link to="/register">
            <Button 
              variant="outline"
              className="bg-white border-[#160B53] text-[#160B53] hover:bg-[#160B53] hover:text-white font-poppins font-semibold"
            >
              <InlineEditable
                value={buttons.register || 'REGISTER'}
                onSave={handleContentUpdate}
                fieldPath="navigation.buttons.register"
                enabled={isSystemAdmin && effectiveEditMode}
                className="font-poppins font-semibold"
              />
            </Button>
          </Link>
          <Link to="/login">
            <Button 
              className="bg-[#160B53] hover:bg-[#160B53]/90 text-white font-poppins font-semibold"
            >
              <InlineEditable
                value={buttons.login || 'LOGIN'}
                onSave={handleContentUpdate}
                fieldPath="navigation.buttons.login"
                enabled={isSystemAdmin && effectiveEditMode}
                className="font-poppins font-semibold"
              />
            </Button>
          </Link>
        </div>
      </div>
    </nav>
    </>
  )
}

