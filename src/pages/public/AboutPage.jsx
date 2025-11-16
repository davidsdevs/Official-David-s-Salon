import { Award, Users, Clock, Globe, ChevronDown, ChevronUp, Printer } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useReactToPrint } from "react-to-print"
import PromotionPopup from "../../components/landing/PromotionPopup"
import Navigation from "../../components/landing/Navigation"
import Footer from "../../components/landing/Footer"
import { branchContentService } from "../../services/branchContentService"
import { useAuth } from "../../context/AuthContext"
import { USER_ROLES } from "../../utils/constants"
import InlineEditable from "../../components/cms/InlineEditable"
import FloatingSaveButton from "../../components/cms/FloatingSaveButton"
import Button from "../../components/ui/Button"

export default function AboutPage({ embedded = false }) {
  const { userData } = useAuth()
  const isSystemAdmin = userData?.roles?.[0] === USER_ROLES.SYSTEM_ADMIN
  
  const [isExpanded, setIsExpanded] = useState(false)
  const [content, setContent] = useState(null)
  const [localContent, setLocalContent] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // Print functionality
  const printRef = useRef()
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `About_Davids_Salon_${new Date().toISOString().split('T')[0]}`,
  })

  // Load content from Firestore
  useEffect(() => {
    const loadContent = async () => {
      try {
        const result = await branchContentService.getAboutPageContent()
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
    const unsubscribe = branchContentService.subscribeToContent('about', 'about', (result) => {
      if (result.success && result.content) {
        setContent(result.content)
        if (!hasChanges) {
          setLocalContent(result.content)
        }
        setLoading(false)
      }
    })

    loadContent()

    return () => unsubscribe()
  }, [hasChanges])

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
    
    if (!Array.isArray(current)) {
      current = []
    }
    
    current[index] = { ...current[index], ...value }
    
    setLocalContent(newContent)
    setHasChanges(true)
  }

  // Save changes
  const handleSave = async () => {
    if (!localContent || !userData) return
    
    try {
      setSaving(true)
      const result = await branchContentService.saveAboutPageContent({
        ...localContent,
        updatedBy: userData.uid
      })
      
      if (result.success) {
        setContent(localContent)
        setHasChanges(false)
        setSaving(false)
      }
    } catch (error) {
      console.error('Error saving content:', error)
      setSaving(false)
    }
  }

  // Use local content if editing, otherwise use saved content
  const displayContent = hasChanges ? localContent : content

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
      <Navigation />
      <div className="min-h-screen bg-white">
        {/* Promotion Popup - Only show when not embedded */}
        {!embedded && <PromotionPopup />}
      
      {/* Floating Save Button for System Admin */}
      {isSystemAdmin && (
        <FloatingSaveButton 
          onSave={handleSave} 
          saving={saving} 
          hasChanges={hasChanges}
        />
      )}
      
      {/* Print Button */}
      {!embedded && (
        <div className="fixed bottom-6 right-6 z-40">
          <Button
            onClick={handlePrint}
            className="bg-[#160B53] hover:bg-[#160B53]/90 text-white shadow-lg"
            size="lg"
          >
            <Printer className="h-5 w-5 mr-2" />
            Print Page
          </Button>
        </div>
      )}
      
      {/* Print Content */}
      <div ref={printRef} className="print-content">
      
      {/* Hero Section */}
      <section
        className={`relative h-[800px] flex items-center justify-center text-center text-white ${embedded ? 'mt-0' : 'mt-[122px]'}`}
        style={{
          backgroundImage: `linear-gradient(rgba(22, 11, 83, 0.7), rgba(22, 11, 83, 0.7)), url('${heroContent.backgroundImage}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-4xl px-6">
          {isSystemAdmin ? (
            <h1 className="font-bold mb-6 text-balance" style={{ fontSize: '50px' }}>
              <InlineEditable
                value={heroContent.title}
                onSave={(path, value) => handleContentUpdate('hero.title', value)}
                fieldPath="hero.title"
                className="text-white"
              />
            </h1>
          ) : (
            <h1 className="font-bold mb-6 text-balance" style={{ fontSize: '50px' }}>{heroContent.title}</h1>
          )}
          {isSystemAdmin ? (
            <p className="text-xl leading-relaxed text-pretty">
              <InlineEditable
                value={heroContent.subtitle}
                onSave={(path, value) => handleContentUpdate('hero.subtitle', value)}
                fieldPath="hero.subtitle"
                multiline={true}
                className="text-white"
              />
            </p>
          ) : (
            <p className="text-xl leading-relaxed text-pretty">
              {heroContent.subtitle}
            </p>
          )}
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index}>
                {isSystemAdmin ? (
                  <div className="text-4xl md:text-5xl font-bold text-[#160B53] mb-2">
                    <InlineEditable
                      value={stat.number}
                      onSave={(path, value) => handleArrayUpdate('stats', index, { number: value, label: stat.label })}
                      fieldPath={`stats.${index}.number`}
                      className="text-[#160B53]"
                    />
                  </div>
                ) : (
                  <div className="text-4xl md:text-5xl font-bold text-[#160B53] mb-2">{stat.number}</div>
                )}
                {isSystemAdmin ? (
                  <div className="text-gray-600 font-medium">
                    <InlineEditable
                      value={stat.label}
                      onSave={(path, value) => handleArrayUpdate('stats', index, { number: stat.number, label: value })}
                      fieldPath={`stats.${index}.label`}
                      className="text-gray-600"
                    />
                  </div>
                ) : (
                  <div className="text-gray-600 font-medium">{stat.label}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Meet Our Founder Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {isSystemAdmin ? (
            <h2 className="font-bold text-center text-[#160B53] mb-4" style={{ fontSize: '50px' }}>
              Meet Our Founder
            </h2>
          ) : (
            <h2 className="font-bold text-center text-[#160B53] mb-4" style={{ fontSize: '50px' }}>Meet Our Founder</h2>
          )}
          <p className="text-center text-gray-600 mb-12">
            The visionary behind the integrated male grooming salon brand
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              {isSystemAdmin ? (
                <h3 className="text-3xl font-bold text-[#160B53] mb-4">
                  <InlineEditable
                    value={founderContent.name}
                    onSave={(path, value) => handleContentUpdate('founder.name', value)}
                    fieldPath="founder.name"
                    className="text-[#160B53]"
                  />
                </h3>
              ) : (
                <h3 className="text-3xl font-bold text-[#160B53] mb-4">{founderContent.name}</h3>
              )}
              {isSystemAdmin ? (
                <p className="text-lg text-gray-600 mb-4">
                  <InlineEditable
                    value={founderContent.role}
                    onSave={(path, value) => handleContentUpdate('founder.role', value)}
                    fieldPath="founder.role"
                    className="text-gray-600"
                  />
                </p>
              ) : (
                <p className="text-lg text-gray-600 mb-4">{founderContent.role}</p>
              )}

              <div className="space-y-4 text-gray-700 leading-relaxed">
                {founderContent.description.map((para, index) => (
                  isSystemAdmin ? (
                    <p key={index} className="text-justify">
                      <InlineEditable
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

              <div className="mt-8 p-4 bg-white rounded-lg border-l-4 border-[#160B53]">
                {isSystemAdmin ? (
                  <p className="text-[#160B53] font-semibold mb-2">
                    <InlineEditable
                      value={founderContent.quote.title}
                      onSave={(path, value) => handleContentUpdate('founder.quote.title', value)}
                      fieldPath="founder.quote.title"
                      className="text-[#160B53]"
                    />
                  </p>
                ) : (
                  <p className="text-[#160B53] font-semibold mb-2">{founderContent.quote.title}</p>
                )}
                {isSystemAdmin ? (
                  <p className="text-sm text-gray-600">
                    "<InlineEditable
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
              <img
                src={founderContent.image}
                alt="David Charlton, Founder and CEO"
                className="w-full max-w-md mx-auto rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Company Story Section */}
      <section className="py-16 px-6 bg-[#160B53] text-white">
        <div className="max-w-6xl mx-auto">
          {isSystemAdmin ? (
            <h2 className="text-3xl font-bold mb-8 whitespace-nowrap">
              <InlineEditable
                value={companyStoryContent.title}
                onSave={(path, value) => handleContentUpdate('companyStory.title', value)}
                fieldPath="companyStory.title"
                className="text-white"
              />
            </h2>
          ) : (
            <h2 className="text-3xl font-bold mb-8 whitespace-nowrap">
              {companyStoryContent.title}
            </h2>
          )}

          <div className="space-y-6 text-lg leading-relaxed">
            {companyStoryContent.paragraphs.slice(0, 2).map((para, index) => (
              isSystemAdmin ? (
                <p key={index} className="text-justify">
                  <InlineEditable
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
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <img
                src={ceoContent.image}
                alt="Laura Charlton, CEO and President"
                className="w-full max-w-md mx-auto rounded-lg shadow-lg"
              />
            </div>

            <div>
              {isSystemAdmin ? (
                <h3 className="text-3xl font-bold text-[#160B53] mb-4">
                  <InlineEditable
                    value={ceoContent.name}
                    onSave={(path, value) => handleContentUpdate('ceo.name', value)}
                    fieldPath="ceo.name"
                    className="text-[#160B53]"
                  />
                </h3>
              ) : (
                <h3 className="text-3xl font-bold text-[#160B53] mb-4">{ceoContent.name}</h3>
              )}
              {isSystemAdmin ? (
                <p className="text-lg text-gray-600 mb-4">
                  <InlineEditable
                    value={ceoContent.role}
                    onSave={(path, value) => handleContentUpdate('ceo.role', value)}
                    fieldPath="ceo.role"
                    className="text-gray-600"
                  />
                </p>
              ) : (
                <p className="text-lg text-gray-600 mb-4">{ceoContent.role}</p>
              )}

              <div className="space-y-4 text-gray-700 leading-relaxed">
                {ceoContent.description.map((para, index) => (
                  isSystemAdmin ? (
                    <p key={index} className="text-justify">
                      <InlineEditable
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
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          {isSystemAdmin ? (
            <h2 className="font-bold text-center text-[#160B53] mb-12" style={{ fontSize: '50px' }}>
              <InlineEditable
                value={teamContent.title}
                onSave={(path, value) => handleContentUpdate('team.title', value)}
                fieldPath="team.title"
                className="text-[#160B53]"
              />
            </h2>
          ) : (
            <h2 className="font-bold text-center text-[#160B53] mb-12" style={{ fontSize: '50px' }}>{teamContent.title}</h2>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 max-w-3xl mx-auto">
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 text-center">
                  <h3 className="text-xl font-bold text-white mb-2">{member.name}</h3>
                  <p className="text-gray-200 text-sm">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose David's Salon Section */}
      <section className="py-16 px-6 bg-[#160B53] text-white">
        <div className="max-w-6xl mx-auto">
          {isSystemAdmin ? (
            <h2 className="font-bold text-center mb-4" style={{ fontSize: '50px' }}>
              <InlineEditable
                value={whyChooseContent.title}
                onSave={(path, value) => handleContentUpdate('whyChoose.title', value)}
                fieldPath="whyChoose.title"
                className="text-white"
              />
            </h2>
          ) : (
            <h2 className="font-bold text-center mb-4" style={{ fontSize: '50px' }}>{whyChooseContent.title}</h2>
          )}
          {isSystemAdmin ? (
            <p className="text-center text-xl mb-12 text-pretty">
              <InlineEditable
                value={whyChooseContent.subtitle}
                onSave={(path, value) => handleContentUpdate('whyChoose.subtitle', value)}
                fieldPath="whyChoose.subtitle"
                multiline={true}
                className="text-white"
              />
            </p>
          ) : (
            <p className="text-center text-xl mb-12 text-pretty">
              {whyChooseContent.subtitle}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {whyChooseContent.benefits.map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center">
                    <div className="text-[#160B53]">{iconMap[benefit.icon] || <Award className="w-8 h-8" />}</div>
                  </div>
                </div>
                {isSystemAdmin ? (
                  <h3 className="text-xl font-bold mb-3">
                    <InlineEditable
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
                  <h3 className="text-xl font-bold mb-3">{benefit.title}</h3>
                )}
                {isSystemAdmin ? (
                  <p className="text-gray-200 leading-relaxed">
                    <InlineEditable
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
                  <p className="text-gray-200 leading-relaxed">{benefit.description}</p>
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
      <Footer />
    </>
  )
}

