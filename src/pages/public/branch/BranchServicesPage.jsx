import Button from "../../../components/ui/Button"
import { Card } from "../../../components/ui/Card"
import { CTAButton, SecondaryButton } from "../../../components/ui/ConsistentButton"
import { Clock, Banknote, Filter } from "lucide-react"
import { useParams, Link } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../../config/firebase'
import { getBranchServices } from '../../../services/branchServicesService'
import BranchNavigation from "../../../components/landing/BranchNavigation"
import BranchFooter from "../../../components/landing/BranchFooter"
import { marketingContentService } from "../../../services/marketingContentService"
import { useAuth } from "../../../context/AuthContext"
import { USER_ROLES } from "../../../utils/constants"
import InlineEditable from "../../../components/cms/InlineEditable"
import FloatingSaveButton from "../../../components/cms/FloatingSaveButton"
import InlineColorPicker from "../../../components/cms/InlineColorPicker"

const slugify = (value) => {
  if (!value) return ''
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function BranchServicesPage({ embedded = false, cmsEditMode, cmsBranchId = null, cmsBranchName = '', cmsBranchSlug = '', onSelectService }) {
  const { userData, userRoles } = useAuth()
  const params = useParams()
  const slug = cmsBranchSlug || params.slug
  const computedBranchName = slug ? slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : ''
  const branchName = cmsBranchName || computedBranchName

  const effectiveEditMode = typeof cmsEditMode === 'boolean' ? cmsEditMode : true
  const isSystemAdmin =
    userRoles?.includes(USER_ROLES.SYSTEM_ADMIN) ||
    userRoles?.includes('system_admin') ||
    userData?.role === USER_ROLES.SYSTEM_ADMIN ||
    userData?.role === 'system_admin'

  const blockInteractions = embedded && isSystemAdmin
  
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [isVisible, setIsVisible] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const servicesPerPage = 6

  const [content, setContent] = useState(null)
  const [localContent, setLocalContent] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)

  const hasChangesRef = useRef(false)
  const localContentRef = useRef(null)
  const editRevisionRef = useRef(0)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  // state for dynamic services (loaded from Firestore / branchServicesService)
  const [branchId, setBranchId] = useState(cmsBranchId)
  const [services, setServices] = useState([])
  const [loadingServices, setLoadingServices] = useState(true)

  // Find branchId by slug
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
      } catch (err) {
        console.error('Error finding branch by slug:', err)
        setBranchId(null)
      }
    }

    if (slug) {
      findBranch()
    }
  }, [slug, cmsBranchId])

  const marketingContentId = cmsBranchId
    ? `branch_${cmsBranchId}`
    : branchId
      ? `branch_${branchId}`
      : slug
        ? `branch_${slug}`
        : null

  useEffect(() => {
    setSelectedCategory('All')
    setCurrentPage(1)
  }, [branchId])

  useEffect(() => {
    hasChangesRef.current = hasChanges
  }, [hasChanges])

  useEffect(() => {
    localContentRef.current = localContent
  }, [localContent])

  useEffect(() => {
    editRevisionRef.current = 0
    setHasChanges(false)
    setLocalContent(null)
    setContent(null)
  }, [marketingContentId])

  useEffect(() => {
    if (!marketingContentId) return

    const unsubscribe = marketingContentService.subscribeToContent(marketingContentId, 'branch', (result) => {
      if (result.success && result.content) {
        setContent(result.content)
        if (!hasChangesRef.current) {
          setLocalContent(result.content)
        }
      }
    })

    return () => unsubscribe()
  }, [marketingContentId])

  useEffect(() => {
    if (content && !localContent) {
      setLocalContent(content)
    }
  }, [content, localContent])

  // Load services for the selected branch
  useEffect(() => {
    if (!branchId) return

    const loadServices = async () => {
      setLoadingServices(true)
      try {
        const results = await getBranchServices(branchId)
        setServices(results)
      } catch (err) {
        console.error('Failed to load branch services:', err)
        setServices([])
      } finally {
        setLoadingServices(false)
      }
    }

    loadServices()
  }, [branchId])

  const displayContent = hasChanges ? localContent : content
  const servicesPage = displayContent?.servicesPage || {}
  const headerContent = servicesPage.header || {}
  const ctaContent = servicesPage.cta || {}
  const buttonsContent = servicesPage.buttons || {}

  const theme = displayContent?.theme || {}
  const primaryColor = theme.primaryColor || '#160B53'
  const ctaBackgroundColor = theme.ctaBackgroundColor || primaryColor

  const viewServiceDetailsButtonText =
    buttonsContent.viewServiceDetailsButtonText || 'View Service Details'
  const bookThisServiceButtonText =
    buttonsContent.bookThisServiceButtonText || 'Book This Service'
  const paginationPreviousButtonText =
    buttonsContent.paginationPreviousButtonText || 'Previous'
  const paginationNextButtonText =
    buttonsContent.paginationNextButtonText || 'Next'

  const handleEmbeddedClickCapture = (e) => {
    if (!blockInteractions) return
    const target = e?.target
    if (!target || typeof target.closest !== 'function') return
    const allowInteraction = target.closest('[data-cms-allow-interaction="true"]')

    if (allowInteraction) return

    e.preventDefault()
    e.stopPropagation()
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
    if (!marketingContentId || !contentToSave || !userData?.uid) return
    try {
      const saveRevision = editRevisionRef.current
      setSaving(true)
      const { id, ...payload } = contentToSave
      const result = await marketingContentService.updateContent(marketingContentId, 'branch', {
        ...payload,
        branchId,
        slug,
        updatedBy: userData.uid
      })
      if (result.success) {
        setContent(contentToSave)
        if (editRevisionRef.current === saveRevision) {
          setHasChanges(false)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  // derive categories from services but keep sensible defaults
  const categories = [
    'All',
    ...Array.from(new Set(services.map(s => s.category || s.serviceType || 'Uncategorized').filter(Boolean)))
  ]

  const filteredServices = services.filter(service => {
    // If still loading or service entry doesn't have expected fields use safe values
    const category = service.category || service.serviceType || 'Uncategorized'
    return selectedCategory === 'All' || category === selectedCategory
  })

  // Pagination logic
  const totalPages = Math.ceil(filteredServices.length / servicesPerPage)
  const startIndex = (currentPage - 1) * servicesPerPage
  const endIndex = startIndex + servicesPerPage
  const currentServices = filteredServices.slice(startIndex, endIndex)

  // Reset to first page when category changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory])

  return (
    <div
      onClickCapture={handleEmbeddedClickCapture}
      style={{ '--branch-primary': primaryColor, '--branch-cta-bg': ctaBackgroundColor }}
    >
      {/* Branch Navigation */}
      {!embedded && <BranchNavigation branchName={`${branchName} Branch`} />}

      {isSystemAdmin && effectiveEditMode && (
        <div
          className="fixed top-4 left-4 z-50 bg-white/95 text-gray-900 rounded-lg border border-gray-200 shadow p-3 space-y-2"
          data-cms-allow-interaction="true"
        >
          <div className="text-xs font-semibold text-gray-700">Theme</div>
          <InlineColorPicker
            label="Primary"
            value={primaryColor}
            onChange={(value) => handleContentUpdate('theme.primaryColor', value)}
          />
          <InlineColorPicker
            label="CTA"
            value={ctaBackgroundColor}
            onChange={(value) => handleContentUpdate('theme.ctaBackgroundColor', value)}
          />
        </div>
      )}
      
      {/* Header Section */}
      <section className={`py-12 px-6 bg-gray-50 ${embedded ? '' : 'mt-[122px]'}`}>
        <div className={`max-w-6xl mx-auto text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h1 className="text-5xl font-poppins font-bold text-[var(--branch-primary)] mb-4">
            <InlineEditable
              value={headerContent.title || 'Services'}
              onSave={handleContentUpdate}
              fieldPath="servicesPage.header.title"
              enabled={isSystemAdmin && effectiveEditMode}
              className="text-5xl font-poppins font-bold"
            />
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            <InlineEditable
              value={headerContent.subtitle || 'Professional hair and beauty services tailored to your needs'}
              onSave={handleContentUpdate}
              fieldPath="servicesPage.header.subtitle"
              enabled={isSystemAdmin && effectiveEditMode}
              className="text-xl"
              multiline
            />
          </p>
          
          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((category) => (
              <button
                key={category}
                onClick={blockInteractions ? undefined : () => setSelectedCategory(category)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-poppins font-medium transition-all duration-300 ${
                  selectedCategory === category
                    ? 'bg-[var(--branch-primary)] text-white scale-105'
                    : 'bg-white text-gray-600 hover:bg-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                {category === "All" && <Filter className="w-4 h-4" />}
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-8 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loadingServices ? (
              <div className="col-span-full text-center py-16">
                <div className="text-2xl text-gray-500">Loading services…</div>
              </div>
            ) : (
              currentServices.map((service, index) => (
              <Card 
                key={service.id}
                className="overflow-hidden border-0 p-0"
                style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}
              >
                {/* Service Image */}
                <div className="relative h-48 bg-gray-100 overflow-hidden">
                  <img
                    src={service.imageURL || service.image || service.media?.[0]?.url || '/logo.jpg'}
                    alt={service.name || service.serviceName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src = '/logo.jpg'
                    }}
                  />
                  {/* Service Tag */}
                    {(service.tag || service.tagLabel) && (
                    <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-poppins font-medium ${service.tagColor}`}>
                      {service.tag || service.tagLabel}
                    </div>
                  )}
                  {/* Category Badge */}
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-poppins font-medium text-gray-700">
                    {service.category || service.serviceType || 'Uncategorized'}
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-poppins font-bold mb-2 text-gray-900">
                    {service.name || service.serviceName}
                  </h3>
                  
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{service.description || service.shortDescription || ''}</p>
                  
                  {/* Service Details */}
                  <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>
                        {service.duration == null ? '—' : (typeof service.duration === 'number' ? `${service.duration} mins` : service.duration)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Banknote className="w-4 h-4" />
                      <span className="font-poppins font-semibold text-[var(--branch-primary)]">{service.price ?? service.branchPricing?.[branchId] ?? '—'}</span>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2">
                    {embedded && typeof onSelectService === 'function' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                        onClick={blockInteractions ? undefined : () => onSelectService(service.id)}
                      >
                        <InlineEditable
                          value={viewServiceDetailsButtonText}
                          onSave={handleContentUpdate}
                          fieldPath="servicesPage.buttons.viewServiceDetailsButtonText"
                          enabled={isSystemAdmin && effectiveEditMode}
                          className="font-poppins"
                        />
                      </Button>
                    ) : (
                      <Link to={`/branch/${slug}/services/${service.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          <InlineEditable
                            value={viewServiceDetailsButtonText}
                            onSave={handleContentUpdate}
                            fieldPath="servicesPage.buttons.viewServiceDetailsButtonText"
                            enabled={isSystemAdmin && effectiveEditMode}
                            className="font-poppins"
                          />
                        </Button>
                      </Link>
                    )}
                    <Button
                      size="sm"
                      className="w-full bg-[var(--branch-primary)] hover:opacity-90 text-white"
                    >
                      <InlineEditable
                        value={bookThisServiceButtonText}
                        onSave={handleContentUpdate}
                        fieldPath="servicesPage.buttons.bookThisServiceButtonText"
                        enabled={isSystemAdmin && effectiveEditMode}
                        className="text-white font-poppins"
                      />
                    </Button>
                  </div>
                </div>
              </Card>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center mt-12 space-x-2">
              <Button
                onClick={blockInteractions ? undefined : () => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                variant="outline"
                className="px-4 py-2"
              >
                <InlineEditable
                  value={paginationPreviousButtonText}
                  onSave={handleContentUpdate}
                  fieldPath="servicesPage.buttons.paginationPreviousButtonText"
                  enabled={isSystemAdmin && effectiveEditMode}
                  className="font-poppins"
                />
              </Button>
              
              <div className="flex space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    onClick={blockInteractions ? undefined : () => setCurrentPage(page)}
                    variant={currentPage === page ? "default" : "outline"}
                    className={`px-3 py-2 ${
                      currentPage === page 
                        ? 'bg-[var(--branch-primary)] text-white hover:opacity-90' 
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </Button>
                ))}
              </div>
              
              <Button
                onClick={blockInteractions ? undefined : () => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                variant="outline"
                className="px-4 py-2"
              >
                <InlineEditable
                  value={paginationNextButtonText}
                  onSave={handleContentUpdate}
                  fieldPath="servicesPage.buttons.paginationNextButtonText"
                  enabled={isSystemAdmin && effectiveEditMode}
                  className="font-poppins"
                />
              </Button>
            </div>
          )}

          {/* Empty State */}
          {filteredServices.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">💇‍♀️</div>
              <h3 className="text-xl font-poppins font-semibold text-gray-600 mb-2">No services found</h3>
              <p className="text-gray-500">Try selecting a different category</p>
            </div>
          )}
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-16 px-6 bg-[var(--branch-cta-bg)] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-poppins font-bold mb-4" style={{ fontSize: '50px' }}>
            <InlineEditable
              value={ctaContent.title || 'Ready to Transform Your Look?'}
              onSave={handleContentUpdate}
              fieldPath="servicesPage.cta.title"
              enabled={isSystemAdmin && effectiveEditMode}
              className="font-poppins font-bold"
            />
          </h2>
          <p className="text-xl mb-8 opacity-90">
            <InlineEditable
              value={ctaContent.subtitle || 'Book your appointment today and experience our professional services'}
              onSave={handleContentUpdate}
              fieldPath="servicesPage.cta.subtitle"
              enabled={isSystemAdmin && effectiveEditMode}
              className="text-xl"
              multiline
            />
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <CTAButton className="bg-white text-[var(--branch-primary)] hover:bg-gray-100">
              <InlineEditable
                value={ctaContent.primaryButtonText || 'Book Appointment'}
                onSave={handleContentUpdate}
                fieldPath="servicesPage.cta.primaryButtonText"
                enabled={isSystemAdmin && effectiveEditMode}
                className="text-[var(--branch-primary)] font-poppins"
              />
            </CTAButton>
            <SecondaryButton className="border-white text-white hover:bg-white hover:text-[var(--branch-primary)]">
              <InlineEditable
                value={ctaContent.secondaryButtonText || 'Call Us Now'}
                onSave={handleContentUpdate}
                fieldPath="servicesPage.cta.secondaryButtonText"
                enabled={isSystemAdmin && effectiveEditMode}
                className="text-white font-poppins"
              />
            </SecondaryButton>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      {!embedded && (
        <BranchFooter 
          branchName={`${branchName} Branch`}
          branchPhone="+63 930 222 9659"
          branchAddress={`${branchName}, Philippines`}
          branchSlug={slug}
        />
      )}

      {isSystemAdmin && effectiveEditMode && hasChanges && (
        <FloatingSaveButton onSave={handleSave} saving={saving} hasChanges={hasChanges} />
      )}
    </div>
  )
}

