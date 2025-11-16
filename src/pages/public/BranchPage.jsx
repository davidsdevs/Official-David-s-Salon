import { useParams, Link } from "react-router-dom"
import Button from "../../components/ui/Button"
import { Card, CardContent } from "../../components/ui/Card"
import { MapPin, Phone, Clock, Scissors, Palette, Sparkles, Crown } from "lucide-react"
import BranchNavigation from "../../components/landing/BranchNavigation"
import BranchFooter from "../../components/landing/BranchFooter"
import PromotionPopup from "../../components/landing/PromotionPopup"
import { useState, useEffect } from "react"
import { branchContentService } from "../../services/branchContentService"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../../config/firebase"

export default function BranchPage() {
  const { slug } = useParams()
  const branchName = slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  const [isVisible, setIsVisible] = useState(false)
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [branchId, setBranchId] = useState(null)

  // Find branchId from slug
  useEffect(() => {
    const findBranch = async () => {
      try {
        // Query branches by slug (assuming branches have a slug field)
        // If not, we'll use slug as contentId directly
        const branchesRef = collection(db, 'branches')
        const q = query(branchesRef, where('slug', '==', slug))
        const querySnapshot = await getDocs(q)
        
        if (!querySnapshot.empty) {
          const branchDoc = querySnapshot.docs[0]
          setBranchId(branchDoc.id)
        } else {
          // Fallback: use slug as contentId
          setBranchId(slug)
        }
      } catch (error) {
        console.error('Error finding branch:', error)
        // Fallback: use slug as contentId
        setBranchId(slug)
      }
    }
    
    findBranch()
  }, [slug])

  // Load content from Firestore
  useEffect(() => {
    if (!branchId) return

    // Subscribe to real-time updates
    const unsubscribe = branchContentService.subscribeToContent(branchId, 'branch', (result) => {
      if (result.success && result.content) {
        setContent(result.content)
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [branchId])

  // Fade in animation on component mount
  useEffect(() => {
    setIsVisible(true)
  }, [])

  const services = [
    {
      icon: <Scissors className="w-8 h-8" />,
      title: "Haircut & Blowdry",
      description: "Professional cutting and styling services",
      color: "bg-purple-100 text-purple-600",
    },
    {
      icon: <Palette className="w-8 h-8" />,
      title: "Hair Coloring",
      description: "Expert coloring, highlights, and balayage",
      color: "bg-blue-100 text-blue-600",
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: "Hair Treatment",
      description: "Premium treatments for healthy hair",
      color: "bg-pink-100 text-pink-600",
    },
    {
      icon: <Crown className="w-8 h-8" />,
      title: "Straightening & Forming",
      description: "Rebonding, keratin, and perm services",
      color: "bg-[#160B53] text-white",
    },
  ]

  const popularServices = [
    {
      name: "Cut, Shampoo and Blowdry",
      duration: "60-90 min",
      price: "₱400",
      image: "/images/gallery/services/cut-shampoo-blowdry-01.jpg",
    },
    {
      name: "Balayage",
      duration: "4-6 hours",
      price: "₱6,000",
      image: "/images/gallery/services/balayage-01.jpg",
    },
    {
      name: "Keratin Treatment",
      duration: "3-4 hours",
      price: "₱2,500-4,500",
      image: "/images/gallery/services/keratin-treatment-01.jpg",
    },
  ]

  const stylists = [
    {
      name: "Maria Santos",
      specialty: "Color Specialist",
      experience: "8 years",
      rating: 4.9,
      image: "/professional-female-hairstylist.png",
    },
    {
      name: "John Cruz",
      specialty: "Cut & Style",
      experience: "6 years",
      rating: 4.8,
      image: "/male-hairstylist-portrait.png",
    },
    {
      name: "Anna Reyes",
      specialty: "Treatment Expert",
      experience: "10 years",
      rating: 4.9,
      image: "/professional-female-hair-treatment-specialist.png",
    },
  ]

  // Use content from Firestore or fallback
  const heroContent = content?.hero || {
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

  const testimonialsContent = content?.testimonials || {
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

  const visitBranchContent = content?.visitBranch || {
    title: "Visit Branch",
    subtitle: "Find us and get in touch",
    location: "Ayala Center, Makati",
    phone: "+63 930 222 9699",
    hours: "Mon-Sun: 10:00 AM - 9:00 PM"
  }

  const contactInfoContent = content?.contactInfo || {
    title: "Visit Us",
    subtitle: "Get in touch with our team",
    address: "Ground Floor Harbor Point Subic, Subic, Philippines",
    phone: "0992 586 5758",
    hours: "Monday - Sunday: 10:00 AM - 9:00 PM"
  }

  const testimonials = testimonialsContent.items || []

  return (
    <div className="min-h-screen bg-white">
      {/* Promotion Popup */}
      <PromotionPopup />
      
      {/* Branch Navigation */}
      <BranchNavigation branchName={`${branchName} Branch`} />
      
      {/* Hero Section */}
      <section
        className="relative h-[800px] flex items-center justify-center text-center text-white mt-[122px]"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, ${heroContent.overlayOpacity || 0.6}), rgba(22, 11, 83, 0.7)), url('${heroContent.backgroundImage}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className={`max-w-4xl px-2 sm:px-4 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h1 className="font-bold mb-6 text-balance animate-pulse-slow" style={{ fontSize: '50px' }}>{heroContent.title}</h1>
          <p className="text-xl mb-8 text-pretty leading-relaxed">
            {heroContent.subtitle}
          </p>
          <Link to="/">
            <Button 
              size="md" 
              variant="ghost"
              className="bg-white text-[#160B53] hover:bg-gray-100 font-semibold px-6 py-2"
            >
              {heroContent.buttonText}
            </Button>
          </Link>
          
          {/* Statistics Cards */}
          {heroContent.statistics && (
            <div className="max-w-4xl mx-auto mt-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <Card className="p-6 border-0 bg-white" style={{ boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)' }}>
                  <CardContent className="p-0">
                    <div className="text-4xl font-bold text-[#160B53] mb-2">{heroContent.statistics.branches}</div>
                    <div className="text-gray-600">Branches</div>
                  </CardContent>
                </Card>
                <Card className="p-6 border-0 bg-white" style={{ boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)' }}>
                  <CardContent className="p-0">
                    <div className="text-4xl font-bold text-[#160B53] mb-2">{heroContent.statistics.clients}</div>
                    <div className="text-gray-600">Happy Clients</div>
                  </CardContent>
                </Card>
                <Card className="p-6 border-0 bg-white" style={{ boxShadow: '0 4px 4px 0 rgba(0, 0, 0, 0.25)' }}>
                  <CardContent className="p-0">
                    <div className="text-4xl font-bold text-[#160B53] mb-2">{heroContent.statistics.years}</div>
                    <div className="text-gray-600">Years Experience</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Explore Our Services Section */}
      <section id="services" className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-bold text-center text-[#160B53] mb-4" style={{ fontSize: '50px' }}>Explore Our Services</h2>
          <p className="text-center text-gray-600 mb-12">Discover what makes {branchName} branch special</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service, index) => (
              <Card key={index} className="p-6 text-center border-0 transition-shadow" style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}>
                <CardContent className="p-0">
                  <div
                    className={`w-16 h-16 rounded-full ${service.color} flex items-center justify-center mx-auto mb-4`}
                  >
                    {service.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-[#160B53] mb-2">{service.title}</h3>
                  <p className="text-gray-600 text-sm mb-4">{service.description}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#160B53] text-[#160B53] hover:bg-[#160B53] hover:text-white bg-transparent"
                  >
                    View More
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Services Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-bold text-center text-[#160B53] mb-4" style={{ fontSize: '50px' }}>Popular Services</h2>
          <p className="text-center text-gray-600 mb-12">Our most requested treatments</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {popularServices.map((service, index) => (
              <Card key={index} className="overflow-hidden border-0 transition-shadow p-0" style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}>
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
                  <h3 className="text-xl font-bold text-[#160B53] mb-2">{service.name}</h3>
                  <div className="flex items-center text-gray-600 mb-2">
                    <Clock className="w-4 h-4 mr-2" />
                    <span className="text-sm">{service.duration}</span>
                  </div>
                  <div className="flex items-center text-gray-600 mb-4">
                    <span className="text-lg font-semibold text-[#160B53]">{service.price}</span>
                  </div>
                  <Button variant="ghost" size="md" className="w-full bg-[#160B53] hover:bg-[#160B53]/90 text-white py-2">View Service Details</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Meet Our Top Stylists Section */}
      <section id="stylists" className="py-16 px-6 bg-[#160B53] text-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-bold text-center mb-4" style={{ fontSize: '50px' }}>Meet Our Top Stylists</h2>
          <p className="text-center mb-12 opacity-90">Expert professionals ready to transform your look</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stylists.map((stylist, index) => (
              <Card key={index} className="bg-white text-gray-900 overflow-hidden border-0 p-0" style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}>
                <div className="h-64 w-full bg-gray-200 overflow-hidden">
                  <img
                    src={stylist.image || "/placeholder.svg"}
                    alt={stylist.name}
                    className="w-full h-full object-cover"
                    style={{ 
                      height: '256px',
                      width: '100%',
                      maxHeight: '256px',
                      maxWidth: '100%'
                    }}
                  />
                </div>
                <div className="p-6 text-center">
                  <h3 className="text-xl font-bold text-[#160B53] mb-1">{stylist.name}</h3>
                  <p className="text-gray-600 text-sm mb-2">{stylist.specialty}</p>
                  <p className="text-gray-500 text-xs mb-4">{stylist.experience} experience</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#160B53] text-[#160B53] hover:bg-[#160B53] hover:text-white bg-transparent"
                  >
                    View Service Profile
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link to={`/branch/${slug}/stylists`}>
              <Button
                variant="outline"
                size="md"
                className="border-white text-white hover:bg-white hover:text-[#160B53] bg-transparent px-6 py-2"
              >
                Meet All Stylists
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Our Work Section */}
      <section id="gallery" className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-bold text-center text-[#160B53] mb-4" style={{ fontSize: '50px' }}>Our Work</h2>
          <p className="text-center text-gray-600 mb-12">See our work and salon atmosphere</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { id: 1, src: "/images/gallery/hair-transformations/after.jpg", alt: "Hair Transformation" },
              { id: 2, src: "/images/gallery/hair-transformations/after01.jpg", alt: "Hair Makeover" },
              { id: 3, src: "/images/gallery/color-work/haircolor.jpg", alt: "Hair Coloring Work" },
              { id: 4, src: "/images/gallery/color-work/haircolor_hairtreatment.jpg", alt: "Hair Treatment & Color" },
              { id: 5, src: "/images/gallery/styling/styling01.jpg", alt: "Professional Styling" },
              { id: 6, src: "/images/gallery/styling/styling02.jpg", alt: "Hair Styling Work" }
            ].map((item) => (
              <div key={item.id} className="h-64 w-full bg-gray-200 rounded-lg overflow-hidden">
                <img
                  src={item.src}
                  alt={item.alt}
                  className="w-full h-full object-cover hover:scale-105 transition-transform"
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
          
          <div className="text-center mt-8">
            <Link to={`/branch/${slug}/gallery`}>
              <Button variant="ghost" size="md" className="bg-[#160B53] hover:bg-[#160B53]/90 text-white px-6 py-2">View Full Gallery</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-bold text-center text-[#160B53] mb-4" style={{ fontSize: '50px' }}>{testimonialsContent.title}</h2>
          <p className="text-center text-gray-600 mb-12">{testimonialsContent.subtitle}</p>

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
                  <div className="text-6xl text-[#160B53] mb-4">"</div>
                  <p className="text-gray-700 mb-6 leading-relaxed">
                    {testimonial.text}
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[#160B53]">
                        {testimonial.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {testimonial.branch}
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
      <section className="py-16 px-6 bg-[#160B53] text-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-bold text-center mb-4" style={{ fontSize: '50px' }}>{visitBranchContent.title}</h2>
          <p className="text-center mb-12 opacity-90">{visitBranchContent.subtitle}</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-white text-gray-900 p-6 text-center">
              <CardContent className="p-0">
                <MapPin className="w-8 h-8 text-[#160B53] mx-auto mb-4" />
                <h3 className="font-semibold text-[#160B53] mb-2">Location</h3>
                <p className="text-sm text-gray-600">{visitBranchContent.location}</p>
              </CardContent>
            </Card>

            <Card className="bg-white text-gray-900 p-6 text-center">
              <CardContent className="p-0">
                <Phone className="w-8 h-8 text-[#160B53] mx-auto mb-4" />
                <h3 className="font-semibold text-[#160B53] mb-2">Contact</h3>
                <p className="text-sm text-gray-600">{visitBranchContent.phone}</p>
              </CardContent>
            </Card>

            <Card className="bg-white text-gray-900 p-6 text-center">
              <CardContent className="p-0">
                <Clock className="w-8 h-8 text-[#160B53] mx-auto mb-4" />
                <h3 className="font-semibold text-[#160B53] mb-2">Hours</h3>
                <p className="text-sm text-gray-600">{visitBranchContent.hours}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Information Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-bold text-center text-[#160B53] mb-4" style={{ fontSize: '50px' }}>{contactInfoContent.title}</h2>
          <p className="text-center text-gray-600 mb-12">{contactInfoContent.subtitle}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Contact Details */}
            <Card className="p-8 border-0" style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#160B53] rounded-full flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#160B53] mb-1">Address</h3>
                    <p className="text-gray-600">{contactInfoContent.address}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#160B53] rounded-full flex items-center justify-center">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#160B53] mb-1">Phone</h3>
                    <p className="text-gray-600">{contactInfoContent.phone}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#160B53] rounded-full flex items-center justify-center">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#160B53] mb-1">Hours</h3>
                    <p className="text-gray-600">{contactInfoContent.hours}</p>
                  </div>
                </div>
              </div>
            </Card>
            
            {/* Call to Action */}
            <Card className="p-8 border-0 bg-[#160B53] text-white" style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}>
              <div className="text-center">
                <h3 className="text-2xl font-bold mb-4">Ready to Book?</h3>
                <p className="text-lg mb-6 opacity-90">Call us now to schedule your appointment</p>
                <Button 
                  className="bg-white text-[#160B53] hover:bg-gray-100 font-bold text-lg px-8 py-3"
                  onClick={() => window.open(`tel:${contactInfoContent.phone.replace(/\s/g, '')}`)}
                >
                  Call {contactInfoContent.phone}
                </Button>
                <p className="text-sm mt-4 opacity-75">Or visit us at our location</p>
              </div>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <BranchFooter 
        branchName={`${branchName} Branch`}
        branchPhone="0992 586 5758"
        branchAddress="Ground Floor Harbor Point Subic, Subic, Philippines"
        branchSlug={slug}
      />
    </div>
  )
}

