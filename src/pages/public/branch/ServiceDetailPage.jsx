import Button from "../../../components/ui/Button"
import { Clock, Banknote, ArrowLeft, Check, ChevronDown, ChevronUp } from "lucide-react"
import { useParams, Link } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../../config/firebase'
import { getServiceById } from '../../../services/branchServicesService'
import BranchNavigation from "../../../components/landing/BranchNavigation"
import BranchFooter from "../../../components/landing/BranchFooter"
import { marketingContentService } from "../../../services/marketingContentService"
import { useAuth } from "../../../context/AuthContext"
import { USER_ROLES } from "../../../utils/constants"
import InlineEditable from "../../../components/cms/InlineEditable"
import FloatingSaveButton from "../../../components/cms/FloatingSaveButton"

const slugify = (value) => {
  if (!value) return ''
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function ServiceDetailPage({
  embedded = false,
  cmsEditMode,
  cmsBranchId = null,
  cmsBranchName = '',
  cmsBranchSlug = '',
  cmsServiceId = null,
  onBack
}) {
  const { userData, userRoles } = useAuth()
  const params = useParams()
  const slug = cmsBranchSlug || params.slug
  const serviceId = cmsServiceId || params.serviceId
  const computedBranchName = slug ? slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : ''
  const branchName = cmsBranchName || computedBranchName

  const effectiveEditMode = typeof cmsEditMode === 'boolean' ? cmsEditMode : true
  const isSystemAdmin =
    userRoles?.includes(USER_ROLES.SYSTEM_ADMIN) ||
    userRoles?.includes('system_admin') ||
    userData?.role === USER_ROLES.SYSTEM_ADMIN ||
    userData?.role === 'system_admin'

  const blockInteractions = embedded && isSystemAdmin && effectiveEditMode
  
  const [isVisible, setIsVisible] = useState(false)
  const [openFAQ, setOpenFAQ] = useState(null)
  const [branchId, setBranchId] = useState(cmsBranchId)
  const [service, setService] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notAvailable, setNotAvailable] = useState(false)

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

  const marketingContentId = cmsBranchId
    ? `branch_${cmsBranchId}`
    : branchId
      ? `branch_${branchId}`
      : slug
        ? `branch_${slug}`
        : null

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

  // Resolve branchId by slug
  useEffect(() => {
    if (cmsBranchId) {
      setBranchId(cmsBranchId)
      return
    }

    const findBranch = async () => {
      try {
        const branchesRef = collection(db, 'branches')
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
        console.error('Error finding branch by slug', err)
        setBranchId(null)
      }
    }

    if (slug) {
      findBranch()
    }
  }, [slug, cmsBranchId])

  // Load service details and check branch availability
  useEffect(() => {
    if (!branchId) return
    if (!serviceId) return

    const loadService = async () => {
      setLoading(true)
      try {
        const s = await getServiceById(serviceId)
        // Check if service is configured for this branch (branchPricing)
        const hasForBranch = s.branchPricing && (s.branchPricing[branchId] !== undefined && s.branchPricing[branchId] !== null)
        if (!hasForBranch) {
          setNotAvailable(true)
          setService(null)
        } else {
          // include branch-specific price for display convenience
          const price = s.branchPricing[branchId]
          const normalized = {
            ...s,
            name: s.name || s.serviceName || 'Service',
            serviceName: s.serviceName || s.name || 'Service',
            description: s.description || s.shortDescription || '',
            longDescription: s.longDescription || s.description || s.shortDescription || '',
            image: s.imageURL || s.imageUrl || s.image || s.media?.[0]?.url || '/logo.jpg',
            category: s.category || s.serviceType || 'Uncategorized',
            tag: s.tag || s.tagLabel || '',
            duration: s.duration ?? s.time ?? null
          }
          setService({ id: s.id, ...normalized, price })
          setNotAvailable(false)
        }
      } catch (err) {
        console.error('Error loading service:', err)
        setService(null)
        setNotAvailable(true)
      } finally {
        setLoading(false)
      }
    }

    loadService()
  }, [branchId, serviceId])

  const displayContent = hasChanges ? localContent : content
  const servicesDetailPage = displayContent?.servicesDetailPage || {}
  const buttonsContent = servicesDetailPage.buttons || {}

  const backButtonText = buttonsContent.backButtonText || 'Back'
  const backToServicesButtonText = buttonsContent.backToServicesButtonText || 'Back to services'
  const bookThisServiceButtonText = buttonsContent.bookThisServiceButtonText || 'Book This Service'
  const viewRecommendedStylistsButtonText =
    buttonsContent.viewRecommendedStylistsButtonText || 'View Recommended Stylists'
  const viewProfileButtonText = buttonsContent.viewProfileButtonText || 'View Profile'

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

  // NOTE: the service data is now loaded from Firestore and validated for the current branch

  const whatsIncluded = [
    "Consultation with professional stylist",
    "Precision hair cutting",
    "Professional blow-dry and styling",
    "Hair care tips and maintenance advice",
    "Complimentary hair wash",
    "Styling product application"
  ]

  const recommendedStylists = [
    {
      name: "John Cruz",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face"
    },
    {
      name: "Maria Santos",
      avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face"
    }
  ]

  const serviceProcess = [
    {
      step: 1,
      title: "Consultation",
      description: "Discuss your desired look, lifestyle, and hair goals with your stylist"
    },
    {
      step: 2,
      title: "Hair Analysis",
      description: "Professional assessment of your hair type, texture, and face shape"
    },
    {
      step: 3,
      title: "Cutting",
      description: "Precision cutting using professional techniques and tools"
    },
    {
      step: 4,
      title: "Styling",
      description: "Professional blow-dry and styling to complete your new look"
    },
    {
      step: 5,
      title: "Finishing",
      description: "Final touches and styling tips for maintaining your new cut"
    }
  ]

  const beforeAfterImages = [
    {
      before: "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?w=300&h=300&fit=crop",
      after: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=300&h=300&fit=crop",
      title: "Before",
      afterTitle: "After"
    },
    {
      before: "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?w=300&h=300&fit=crop",
      after: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&h=300&fit=crop",
      title: "Before",
      afterTitle: "After"
    },
    {
      before: "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?w=300&h=300&fit=crop",
      after: "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=300&h=300&fit=crop",
      title: "Before",
      afterTitle: "After"
    },
    {
      before: "https://images.unsplash.com/photo-1616683693504-3ea7e9ad6fec?w=300&h=300&fit=crop",
      after: "https://images.unsplash.com/photo-1559599101-f09722fb4948?w=300&h=300&fit=crop",
      title: "Before",
      afterTitle: "After"
    }
  ]

  const faqs = [
    {
      question: "How often should I get a haircut?",
      answer: "Generally every 6-8 weeks to maintain shape and health, but this varies based on your hair type and style."
    },
    {
      question: "Should I wash my hair before coming in?",
      answer: "Generally every 6-8 weeks to maintain shape and health, but this varies based on your hair type and style."
    },
    {
      question: "Can I bring reference photos?",
      answer: "Reference photos help us understand exactly what you're looking for."
    }
  ]

  const toggleFAQ = (index) => {
    if (blockInteractions) return
    setOpenFAQ(openFAQ === index ? null : index)
  }

  const handleEmbeddedClickCapture = (e) => {
    if (!blockInteractions) return
    const target = e?.target
    if (!target || typeof target.closest !== 'function') return
    if (target.closest('[data-cms-allow-interaction="true"]')) return
    e.preventDefault()
    e.stopPropagation()
  }

  // Render different states: loading, not available, or show service details
  if (loading) {
    return (
      <div onClickCapture={handleEmbeddedClickCapture}>
        {!embedded && <BranchNavigation branchName={`${branchName} Branch`} />}
        <div className="py-40 text-center text-gray-500">Loading service details…</div>
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

  if (notAvailable) {
    return (
      <div onClickCapture={handleEmbeddedClickCapture}>
        {!embedded && <BranchNavigation branchName={`${branchName} Branch`} />}
        <section className="py-40 px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-poppins font-bold text-[#160B53] mb-4">Service not available</h2>
            <p className="text-gray-600 mb-6">The service you requested is not offered at the {branchName} branch.</p>
            {typeof onBack === 'function' || embedded ? (
              <button
                type="button"
                onClick={blockInteractions ? undefined : onBack}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#160B53] text-white rounded-lg"
              >
                <InlineEditable
                  value={backToServicesButtonText}
                  onSave={handleContentUpdate}
                  fieldPath="servicesDetailPage.buttons.backToServicesButtonText"
                  enabled={isSystemAdmin && effectiveEditMode}
                  className="text-white"
                />
              </button>
            ) : (
              <Link to={`/branch/${slug}/services`} className="inline-flex items-center gap-2 px-6 py-3 bg-[#160B53] text-white rounded-lg">
                <InlineEditable
                  value={backToServicesButtonText}
                  onSave={handleContentUpdate}
                  fieldPath="servicesDetailPage.buttons.backToServicesButtonText"
                  enabled={isSystemAdmin && effectiveEditMode}
                  className="text-white"
                />
              </Link>
            )}
          </div>
        </section>
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

  return (
    <div onClickCapture={handleEmbeddedClickCapture}>
      {!embedded && <BranchNavigation branchName={`${branchName} Branch`} />}
      
      {/* Hero Section */}
      <section className="relative py-16 px-6 bg-gray-50" style={{ paddingTop: embedded ? undefined : '138px' }}>
        <div className="max-w-6xl mx-auto">
          {/* Back Button */}
          <div className="mb-6">
            {typeof onBack === 'function' || embedded ? (
              <button
                type="button"
                onClick={blockInteractions ? undefined : onBack}
                className="inline-flex items-center gap-2 text-[#160B53] hover:text-[#160B53]/80 font-poppins font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <InlineEditable
                  value={backButtonText}
                  onSave={handleContentUpdate}
                  fieldPath="servicesDetailPage.buttons.backButtonText"
                  enabled={isSystemAdmin && effectiveEditMode}
                  className="text-[#160B53]"
                />
              </button>
            ) : (
              <Link 
                to={`/branch/${slug}/services`}
                className="inline-flex items-center gap-2 text-[#160B53] hover:text-[#160B53]/80 font-poppins font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <InlineEditable
                  value={backButtonText}
                  onSave={handleContentUpdate}
                  fieldPath="servicesDetailPage.buttons.backButtonText"
                  enabled={isSystemAdmin && effectiveEditMode}
                  className="text-[#160B53]"
                />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Service Image */}
            <div className="relative">
              <img
                src={service.image}
                alt={service.name}
                className="w-full h-80 object-cover rounded-lg shadow-lg"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = '/logo.jpg'
                }}
              />
              <div className="absolute top-4 left-4 flex gap-2">
                <span className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-poppins font-medium text-gray-700">
                  {service.category}
                </span>
                {!!service.tag && (
                  <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-poppins font-medium">
                    {service.tag}
                  </span>
                )}
              </div>
            </div>

            {/* Service Info */}
            <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <h1 className="text-4xl font-poppins font-bold text-[#160B53] mb-4">{service.name}</h1>
              <p className="text-lg text-gray-600 mb-6">{service.description}</p>
              
              {/* Service Details */}
              <div className="flex items-center gap-6 mb-8">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-5 h-5" />
                  <span className="font-poppins font-medium">
                    {service.duration == null ? '—' : (typeof service.duration === 'number' ? `${service.duration} mins` : service.duration)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-gray-600" />
                  <span className="font-poppins font-bold text-xl text-[#160B53]">{service.price}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="bg-[#160B53] hover:bg-[#160B53]/90 text-white font-poppins font-semibold"
                >
                  <InlineEditable
                    value={bookThisServiceButtonText}
                    onSave={handleContentUpdate}
                    fieldPath="servicesDetailPage.buttons.bookThisServiceButtonText"
                    enabled={isSystemAdmin && effectiveEditMode}
                    className="text-white"
                  />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-[#160B53] text-[#160B53] hover:bg-[#160B53] hover:text-white font-poppins font-semibold"
                >
                  <InlineEditable
                    value={viewRecommendedStylistsButtonText}
                    onSave={handleContentUpdate}
                    fieldPath="servicesDetailPage.buttons.viewRecommendedStylistsButtonText"
                    enabled={isSystemAdmin && effectiveEditMode}
                    className="text-[#160B53]"
                  />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About This Service */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-poppins font-bold text-[#160B53] mb-6">About This Service</h2>
          <p className="text-gray-600 leading-relaxed mb-8 text-lg">
            {service.longDescription}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* What's Included */}
            <div>
              <h3 className="text-xl font-poppins font-bold text-gray-900 mb-4">What's Included</h3>
              <div className="space-y-3">
                {whatsIncluded.map((item, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-600">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Stylists */}
            <div>
              <h3 className="text-xl font-poppins font-bold text-gray-900 mb-4">Recommended Stylists</h3>
              <div className="space-y-4">
                {recommendedStylists.map((stylist, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <img
                        src={stylist.avatar}
                        alt={stylist.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <span className="font-poppins font-medium text-gray-900">{stylist.name}</span>
                    </div>
                    <Button size="sm" variant="outline" className="border-[#160B53] text-[#160B53] hover:bg-[#160B53] hover:text-white">
                      <InlineEditable
                        value={viewProfileButtonText}
                        onSave={handleContentUpdate}
                        fieldPath="servicesDetailPage.buttons.viewProfileButtonText"
                        enabled={isSystemAdmin && effectiveEditMode}
                        className="text-[#160B53]"
                      />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Service Process */}
      <section className="py-16 px-6 bg-[#160B53] text-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-poppins font-bold text-center mb-12">Service Process</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {serviceProcess.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-white text-[#160B53] rounded-full flex items-center justify-center mx-auto mb-4 font-poppins font-bold text-xl">
                  {step.step}
                </div>
                <h3 className="font-poppins font-bold mb-2">{step.title}</h3>
                <p className="text-sm opacity-90">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Before & After Results */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-poppins font-bold text-center text-[#160B53] mb-12">Before & After Results</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {beforeAfterImages.map((item, index) => (
              <div key={index} className="space-y-4">
                <div className="relative">
                  <img
                    src={item.before}
                    alt="Before"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm font-poppins font-medium">
                    Before
                  </div>
                </div>
                <div className="relative">
                  <img
                    src={item.after}
                    alt="After"
                    className="w-full h-64 object-cover rounded-lg"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm font-poppins font-medium">
                    After
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-poppins font-bold text-center text-[#160B53] mb-12">Frequently Asked Questions</h2>
          
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm border">
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="font-poppins font-medium text-gray-900">{faq.question}</span>
                  {openFAQ === index ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                {openFAQ === index && (
                  <div className="px-6 pb-6">
                    <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      
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

