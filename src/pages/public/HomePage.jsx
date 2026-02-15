import Button from "../../components/ui/Button"
import { Card, CardContent } from "../../components/ui/Card"
import { SearchInput } from "../../components/ui/SearchInput"
import { MapPin, Phone, Search } from "lucide-react"
import { Link } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { collection, getCountFromServer, query, where } from "firebase/firestore"
import Navigation from "../../components/landing/Navigation"
import Footer from "../../components/landing/Footer"
import ChatbotWidget from "../../components/chatbot/ChatbotWidget"
import { marketingContentService } from "../../services/marketingContentService"
import { getAllBranches } from "../../services/branchService"
import { useAuth } from "../../context/AuthContext"
import { USER_ROLES } from "../../utils/constants"
import { db } from "../../config/firebase"
import InlineEditable from "../../components/cms/InlineEditable"
import FloatingSaveButton from "../../components/cms/FloatingSaveButton"
import EditableImage from "../../components/cms/EditableImage"
import InlineColorPicker from "../../components/cms/InlineColorPicker"

export default function HomePage({ embedded = false, cmsEditMode }) {
  const { userData, userRoles } = useAuth()
  const isSystemAdmin =
    userRoles?.includes(USER_ROLES.SYSTEM_ADMIN) ||
    userRoles?.includes('system_admin') ||
    userData?.role === USER_ROLES.SYSTEM_ADMIN ||
    userData?.role === 'system_admin'
  const effectiveEditMode = typeof cmsEditMode === 'boolean' ? cmsEditMode : true
  
  const [searchTerm, setSearchTerm] = useState("")
  const [isVisible, setIsVisible] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const branchesPerPage = 6
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [localContent, setLocalContent] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [branchesData, setBranchesData] = useState([])
  const [branchCount, setBranchCount] = useState(null)
  const [clientCount, setClientCount] = useState(null)

  const hasChangesRef = useRef(null)
  const localContentRef = useRef(null)
  const editRevisionRef = useRef(0)

  const slugify = (value) => {
    if (!value) return ""
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
  }

  // Load content from Firestore
  useEffect(() => {
    const loadContent = async () => {
      try {
        const result = await marketingContentService.getHomepageContent()
        if (result.success && result.content) {
          setContent(result.content)
        }
      } catch (error) {
        console.error('Error loading homepage content:', error)
      } finally {
        setLoading(false)
      }
    }

    // Subscribe to real-time updates
    const unsubscribe = marketingContentService.subscribeToContent('main', 'homepage', (result) => {
      if (result.success && result.content) {
        setContent(result.content)
        if (!hasChangesRef.current) {
          setLocalContent(result.content)
        }
        setLoading(false)
      }
    })

    loadContent()

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    hasChangesRef.current = hasChanges
  }, [hasChanges])

  useEffect(() => {
    localContentRef.current = localContent
  }, [localContent])

  // Initialize local content when content loads
  useEffect(() => {
    if (content && !localContent) {
      setLocalContent(content)
    }
  }, [content, localContent])

  // Fade in animation on component mount
  useEffect(() => {
    setIsVisible(true)
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadStats = async () => {
      try {
        const branchesCountSnapshot = await getCountFromServer(collection(db, 'branches'))
        if (!cancelled) {
          setBranchCount(branchesCountSnapshot.data().count)
        }
      } catch (e) {
        if (!cancelled) {
          setBranchCount(null)
        }
      }

      try {
        try {
          const q = query(
            collection(db, 'users'),
            where('roles', 'array-contains', USER_ROLES.CLIENT)
          )
          const clientsCountSnapshot = await getCountFromServer(q)
          if (!cancelled) {
            setClientCount(clientsCountSnapshot.data().count)
          }
          return
        } catch (e) {
          const q = query(
            collection(db, 'users'),
            where('role', '==', USER_ROLES.CLIENT)
          )
          const clientsCountSnapshot = await getCountFromServer(q)
          if (!cancelled) {
            setClientCount(clientsCountSnapshot.data().count)
          }
        }
      } catch (e) {
        if (!cancelled) {
          setClientCount(null)
        }
      }
    }

    loadStats()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadBranches = async () => {
      try {
        const results = await getAllBranches()
        if (cancelled) return

        const mapped = (results || [])
          .filter((b) => b?.isActive === true)
          .map((b) => {
            const name = b?.branchName || b?.name || "Branch"
            const slug = b?.slug || slugify(name)
            return {
              id: b.id,
              name,
              slug,
              location: b?.address || "",
              phone: b?.contact || "",
              email: b?.email || "",
              operatingHours: b?.operatingHours || null,
              isActive: b?.isActive === true,
              imageUrl: b?.imageUrl || b?.image || b?.photoUrl || b?.bannerImage || "/logo.jpg",
            }
          })

        setBranchesData(mapped)
        setCurrentPage(1)
      } catch (e) {
        if (cancelled) return
        setBranchesData([])
      }
    }

    loadBranches()

    return () => {
      cancelled = true
    }
  }, [])

  // Fallback branches data
  const defaultBranches = []

  // Use local content if editing, otherwise use saved content
  const displayContent = hasChanges ? localContent : content

  const theme = displayContent?.theme || {}
  const primaryColor = theme.primaryColor || '#160B53'
  const ctaBackgroundColor = theme.ctaBackgroundColor || primaryColor
  const heroOverlayBottomColor = theme.heroOverlayBottomColor || primaryColor
  const heroOverlayBottomOpacity = typeof theme.heroOverlayBottomOpacity === 'number' ? theme.heroOverlayBottomOpacity : 0.7

  const hexToRgba = (hex, opacity = 1) => {
    if (typeof hex !== 'string') return `rgba(0, 0, 0, ${opacity})`
    const normalized = hex.replace('#', '').trim()
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(0, 0, 0, ${opacity})`
    const r = parseInt(normalized.slice(0, 2), 16)
    const g = parseInt(normalized.slice(2, 4), 16)
    const b = parseInt(normalized.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }

  // Use content from Firestore or fallback
  const heroContent = displayContent?.hero || {
    title: "Welcome to David's Salon",
    subtitle: "Experience premium hair and beauty services at our Harbor Point Ayala location. Discover our specialized services and exclusive offers tailored just for you.",
    buttonText: "View Our Services",
    backgroundImage: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%201-gwMUdJmDY3pIDaLqR4DsNsL8vwz2Fd.png",
    overlayOpacity: 0.6
  }

  const branchesContent = displayContent?.branches || {
    title: "Choose Your Branch",
    subtitle: "",
    searchPlaceholder: "Search branches..."
  }

  const testimonialsContent = displayContent?.testimonials || {
    title: "What Our Clients Say",
    subtitle: "Real stories from our satisfied customers",
    items: [
      {
        name: "Maria Gonzalez",
        branch: "Harbor Point Ayala",
        rating: 5,
        text: "I've been a loyal customer at Harbor Point Ayala for over 5 years, and the service quality and professionalism is remarkable. David's Salon truly understands Filipino beauty.",
      },
      {
        name: "Jennifer Santos",
        branch: "Harbor Point Ayala",
        rating: 5,
        text: "The staff at Harbor Point Ayala are not just skilled, they're artists. The transformation was beyond my expectations. The European techniques combined with Filipino hospitality is unmatched!",
      },
      {
        name: "Carlos Mendoza",
        branch: "Harbor Point Ayala",
        rating: 5,
        text: "Harbor Point Ayala offers world-class service. The quality is exceptional, the location is convenient, and the prices are very reasonable.",
      },
    ]
  }

  const ctaContent = displayContent?.cta || {
    title: "Ready to Transform Your Look?",
    subtitle: "Visit our Harbor Point Ayala location to discover our exclusive services and book your appointment today.",
    buttonText: "View Our Services"
  }

  const statsContent = displayContent?.stats || {
    yearsExperience: '15+'
  }

  const branches = branchesData.length ? branchesData : defaultBranches
  const testimonials = testimonialsContent.items || []

  // Handle inline editing
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
    editRevisionRef.current += 1
    setHasChanges(true)
  }

  // Handle testimonial updates
  const handleTestimonialUpdate = (index, field, value) => {
    if (!localContent) return
    
    const newContent = { ...localContent }
    if (!newContent.testimonials) {
      newContent.testimonials = { items: [] }
    }
    if (!newContent.testimonials.items) {
      newContent.testimonials.items = []
    }
    
    newContent.testimonials.items[index] = {
      ...newContent.testimonials.items[index],
      [field]: value
    }
    
    setLocalContent(newContent)
    editRevisionRef.current += 1
    setHasChanges(true)
  }

  // Save changes
  const handleSave = async () => {
    const contentToSave = localContentRef.current
    if (!contentToSave || !userData) return
    
    try {
      const saveRevision = editRevisionRef.current
      setSaving(true)
      const { id, ...payload } = contentToSave
      const result = await marketingContentService.updateContent('main', 'homepage', {
        ...payload,
        updatedBy: userData.uid
      })
      
      if (result.success) {
        setContent(contentToSave)
        if (editRevisionRef.current === saveRevision) {
          setHasChanges(false)
        }
      }
    } catch (error) {
      console.error('Error saving content:', error)
    } finally {
      setSaving(false)
    }
  }

  // Filter branches based on search term
  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.location.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Pagination logic
  const totalPages = Math.ceil(filteredBranches.length / branchesPerPage)
  const startIndex = (currentPage - 1) * branchesPerPage
  const endIndex = startIndex + branchesPerPage
  const currentBranches = filteredBranches.slice(startIndex, endIndex)

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  return (
    <div style={{ '--marketing-primary': primaryColor, '--marketing-cta-bg': ctaBackgroundColor }}>
      {!embedded && <Navigation />}
      {embedded && <Navigation embedded={true} cmsEditMode={cmsEditMode} />}
      
      {/* Floating Save Button for System Admin */}
      {isSystemAdmin && (
        <FloatingSaveButton 
          onSave={handleSave} 
          saving={saving} 
          hasChanges={hasChanges}
        />
      )}
      
      {/* Hero Section */}
      <EditableImage
        enabled={isSystemAdmin && effectiveEditMode}
        mode="background"
        onChange={(url) => handleContentUpdate('hero.backgroundImage', url)}
        wrapperClassName=""
      >
        <section
          className={`relative min-h-[600px] sm:min-h-[650px] md:min-h-[700px] lg:min-h-[800px] flex items-center justify-center text-center text-white ${embedded ? 'mt-0' : 'mt-[80px]'} pb-6 sm:pb-8`}
          style={{
            backgroundImage: `linear-gradient(rgba(0, 0, 0, ${heroContent.overlayOpacity || 0.6}), ${hexToRgba(heroOverlayBottomColor, heroOverlayBottomOpacity)}), url('${heroContent.backgroundImage}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {isSystemAdmin && effectiveEditMode && (
            <div className="absolute top-4 left-4 z-10 bg-white/95 text-gray-900 rounded-lg border border-gray-200 shadow p-3 space-y-2">
              <div className="text-xs font-semibold text-gray-700">Theme</div>
              <InlineColorPicker
                label="Primary"
                value={primaryColor}
                onChange={(value) => handleContentUpdate('theme.primaryColor', value)}
              />
              <InlineColorPicker
                label="Hero Overlay"
                value={heroOverlayBottomColor}
                onChange={(value) => handleContentUpdate('theme.heroOverlayBottomColor', value)}
              />
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700 whitespace-nowrap">Overlay Opacity</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={heroOverlayBottomOpacity}
                  onChange={(e) => handleContentUpdate('theme.heroOverlayBottomOpacity', parseFloat(e.target.value))}
                  className="w-32"
                />
                <span className="text-xs font-mono text-gray-600">{heroOverlayBottomOpacity.toFixed(2)}</span>
              </div>
              <InlineColorPicker
                label="CTA BG"
                value={ctaBackgroundColor}
                onChange={(value) => handleContentUpdate('theme.ctaBackgroundColor', value)}
              />
            </div>
          )}
          <div className={`max-w-4xl px-4 sm:px-6 md:px-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {isSystemAdmin ? (
              <h1 className="font-bold mb-4 sm:mb-6 text-balance animate-pulse-slow text-3xl sm:text-4xl md:text-5xl lg:text-[50px]">
                <InlineEditable
                  enabled={effectiveEditMode}
                  value={heroContent.title}
                  onSave={(path, value) => handleContentUpdate('hero.title', value)}
                  fieldPath="hero.title"
                  className="text-white"
                />
              </h1>
            ) : (
              <h1 className="font-bold mb-4 sm:mb-6 text-balance animate-pulse-slow text-3xl sm:text-4xl md:text-5xl lg:text-[50px]">{heroContent.title}</h1>
            )}
            {isSystemAdmin ? (
              <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 text-pretty leading-relaxed px-2">
                <InlineEditable
                  enabled={effectiveEditMode}
                  value={heroContent.subtitle}
                  onSave={(path, value) => handleContentUpdate('hero.subtitle', value)}
                  fieldPath="hero.subtitle"
                  multiline={true}
                  className="text-white"
                />
              </p>
            ) : (
              <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 text-pretty leading-relaxed px-2">
                {heroContent.subtitle}
              </p>
            )}
            <Button 
              size="md" 
              variant="ghost"
              className="bg-white text-[var(--marketing-primary)] hover:bg-gray-100 font-semibold px-6 py-2"
              onClick={() => {
                const branchesSection = document.getElementById('branches')
                if (branchesSection) {
                  const targetPosition = branchesSection.offsetTop - 20 // Add some offset from top
                  const startPosition = window.pageYOffset
                  const distance = targetPosition - startPosition
                  const duration = 1000 // 1 second for smooth scroll
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
              }}
            >
              {isSystemAdmin ? (
                <InlineEditable
                  enabled={effectiveEditMode}
                  value={heroContent.buttonText}
                  onSave={(path, value) => handleContentUpdate('hero.buttonText', value)}
                  fieldPath="hero.buttonText"
                  className="text-[var(--marketing-primary)]"
                />
              ) : (
                heroContent.buttonText
              )}
            </Button>

            <div className="max-w-4xl mx-auto mt-6 sm:mt-8 md:mt-12">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-8 text-center px-2 sm:px-4">
                <Card className="p-3 sm:p-4 md:p-6 border-0 bg-white" style={{ boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)' }}>
                  <CardContent className="p-0">
                    <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[var(--marketing-primary)] mb-1 sm:mb-2">{typeof branchCount === 'number' ? branchCount : '—'}</div>
                    <div className="text-xs sm:text-sm md:text-base text-gray-600">Branches</div>
                  </CardContent>
                </Card>
                <Card className="p-3 sm:p-4 md:p-6 border-0 bg-white" style={{ boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)' }}>
                  <CardContent className="p-0">
                    <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[var(--marketing-primary)] mb-1 sm:mb-2">{typeof clientCount === 'number' ? clientCount.toLocaleString() : '—'}</div>
                    <div className="text-xs sm:text-sm md:text-base text-gray-600">Happy Clients</div>
                  </CardContent>
                </Card>
                <Card className="p-3 sm:p-4 md:p-6 border-0 bg-white" style={{ boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)' }}>
                  <CardContent className="p-0">
                    <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-[var(--marketing-primary)] mb-1 sm:mb-2">
                      {isSystemAdmin ? (
                        <InlineEditable
                          enabled={effectiveEditMode}
                          value={statsContent.yearsExperience}
                          onSave={(path, value) => handleContentUpdate('stats.yearsExperience', value)}
                          fieldPath="stats.yearsExperience"
                          className="text-[var(--marketing-primary)]"
                        />
                      ) : (
                        statsContent.yearsExperience
                      )}
                    </div>
                    <div className="text-xs sm:text-sm md:text-base text-gray-600">Years Experience</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </EditableImage>

      {/* Mobile App Installation Banner */}
      <section className="bg-gradient-to-r from-[#160B53] to-[#2D1B8F] py-6 sm:py-8 md:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">
            {/* Left side - Text content */}
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 sm:mb-3">
                Get the David's Salon App
              </h3>
              <p className="text-sm sm:text-base md:text-lg text-white/90 mb-4 sm:mb-0">
                Book appointments, track rewards, and get exclusive offers on the go!
              </p>
            </div>

            {/* Right side - Download buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full md:w-auto">
              {/* Google Play Button */}
              <a
                href="#"
                className="flex items-center justify-center gap-3 bg-black hover:bg-gray-900 text-white px-6 py-3 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
                onClick={(e) => {
                  e.preventDefault()
                  alert('Android app coming soon! Stay tuned for the release.')
                }}
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                </svg>
                <div className="text-left">
                  <div className="text-xs opacity-90">GET IT ON</div>
                  <div className="text-lg font-semibold -mt-1">Google Play</div>
                </div>
              </a>

              {/* App Store Button - Coming Soon */}
              <a
                href="#"
                className="flex items-center justify-center gap-3 bg-black/50 text-white/50 px-6 py-3 rounded-lg shadow-lg cursor-not-allowed"
                onClick={(e) => e.preventDefault()}
              >
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z"/>
                </svg>
                <div className="text-left">
                  <div className="text-xs">Coming Soon</div>
                  <div className="text-lg font-semibold -mt-1">App Store</div>
                </div>
              </a>

              {/* Web App Badge */}
              <div className="flex items-center justify-center gap-2 bg-white/10 backdrop-blur-sm text-white px-4 py-3 rounded-lg border border-white/20">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/>
                </svg>
                <div className="text-left">
                  <div className="text-xs opacity-90">Available on</div>
                  <div className="text-sm font-semibold -mt-1">All Browsers</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Location Section */}
      <section id="branches" className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          {isSystemAdmin ? (
            <h2 className="font-bold text-center text-[var(--marketing-primary)] mb-4 text-3xl sm:text-4xl md:text-5xl lg:text-[50px]">
              <InlineEditable
                enabled={effectiveEditMode}
                value={branchesContent.title}
                onSave={(path, value) => handleContentUpdate('branches.title', value)}
                fieldPath="branches.title"
                className="text-[var(--marketing-primary)]"
              />
            </h2>
          ) : (
            <h2 className="font-bold text-center text-[var(--marketing-primary)] mb-4 text-3xl sm:text-4xl md:text-5xl lg:text-[50px]">{branchesContent.title}</h2>
          )}
          {branchesContent.subtitle && (
            isSystemAdmin ? (
              <p className="text-center text-gray-600 mb-8">
                <InlineEditable
                  enabled={effectiveEditMode}
                  value={branchesContent.subtitle}
                  onSave={(path, value) => handleContentUpdate('branches.subtitle', value)}
                  fieldPath="branches.subtitle"
                  className="text-gray-600"
                />
              </p>
            ) : (
              <p className="text-center text-gray-600 mb-8">{branchesContent.subtitle}</p>
            )
          )}

          <div className="flex justify-center mb-12">
            <div className="max-w-md w-full">
              <SearchInput
                placeholder={branchesContent.searchPlaceholder || "Search branches..."}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1) // Reset to first page when searching
                }}
              />
            </div>
          </div>

          {searchTerm && (
            <div className="text-center mb-6">
              <p className="text-gray-600">
                Found {filteredBranches.length} branch{filteredBranches.length !== 1 ? 'es' : ''} 
                {searchTerm && ` for "${searchTerm}"`}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {currentBranches.map((branch, index) => (
              <Card 
                key={index} 
                className="overflow-hidden p-0 border-0"
                style={{ 
                  boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)'
                }}
              >
                <div className="h-48 sm:h-56 w-full overflow-hidden relative">
                  <EditableImage
                    enabled={isSystemAdmin && effectiveEditMode}
                    src={branch.imageUrl || "/placeholder.svg"}
                    alt={`${branch.name} branch`}
                    onChange={async (url) => {
                      // Update branch image in Firestore
                      const updatedBranches = branchesData.map(b => 
                        b.id === branch.id ? { ...b, imageUrl: url } : b
                      );
                      setBranchesData(updatedBranches);
                      
                      // Save to Firestore with proper user context
                      try {
                        const { updateBranch } = await import('../../services/branchService');
                        await updateBranch(branch.id, { imageUrl: url }, userData);
                        console.log('✅ Branch image updated successfully');
                      } catch (error) {
                        console.error('❌ Error updating branch image:', error);
                      }
                    }}
                    className="w-full h-full object-cover"
                    wrapperClassName="w-full h-full"
                    style={{ 
                      objectPosition: 'center center',
                      height: '100%',
                      width: '100%'
                    }}
                  />
                </div>
                <CardContent className="p-4 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-bold mb-3 text-gray-800">
                    {branch.name}
                  </h3>
                  <div className="flex items-start text-gray-600 mb-3">
                    <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-gray-400" />
                    <span className="text-sm leading-relaxed">{branch.location}</span>
                  </div>
                  <div className="flex items-center text-gray-600 mb-4">
                    <Phone className="w-4 h-4 mr-2 flex-shrink-0 text-gray-400" />
                    <span className="text-sm">{branch.phone}</span>
                  </div>
                  <div className="text-sm text-gray-500 mb-4">
                    <span className="inline-block px-3 py-1.5 rounded-full text-xs bg-gray-100 text-gray-600">
                      Premium Services
                    </span>
                  </div>
                  <Link to={`/branch/${branch.slug}`}>
                    <Button
                      variant="ghost"
                      size="md"
                      className="w-full text-white bg-[var(--marketing-primary)] hover:opacity-90 py-2.5 font-medium"
                    >
                      View Services
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8 sm:mt-12 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-9 h-9 sm:w-10 sm:h-10 p-0 bg-transparent text-gray-700 border-gray-300 hover:bg-gray-50 transition-all duration-300 hover:scale-110 hover:border-[var(--marketing-primary)]"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                {"<"}
              </Button>
              
              {[...Array(totalPages)].map((_, index) => {
                const page = index + 1
                return (
                  <Button 
                    key={page}
                    variant="outline" 
                    size="sm" 
                    className={`w-9 h-9 sm:w-10 sm:h-10 p-0 transition-all duration-300 hover:scale-110 ${
                      currentPage === page
                        ? 'bg-[var(--marketing-primary)] text-white border-[var(--marketing-primary)]'
                        : 'bg-transparent text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-[var(--marketing-primary)]'
                    }`}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </Button>
                )
              })}
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-9 h-9 sm:w-10 sm:h-10 p-0 bg-transparent text-gray-700 border-gray-300 hover:bg-gray-50 transition-all duration-300 hover:scale-110 hover:border-[var(--marketing-primary)]"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                {">"}
              </Button>
            </div>
          )}

          {filteredBranches.length === 0 && searchTerm && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              </div>
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No branches found</h3>
              <p className="text-gray-500">
                Try searching with different keywords or check the spelling.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 px-2 sm:px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {isSystemAdmin ? (
            <h2 className="font-bold text-center text-[var(--marketing-primary)] mb-4" style={{ fontSize: '50px' }}>
              <InlineEditable
                enabled={effectiveEditMode}
                value={testimonialsContent.title}
                onSave={(path, value) => handleContentUpdate('testimonials.title', value)}
                fieldPath="testimonials.title"
                className="text-[var(--marketing-primary)]"
              />
            </h2>
          ) : (
            <h2 className="font-bold text-center text-[var(--marketing-primary)] mb-4" style={{ fontSize: '50px' }}>{testimonialsContent.title}</h2>
          )}
          {isSystemAdmin ? (
            <p className="text-center text-gray-600 mb-12">
              <InlineEditable
                enabled={effectiveEditMode}
                value={testimonialsContent.subtitle}
                onSave={(path, value) => handleContentUpdate('testimonials.subtitle', value)}
                fieldPath="testimonials.subtitle"
                className="text-gray-600"
              />
            </p>
          ) : (
            <p className="text-center text-gray-600 mb-12">{testimonialsContent.subtitle}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card 
                key={index} 
                className="p-6 border-0"
                style={{ 
                  borderColor: '#B5B5B5',
                  boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)'
                }}
              >
                <CardContent className="p-0">
                  <div className="text-6xl text-[var(--marketing-primary)] mb-4">"</div>
                  {isSystemAdmin ? (
                    <p className="text-gray-700 mb-6 leading-relaxed">
                      <InlineEditable
                        enabled={effectiveEditMode}
                        value={testimonial.text}
                        onSave={(path, value) => handleTestimonialUpdate(index, 'text', value)}
                        fieldPath={`testimonials.items.${index}.text`}
                        multiline={true}
                        className="text-gray-700"
                      />
                    </p>
                  ) : (
                    <p className="text-gray-700 mb-6 leading-relaxed">
                      {testimonial.text}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div>
                      {isSystemAdmin ? (
                        <div className="font-semibold text-[var(--marketing-primary)]">
                          <InlineEditable
                            enabled={effectiveEditMode}
                            value={testimonial.name}
                            onSave={(path, value) => handleTestimonialUpdate(index, 'name', value)}
                            fieldPath={`testimonials.items.${index}.name`}
                            className="text-[var(--marketing-primary)]"
                          />
                        </div>
                      ) : (
                        <div className="font-semibold text-[var(--marketing-primary)]">
                          {testimonial.name}
                        </div>
                      )}
                      {isSystemAdmin ? (
                        <div className="text-sm text-gray-500">
                          <InlineEditable
                            enabled={effectiveEditMode}
                            value={testimonial.branch}
                            onSave={(path, value) => handleTestimonialUpdate(index, 'branch', value)}
                            fieldPath={`testimonials.items.${index}.branch`}
                            className="text-gray-500"
                          />
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">
                          {testimonial.branch}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-16 px-2 sm:px-4 bg-[var(--marketing-cta-bg)] text-white text-center">
        <div className="max-w-4xl mx-auto">
          {isSystemAdmin ? (
            <h2 className="font-bold mb-6" style={{ fontSize: '50px' }}>
              <InlineEditable
                enabled={effectiveEditMode}
                value={ctaContent.title}
                onSave={(path, value) => handleContentUpdate('cta.title', value)}
                fieldPath="cta.title"
                className="text-white"
              />
            </h2>
          ) : (
            <h2 className="font-bold mb-6" style={{ fontSize: '50px' }}>{ctaContent.title}</h2>
          )}
          {isSystemAdmin ? (
            <p className="text-xl mb-8 text-pretty leading-relaxed">
              <InlineEditable
                enabled={effectiveEditMode}
                value={ctaContent.subtitle}
                onSave={(path, value) => handleContentUpdate('cta.subtitle', value)}
                fieldPath="cta.subtitle"
                multiline={true}
                className="text-white"
              />
            </p>
          ) : (
            <p className="text-xl mb-8 text-pretty leading-relaxed">
              {ctaContent.subtitle}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="md"
              variant="ghost"
              className="border border-white text-white hover:bg-white hover:text-[var(--marketing-primary)] bg-transparent px-6 py-2"
              onClick={() => {
                const branchesSection = document.getElementById('branches')
                if (branchesSection) {
                  const targetPosition = branchesSection.offsetTop - 20 // Add some offset from top
                  const startPosition = window.pageYOffset
                  const distance = targetPosition - startPosition
                  const duration = 1000 // 1 second for smooth scroll
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
              }}
            >
              {isSystemAdmin ? (
                <InlineEditable
                  enabled={effectiveEditMode}
                  value={ctaContent.buttonText}
                  onSave={(path, value) => handleContentUpdate('cta.buttonText', value)}
                  fieldPath="cta.buttonText"
                  className="text-white"
                />
              ) : (
                ctaContent.buttonText
              )}
            </Button>
          </div>
        </div>
      </section>
      {!embedded && <Footer />}
      {embedded && <Footer embedded={true} cmsEditMode={cmsEditMode} />}
      
      {/* Chatbot Widget */}
      {!embedded && <ChatbotWidget />}
    </div>
  )
}

