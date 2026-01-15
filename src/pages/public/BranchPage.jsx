import { useParams, Link } from "react-router-dom"
import Button from "../../components/ui/Button"
import { Card, CardContent } from "../../components/ui/Card"
import { MapPin, Phone, Clock, Scissors, Palette, Sparkles, Crown } from "lucide-react"
import BranchNavigation from "../../components/landing/BranchNavigation"
import BranchFooter from "../../components/landing/BranchFooter"
import PromotionPopup from "../../components/landing/PromotionPopup"
import { useState, useEffect, useRef } from "react"
import { marketingBranchService } from "../../services/marketingBranchService"
import { getBranchServices } from "../../services/branchServicesService"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../../config/firebase"
import { useAuth } from "../../context/AuthContext"
import { USER_ROLES } from "../../utils/constants"
import InlineEditable from "../../components/cms/InlineEditable"
import FloatingSaveButton from "../../components/cms/FloatingSaveButton"
import EditableImage from "../../components/cms/EditableImage"
import InlineColorPicker from "../../components/cms/InlineColorPicker"

export default function BranchPage({
  embedded = false,
  cmsEditMode,
  cmsBranchId = null,
  cmsBranchName = '',
  cmsBranchSlug = ''
}) {
  const { userData, userRoles } = useAuth()
  const params = useParams()
  const slug = cmsBranchSlug || params.slug
  const effectiveEditMode = typeof cmsEditMode === 'boolean' ? cmsEditMode : true
  const isSystemAdmin =
    userRoles?.includes(USER_ROLES.SYSTEM_ADMIN) ||
    userRoles?.includes('system_admin') ||
    userData?.role === USER_ROLES.SYSTEM_ADMIN ||
    userData?.role === 'system_admin'

  const computedBranchName = slug
    ? slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : ''
  const branchName = cmsBranchName || computedBranchName || 'Branch'
  const [isVisible, setIsVisible] = useState(false)
  const [content, setContent] = useState(null)
  const [localContent, setLocalContent] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [branchId, setBranchId] = useState(null)
  const [branchServices, setBranchServices] = useState([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [branchStylists, setBranchStylists] = useState([])
  const [stylistsLoading, setStylistsLoading] = useState(false)
  const [branchGalleryItems, setBranchGalleryItems] = useState([])
  const [galleryLoading, setGalleryLoading] = useState(false)

  const localContentRef = useRef(null)
  const editRevisionRef = useRef(0)

  const slugify = (value) => {
    if (!value) return ''
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  }

  // Find branchId from slug
  useEffect(() => {
    if (cmsBranchId) {
      setBranchId(cmsBranchId)
      return
    }

    const findBranch = async () => {
      try {
        const branchesRef = collection(db, 'branches')

        // Try resolving by stored slug first
        const slugQuery = query(branchesRef, where('slug', '==', slug))
        const slugSnapshot = await getDocs(slugQuery)
        if (!slugSnapshot.empty) {
          setBranchId(slugSnapshot.docs[0].id)
          return
        }

        const slugNormalized = slugify(slug)
        const slugAlt = slugNormalized.endsWith('-branch')
          ? slugNormalized.replace(/-branch$/, '')
          : `${slugNormalized}-branch`

        const allSnapshot = await getDocs(branchesRef)
        const match = allSnapshot.docs.find((d) => {
          const data = d.data() || {}
          const candidates = [
            slugify(data.slug),
            slugify(data.name),
            slugify(data.branchName)
          ].filter(Boolean)
          return candidates.includes(slugNormalized) || candidates.includes(slugAlt)
        })

        if (match) {
          setBranchId(match.id)
          return
        }

        setBranchId(null)
      } catch (error) {
        console.error('Error finding branch:', error)
        setBranchId(null)
      }
    }
    
    if (slug) {
      findBranch()
    }
  }, [slug, cmsBranchId])

  const slugKey = slug ? `slug_${slugify(slug)}` : null
  const marketingBranchId = branchId || slugKey || null

  useEffect(() => {
    editRevisionRef.current = 0
    setHasChanges(false)
    setLocalContent(null)
    setContent(null)
    if (branchId) {
      setLoading(true)
    }
  }, [branchId])

  // Load content from Firestore
  useEffect(() => {
    if (!marketingBranchId) return

    // Subscribe to real-time updates
    const unsubscribe = marketingBranchService.subscribeToContent(marketingBranchId, 'branch', (result) => {
      if (result.content) {
        setContent(result.content)
        if (!hasChanges) {
          setLocalContent(result.content)
        }
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [marketingBranchId, hasChanges])

  useEffect(() => {
    if (content && !localContent) {
      setLocalContent(content)
    }
  }, [content, localContent])

  useEffect(() => {
    localContentRef.current = localContent
  }, [localContent])

  // Fade in animation on component mount
  useEffect(() => {
    setIsVisible(true)
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadBranchServices = async () => {
      if (!branchId) {
        setBranchServices([])
        return
      }

      try {
        setServicesLoading(true)
        const services = await getBranchServices(branchId)
        if (cancelled) return
        setBranchServices(Array.isArray(services) ? services : [])
      } catch (e) {
        if (cancelled) return
        setBranchServices([])
      } finally {
        if (cancelled) return
        setServicesLoading(false)
      }
    }

    loadBranchServices()

    return () => {
      cancelled = true
    }
  }, [branchId])

  const formatDuration = (minutes) => {
    const n = typeof minutes === 'number' ? minutes : parseInt(minutes, 10)
    if (!n || Number.isNaN(n)) return ''
    if (n < 60) return `${n} min`
    const h = Math.floor(n / 60)
    const m = n % 60
    return m ? `${h}h ${m}m` : `${h}h`
  }

  const formatPrice = (value) => {
    if (value === undefined || value === null || value === '') return ''
    const n = typeof value === 'number' ? value : parseFloat(value)
    if (Number.isNaN(n)) return `₱${value}`
    return `₱${n.toLocaleString()}`
  }

  const categoryIcon = (category) => {
    const c = String(category || '').toLowerCase()
    if (c.includes('cut') || c.includes('blow')) return <Scissors className="w-8 h-8" />
    if (c.includes('color') || c.includes('colour') || c.includes('balayage') || c.includes('dye')) return <Palette className="w-8 h-8" />
    if (c.includes('straight') || c.includes('rebond') || c.includes('keratin') || c.includes('perm')) return <Crown className="w-8 h-8" />
    return <Sparkles className="w-8 h-8" />
  }

  const categoryColor = (category) => {
    const c = String(category || '').toLowerCase()
    if (c.includes('cut') || c.includes('blow')) return "bg-purple-100 text-purple-600"
    if (c.includes('color') || c.includes('colour') || c.includes('balayage') || c.includes('dye')) return "bg-blue-100 text-blue-600"
    if (c.includes('straight') || c.includes('rebond') || c.includes('keratin') || c.includes('perm')) return "bg-[var(--branch-primary)] text-white"
    return "bg-pink-100 text-pink-600"
  }

  const services = (() => {
    const counts = new Map()
    for (const s of branchServices) {
      const category = s?.category || 'Uncategorized'
      counts.set(category, (counts.get(category) || 0) + 1)
    }
    return Array.from(counts.entries())
      .slice(0, 4)
      .map(([category, count]) => ({
        icon: categoryIcon(category),
        title: category,
        description: `${count} service${count === 1 ? '' : 's'} available`,
        color: categoryColor(category)
      }))
  })()

  const popularServices = branchServices.slice(0, 3).map((s) => ({
    id: s.id,
    name: s.serviceName || s.name || 'Service',
    duration: formatDuration(s.duration),
    price: formatPrice(s.price),
    image: s.imageURL || s.image || s.media?.[0]?.url || '/logo.jpg'
  }))

  useEffect(() => {
    let cancelled = false

    const isStylistUser = (u) => {
      if (!u) return false
      const role = u.role
      const roles = Array.isArray(u.roles) ? u.roles : []
      return (
        role === USER_ROLES.STYLIST ||
        role === 'stylist' ||
        roles.includes(USER_ROLES.STYLIST) ||
        roles.includes('stylist')
      )
    }

    const fullName = (u) => {
      const first = u.firstName || ''
      const last = u.lastName || ''
      const joined = `${first} ${last}`.trim()
      return joined || u.displayName || u.name || u.email || 'Stylist'
    }

    const toExperienceLabel = (u) => {
      const years =
        u.yearsExperience ??
        u.experienceYears ??
        u.experience ??
        u.yearsOfExperience

      if (typeof years === 'number' && years > 0) return `${years} years`
      if (typeof years === 'string' && years.trim()) return years.trim()
      return '—'
    }

    const loadStylists = async () => {
      if (!branchId) {
        setBranchStylists([])
        setBranchGalleryItems([])
        setGalleryLoading(false)
        return
      }

      try {
        setStylistsLoading(true)
        setGalleryLoading(true)

        // Avoid composite index requirements by only filtering by branchId and doing the rest in-memory
        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('branchId', '==', branchId))
        const snapshot = await getDocs(q)
        if (cancelled) return

        const mapped = snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() || {}) }))
          .filter((u) => u?.isActive !== false)
          .filter(isStylistUser)
          .map((u) => ({
            id: u.id,
            name: fullName(u),
            specialty: u.specialty || u.specialization || u.position || 'Stylist',
            experience: toExperienceLabel(u),
            image: u.photoURL || u.profilePicture || u.avatarUrl || u.image || '/logo.jpg',
          }))

        const stylistIds = mapped.map((s) => s.id).filter(Boolean)

        const portfolioImageByStylistId = new Map()
        const approvedPortfolioItems = []
        const batchSize = 10
        for (let i = 0; i < stylistIds.length; i += batchSize) {
          const batch = stylistIds.slice(i, i + batchSize)
          if (batch.length === 0) continue

          const portfolioSnap = await getDocs(
            query(collection(db, 'portfolio'), where('stylistId', 'in', batch))
          )

          portfolioSnap.docs
            .map((d) => ({ id: d.id, ...(d.data() || {}) }))
            .filter((p) => p?.status === 'active' || p?.status === 'approved')
            .forEach((p) => {
              const stylistId = p?.stylistId
              if (!stylistId) return

              const imageUrl = p.thumbnailUrl || p.imageUrl
              if (!imageUrl) return

              const createdAtSeconds =
                p?.createdAt?.seconds ??
                (typeof p?.createdAt === 'number' ? p.createdAt : null)

              approvedPortfolioItems.push({
                id: p.id,
                stylistId,
                title: p.title,
                category: p.category,
                imageUrl,
                createdAtSeconds
              })

              const existing = portfolioImageByStylistId.get(stylistId)
              if (!existing) {
                portfolioImageByStylistId.set(stylistId, { imageUrl, createdAtSeconds })
                return
              }

              const prevSeconds = existing.createdAtSeconds ?? 0
              const nextSeconds = createdAtSeconds ?? 0
              if (nextSeconds >= prevSeconds) {
                portfolioImageByStylistId.set(stylistId, { imageUrl, createdAtSeconds })
              }
            })
        }

        const enriched = mapped.map((s) => ({
          ...s,
          portfolioImage: portfolioImageByStylistId.get(s.id)?.imageUrl || null
        }))

        approvedPortfolioItems.sort((a, b) => {
          const aTime = a.createdAtSeconds ?? 0
          const bTime = b.createdAtSeconds ?? 0
          return bTime - aTime
        })

        setBranchGalleryItems(
          approvedPortfolioItems.slice(0, 6).map((item) => ({
            id: item.id,
            image: item.imageUrl,
            title: item.title || 'Work',
            category: item.category || ''
          }))
        )

        setBranchStylists(enriched)
      } catch (e) {
        if (cancelled) return
        setBranchStylists([])
        setBranchGalleryItems([])
      } finally {
        if (cancelled) return
        setStylistsLoading(false)
        setGalleryLoading(false)
      }
    }

    loadStylists()

    return () => {
      cancelled = true
    }
  }, [branchId])

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

  const handleSave = async () => {
    const contentToSave = localContentRef.current
    if (!branchId || !contentToSave || !userData?.uid) return
    try {
      const saveRevision = editRevisionRef.current
      setSaving(true)
      const { id, ...payload } = contentToSave
      const docIds = [branchId, slugKey].filter(Boolean)
      const results = await Promise.all(
        docIds.map((docId) =>
          marketingBranchService.updateContent(docId, 'branch', {
            ...payload,
            branchId,
            slug,
            updatedBy: userData.uid
          })
        )
      )

      const success = results.every((r) => r?.success)

      if (success) {
        setContent(contentToSave)
        if (editRevisionRef.current === saveRevision) {
          setHasChanges(false)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  // Use content from Firestore or fallback
  const heroContent = displayContent?.hero || {
    title: `David's Salon ${branchName} Branch`,
    subtitle: "Choose your preferred branch to discover our specialized services and exclusive offers tailored just for you. Each location offers unique experiences designed for our local community.",
    buttonText: "Choose another branch",
    backgroundImage: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%201-gwMUdJmDY3pIDaLqR4DsNsL8vwz2Fd.png",
    overlayOpacity: 0.6,
    statistics: {
      branches: 7,
      clients: "50K+",
      years: "15+"
    }
  }

  const testimonialsContent = displayContent?.testimonials || {
    title: "What Our Clients Say",
    subtitle: "Real stories from our satisfied customers",
    items: [
      {
        name: "Maria Gonzales",
        branch: "Makati Branch",
        rating: 5,
        text: "I've been a loyal customer for over 10 years, and the service quality and professionalism across all branches is remarkable. David's Salon truly understands Filipino beauty.",
      },
      {
        name: "Jennifer Santos",
        branch: "BGC Branch",
        rating: 5,
        text: "The staff was not just skilled, they're artists. The transformation was beyond my expectations. The European techniques combined with Filipino hospitality is unmatched!",
      },
      {
        name: "Carlos Mendoza",
        branch: "Cebu Branch",
        rating: 5,
        text: "As someone who travels frequently, I can confidently say that David's Salon offers world-class. The quality is consistent everywhere, and the prices are very reasonable.",
      },
    ]
  }

  const visitBranchContent = displayContent?.visitBranch || {
    title: "Visit Branch",
    subtitle: "Find us and get in touch",
    locationLabel: 'Location',
    phoneLabel: 'Contact',
    hoursLabel: 'Hours',
    location: "Ayala Center, Makati",
    phone: "+63 930 222 9699",
    hours: "Mon-Sun: 10:00 AM - 9:00 PM"
  }

  const contactInfoContent = displayContent?.contactInfo || {
    title: "Visit Us",
    subtitle: "Get in touch with our team",
    addressLabel: 'Address',
    phoneLabel: 'Phone',
    hoursLabel: 'Hours',
    address: "Ground Floor Harbor Point Subic, Subic, Philippines",
    phone: "0992 586 5758",
    hours: "Monday - Sunday: 10:00 AM - 9:00 PM"
  }

  const bookingCtaContent = contactInfoContent.bookingCta || {
    title: 'Ready to Book?',
    subtitle: 'Call us now to schedule your appointment',
    callButtonPrefix: 'Call',
    footerText: 'Or visit us at our location'
  }

  const servicesSection = displayContent?.services || {
    title: "Explore Our Services",
    subtitle: `Discover what makes ${branchName} branch special`
  }

  const servicesCategoryCardButtonText =
    displayContent?.services?.categoryCardButtonText || 'View More'

  const servicesViewDetailsButtonText =
    displayContent?.services?.viewDetailsButtonText || 'View Service Details'
  const servicesViewAllButtonText =
    displayContent?.services?.viewAllButtonText || 'View All Services'

  const popularServicesSection = displayContent?.popularServices || {
    title: "Popular Services",
    subtitle: "Our most requested treatments"
  }

  const stylistsSection = displayContent?.stylists || {
    title: "Meet Our Top Stylists",
    subtitle: "Expert professionals ready to transform your look"
  }

  const stylistsProfileButtonText =
    displayContent?.stylists?.profileButtonText || 'View Service Profile'
  const stylistsMeetAllButtonText =
    displayContent?.stylists?.meetAllButtonText || 'Meet All Stylists'

  const gallerySection = displayContent?.gallery || {
    title: "Our Work",
    subtitle: "See our work and salon atmosphere"
  }

  const galleryViewFullButtonText =
    displayContent?.gallery?.viewFullButtonText || 'View Full Gallery'

  const testimonials = testimonialsContent.items || []

  const handleEmbeddedClickCapture = (e) => {
    if (!embedded) return
    const target = e?.target
    if (!target || typeof target.closest !== 'function') return
    if (target.closest('[data-cms-allow-interaction="true"]')) return

    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      className="min-h-screen bg-white"
      style={{ '--branch-primary': primaryColor, '--branch-cta-bg': ctaBackgroundColor }}
      onClickCapture={handleEmbeddedClickCapture}
    >
      {/* Promotion Popup */}
      {!embedded && <PromotionPopup />}
      
      {/* Branch Navigation */}
      {!embedded && (
        <BranchNavigation
          branchName={`${branchName} Branch`}
          branchSlug={slug}
          cmsEditable={isSystemAdmin && effectiveEditMode}
          onContentUpdate={(path, value) => handleContentUpdate(path, value)}
          navigationContent={displayContent?.navigation}
        />
      )}

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
      >
        <section
          className={`relative h-[800px] flex items-center justify-center text-center text-white ${embedded ? 'mt-0' : 'mt-[122px]'}`}
          style={{
            backgroundImage: `linear-gradient(rgba(0, 0, 0, ${heroContent.overlayOpacity || 0.6}), ${hexToRgba(heroOverlayBottomColor, heroOverlayBottomOpacity)}), url('${heroContent.backgroundImage}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {isSystemAdmin && effectiveEditMode && (
            <div
              className="absolute top-4 left-4 z-10 bg-white/95 text-gray-900 rounded-lg border border-gray-200 shadow p-3 space-y-2"
              data-cms-allow-interaction="true"
            >
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
          <div className={`max-w-4xl px-2 sm:px-4 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h1 className="font-bold mb-6 text-balance animate-pulse-slow" style={{ fontSize: '50px' }}>
              {isSystemAdmin ? (
                <InlineEditable
                  enabled={effectiveEditMode}
                  value={heroContent.title}
                  onSave={(path, value) => handleContentUpdate('hero.title', value)}
                  fieldPath="hero.title"
                  className="text-white"
                />
              ) : (
                heroContent.title
              )}
            </h1>
            <p className="text-xl mb-8 text-pretty leading-relaxed">
              {isSystemAdmin ? (
                <InlineEditable
                  enabled={effectiveEditMode}
                  value={heroContent.subtitle}
                  onSave={(path, value) => handleContentUpdate('hero.subtitle', value)}
                  fieldPath="hero.subtitle"
                  multiline={true}
                  className="text-white"
                />
              ) : (
                heroContent.subtitle
              )}
            </p>
            {embedded ? (
              <Button 
                size="md" 
                variant="ghost"
                className="bg-white text-[var(--branch-primary)] hover:bg-gray-100 font-semibold px-6 py-2"
              >
                {isSystemAdmin ? (
                  <InlineEditable
                    enabled={effectiveEditMode}
                    value={heroContent.buttonText}
                    onSave={(path, value) => handleContentUpdate('hero.buttonText', value)}
                    fieldPath="hero.buttonText"
                    className="text-[var(--branch-primary)]"
                  />
                ) : (
                  heroContent.buttonText
                )}
              </Button>
            ) : (
              <Link to="/">
                <Button 
                  size="md" 
                  variant="ghost"
                  className="bg-white text-[var(--branch-primary)] hover:bg-gray-100 font-semibold px-6 py-2"
                >
                  {isSystemAdmin ? (
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={heroContent.buttonText}
                      onSave={(path, value) => handleContentUpdate('hero.buttonText', value)}
                      fieldPath="hero.buttonText"
                      className="text-[var(--branch-primary)]"
                    />
                  ) : (
                    heroContent.buttonText
                  )}
                </Button>
              </Link>
            )}
          
          </div>
        </section>
      </EditableImage>

      {/* Explore Our Services Section */}
      <section id="services" className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-bold text-center text-[var(--branch-primary)] mb-4" style={{ fontSize: '50px' }}>
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={servicesSection.title}
                onSave={(path, value) => handleContentUpdate('services.title', value)}
                fieldPath="services.title"
                className="text-[var(--branch-primary)]"
              />
            ) : (
              servicesSection.title
            )}
          </h2>
          <p className="text-center text-gray-600 mb-12">
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={servicesSection.subtitle}
                onSave={(path, value) => handleContentUpdate('services.subtitle', value)}
                fieldPath="services.subtitle"
                className="text-gray-600"
              />
            ) : (
              servicesSection.subtitle
            )}
          </p>

          {servicesLoading ? (
            <div className="text-center text-gray-600 py-8">Loading services...</div>
          ) : services.length === 0 ? (
            <div className="text-center text-gray-600 py-8">No services available for this branch yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {services.map((service, index) => (
                <Card key={index} className="p-6 text-center border-0 transition-shadow" style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}>
                  <CardContent className="p-0">
                    <div
                      className={`w-16 h-16 rounded-full ${service.color} flex items-center justify-center mx-auto mb-4`}
                    >
                      {service.icon}
                    </div>
                    <h3 className="text-xl font-semibold text-[var(--branch-primary)] mb-2">{service.title}</h3>
                    <p className="text-gray-600 text-sm mb-4">{service.description}</p>
                    <Link to={`/branch/${slug}/services`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[var(--branch-primary)] text-[var(--branch-primary)] hover:bg-[var(--branch-primary)] hover:text-white bg-transparent"
                      >
                        {isSystemAdmin ? (
                          <InlineEditable
                            enabled={effectiveEditMode}
                            value={servicesCategoryCardButtonText}
                            onSave={(path, value) => handleContentUpdate('services.categoryCardButtonText', value)}
                            fieldPath="services.categoryCardButtonText"
                            className="text-[var(--branch-primary)]"
                          />
                        ) : (
                          servicesCategoryCardButtonText
                        )}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Popular Services Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-bold text-center text-[var(--branch-primary)] mb-4" style={{ fontSize: '50px' }}>
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={popularServicesSection.title}
                onSave={(path, value) => handleContentUpdate('popularServices.title', value)}
                fieldPath="popularServices.title"
                className="text-[var(--branch-primary)]"
              />
            ) : (
              popularServicesSection.title
            )}
          </h2>
          <p className="text-center text-gray-600 mb-12">
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={popularServicesSection.subtitle}
                onSave={(path, value) => handleContentUpdate('popularServices.subtitle', value)}
                fieldPath="popularServices.subtitle"
                className="text-gray-600"
              />
            ) : (
              popularServicesSection.subtitle
            )}
          </p>

          {servicesLoading ? (
            <div className="text-center text-gray-600 py-8">Loading services...</div>
          ) : popularServices.length === 0 ? (
            <div className="text-center text-gray-600 py-8">No services available for this branch yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {popularServices.map((service, index) => (
                <Card key={service.id || index} className="overflow-hidden border-0 transition-shadow p-0" style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}>
                  <div className="h-48 w-full bg-gray-200 overflow-hidden">
                    <img
                      src={service.image || "/placeholder.svg"}
                      alt={service.name}
                      className="w-full h-full object-cover"
                      style={{ 
                        height: '192px',
                        width: '100%',
                        maxHeight: '192px',
                        maxWidth: '100%'
                      }}
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-[var(--branch-primary)] mb-2">{service.name}</h3>
                    <div className="flex items-center text-gray-600 mb-2">
                      <Clock className="w-4 h-4 mr-2" />
                      <span className="text-sm">{service.duration || '—'}</span>
                    </div>
                    <div className="flex items-center text-gray-600 mb-4">
                      <span className="text-lg font-semibold text-[var(--branch-primary)]">{service.price || '—'}</span>
                    </div>
                    {embedded ? (
                      <Button variant="ghost" size="md" className="w-full bg-[var(--branch-primary)] hover:opacity-90 text-white py-2">
                        {isSystemAdmin ? (
                          <InlineEditable
                            enabled={effectiveEditMode}
                            value={servicesViewDetailsButtonText}
                            onSave={(path, value) => handleContentUpdate('services.viewDetailsButtonText', value)}
                            fieldPath="services.viewDetailsButtonText"
                            className="text-white"
                          />
                        ) : (
                          servicesViewDetailsButtonText
                        )}
                      </Button>
                    ) : (
                      <Link to={service.id ? `/branch/${slug}/services/${service.id}` : `/branch/${slug}/services`}>
                        <Button variant="ghost" size="md" className="w-full bg-[var(--branch-primary)] hover:opacity-90 text-white py-2">
                          {isSystemAdmin ? (
                            <InlineEditable
                              enabled={effectiveEditMode}
                              value={servicesViewDetailsButtonText}
                              onSave={(path, value) => handleContentUpdate('services.viewDetailsButtonText', value)}
                              fieldPath="services.viewDetailsButtonText"
                              className="text-white"
                            />
                          ) : (
                            servicesViewDetailsButtonText
                          )}
                        </Button>
                      </Link>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!servicesLoading && branchServices.length > 0 && (
            <div className="text-center mt-8">
              {embedded ? (
                <Button variant="ghost" size="md" className="bg-[var(--branch-primary)] hover:opacity-90 text-white px-6 py-2">
                  {isSystemAdmin ? (
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={servicesViewAllButtonText}
                      onSave={(path, value) => handleContentUpdate('services.viewAllButtonText', value)}
                      fieldPath="services.viewAllButtonText"
                      className="text-white"
                    />
                  ) : (
                    servicesViewAllButtonText
                  )}
                </Button>
              ) : (
                <Link to={`/branch/${slug}/services`}>
                  <Button variant="ghost" size="md" className="bg-[var(--branch-primary)] hover:opacity-90 text-white px-6 py-2">
                    {isSystemAdmin ? (
                      <InlineEditable
                        enabled={effectiveEditMode}
                        value={servicesViewAllButtonText}
                        onSave={(path, value) => handleContentUpdate('services.viewAllButtonText', value)}
                        fieldPath="services.viewAllButtonText"
                        className="text-white"
                      />
                    ) : (
                      servicesViewAllButtonText
                    )}
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Meet Our Top Stylists Section */}
      <section id="stylists" className="py-16 px-6 bg-[var(--branch-primary)] text-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-bold text-center mb-4" style={{ fontSize: '50px' }}>
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={stylistsSection.title}
                onSave={(path, value) => handleContentUpdate('stylists.title', value)}
                fieldPath="stylists.title"
                className="text-white"
              />
            ) : (
              stylistsSection.title
            )}
          </h2>
          <p className="text-center mb-12 opacity-90">
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={stylistsSection.subtitle}
                onSave={(path, value) => handleContentUpdate('stylists.subtitle', value)}
                fieldPath="stylists.subtitle"
                className="text-white"
              />
            ) : (
              stylistsSection.subtitle
            )}
          </p>

          {stylistsLoading ? (
            <div className="text-center text-white/80 py-8">Loading stylists...</div>
          ) : branchStylists.length === 0 ? (
            <div className="text-center text-white/80 py-8">No stylists available for this branch yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {branchStylists.slice(0, 3).map((stylist) => (
                <Card key={stylist.id} className="bg-white text-gray-900 overflow-hidden border-0 p-0" style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}>
                  <div className="h-64 w-full bg-gray-200 overflow-hidden">
                    <img
                      src={stylist.image || stylist.portfolioImage || '/logo.jpg'}
                      alt={stylist.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null
                        e.currentTarget.src = '/logo.jpg'
                      }}
                      style={{ 
                        height: '256px',
                        width: '100%',
                        maxHeight: '256px',
                        maxWidth: '100%'
                      }}
                    />
                  </div>
                  <div className="p-6 text-center">
                    <h3 className="text-xl font-bold text-[var(--branch-primary)] mb-1">{stylist.name}</h3>
                    <p className="text-gray-600 text-sm mb-2">{stylist.specialty}</p>
                    <p className="text-gray-500 text-xs mb-4">{stylist.experience} experience</p>
                    {embedded ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[var(--branch-primary)] text-[var(--branch-primary)] hover:bg-[var(--branch-primary)] hover:text-white bg-transparent"
                      >
                        {isSystemAdmin ? (
                          <InlineEditable
                            enabled={effectiveEditMode}
                            value={stylistsProfileButtonText}
                            onSave={(path, value) => handleContentUpdate('stylists.profileButtonText', value)}
                            fieldPath="stylists.profileButtonText"
                            className="text-[var(--branch-primary)]"
                          />
                        ) : (
                          stylistsProfileButtonText
                        )}
                      </Button>
                    ) : (
                      <Link to={`/branch/${slug}/stylists/${stylist.id}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[var(--branch-primary)] text-[var(--branch-primary)] hover:bg-[var(--branch-primary)] hover:text-white bg-transparent"
                        >
                          {isSystemAdmin ? (
                            <InlineEditable
                              enabled={effectiveEditMode}
                              value={stylistsProfileButtonText}
                              onSave={(path, value) => handleContentUpdate('stylists.profileButtonText', value)}
                              fieldPath="stylists.profileButtonText"
                              className="text-[var(--branch-primary)]"
                            />
                          ) : (
                            stylistsProfileButtonText
                          )}
                        </Button>
                      </Link>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="text-center mt-8">
            {embedded ? (
              <Button
                variant="outline"
                size="md"
                className="border-white text-white hover:bg-white hover:text-[var(--branch-primary)] bg-transparent px-6 py-2"
              >
                {isSystemAdmin ? (
                  <InlineEditable
                    enabled={effectiveEditMode}
                    value={stylistsMeetAllButtonText}
                    onSave={(path, value) => handleContentUpdate('stylists.meetAllButtonText', value)}
                    fieldPath="stylists.meetAllButtonText"
                    className="text-white"
                  />
                ) : (
                  stylistsMeetAllButtonText
                )}
              </Button>
            ) : (
              <Link to={`/branch/${slug}/stylists`}>
                <Button
                  variant="outline"
                  size="md"
                  className="border-white text-white hover:bg-white hover:text-[var(--branch-primary)] bg-transparent px-6 py-2"
                >
                  {isSystemAdmin ? (
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={stylistsMeetAllButtonText}
                      onSave={(path, value) => handleContentUpdate('stylists.meetAllButtonText', value)}
                      fieldPath="stylists.meetAllButtonText"
                      className="text-white"
                    />
                  ) : (
                    stylistsMeetAllButtonText
                  )}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Our Work Section */}
      <section id="gallery" className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-bold text-center text-[var(--branch-primary)] mb-4" style={{ fontSize: '50px' }}>
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={gallerySection.title}
                onSave={(path, value) => handleContentUpdate('gallery.title', value)}
                fieldPath="gallery.title"
                className="text-[var(--branch-primary)]"
              />
            ) : (
              gallerySection.title
            )}
          </h2>
          <p className="text-center text-gray-600 mb-12">
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={gallerySection.subtitle}
                onSave={(path, value) => handleContentUpdate('gallery.subtitle', value)}
                fieldPath="gallery.subtitle"
                className="text-gray-600"
              />
            ) : (
              gallerySection.subtitle
            )}
          </p>

          {stylistsLoading || galleryLoading ? (
            <div className="text-center text-gray-600 py-8">Loading gallery...</div>
          ) : branchGalleryItems.length === 0 ? (
            <div className="text-center text-gray-600 py-8">No gallery images available for this branch yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {branchGalleryItems.map((item) => (
                <div key={item.id} className="h-64 w-full bg-gray-200 rounded-lg overflow-hidden" style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}>
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = '/logo.jpg'
                    }}
                    style={{
                      height: '256px',
                      width: '100%',
                      maxHeight: '256px',
                      maxWidth: '100%'
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          
          <div className="text-center mt-8">
            {embedded ? (
              <Button variant="ghost" size="md" className="bg-[var(--branch-primary)] hover:opacity-90 text-white px-6 py-2">
                {isSystemAdmin ? (
                  <InlineEditable
                    enabled={effectiveEditMode}
                    value={galleryViewFullButtonText}
                    onSave={(path, value) => handleContentUpdate('gallery.viewFullButtonText', value)}
                    fieldPath="gallery.viewFullButtonText"
                    className="text-white"
                  />
                ) : (
                  galleryViewFullButtonText
                )}
              </Button>
            ) : (
              <Link to={`/branch/${slug}/gallery`}>
                <Button variant="ghost" size="md" className="bg-[var(--branch-primary)] hover:opacity-90 text-white px-6 py-2">
                  {isSystemAdmin ? (
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={galleryViewFullButtonText}
                      onSave={(path, value) => handleContentUpdate('gallery.viewFullButtonText', value)}
                      fieldPath="gallery.viewFullButtonText"
                      className="text-white"
                    />
                  ) : (
                    galleryViewFullButtonText
                  )}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-bold text-center text-[var(--branch-primary)] mb-4" style={{ fontSize: '50px' }}>
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={testimonialsContent.title}
                onSave={(path, value) => handleContentUpdate('testimonials.title', value)}
                fieldPath="testimonials.title"
                className="text-[var(--branch-primary)]"
              />
            ) : (
              testimonialsContent.title
            )}
          </h2>
          <p className="text-center text-gray-600 mb-12">
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={testimonialsContent.subtitle}
                onSave={(path, value) => handleContentUpdate('testimonials.subtitle', value)}
                fieldPath="testimonials.subtitle"
                className="text-gray-600"
              />
            ) : (
              testimonialsContent.subtitle
            )}
          </p>

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
                  <div className="text-6xl text-[var(--branch-primary)] mb-4">"</div>
                  <p className="text-gray-700 mb-6 leading-relaxed">
                    {isSystemAdmin ? (
                      <InlineEditable
                        enabled={effectiveEditMode}
                        value={testimonial.text}
                        onSave={(path, value) => handleContentUpdate(`testimonials.items.${index}.text`, value)}
                        fieldPath={`testimonials.items.${index}.text`}
                        multiline={true}
                        className="text-gray-700"
                      />
                    ) : (
                      testimonial.text
                    )}
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[var(--branch-primary)]">
                        {isSystemAdmin ? (
                          <InlineEditable
                            enabled={effectiveEditMode}
                            value={testimonial.name}
                            onSave={(path, value) => handleContentUpdate(`testimonials.items.${index}.name`, value)}
                            fieldPath={`testimonials.items.${index}.name`}
                            className="text-[var(--branch-primary)]"
                          />
                        ) : (
                          testimonial.name
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {isSystemAdmin ? (
                          <InlineEditable
                            enabled={effectiveEditMode}
                            value={testimonial.branch}
                            onSave={(path, value) => handleContentUpdate(`testimonials.items.${index}.branch`, value)}
                            fieldPath={`testimonials.items.${index}.branch`}
                            className="text-gray-500"
                          />
                        ) : (
                          testimonial.branch
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Visit Branch Section */}
      <section className="py-16 px-6 bg-[var(--branch-cta-bg)] text-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-bold text-center mb-4" style={{ fontSize: '50px' }}>
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={visitBranchContent.title}
                onSave={(path, value) => handleContentUpdate('visitBranch.title', value)}
                fieldPath="visitBranch.title"
                className="text-white"
              />
            ) : (
              visitBranchContent.title
            )}
          </h2>
          <p className="text-center mb-12 opacity-90">
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={visitBranchContent.subtitle}
                onSave={(path, value) => handleContentUpdate('visitBranch.subtitle', value)}
                fieldPath="visitBranch.subtitle"
                className="text-white"
              />
            ) : (
              visitBranchContent.subtitle
            )}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-white text-gray-900 p-6 text-center">
              <CardContent className="p-0">
                <MapPin className="w-8 h-8 text-[var(--branch-primary)] mx-auto mb-4" />
                <h3 className="font-semibold text-[var(--branch-primary)] mb-2">
                  {isSystemAdmin ? (
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={visitBranchContent.locationLabel || 'Location'}
                      onSave={(path, value) => handleContentUpdate('visitBranch.locationLabel', value)}
                      fieldPath="visitBranch.locationLabel"
                      className="text-[var(--branch-primary)]"
                    />
                  ) : (
                    visitBranchContent.locationLabel || 'Location'
                  )}
                </h3>
                <p className="text-sm text-gray-600">
                  {isSystemAdmin ? (
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={visitBranchContent.location}
                      onSave={(path, value) => handleContentUpdate('visitBranch.location', value)}
                      fieldPath="visitBranch.location"
                      className="text-gray-600"
                    />
                  ) : (
                    visitBranchContent.location
                  )}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white text-gray-900 p-6 text-center">
              <CardContent className="p-0">
                <Phone className="w-8 h-8 text-[var(--branch-primary)] mx-auto mb-4" />
                <h3 className="font-semibold text-[var(--branch-primary)] mb-2">
                  {isSystemAdmin ? (
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={visitBranchContent.phoneLabel || 'Contact'}
                      onSave={(path, value) => handleContentUpdate('visitBranch.phoneLabel', value)}
                      fieldPath="visitBranch.phoneLabel"
                      className="text-[var(--branch-primary)]"
                    />
                  ) : (
                    visitBranchContent.phoneLabel || 'Contact'
                  )}
                </h3>
                <p className="text-sm text-gray-600">
                  {isSystemAdmin ? (
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={visitBranchContent.phone}
                      onSave={(path, value) => handleContentUpdate('visitBranch.phone', value)}
                      fieldPath="visitBranch.phone"
                      className="text-gray-600"
                    />
                  ) : (
                    visitBranchContent.phone
                  )}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white text-gray-900 p-6 text-center">
              <CardContent className="p-0">
                <Clock className="w-8 h-8 text-[var(--branch-primary)] mx-auto mb-4" />
                <h3 className="font-semibold text-[var(--branch-primary)] mb-2">
                  {isSystemAdmin ? (
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={visitBranchContent.hoursLabel || 'Hours'}
                      onSave={(path, value) => handleContentUpdate('visitBranch.hoursLabel', value)}
                      fieldPath="visitBranch.hoursLabel"
                      className="text-[var(--branch-primary)]"
                    />
                  ) : (
                    visitBranchContent.hoursLabel || 'Hours'
                  )}
                </h3>
                <p className="text-sm text-gray-600">
                  {isSystemAdmin ? (
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={visitBranchContent.hours}
                      onSave={(path, value) => handleContentUpdate('visitBranch.hours', value)}
                      fieldPath="visitBranch.hours"
                      className="text-gray-600"
                    />
                  ) : (
                    visitBranchContent.hours
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Information Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-bold text-center text-[var(--branch-primary)] mb-4" style={{ fontSize: '50px' }}>
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={contactInfoContent.title}
                onSave={(path, value) => handleContentUpdate('contactInfo.title', value)}
                fieldPath="contactInfo.title"
                className="text-[var(--branch-primary)]"
              />
            ) : (
              contactInfoContent.title
            )}
          </h2>
          <p className="text-center text-gray-600 mb-12">
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={contactInfoContent.subtitle}
                onSave={(path, value) => handleContentUpdate('contactInfo.subtitle', value)}
                fieldPath="contactInfo.subtitle"
                className="text-gray-600"
              />
            ) : (
              contactInfoContent.subtitle
            )}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Contact Details */}
            <Card className="p-8 border-0" style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[var(--branch-primary)] rounded-full flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[var(--branch-primary)] mb-1">
                      {isSystemAdmin ? (
                        <InlineEditable
                          enabled={effectiveEditMode}
                          value={contactInfoContent.addressLabel || 'Address'}
                          onSave={(path, value) => handleContentUpdate('contactInfo.addressLabel', value)}
                          fieldPath="contactInfo.addressLabel"
                          className="text-[var(--branch-primary)]"
                        />
                      ) : (
                        contactInfoContent.addressLabel || 'Address'
                      )}
                    </h3>
                    <p className="text-gray-600">
                      {isSystemAdmin ? (
                        <InlineEditable
                          enabled={effectiveEditMode}
                          value={contactInfoContent.address}
                          onSave={(path, value) => handleContentUpdate('contactInfo.address', value)}
                          fieldPath="contactInfo.address"
                          className="text-gray-600"
                        />
                      ) : (
                        contactInfoContent.address
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[var(--branch-primary)] rounded-full flex items-center justify-center">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[var(--branch-primary)] mb-1">
                      {isSystemAdmin ? (
                        <InlineEditable
                          enabled={effectiveEditMode}
                          value={contactInfoContent.phoneLabel || 'Phone'}
                          onSave={(path, value) => handleContentUpdate('contactInfo.phoneLabel', value)}
                          fieldPath="contactInfo.phoneLabel"
                          className="text-[var(--branch-primary)]"
                        />
                      ) : (
                        contactInfoContent.phoneLabel || 'Phone'
                      )}
                    </h3>
                    <p className="text-gray-600">
                      {isSystemAdmin ? (
                        <InlineEditable
                          enabled={effectiveEditMode}
                          value={contactInfoContent.phone}
                          onSave={(path, value) => handleContentUpdate('contactInfo.phone', value)}
                          fieldPath="contactInfo.phone"
                          className="text-gray-600"
                        />
                      ) : (
                        contactInfoContent.phone
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[var(--branch-primary)] rounded-full flex items-center justify-center">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[var(--branch-primary)] mb-1">
                      {isSystemAdmin ? (
                        <InlineEditable
                          enabled={effectiveEditMode}
                          value={contactInfoContent.hoursLabel || 'Hours'}
                          onSave={(path, value) => handleContentUpdate('contactInfo.hoursLabel', value)}
                          fieldPath="contactInfo.hoursLabel"
                          className="text-[var(--branch-primary)]"
                        />
                      ) : (
                        contactInfoContent.hoursLabel || 'Hours'
                      )}
                    </h3>
                    <p className="text-gray-600">
                      {isSystemAdmin ? (
                        <InlineEditable
                          enabled={effectiveEditMode}
                          value={contactInfoContent.hours}
                          onSave={(path, value) => handleContentUpdate('contactInfo.hours', value)}
                          fieldPath="contactInfo.hours"
                          className="text-gray-600"
                        />
                      ) : (
                        contactInfoContent.hours
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
            
            {/* Call to Action */}
            <Card className="p-8 border-0 bg-[var(--branch-cta-bg)] text-white" style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}>
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-4">
                  {isSystemAdmin ? (
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={bookingCtaContent.title}
                      onSave={(path, value) => handleContentUpdate('contactInfo.bookingCta.title', value)}
                      fieldPath="contactInfo.bookingCta.title"
                      className="text-white"
                    />
                  ) : (
                    bookingCtaContent.title
                  )}
                </h3>
                <p className="text-lg mb-6 opacity-90">
                  {isSystemAdmin ? (
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={bookingCtaContent.subtitle}
                      onSave={(path, value) => handleContentUpdate('contactInfo.bookingCta.subtitle', value)}
                      fieldPath="contactInfo.bookingCta.subtitle"
                      className="text-white"
                      multiline={true}
                    />
                  ) : (
                    bookingCtaContent.subtitle
                  )}
                </p>
                <Button 
                  className="bg-white text-[var(--branch-primary)] hover:bg-gray-100 font-bold text-lg px-8 py-3"
                  onClick={() => window.open(`tel:${contactInfoContent.phone.replace(/\s/g, '')}`)}
                >
                  {isSystemAdmin ? (
                    <>
                      <InlineEditable
                        enabled={effectiveEditMode}
                        value={bookingCtaContent.callButtonPrefix}
                        onSave={(path, value) => handleContentUpdate('contactInfo.bookingCta.callButtonPrefix', value)}
                        fieldPath="contactInfo.bookingCta.callButtonPrefix"
                        className="text-[var(--branch-primary)]"
                      />{' '}
                      {contactInfoContent.phone}
                    </>
                  ) : (
                    `${bookingCtaContent.callButtonPrefix} ${contactInfoContent.phone}`
                  )}
                </Button>
                <p className="text-sm mt-4 opacity-75">
                  {isSystemAdmin ? (
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={bookingCtaContent.footerText}
                      onSave={(path, value) => handleContentUpdate('contactInfo.bookingCta.footerText', value)}
                      fieldPath="contactInfo.bookingCta.footerText"
                      className="text-white"
                    />
                  ) : (
                    bookingCtaContent.footerText
                  )}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <BranchFooter 
        branchName={`${branchName} Branch`}
        branchPhone={contactInfoContent.phone || '—'}
        branchAddress={contactInfoContent.address || '—'}
        branchSlug={slug}
        cmsEditable={isSystemAdmin && effectiveEditMode}
        onContentUpdate={(path, value) => handleContentUpdate(path, value)}
        footerContent={displayContent?.footer}
      />
    </div>
  )
}

