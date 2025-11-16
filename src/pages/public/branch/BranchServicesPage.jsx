import Button from "../../../components/ui/Button"
import { Card } from "../../../components/ui/Card"
import { CTAButton, SecondaryButton } from "../../../components/ui/ConsistentButton"
import { Clock, DollarSign, Filter } from "lucide-react"
import { useParams, Link } from "react-router-dom"
import { useState, useEffect } from "react"
import BranchNavigation from "../../../components/landing/BranchNavigation"
import BranchFooter from "../../../components/landing/BranchFooter"

export default function BranchServicesPage() {
  const { slug } = useParams()
  const branchName = slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [isVisible, setIsVisible] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const servicesPerPage = 6

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const services = [
    // HAIRCUT AND BLOWDRY
    {
      id: 1,
      name: "Cut, Shampoo and Blowdry",
      category: "Haircut & Blowdry",
      duration: "60-90 min",
      price: "₱400",
      tag: "Popular",
      tagColor: "bg-gray-100 text-gray-700",
      description: "Complete hair service with cut, shampoo and professional blowdry"
    },
    {
      id: 2,
      name: "Kid's Haircut",
      category: "Haircut & Blowdry",
      duration: "30-45 min",
      price: "₱500",
      tag: "Family",
      tagColor: "bg-blue-100 text-blue-700",
      description: "Specialized haircut service for children"
    },
    {
      id: 3,
      name: "Shampoo and Blowdry",
      category: "Haircut & Blowdry",
      duration: "45-60 min",
      price: "₱300",
      tag: "Quick",
      tagColor: "bg-green-100 text-green-700",
      description: "Refreshing shampoo and professional blowdry"
    },
    {
      id: 4,
      name: "Shampoo and Iron",
      category: "Haircut & Blowdry",
      duration: "60-90 min",
      price: "₱1,000",
      tag: "Premium",
      tagColor: "bg-[#160B53] text-white",
      description: "Shampoo with professional flat iron styling"
    },

    // HAIR COLORING
    {
      id: 5,
      name: "Tint",
      category: "Hair Coloring",
      duration: "2-3 hours",
      price: "₱2,000",
      tag: "Popular",
      tagColor: "bg-gray-100 text-gray-700",
      description: "Professional hair tinting service"
    },
    {
      id: 6,
      name: "Tint (Ammonia Free)",
      category: "Hair Coloring",
      duration: "2-3 hours",
      price: "₱2,600",
      tag: "Gentle",
      tagColor: "bg-purple-100 text-purple-700",
      description: "Gentle ammonia-free hair tinting for sensitive hair"
    },
    {
      id: 7,
      name: "Highlights Cap",
      category: "Hair Coloring",
      duration: "3-4 hours",
      price: "₱2,600",
      tag: "Classic",
      tagColor: "bg-yellow-100 text-yellow-700",
      description: "Traditional cap highlighting technique"
    },
    {
      id: 8,
      name: "Highlights Foil",
      category: "Hair Coloring",
      duration: "3-4 hours",
      price: "₱2,600",
      tag: "Modern",
      tagColor: "bg-pink-100 text-pink-700",
      description: "Modern foil highlighting for precise color placement"
    },
    {
      id: 9,
      name: "Color Conditioning",
      category: "Hair Coloring",
      duration: "2-3 hours",
      price: "₱2,200",
      tag: "Nourishing",
      tagColor: "bg-orange-100 text-orange-700",
      description: "Color service with deep conditioning treatment"
    },
    {
      id: 10,
      name: "Balayage",
      category: "Hair Coloring",
      duration: "4-6 hours",
      price: "₱6,000",
      tag: "Premium",
      tagColor: "bg-[#160B53] text-white",
      description: "Hand-painted balayage technique for natural-looking highlights"
    },

    // HAIR TREATMENT
    {
      id: 11,
      name: "Protein Treatment",
      category: "Hair Treatment",
      duration: "60-90 min",
      price: "₱800",
      tag: "Repair",
      tagColor: "bg-red-100 text-red-700",
      description: "Strengthening protein treatment for damaged hair"
    },
    {
      id: 12,
      name: "Moroccan Treatment",
      category: "Hair Treatment",
      duration: "90-120 min",
      price: "₱1,200",
      tag: "Luxury",
      tagColor: "bg-amber-100 text-amber-700",
      description: "Premium Moroccan oil treatment for silky smooth hair"
    },
    {
      id: 13,
      name: "Plarmia Full Head",
      category: "Hair Treatment",
      duration: "90-120 min",
      price: "₱1,800",
      tag: "Professional",
      tagColor: "bg-indigo-100 text-indigo-700",
      description: "Professional Plarmia treatment for full head coverage"
    },
    {
      id: 14,
      name: "Milbon",
      category: "Hair Treatment",
      duration: "90-120 min",
      price: "₱1,800",
      tag: "Japanese",
      tagColor: "bg-teal-100 text-teal-700",
      description: "Japanese Milbon treatment for hair restoration"
    },
    {
      id: 15,
      name: "OI Luster",
      category: "Hair Treatment",
      duration: "90-120 min",
      price: "₱1,800",
      tag: "Shine",
      tagColor: "bg-cyan-100 text-cyan-700",
      description: "OI Luster treatment for enhanced hair shine and luster"
    },
    {
      id: 16,
      name: "Foliage Booster",
      category: "Hair Treatment",
      duration: "120-150 min",
      price: "₱2,400",
      tag: "Advanced",
      tagColor: "bg-emerald-100 text-emerald-700",
      description: "Advanced Foliage Booster treatment for hair health"
    },
    {
      id: 17,
      name: "D2 Treatment",
      category: "Hair Treatment",
      duration: "120-150 min",
      price: "₱2,400",
      tag: "Repair",
      tagColor: "bg-red-100 text-red-700",
      description: "D2 treatment for intensive hair repair and restoration"
    },
    {
      id: 18,
      name: "Tailoring",
      category: "Hair Treatment",
      duration: "120-150 min",
      price: "₱2,500",
      tag: "Custom",
      tagColor: "bg-violet-100 text-violet-700",
      description: "Customized tailoring treatment for individual hair needs"
    },

    // STRAIGHTENING & FORMING
    {
      id: 19,
      name: "Perm",
      category: "Straightening & Forming",
      duration: "3-4 hours",
      price: "₱3,000",
      tag: "Classic",
      tagColor: "bg-yellow-100 text-yellow-700",
      description: "Traditional perm for curly hair styling"
    },
    {
      id: 20,
      name: "Digital Perm",
      category: "Straightening & Forming",
      duration: "4-6 hours",
      price: "₱6,000",
      tag: "Premium",
      tagColor: "bg-[#160B53] text-white",
      description: "Modern digital perm technology for natural-looking curls"
    },
    {
      id: 21,
      name: "Relaxing",
      category: "Straightening & Forming",
      duration: "3-4 hours",
      price: "₱3,800",
      tag: "Smooth",
      tagColor: "bg-slate-100 text-slate-700",
      description: "Hair relaxing treatment for straight, smooth hair"
    },
    {
      id: 22,
      name: "Rebonding",
      category: "Straightening & Forming",
      duration: "4-6 hours",
      price: "₱6,000",
      tag: "Premium",
      tagColor: "bg-[#160B53] text-white",
      description: "Professional rebonding for permanently straight hair"
    },
    {
      id: 23,
      name: "Foliage",
      category: "Straightening & Forming",
      duration: "3-4 hours",
      price: "₱3,000",
      tag: "Modern",
      tagColor: "bg-pink-100 text-pink-700",
      description: "Modern Foliage straightening treatment"
    },
    {
      id: 24,
      name: "Keratherapy",
      category: "Straightening & Forming",
      duration: "3-4 hours",
      price: "₱5,000",
      tag: "Advanced",
      tagColor: "bg-emerald-100 text-emerald-700",
      description: "Advanced Keratherapy treatment for hair straightening"
    },

    // HAIR & MAKE UP
    {
      id: 25,
      name: "Hair & Make Up",
      category: "Hair & Make Up",
      duration: "2-3 hours",
      price: "₱1,700",
      tag: "Complete",
      tagColor: "bg-rose-100 text-rose-700",
      description: "Complete hair styling and professional make-up service"
    },
    {
      id: 26,
      name: "Hair Setting",
      category: "Hair & Make Up",
      duration: "60-90 min",
      price: "₱850-1,500",
      tag: "Styling",
      tagColor: "bg-fuchsia-100 text-fuchsia-700",
      description: "Professional hair setting and styling service"
    },

    // NAIL CARE / WAXING / THREADING
    {
      id: 27,
      name: "Manicure",
      category: "Nail Care",
      duration: "45-60 min",
      price: "₱300",
      tag: "Basic",
      tagColor: "bg-gray-100 text-gray-700",
      description: "Professional manicure service"
    },
    {
      id: 28,
      name: "Pedicure",
      category: "Nail Care",
      duration: "60-90 min",
      price: "₱350",
      tag: "Relaxing",
      tagColor: "bg-blue-100 text-blue-700",
      description: "Relaxing pedicure service"
    },
    {
      id: 29,
      name: "Nail Extension",
      category: "Nail Care",
      duration: "2-3 hours",
      price: "₱1,500",
      tag: "Luxury",
      tagColor: "bg-amber-100 text-amber-700",
      description: "Professional nail extension service"
    },
    {
      id: 30,
      name: "Footspa",
      category: "Nail Care",
      duration: "60-90 min",
      price: "₱450",
      tag: "Spa",
      tagColor: "bg-green-100 text-green-700",
      description: "Relaxing foot spa treatment"
    },
    {
      id: 31,
      name: "Gel FX",
      category: "Nail Care",
      duration: "90-120 min",
      price: "₱600",
      tag: "Modern",
      tagColor: "bg-pink-100 text-pink-700",
      description: "Modern gel nail art and design"
    },
    {
      id: 32,
      name: "Change Polish",
      category: "Nail Care",
      duration: "30-45 min",
      price: "₱200",
      tag: "Quick",
      tagColor: "bg-green-100 text-green-700",
      description: "Quick nail polish change service"
    },
    {
      id: 33,
      name: "Threading",
      category: "Waxing & Threading",
      duration: "15-30 min",
      price: "₱300",
      tag: "Precise",
      tagColor: "bg-purple-100 text-purple-700",
      description: "Precise threading for facial hair removal"
    },
    {
      id: 34,
      name: "Upperlip/Lowerlip",
      category: "Waxing & Threading",
      duration: "15-30 min",
      price: "₱350",
      tag: "Facial",
      tagColor: "bg-rose-100 text-rose-700",
      description: "Lip area hair removal service"
    },
    {
      id: 35,
      name: "Eyebrow Shave",
      category: "Waxing & Threading",
      duration: "15-30 min",
      price: "₱250",
      tag: "Brows",
      tagColor: "bg-indigo-100 text-indigo-700",
      description: "Professional eyebrow shaping and shaving"
    },
    {
      id: 36,
      name: "Underarm Waxing",
      category: "Waxing & Threading",
      duration: "30-45 min",
      price: "₱400",
      tag: "Smooth",
      tagColor: "bg-slate-100 text-slate-700",
      description: "Underarm hair waxing service"
    },
    {
      id: 37,
      name: "Half Leg Waxing",
      category: "Waxing & Threading",
      duration: "45-60 min",
      price: "₱600",
      tag: "Legs",
      tagColor: "bg-cyan-100 text-cyan-700",
      description: "Half leg hair waxing service"
    },
    {
      id: 38,
      name: "Full Leg Waxing",
      category: "Waxing & Threading",
      duration: "60-90 min",
      price: "₱850",
      tag: "Complete",
      tagColor: "bg-teal-100 text-teal-700",
      description: "Complete full leg hair waxing service"
    },
    {
      id: 39,
      name: "Foot Massage",
      category: "Massage",
      duration: "30-45 min",
      price: "₱400",
      tag: "Relaxing",
      tagColor: "bg-blue-100 text-blue-700",
      description: "Relaxing foot massage service"
    },
    {
      id: 40,
      name: "Head Massage",
      category: "Massage",
      duration: "30-45 min",
      price: "₱400",
      tag: "Relaxing",
      tagColor: "bg-blue-100 text-blue-700",
      description: "Relaxing head and scalp massage service"
    }
  ]

  const categories = ["All", "Haircut & Blowdry", "Hair Coloring", "Hair Treatment", "Straightening & Forming", "Hair & Make Up", "Nail Care", "Waxing & Threading", "Massage"]

  const filteredServices = services.filter(service => {
    return selectedCategory === "All" || service.category === selectedCategory
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
    <>
      {/* Branch Navigation */}
      <BranchNavigation branchName={`${branchName} Branch`} />
      
      {/* Header Section */}
      <section className="py-12 px-6 bg-gray-50 mt-[122px]">
        <div className={`max-w-6xl mx-auto text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h1 className="text-5xl font-poppins font-bold text-[#160B53] mb-4">Services</h1>
          <p className="text-xl text-gray-600 mb-6">Professional hair and beauty services tailored to your needs</p>
          
          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-poppins font-medium transition-all duration-300 ${
                  selectedCategory === category
                    ? 'bg-[#160B53] text-white scale-105'
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
            {currentServices.map((service, index) => (
              <Card 
                key={service.id}
                className="overflow-hidden border-0 p-0"
                style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}
              >
                {/* Service Image */}
                <div className="relative h-48 bg-gray-100 overflow-hidden">
                  <img
                    src={service.image}
                    alt={service.name}
                    className="w-full h-full object-cover"
                  />
                  {/* Service Tag */}
                  {service.tag && (
                    <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-sm font-poppins font-medium ${service.tagColor}`}>
                      {service.tag}
                    </div>
                  )}
                  {/* Category Badge */}
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-poppins font-medium text-gray-700">
                    {service.category}
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-poppins font-bold mb-2 text-gray-900">
                    {service.name}
                  </h3>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{service.description}</p>
                  
                  {/* Service Details */}
                  <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{service.duration}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="font-poppins font-semibold text-[#160B53]">{service.price}</span>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2">
                    <Link to={`/branch/${slug}/services/${service.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        View Service Details
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      className="w-full bg-[#160B53] hover:bg-[#160B53]/90 text-white"
                    >
                      Book This Service
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center mt-12 space-x-2">
              <Button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                variant="outline"
                className="px-4 py-2"
              >
                Previous
              </Button>
              
              <div className="flex space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    variant={currentPage === page ? "default" : "outline"}
                    className={`px-3 py-2 ${
                      currentPage === page 
                        ? 'bg-[#160B53] text-white hover:bg-[#160B53]/90' 
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </Button>
                ))}
              </div>
              
              <Button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                variant="outline"
                className="px-4 py-2"
              >
                Next
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
      <section className="py-16 px-6 bg-[#160B53] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-poppins font-bold mb-4" style={{ fontSize: '50px' }}>Ready to Transform Your Look?</h2>
          <p className="text-xl mb-8 opacity-90">Book your appointment today and experience our professional services</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <CTAButton className="bg-white text-[#160B53] hover:bg-gray-100">
              Book Appointment
            </CTAButton>
            <SecondaryButton className="border-white text-white hover:bg-white hover:text-[#160B53]">
              Call Us Now
            </SecondaryButton>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <BranchFooter 
        branchName={`${branchName} Branch`}
        branchPhone="+63 930 222 9659"
        branchAddress={`${branchName}, Philippines`}
        branchSlug={slug}
      />
    </>
  )
}

