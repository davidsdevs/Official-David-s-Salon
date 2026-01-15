import Button from "../../../components/ui/Button"
import { Card } from "../../../components/ui/Card"
import { CTAButton, SecondaryButton } from "../../../components/ui/ConsistentButton"
import { Filter } from "lucide-react"
import { useParams, Link, useNavigate } from "react-router-dom"
import BranchNavigation from "../../../components/landing/BranchNavigation"
import BranchFooter from "../../../components/landing/BranchFooter"
import { useState, useEffect } from "react"
import { getUsersByRole } from "../../../services/userService"
import { getAllBranches } from "../../../services/branchService"
import { USER_ROLES } from "../../../utils/constants"
import { getFullName } from "../../../utils/helpers"
import { marketingContentService } from "../../../services/marketingContentService"
import { useAuth } from "../../../context/AuthContext"
import InlineEditable from "../../../components/cms/InlineEditable"
import FloatingSaveButton from "../../../components/cms/FloatingSaveButton"
import InlineColorPicker from "../../../components/cms/InlineColorPicker"
import { useRef } from "react"

export default function BranchStylistsPage({ embedded = false, cmsEditMode, cmsBranchId = null, cmsBranchName = '', cmsBranchSlug = '' }) {
  const { userData, userRoles } = useAuth()
  const params = useParams()
  const slug = cmsBranchSlug || params.slug
  const navigate = useNavigate()

  const slugify = (value) => {
    if (!value) return ''
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  }

  const computedBranchName = slug
    ? slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : ''

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
  const stylistsPerPage = 3

  const [branches, setBranches] = useState([])
  const [selectedBranchId, setSelectedBranchId] = useState(null)
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [stylists, setStylists] = useState([])
  const [loadingStylists, setLoadingStylists] = useState(true)
  const [brokenImageById, setBrokenImageById] = useState({})

  const branchName = cmsBranchName || (selectedBranch?.__name || computedBranchName)

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

  useEffect(() => {
    hasChangesRef.current = hasChanges
  }, [hasChanges])

  useEffect(() => {
    localContentRef.current = localContent
  }, [localContent])

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const branchesData = await getAllBranches()
        const normalized = (Array.isArray(branchesData) ? branchesData : []).map((b) => {
          const name = b?.branchName || b?.name || 'Branch'
          const resolvedSlug = b?.slug || slugify(name)
          return { ...b, id: b.id, __name: name, __slug: resolvedSlug }
        })
        setBranches(normalized)
      } catch (e) {
        console.error('Error loading branches:', e)
      }
    }

    loadBranches()
  }, [])

  useEffect(() => {
    if (!slug || branches.length === 0) return

    const slugNormalized = slugify(slug)
    const slugAlt = slugNormalized.endsWith('-branch')
      ? slugNormalized.replace(/-branch$/, '')
      : `${slugNormalized}-branch`

    const match = branches.find((b) => {
      const candidates = [slugify(b?.slug), slugify(b?.__slug), slugify(b?.__name), slugify(b?.name), slugify(b?.branchName)]
        .filter(Boolean)
      return candidates.includes(slugNormalized) || candidates.includes(slugAlt)
    })

    if (match) {
      setSelectedBranchId(match.id)
      setSelectedBranch(match)
      return
    }

    setSelectedBranchId(null)
    setSelectedBranch(null)
  }, [slug, branches])

  const marketingContentId = cmsBranchId
    ? `branch_${cmsBranchId}`
    : selectedBranchId
      ? `branch_${selectedBranchId}`
      : slug
        ? `branch_${slug}`
        : null

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
    setBrokenImageById({})
  }, [selectedBranchId])

  useEffect(() => {
    if (content && !localContent) {
      setLocalContent(content)
    }
  }, [content, localContent])

  useEffect(() => {
    const loadStylists = async () => {
      try {
        setLoadingStylists(true)
        const stylistsData = await getUsersByRole(USER_ROLES.STYLIST)
        const branchStylists = selectedBranchId
          ? stylistsData.filter((s) => s.branchId === selectedBranchId)
          : []

        const mapped = branchStylists.map((s) => {
          const fullName = getFullName(s)
          const specialty = s.specialty || s.primarySpecialty || 'Stylist'
          const years = s.yearsExperience || s.experienceYears || s.experience
          const experienceText =
            typeof years === 'number'
              ? `${years} years experience`
              : (typeof years === 'string' ? years : '')

          return {
            id: s.id,
            name: fullName,
            specialty,
            experience: experienceText,
            rating: typeof s.rating === 'number' ? s.rating : 0,
            reviews: typeof s.reviews === 'number' ? s.reviews : (typeof s.reviewCount === 'number' ? s.reviewCount : 0),
            specialties: Array.isArray(s.specialties) ? s.specialties : [specialty],
            description: s.bio || s.description || '',
            image:
              s.imageURL ||
              s.imageUrl ||
              s.photoURL ||
              s.photoUrl ||
              s.avatarUrl ||
              s.profileImageUrl ||
              ''
          }
        })

        setStylists(mapped)
      } catch (e) {
        console.error('Error loading stylists:', e)
        setStylists([])
      } finally {
        setLoadingStylists(false)
      }
    }

    loadStylists()
  }, [selectedBranchId])

  const displayContent = hasChanges ? localContent : content
  const stylistsPage = displayContent?.stylistsPage || {}
  const headerContent = stylistsPage.header || {}
  const filtersContent = stylistsPage.filters || {}
  const emptyStateContent = stylistsPage.emptyState || {}
  const buttonsContent = stylistsPage.buttons || {}
  const ctaContent = stylistsPage.cta || {}

  const theme = displayContent?.theme || {}
  const primaryColor = theme.primaryColor || '#160B53'
  const ctaBackgroundColor = theme.ctaBackgroundColor || primaryColor

  const headerTitle = headerContent.title || 'Stylists'
  const headerSubtitle = headerContent.subtitle || 'Meet our team of expert stylists ready to transform your look'
  const allLabel = filtersContent.allLabel || 'All'
  const emptyTitle = emptyStateContent.title || 'No stylists found'
  const emptySubtitle = emptyStateContent.subtitle || 'Try selecting a different category'
  const viewProfileText = buttonsContent.viewProfileText || 'View Profile'
  const ctaTitle = ctaContent.title || 'Ready to Book with Our Experts?'
  const ctaSubtitle = ctaContent.subtitle || 'Choose your preferred stylist and schedule your appointment today'
  const ctaPrimaryButtonText = ctaContent.primaryButtonText || 'Book Appointment'
  const ctaSecondaryButtonText = ctaContent.secondaryButtonText || 'Call Us Now'

  useEffect(() => {
    setSelectedCategory(allLabel)
    setCurrentPage(1)
  }, [allLabel, selectedBranchId])

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
      const branchIdToSave = cmsBranchId || selectedBranchId || null
      const result = await marketingContentService.updateContent(marketingContentId, 'branch', {
        ...payload,
        branchId: branchIdToSave,
        slug,
        updatedBy: userData.uid
      })
      if (result?.success) {
        setContent(contentToSave)
        if (editRevisionRef.current === saveRevision) {
          setHasChanges(false)
        }
      }
    } catch (e) {
      console.error('Error saving stylist page content:', e)
    } finally {
      setSaving(false)
    }
  }

  const categories = [
    allLabel,
    ...Array.from(new Set(stylists.map((s) => s.specialty).filter(Boolean)))
  ]

  const filteredStylists = stylists.filter(stylist => {
    return selectedCategory === allLabel || stylist.specialty === selectedCategory
  })

  // Pagination logic
  const totalPages = Math.ceil(filteredStylists.length / stylistsPerPage)
  const startIndex = (currentPage - 1) * stylistsPerPage
  const endIndex = startIndex + stylistsPerPage
  const currentStylists = filteredStylists.slice(startIndex, endIndex)

  const isImageBroken = (id) => brokenImageById?.[id] === true

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div
      onClickCapture={handleEmbeddedClickCapture}
      style={{ '--branch-primary': primaryColor, '--branch-cta-bg': ctaBackgroundColor }}
    >
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
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={headerTitle}
                onSave={handleContentUpdate}
                fieldPath="stylistsPage.header.title"
                className="text-[var(--branch-primary)]"
              />
            ) : (
              headerTitle
            )}
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={headerSubtitle}
                onSave={handleContentUpdate}
                fieldPath="stylistsPage.header.subtitle"
                className="text-gray-600"
                multiline={true}
              />
            ) : (
              headerSubtitle
            )}
          </p>

          {/* Branch Selector */}
          {!embedded && branches.length > 0 && (
            <div className="flex justify-center mb-6">
              <select
                value={selectedBranchId || ''}
                onChange={(e) => {
                  const nextId = e.target.value
                  const nextBranch = branches.find((b) => b.id === nextId)
                  if (!nextBranch) return
                  setSelectedBranchId(nextId)
                  setSelectedBranch(nextBranch)
                  navigate(`/branch/${nextBranch.__slug}/stylists`)
                }}
                className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 font-poppins"
              >
                <option value="" disabled>Select branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.__name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category)
                  setCurrentPage(1) // Reset to first page when filtering
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-poppins font-medium transition-all duration-300 ${
                  selectedCategory === category
                    ? 'bg-[var(--branch-primary)] text-white scale-105'
                    : 'bg-white text-gray-600 hover:bg-gray-100 hover:scale-105 border border-gray-200'
                }`}
              >
                {category === allLabel && <Filter className="w-4 h-4" />}
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Stylists Grid */}
      <section className="py-8 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          {loadingStylists && (
            <div className="text-center py-16">
              <h3 className="text-xl font-poppins font-semibold text-gray-600 mb-2">Loading stylists...</h3>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {currentStylists.map((stylist, index) => (
              <Card 
                key={stylist.id}
                className="overflow-hidden border-0 p-0"
                style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}
              >
                {/* Stylist Image */}
                <div className="relative h-64 bg-gray-100 overflow-hidden">
                  {stylist.image && !isImageBroken(stylist.id) ? (
                    <img
                      src={stylist.image}
                      alt={stylist.name}
                      className="w-full h-full object-cover"
                      onError={() => {
                        setBrokenImageById((prev) => ({
                          ...(prev || {}),
                          [stylist.id]: true
                        }))
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-poppins">
                      No Photo
                    </div>
                  )}
                  {/* Specialty Tags */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                    {stylist.specialties.map((specialty, idx) => (
                      <span 
                        key={idx}
                        className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-poppins font-medium text-gray-700"
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-poppins font-bold mb-1 text-gray-900">
                    {stylist.name}
                  </h3>
                  
                  <p className="text-[var(--branch-primary)] font-poppins font-medium text-sm mb-1">{stylist.specialty}</p>
                  <p className="text-gray-500 text-sm mb-3">{stylist.experience}</p>
                  
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{stylist.description}</p>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2">
                    <Link to={`/branch/${slug}/stylists/${stylist.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        {isSystemAdmin ? (
                          <InlineEditable
                            enabled={effectiveEditMode}
                            value={viewProfileText}
                            onSave={handleContentUpdate}
                            fieldPath="stylistsPage.buttons.viewProfileText"
                            className="text-gray-700"
                          />
                        ) : (
                          viewProfileText
                        )}
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Empty State */}
          {currentStylists.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">✂️</div>
              <h3 className="text-xl font-poppins font-semibold text-gray-600 mb-2">
                {isSystemAdmin ? (
                  <InlineEditable
                    enabled={effectiveEditMode}
                    value={emptyTitle}
                    onSave={handleContentUpdate}
                    fieldPath="stylistsPage.emptyState.title"
                    className="text-gray-600"
                  />
                ) : (
                  emptyTitle
                )}
              </h3>
              <p className="text-gray-500">
                {isSystemAdmin ? (
                  <InlineEditable
                    enabled={effectiveEditMode}
                    value={emptySubtitle}
                    onSave={handleContentUpdate}
                    fieldPath="stylistsPage.emptyState.subtitle"
                    className="text-gray-500"
                    multiline={true}
                  />
                ) : (
                  emptySubtitle
                )}
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8 space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-8 h-8 p-0 bg-transparent text-gray-700 border-gray-300 hover:bg-gray-50 transition-all duration-300 hover:scale-110"
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
                    className={`w-8 h-8 p-0 transition-all duration-300 hover:scale-110 ${
                      currentPage === page
                        ? 'bg-[var(--branch-primary)] text-white border-[var(--branch-primary)]'
                        : 'bg-transparent text-gray-700 border-gray-300 hover:bg-gray-50'
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
                className="w-8 h-8 p-0 bg-transparent text-gray-700 border-gray-300 hover:bg-gray-50 transition-all duration-300 hover:scale-110"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                {">"}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-16 px-6 bg-[var(--branch-cta-bg)] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-poppins font-bold mb-4" style={{ fontSize: '50px' }}>
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={ctaTitle}
                onSave={handleContentUpdate}
                fieldPath="stylistsPage.cta.title"
                className="text-white"
              />
            ) : (
              ctaTitle
            )}
          </h2>
          <p className="text-xl mb-8 opacity-90">
            {isSystemAdmin ? (
              <InlineEditable
                enabled={effectiveEditMode}
                value={ctaSubtitle}
                onSave={handleContentUpdate}
                fieldPath="stylistsPage.cta.subtitle"
                className="text-white"
                multiline={true}
              />
            ) : (
              ctaSubtitle
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <CTAButton className="bg-white text-[var(--branch-primary)] hover:bg-gray-100">
              {isSystemAdmin ? (
                <InlineEditable
                  enabled={effectiveEditMode}
                  value={ctaPrimaryButtonText}
                  onSave={handleContentUpdate}
                  fieldPath="stylistsPage.cta.primaryButtonText"
                  className="text-[var(--branch-primary)]"
                />
              ) : (
                ctaPrimaryButtonText
              )}
            </CTAButton>
            <SecondaryButton className="border-white text-white hover:bg-white hover:text-[var(--branch-primary)]">
              {isSystemAdmin ? (
                <InlineEditable
                  enabled={effectiveEditMode}
                  value={ctaSecondaryButtonText}
                  onSave={handleContentUpdate}
                  fieldPath="stylistsPage.cta.secondaryButtonText"
                  className="text-white"
                />
              ) : (
                ctaSecondaryButtonText
              )}
            </SecondaryButton>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <BranchFooter 
        branchName={`${branchName} Branch`}
        branchPhone={selectedBranch?.contact || '+63 930 222 9659'}
        branchAddress={selectedBranch?.address || `${branchName}, Philippines`}
        branchSlug={slug}
        cmsEditable={isSystemAdmin && effectiveEditMode}
        onContentUpdate={(path, value) => handleContentUpdate(path, value)}
        footerContent={displayContent?.footer}
      />
    </div>
  )
}

