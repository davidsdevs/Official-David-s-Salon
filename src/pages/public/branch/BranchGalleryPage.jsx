import Button from "../../../components/ui/Button"
import { Card } from "../../../components/ui/Card"
import { Filter, X, Calendar, User, Tag } from "lucide-react"
import { useParams } from "react-router-dom"
import BranchNavigation from "../../../components/landing/BranchNavigation"
import BranchFooter from "../../../components/landing/BranchFooter"
import { useState, useEffect, useRef } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "../../../config/firebase"
import { USER_ROLES } from "../../../utils/constants"
import { marketingContentService } from "../../../services/marketingContentService"
import { useAuth } from "../../../context/AuthContext"
import InlineEditable from "../../../components/cms/InlineEditable"
import FloatingSaveButton from "../../../components/cms/FloatingSaveButton"
import InlineColorPicker from "../../../components/cms/InlineColorPicker"

export default function BranchGalleryPage({
  embedded = false,
  cmsEditMode,
  cmsBranchId = null,
  cmsBranchName = '',
  cmsBranchSlug = ''
}) {
  const { userData, userRoles } = useAuth()
  const params = useParams()
  const slug = cmsBranchSlug || params.slug
  const branchName = (cmsBranchName || slug || '')
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase())

  const effectiveEditMode = typeof cmsEditMode === 'boolean' ? cmsEditMode : true
  const isSystemAdmin =
    userRoles?.includes(USER_ROLES.SYSTEM_ADMIN) ||
    userRoles?.includes('system_admin') ||
    userData?.role === USER_ROLES.SYSTEM_ADMIN ||
    userData?.role === 'system_admin'

  const blockInteractions = embedded && isSystemAdmin
  
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [isVisible, setIsVisible] = useState(false)
  const [hoveredImage, setHoveredImage] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedImage, setSelectedImage] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [galleryItems, setGalleryItems] = useState([])
  const [loadingGallery, setLoadingGallery] = useState(false)
  const imagesPerPage = 8

  const [resolvedBranchId, setResolvedBranchId] = useState(null)

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

  const handleEmbeddedClickCapture = (e) => {
    if (!blockInteractions) return
    const target = e?.target
    if (!target || typeof target.closest !== 'function') return
    const allowInteraction = target.closest('[data-cms-allow-interaction="true"]')
    if (allowInteraction) return

    const tag = target.tagName ? target.tagName.toLowerCase() : ''
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'option') return
    if (target.isContentEditable) return

    e.preventDefault()
    e.stopPropagation()
  }

  const handleEmbeddedSubmitCapture = (e) => {
    if (!blockInteractions) return
    const target = e?.target
    if (!target || typeof target.closest !== 'function') return
    const allowInteraction = target.closest('[data-cms-allow-interaction="true"]')
    if (allowInteraction) return

    e.preventDefault()
    e.stopPropagation()
  }

  const slugify = (value) => {
    if (!value) return ''
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  }

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

  const stylistFullName = (u) => {
    const first = u?.firstName || ''
    const last = u?.lastName || ''
    const joined = `${first} ${last}`.trim()
    return joined || u?.displayName || u?.name || u?.email || 'Stylist'
  }

  const marketingContentId = cmsBranchId ? `branch_${cmsBranchId}` : resolvedBranchId ? `branch_${resolvedBranchId}` : null

  useEffect(() => {
    if (!marketingContentId) return

    editRevisionRef.current = 0
    setHasChanges(false)
    setLocalContent(null)
    setContent(null)

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
        branchId: cmsBranchId || resolvedBranchId || null,
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
      console.error('Error saving gallery page content:', e)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    const loadGallery = async () => {
      if (!slug && !cmsBranchId) {
        setGalleryItems([])
        return
      }

      try {
        setLoadingGallery(true)

        if (cmsBranchId) {
          setResolvedBranchId(cmsBranchId)
        }

        const branchesRef = collection(db, 'branches')
        let resolvedBranchId = null

        if (cmsBranchId) {
          resolvedBranchId = cmsBranchId
        }

        const slugQuery = query(branchesRef, where('slug', '==', slug))
        const slugSnapshot = await getDocs(slugQuery)
        if (!resolvedBranchId && !slugSnapshot.empty) {
          resolvedBranchId = slugSnapshot.docs[0].id
        } else if (!resolvedBranchId) {
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
            resolvedBranchId = match.id
          }
        }

        if (!resolvedBranchId) {
          if (cancelled) return
          setGalleryItems([])
          return
        }

        setResolvedBranchId(resolvedBranchId)

        const usersRef = collection(db, 'users')
        const usersSnapshot = await getDocs(query(usersRef, where('branchId', '==', resolvedBranchId)))
        if (cancelled) return

        const stylists = usersSnapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() || {}) }))
          .filter((u) => u?.isActive !== false)
          .filter(isStylistUser)

        const stylistNameById = new Map()
        stylists.forEach((s) => {
          stylistNameById.set(s.id, stylistFullName(s))
        })

        const stylistIds = stylists.map((s) => s.id).filter(Boolean)
        if (stylistIds.length === 0) {
          if (cancelled) return
          setGalleryItems([])
          return
        }

        const items = []
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
              const imageUrl = p.thumbnailUrl || p.imageUrl
              if (!imageUrl) return

              const createdAtSeconds =
                p?.createdAt?.seconds ??
                (typeof p?.createdAt === 'number' ? p.createdAt : null)

              items.push({
                id: p.id,
                category: p.category || 'Work',
                title: p.title || 'Work',
                description: p.description || '',
                stylist: stylistNameById.get(p.stylistId) || 'Stylist',
                image: imageUrl,
                tag: p.category || 'Work',
                createdAtSeconds
              })
            })
        }

        items.sort((a, b) => {
          const aTime = a.createdAtSeconds ?? 0
          const bTime = b.createdAtSeconds ?? 0
          return bTime - aTime
        })

        if (cancelled) return
        setGalleryItems(items)
        setCurrentPage(1)
      } catch (e) {
        if (cancelled) return
        setGalleryItems([])
      } finally {
        if (cancelled) return
        setLoadingGallery(false)
      }
    }

    loadGallery()

    return () => {
      cancelled = true
    }
  }, [slug, cmsBranchId])

  const displayContent = hasChanges ? localContent : content
  const theme = displayContent?.theme || {}
  const primaryColor = theme.primaryColor || '#160B53'

  const stylistPortfolioPage = displayContent?.stylistPortfolioPage || {}
  const headerContent = stylistPortfolioPage.header || {}
  const filtersContent = stylistPortfolioPage.filters || {}
  const emptyStateContent = stylistPortfolioPage.emptyState || {}

  const headerTitle = headerContent.title || 'Gallery'
  const headerSubtitle = headerContent.subtitle || 'Meet our team of expert stylists ready to transform your look'
  const allLabel = filtersContent.allLabel || 'All'
  const emptyTitle = emptyStateContent.title || 'No images found'
  const emptySubtitle = emptyStateContent.subtitle || 'Try selecting a different category'

  useEffect(() => {
    setSelectedCategory(allLabel)
    setCurrentPage(1)
  }, [allLabel, resolvedBranchId])

  const categories = [
    allLabel,
    ...Array.from(new Set(galleryItems.map((i) => i.category).filter(Boolean)))
  ]

  const filteredImages = galleryItems.filter(image => {
    if (selectedCategory === allLabel) return true
    return image.category === selectedCategory
  })

  // Pagination logic
  const totalPages = Math.ceil(filteredImages.length / imagesPerPage)
  const startIndex = (currentPage - 1) * imagesPerPage
  const endIndex = startIndex + imagesPerPage
  const currentImages = filteredImages.slice(startIndex, endIndex)

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCategoryChange = (category) => {
    setSelectedCategory(category)
    setCurrentPage(1) // Reset to first page when filtering
  }

  const handleImageClick = (image) => {
    setSelectedImage(image)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedImage(null)
  }

  return (
    <div
      onClickCapture={handleEmbeddedClickCapture}
      onSubmitCapture={handleEmbeddedSubmitCapture}
      style={{ '--branch-primary': primaryColor }}
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
                fieldPath="stylistPortfolioPage.header.title"
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
                fieldPath="stylistPortfolioPage.header.subtitle"
                className="text-gray-600"
                multiline={true}
              />
            ) : (
              headerSubtitle
            )}
          </p>
          
          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryChange(category)}
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

      {/* Gallery Grid */}
      <section className="py-8 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          {loadingGallery ? (
            <div className="text-center py-16 text-gray-500">Loading gallery…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {currentImages.map((image, index) => (
                <Card 
                  key={image.id}
                  className={`overflow-hidden transition-all duration-300 cursor-pointer transform border-0 p-0 ${
                    hoveredImage === image.id 
                      ? 'scale-105 ring-2 ring-[#160B53]/20' 
                      : ''
                  }`}
                  style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}
                  onMouseEnter={() => setHoveredImage(image.id)}
                  onMouseLeave={() => setHoveredImage(null)}
                  onClick={() => handleImageClick(image)}
                >
                  {/* Gallery Image */}
                  <div className="relative aspect-square bg-gray-100 overflow-hidden">
                    <img
                      src={image.image}
                      alt={image.title}
                      className={`w-full h-full object-cover transition-transform duration-300 ${
                        hoveredImage === image.id ? 'scale-110' : 'scale-100'
                      }`}
                    />
                    {/* Category Tag */}
                    <div className="absolute top-3 left-3 bg-[var(--branch-primary)] text-white px-3 py-1 rounded-full text-sm font-poppins font-medium">
                      {image.tag}
                    </div>
                  </div>

                  <div className="p-4">
                    <h3 className={`font-poppins font-bold mb-1 transition-colors duration-300 ${
                      hoveredImage === image.id ? 'text-[#160B53]' : 'text-gray-900'
                    }`}>
                      {image.title}
                    </h3>
                    
                    <p className="text-gray-600 text-sm mb-2">{image.description}</p>
                    
                    {image.stylist && (
                      <p className="text-[var(--branch-primary)] font-poppins font-medium text-sm">
                        by {image.stylist}
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Empty State */}
          {currentImages.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📸</div>
              <h3 className="text-xl font-poppins font-semibold text-gray-600 mb-2">
                {isSystemAdmin ? (
                  <InlineEditable
                    enabled={effectiveEditMode}
                    value={emptyTitle}
                    onSave={handleContentUpdate}
                    fieldPath="stylistPortfolioPage.emptyState.title"
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
                    fieldPath="stylistPortfolioPage.emptyState.subtitle"
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
                className="w-8 h-8 p-0 bg-transparent text-gray-700 border-gray-300 hover:bg-gray-50 transition-all duration-300 hover:scale-110 hover:border-[#160B53]/50"
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
                        ? 'bg-[#160B53] text-white border-[#160B53]'
                        : 'bg-transparent text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-[#160B53]/50'
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
                className="w-8 h-8 p-0 bg-transparent text-gray-700 border-gray-300 hover:bg-gray-50 transition-all duration-300 hover:scale-110 hover:border-[#160B53]/50"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                {">"}
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Gallery Detail Modal */}
      {isModalOpen && selectedImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#D4D4D4' }}>
              <h2 className="text-2xl font-poppins font-bold text-[var(--branch-primary)]">{selectedImage.title}</h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Image */}
                <div className="relative">
                  <div className="relative">
                    <img
                      src={selectedImage.image}
                      alt={selectedImage.title}
                      className="w-full h-96 object-cover rounded-lg"
                    />
                    <div className="absolute top-4 left-4 bg-[var(--branch-primary)] text-white px-3 py-1 rounded-full text-sm font-poppins font-medium">
                      {selectedImage.tag}
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-poppins font-bold text-gray-900 mb-2">Description</h3>
                    <p className="text-gray-600 leading-relaxed">{selectedImage.description}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[var(--branch-primary)]/10 rounded-full flex items-center justify-center">
                        <Tag className="w-5 h-5 text-[var(--branch-primary)]" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Category</p>
                        <p className="font-poppins font-medium text-gray-900">{selectedImage.category}</p>
                      </div>
                    </div>

                    {selectedImage.stylist && (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[var(--branch-primary)]/10 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-[var(--branch-primary)]" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Stylist</p>
                          <p className="font-poppins font-medium text-gray-900">{selectedImage.stylist}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[var(--branch-primary)]/10 rounded-full flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-[var(--branch-primary)]" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Branch</p>
                        <p className="font-poppins font-medium text-gray-900">{branchName} Branch</p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Footer */}
      {!embedded && (
        <BranchFooter 
          branchName={`${branchName} Branch`}
          branchPhone="+63 930 222 9659"
          branchAddress={`${branchName}, Philippines`}
          branchSlug={slug}
        />
      )}
    </div>
  )
}

