import { Award, Users, Clock, Globe, ChevronDown, ChevronUp } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import PromotionPopup from "../../components/landing/PromotionPopup"
import Navigation from "../../components/landing/Navigation"
import Footer from "../../components/landing/Footer"
import { marketingContentService } from "../../services/marketingContentService"
import { useAuth } from "../../context/AuthContext"
import { USER_ROLES } from "../../utils/constants"
import InlineEditable from "../../components/cms/InlineEditable"
import FloatingSaveButton from "../../components/cms/FloatingSaveButton"
import EditableImage from "../../components/cms/EditableImage"
import InlineColorPicker from "../../components/cms/InlineColorPicker"

export default function AboutPage({ embedded = false, cmsEditMode }) {
  const { userData, userRoles } = useAuth()
  const isSystemAdmin =
    userRoles?.includes(USER_ROLES.SYSTEM_ADMIN) ||
    userRoles?.includes('system_admin') ||
    userData?.role === USER_ROLES.SYSTEM_ADMIN ||
    userData?.role === 'system_admin'
  const effectiveEditMode = typeof cmsEditMode === 'boolean' ? cmsEditMode : true
  
  const [isExpanded, setIsExpanded] = useState(false)
  const [content, setContent] = useState(null)
  const [localContent, setLocalContent] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const hasChangesRef = useRef(false)
  const localContentRef = useRef(null)
  const editRevisionRef = useRef(0)
  
  // Print functionality
  const printRef = useRef()

  // Load content from Firestore
  useEffect(() => {
    const loadContent = async () => {
      try {
        const result = await marketingContentService.getAboutPageContent()
        if (result.success && result.content) {
          setContent(result.content)
          setLocalContent(result.content)
        }
      } catch (error) {
        console.error('Error loading about page content:', error)
      } finally {
        setLoading(false)
      }
    }

    // Subscribe to real-time updates
    const unsubscribe = marketingContentService.subscribeToContent('about', 'about', (result) => {
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


  // Handle array updates (for stats, paragraphs, etc.)
  const handleArrayUpdate = (fieldPath, index, value) => {
    if (!localContent) return
    
    const keys = fieldPath.split('.')
    const newContent = { ...localContent }
    let current = newContent
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = []
      }
      current = current[keys[i]]
    }

    const arrayKey = keys[keys.length - 1]
    const targetArray = Array.isArray(current[arrayKey]) ? [...current[arrayKey]] : []
    targetArray[index] = { ...(targetArray[index] || {}), ...value }
    current[arrayKey] = targetArray
    
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
      const result = await marketingContentService.updateContent('about', 'about', {
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

  // Use local content if editing, otherwise use saved content
  const displayContent = hasChanges ? localContent : content

  const theme = displayContent?.theme || {}
  const primaryColor = theme.primaryColor || '#160B53'
  const heroOverlayColor = theme.heroOverlayColor || primaryColor
  const heroOverlayOpacity = typeof theme.heroOverlayOpacity === 'number' ? theme.heroOverlayOpacity : 0.7

  const hexToRgba = (hex, opacity = 1) => {
    if (typeof hex !== 'string') return `rgba(0, 0, 0, ${opacity})`
    const normalized = hex.replace('#', '').trim()
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(0, 0, 0, ${opacity})`
    const r = parseInt(normalized.slice(0, 2), 16)
    const g = parseInt(normalized.slice(2, 4), 16)
    const b = parseInt(normalized.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }

  const stats = displayContent?.stats || [
    { number: "200+", label: "Branches Nationwide" },
    { number: "1M+", label: "Happy Clients" },
    { number: "35+", label: "Years of Experience" },
    { number: "3", label: "Countries" },
  ]

  // Icon mapping for benefits
  const iconMap = {
    Award: <Award className="w-8 h-8" />,
    Users: <Users className="w-8 h-8" />,
    Clock: <Clock className="w-8 h-8" />,
    Globe: <Globe className="w-8 h-8" />
  }

  const heroContent = displayContent?.hero || {
    title: "Our Story",
    subtitle: "From humble beginnings to becoming the Philippines' most trusted salon chain. Managed by industry experts with over 35 years of combined experience, we've built a legacy of excellence that spans generations and continues to set the standard for beauty and style.",
    backgroundImage: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/441497757_1392380064751655_248591870024847667_n%201-EoXi9uyyfemn6aMBujpw67luRG1Z7D.png"
  }

  const founderContent = displayContent?.founder || {
    name: "David Charlton",
    role: "Founder",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/DC%201-lnGIWn6aY2YuvXcg35yYsKsosL1eWp.png",
    description: [
      "David Charlton is a visionary entrepreneur with over three decades of experience in the beauty and wellness industry. His journey began in the early 1990s when he recognized the untapped potential in the Filipino market for premium salon services that combine international standards with local sensibilities.",
      "Under his leadership, David's Salon has grown from a single location to over 200 branches across the Philippines, establishing itself as the country's most trusted salon chain. His commitment to excellence and innovation has earned him recognition as one of the industry's most influential leaders.",
      "David's philosophy centers on empowering both clients and staff through continuous education, premium products, and personalized service. His vision extends beyond business success to creating meaningful impact in communities across the nation."
    ],
    quote: {
      title: "Industry Pioneer",
      text: "Our success lies in understanding that beauty is personal, and every client deserves to feel confident and beautiful."
    }
  }

  const companyStoryContent = displayContent?.companyStory || {
    title: "Whoever you are, whatever you do, we bring out the best in you",
    paragraphs: [
      "David's Salon offers world-class hairdressing, fueled by Filipino passion. With the vision of bringing true European hairdressing to the Philippines, CEO David Charlton and the David's Salon's brand has made a name for itself, offering a wide range of hair and beauty services to a wide range of customers. It is a name that has been earned and followed by many Filipinos since its first salon opened in 1988. It is now the biggest chain of salons in the Philippines with over 200 branches all over the country.",
      "\"We take pride in providing the highest quality of service at prices everyone can afford,\" says Charlton. David's Salon's roster of services includes Hair Styling, Hair Color, Hot Oil and Scalp Treatments, Perming, Relaxing, Rebonding, Make Up, Waxing/Threading, Nail Care, and Hand and Foot Spa.",
      "A trusted salon brand such as David's Salon works with different trusted suppliers for hair care, hair color, and other kinds of technologies used for hair styling. Among these suppliers are Loreal, Wella Professional Service, Alfaparf Infiniti, and Schwarzkopf & Henkel.",
      "Total customers satisfaction is the goal of David's Salon. The David's Salon Experience is one where customers are given relaxing ambiance, professional consultations from creative stylists, and personal assistance by store managers and store assistants.",
      "Clients are pampered as they are given quality service with professional care coming from a well-trained team. David's Salon has a solid core business management team equipped themselves with the latest and most innovative European hairdressing technology, which they generously and systematically pass on to every David's Salon stylist."
    ]
  }

  const ceoContent = displayContent?.ceo || {
    name: "Laura Charlton",
    role: "CEO and President",
    image: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/DC%201%20%281%29-naiRFHoiiPP970mA8FxdHoiQjnpvAz.png",
    description: [
      "Laura Charlton brings over two decades of operational excellence to David's Salon. As CEO and President, she oversees the day-to-day operations of all branches, ensuring consistent quality and service standards across the entire network.",
      "Her expertise in staff training and development has been instrumental in building David's Salon's reputation for exceptional service. Laura's commitment to continuous improvement and innovation has helped establish the company as an industry leader in the Philippines.",
      "Under her guidance, David's Salon has implemented cutting-edge training programs and quality assurance systems that ensure every client receives the premium experience they deserve, regardless of which branch they visit."
    ]
  }

  const teamContent = displayContent?.team || {
    title: "Our Team",
    executive: [
      {
        name: "Marivic Aguibiador",
        role: "Executive Vice President for Finance and Operations",
        image: "/images/team/executives/marivicaguibiador.jpg"
      },
      {
        name: "Maria Luisa Flores",
        role: "Vice President for Human Resources",
        image: "/images/team/executives/marialuisa.jpg"
      }
    ],
    management: [
      {
        name: "Jeng Sy",
        role: "Retail Department Manager",
        image: "/images/team/management/jengsy.jpg"
      },
      {
        name: "Lorna Sandoval",
        role: "Academy Training Director",
        image: "/images/team/management/lornasandoval.jpg"
      },
      {
        name: "Hanna Riñon de Grano",
        role: "Purchasing Department Manager",
        image: "/images/team/management/hannarinon.jpg"
      }
    ]
  }

  const whyChooseContent = displayContent?.whyChoose || {
    title: "Why Choose David's Salon",
    subtitle: "Where every client receives exceptional service and achieves their desired look with personalized care for every client.",
    benefits: [
      {
        icon: "Award",
        title: "Expert stylists",
        description: "Experienced professionals trained in the latest techniques and trends."
      },
      {
        icon: "Users",
        title: "Premium products",
        description: "High-quality products and tools for the best results."
      },
      {
        icon: "Clock",
        title: "Customized solutions",
        description: "Tailored treatments that fit your unique style and preferences."
      },
      {
        icon: "Globe",
        title: "International standards",
        description: "World-class service with Filipino hospitality and warmth."
      }
    ]
  }

  return (
    <>
      {!embedded && <Navigation />}
      {embedded && <Navigation embedded={true} cmsEditMode={cmsEditMode} />}
      <div className="min-h-screen bg-white" style={{ '--marketing-primary': primaryColor }}>
        {/* Promotion Popup - Only show when not embedded */}
        {/* Promotion popup disabled */}
        {/* {!embedded && <PromotionPopup />} */}
      
      {/* Floating Save Button for System Admin */}
      {isSystemAdmin && (
        <FloatingSaveButton 
          onSave={handleSave} 
          saving={saving} 
          hasChanges={hasChanges}
        />
      )}
      
      {/* Print Content */}
      <div ref={printRef} className="print-content">
      
      {/* Hero Section */}
      <EditableImage
        enabled={isSystemAdmin && effectiveEditMode}
        mode="background"
        onChange={(url) => handleContentUpdate('hero.backgroundImage', url)}
      >
        <section
          className={`relative min-h-[500px] sm:min-h-[600px] md:min-h-[700px] lg:min-h-[800px] flex items-center justify-center text-center text-white ${embedded ? 'mt-0' : 'mt-[80px]'} pb-6 sm:pb-8`}
          style={{
            backgroundImage: `linear-gradient(${hexToRgba(heroOverlayColor, heroOverlayOpacity)}, ${hexToRgba(heroOverlayColor, heroOverlayOpacity)}), url('${heroContent.backgroundImage}')`,
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
                value={heroOverlayColor}
                onChange={(value) => handleContentUpdate('theme.heroOverlayColor', value)}
              />
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700 whitespace-nowrap">Overlay Opacity</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={heroOverlayOpacity}
                  onChange={(e) => handleContentUpdate('theme.heroOverlayOpacity', parseFloat(e.target.value))}
                  className="w-32"
                />
                <span className="text-xs font-mono text-gray-600">{heroOverlayOpacity.toFixed(2)}</span>
              </div>
            </div>
          )}
          <div className="max-w-4xl px-4 sm:px-6">
            {isSystemAdmin ? (
              <h1 className="font-bold mb-4 sm:mb-6 text-balance text-3xl sm:text-4xl md:text-5xl lg:text-[50px]">
                <InlineEditable
                  enabled={effectiveEditMode}
                  value={heroContent.title}
                  onSave={(path, value) => handleContentUpdate('hero.title', value)}
                  fieldPath="hero.title"
                  className="text-white"
                />
              </h1>
            ) : (
              <h1 className="font-bold mb-4 sm:mb-6 text-balance text-3xl sm:text-4xl md:text-5xl lg:text-[50px]">{heroContent.title}</h1>
            )}
            {isSystemAdmin ? (
              <p className="text-base sm:text-lg md:text-xl leading-relaxed text-pretty">
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
              <p className="text-base sm:text-lg md:text-xl leading-relaxed text-pretty">
                {heroContent.subtitle}
              </p>
            )}
          </div>
        </section>
      </EditableImage>

      {/* Statistics Section */}
      <section className="py-8 sm:py-12 md:py-16 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index}>
                {isSystemAdmin ? (
                  <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[var(--marketing-primary)] mb-2">
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={stat.number}
                      onSave={(path, value) => handleArrayUpdate('stats', index, { number: value, label: stat.label })}
                      fieldPath={`stats.${index}.number`}
                      className="text-[var(--marketing-primary)]"
                    />
                  </div>
                ) : (
                  <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[var(--marketing-primary)] mb-2">{stat.number}</div>
                )}
                {isSystemAdmin ? (
                  <div className="text-xs sm:text-sm md:text-base text-gray-600 font-medium">
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={stat.label}
                      onSave={(path, value) => handleArrayUpdate('stats', index, { number: stat.number, label: value })}
                      fieldPath={`stats.${index}.label`}
                      className="text-gray-600"
                    />
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm md:text-base text-gray-600 font-medium">{stat.label}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Meet Our Founder Section */}
      <section className="py-8 sm:py-12 md:py-16 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {isSystemAdmin ? (
            <h2 className="font-bold text-center text-[var(--marketing-primary)] mb-4 text-3xl sm:text-4xl md:text-5xl lg:text-[50px]">
              Meet Our Founder
            </h2>
          ) : (
            <h2 className="font-bold text-center text-[var(--marketing-primary)] mb-4 text-3xl sm:text-4xl md:text-5xl lg:text-[50px]">Meet Our Founder</h2>
          )}
          <p className="text-center text-gray-600 mb-8 sm:mb-12 text-sm sm:text-base">
            The visionary behind the integrated male grooming salon brand
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div className="order-2 lg:order-1">
              {isSystemAdmin ? (
                <h3 className="text-2xl sm:text-3xl font-bold text-[var(--marketing-primary)] mb-4">
                  <InlineEditable
                    enabled={effectiveEditMode}
                    value={founderContent.name}
                    onSave={(path, value) => handleContentUpdate('founder.name', value)}
                    fieldPath="founder.name"
                    className="text-[var(--marketing-primary)]"
                  />
                </h3>
              ) : (
                <h3 className="text-2xl sm:text-3xl font-bold text-[var(--marketing-primary)] mb-4">{founderContent.name}</h3>
              )}
              {isSystemAdmin ? (
                <p className="text-base sm:text-lg text-gray-600 mb-4">
                  <InlineEditable
                    enabled={effectiveEditMode}
                    value={founderContent.role}
                    onSave={(path, value) => handleContentUpdate('founder.role', value)}
                    fieldPath="founder.role"
                    className="text-gray-600"
                  />
                </p>
              ) : (
                <p className="text-base sm:text-lg text-gray-600 mb-4">{founderContent.role}</p>
              )}

              <div className="space-y-4 text-gray-700 leading-relaxed">
                {founderContent.description.map((para, index) => (
                  isSystemAdmin ? (
                    <p key={index} className="text-justify">
                      <InlineEditable
                        enabled={effectiveEditMode}
                        value={para}
                        onSave={(path, value) => {
                          const newDesc = [...founderContent.description]
                          newDesc[index] = value
                          handleContentUpdate('founder.description', newDesc)
                        }}
                        fieldPath={`founder.description.${index}`}
                        multiline={true}
                        className="text-gray-700"
                      />
                    </p>
                  ) : (
                    <p key={index} className="text-justify">{para}</p>
                  )
                ))}
              </div>

              <div className="mt-8 p-4 bg-white rounded-lg border-l-4 border-[var(--marketing-primary)]">
                {isSystemAdmin ? (
                  <p className="text-[var(--marketing-primary)] font-semibold mb-2">
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={founderContent.quote.title}
                      onSave={(path, value) => handleContentUpdate('founder.quote.title', value)}
                      fieldPath="founder.quote.title"
                      className="text-[var(--marketing-primary)]"
                    />
                  </p>
                ) : (
                  <p className="text-[var(--marketing-primary)] font-semibold mb-2">{founderContent.quote.title}</p>
                )}
                {isSystemAdmin ? (
                  <p className="text-sm text-gray-600">
                    "<InlineEditable
                      enabled={effectiveEditMode}
                      value={founderContent.quote.text}
                      onSave={(path, value) => handleContentUpdate('founder.quote.text', value)}
                      fieldPath="founder.quote.text"
                      multiline={true}
                      className="text-gray-600"
                    />"
                  </p>
                ) : (
                  <p className="text-sm text-gray-600">
                    "{founderContent.quote.text}"
                  </p>
                )}
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <EditableImage
                enabled={isSystemAdmin && effectiveEditMode}
                src={founderContent.image}
                alt="David Charlton, Founder and CEO"
                className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                wrapperClassName="w-full"
                onChange={(url) => handleContentUpdate('founder.image', url)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Company Story Section */}
      <section className="py-8 sm:py-12 md:py-16 px-4 sm:px-6 bg-[var(--marketing-primary)] text-white">
        <div className="max-w-6xl mx-auto">
          {isSystemAdmin ? (
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">
              <InlineEditable
                enabled={effectiveEditMode}
                value={companyStoryContent.title}
                onSave={(path, value) => handleContentUpdate('companyStory.title', value)}
                fieldPath="companyStory.title"
                className="text-white"
              />
            </h2>
          ) : (
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">
              {companyStoryContent.title}
            </h2>
          )}

          <div className="space-y-4 sm:space-y-6 text-sm sm:text-base md:text-lg leading-relaxed">
            {companyStoryContent.paragraphs.slice(0, 2).map((para, index) => (
              isSystemAdmin ? (
                <p key={index} className="text-justify">
                  <InlineEditable
                    enabled={effectiveEditMode}
                    value={para}
                    onSave={(path, value) => {
                      const newParas = [...companyStoryContent.paragraphs]
                      newParas[index] = value
                      handleContentUpdate('companyStory.paragraphs', newParas)
                    }}
                    fieldPath={`companyStory.paragraphs.${index}`}
                    multiline={true}
                    className="text-white"
                  />
                </p>
              ) : (
                <p key={index} className="text-justify">{para}</p>
              )
            ))}

            <div 
              className={`overflow-hidden transition-all duration-500 ease-in-out ${
                isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="space-y-6">
                {companyStoryContent.paragraphs.slice(2).map((para, index) => (
                  isSystemAdmin ? (
                    <p key={index + 2} className="text-justify">
                      <InlineEditable
                        enabled={effectiveEditMode}
                        value={para}
                        onSave={(path, value) => {
                          const newParas = [...companyStoryContent.paragraphs]
                          newParas[index + 2] = value
                          handleContentUpdate('companyStory.paragraphs', newParas)
                        }}
                        fieldPath={`companyStory.paragraphs.${index + 2}`}
                        multiline={true}
                        className="text-white"
                      />
                    </p>
                  ) : (
                    <p key={index + 2} className="text-justify">{para}</p>
                  )
                ))}
              </div>
            </div>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 text-white hover:text-gray-200 transition-colors duration-200 font-medium"
            >
              {isExpanded ? (
                <>
                  <span>Read Less</span>
                  <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Read More</span>
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Laura Charlton Section */}
      <section className="py-8 sm:py-12 md:py-16 px-4 sm:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center">
            <div>
              <EditableImage
                enabled={isSystemAdmin && effectiveEditMode}
                src={ceoContent.image}
                alt="Laura Charlton, CEO and President"
                className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                wrapperClassName="w-full"
                onChange={(url) => handleContentUpdate('ceo.image', url)}
              />
            </div>

            <div>
              {isSystemAdmin ? (
                <h3 className="text-2xl sm:text-3xl font-bold text-[var(--marketing-primary)] mb-4">
                  <InlineEditable
                    enabled={effectiveEditMode}
                    value={ceoContent.name}
                    onSave={(path, value) => handleContentUpdate('ceo.name', value)}
                    fieldPath="ceo.name"
                    className="text-[var(--marketing-primary)]"
                  />
                </h3>
              ) : (
                <h3 className="text-2xl sm:text-3xl font-bold text-[var(--marketing-primary)] mb-4">{ceoContent.name}</h3>
              )}
              {isSystemAdmin ? (
                <p className="text-base sm:text-lg text-gray-600 mb-4">
                  <InlineEditable
                    enabled={effectiveEditMode}
                    value={ceoContent.role}
                    onSave={(path, value) => handleContentUpdate('ceo.role', value)}
                    fieldPath="ceo.role"
                    className="text-gray-600"
                  />
                </p>
              ) : (
                <p className="text-base sm:text-lg text-gray-600 mb-4">{ceoContent.role}</p>
              )}

              <div className="space-y-4 text-gray-700 leading-relaxed">
                {ceoContent.description.map((para, index) => (
                  isSystemAdmin ? (
                    <p key={index} className="text-justify">
                      <InlineEditable
                        enabled={effectiveEditMode}
                        value={para}
                        onSave={(path, value) => {
                          const newDesc = [...ceoContent.description]
                          newDesc[index] = value
                          handleContentUpdate('ceo.description', newDesc)
                        }}
                        fieldPath={`ceo.description.${index}`}
                        multiline={true}
                        className="text-gray-700"
                      />
                    </p>
                  ) : (
                    <p key={index} className="text-justify">{para}</p>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Team Section */}
      <section className="py-8 sm:py-12 md:py-16 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {isSystemAdmin ? (
            <h2 className="font-bold text-center text-[var(--marketing-primary)] mb-8 sm:mb-12 text-3xl sm:text-4xl md:text-5xl lg:text-[50px]">
              <InlineEditable
                enabled={effectiveEditMode}
                value={teamContent.title}
                onSave={(path, value) => handleContentUpdate('team.title', value)}
                fieldPath="team.title"
                className="text-[var(--marketing-primary)]"
              />
            </h2>
          ) : (
            <h2 className="font-bold text-center text-[var(--marketing-primary)] mb-8 sm:mb-12 text-3xl sm:text-4xl md:text-5xl lg:text-[50px]">{teamContent.title}</h2>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8 max-w-3xl mx-auto">
            {teamContent.executive.map((member, index) => (
              <div 
                key={index} 
                className="relative overflow-hidden bg-white rounded-lg aspect-[3/4]"
                style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}
              >
                <img
                  src={member.image || "/placeholder.svg"}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-center">
                  <h3 className="text-xl font-bold text-white mb-2">{member.name}</h3>
                  <p className="text-gray-200 text-sm">{member.role}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {teamContent.management.map((member, index) => (
              <div 
                key={index} 
                className="relative overflow-hidden bg-white rounded-lg aspect-[3/4]"
                style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}
              >
                <img
                  src={member.image || "/placeholder.svg"}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 sm:p-6 text-center">
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-1 sm:mb-2">{member.name}</h3>
                  <p className="text-gray-200 text-xs sm:text-sm">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose David's Salon Section */}
      <section className="py-8 sm:py-12 md:py-16 px-4 sm:px-6 bg-[var(--marketing-primary)] text-white">
        <div className="max-w-6xl mx-auto">
          {isSystemAdmin ? (
            <h2 className="font-bold text-center mb-4 text-3xl sm:text-4xl md:text-5xl lg:text-[50px]">
              <InlineEditable
                enabled={effectiveEditMode}
                value={whyChooseContent.title}
                onSave={(path, value) => handleContentUpdate('whyChoose.title', value)}
                fieldPath="whyChoose.title"
                className="text-white"
              />
            </h2>
          ) : (
            <h2 className="font-bold text-center mb-4 text-3xl sm:text-4xl md:text-5xl lg:text-[50px]">{whyChooseContent.title}</h2>
          )}
          {isSystemAdmin ? (
            <p className="text-center text-base sm:text-lg md:text-xl mb-8 sm:mb-12 text-pretty px-2">
              <InlineEditable
                enabled={effectiveEditMode}
                value={whyChooseContent.subtitle}
                onSave={(path, value) => handleContentUpdate('whyChoose.subtitle', value)}
                fieldPath="whyChoose.subtitle"
                multiline={true}
                className="text-white"
              />
            </p>
          ) : (
            <p className="text-center text-base sm:text-lg md:text-xl mb-8 sm:mb-12 text-pretty px-2">
              {whyChooseContent.subtitle}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {whyChooseContent.benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                    <div className="text-[var(--marketing-primary)]">{iconMap[benefit.icon] || <Award className="w-8 h-8" />}</div>
                  </div>
                </div>
                {isSystemAdmin ? (
                  <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={benefit.title}
                      onSave={(path, value) => {
                        const newBenefits = [...whyChooseContent.benefits]
                        newBenefits[index] = { ...benefit, title: value }
                        handleContentUpdate('whyChoose.benefits', newBenefits)
                      }}
                      fieldPath={`whyChoose.benefits.${index}.title`}
                      className="text-white"
                    />
                  </h3>
                ) : (
                  <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">{benefit.title}</h3>
                )}
                {isSystemAdmin ? (
                  <p className="text-sm sm:text-base text-gray-200 leading-relaxed">
                    <InlineEditable
                      enabled={effectiveEditMode}
                      value={benefit.description}
                      onSave={(path, value) => {
                        const newBenefits = [...whyChooseContent.benefits]
                        newBenefits[index] = { ...benefit, description: value }
                        handleContentUpdate('whyChoose.benefits', newBenefits)
                      }}
                      fieldPath={`whyChoose.benefits.${index}.description`}
                      multiline={true}
                      className="text-gray-200"
                    />
                  </p>
                ) : (
                  <p className="text-sm sm:text-base text-gray-200 leading-relaxed">{benefit.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-content,
          .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print-content button,
          .print-content .floating-save-button {
            display: none !important;
          }
          .print-content section {
            page-break-inside: avoid;
          }
        }
      `}</style>
        </div>
      </div>
      {!embedded && <Footer />}
      {embedded && <Footer embedded={true} cmsEditMode={cmsEditMode} />}
    </>
  )
}

