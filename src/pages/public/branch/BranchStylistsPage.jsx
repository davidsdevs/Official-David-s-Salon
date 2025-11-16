import Button from "../../../components/ui/Button"
import { Card } from "../../../components/ui/Card"
import { CTAButton, SecondaryButton } from "../../../components/ui/ConsistentButton"
import { Filter } from "lucide-react"
import { useParams, Link } from "react-router-dom"
import BranchNavigation from "../../../components/landing/BranchNavigation"
import BranchFooter from "../../../components/landing/BranchFooter"
import { useState, useEffect } from "react"

export default function BranchStylistsPage() {
  const { slug } = useParams()
  const branchName = slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [isVisible, setIsVisible] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const stylistsPerPage = 3

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const stylists = [
    {
      id: 1,
      name: "Maria Santos",
      specialty: "Color Specialist",
      experience: "8 years experience",
      rating: 4.9,
      reviews: 156,
      specialties: ["Balayage", "Color Correction"],
      description: "Expert in balayage, highlights, and color corrections with international training",
    },
    {
      id: 2,
      name: "John Cruz",
      specialty: "Cut & Style Expert",
      experience: "6 years experience",
      rating: 4.8,
      reviews: 203,
      specialties: ["Precision Cuts", "Color Correction"],
      description: "Master of precision cutting and contemporary styling with modern techniques",
    },
    {
      id: 3,
      name: "Anna Reyes",
      specialty: "Keratin Expert",
      experience: "10 years experience",
      rating: 4.8,
      reviews: 189,
      specialties: ["Keratin Treatment", "Color Correction"],
      description: "Senior treatment specialist with expertise in hair restoration and keratin treatments",
    }
  ]

  const categories = ["All", "Color Specialist", "Cut & Style Expert", "Keratin Expert"]

  const filteredStylists = stylists.filter(stylist => {
    return selectedCategory === "All" || stylist.specialty === selectedCategory
  })

  // Pagination logic
  const totalPages = Math.ceil(filteredStylists.length / stylistsPerPage)
  const startIndex = (currentPage - 1) * stylistsPerPage
  const endIndex = startIndex + stylistsPerPage
  const currentStylists = filteredStylists.slice(startIndex, endIndex)

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      {/* Branch Navigation */}
      <BranchNavigation branchName={`${branchName} Branch`} />
      
      {/* Header Section */}
      <section className="py-12 px-6 bg-gray-50 mt-[122px]">
        <div className={`max-w-6xl mx-auto text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h1 className="text-5xl font-poppins font-bold text-[#160B53] mb-4">Stylists</h1>
          <p className="text-xl text-gray-600 mb-6">Meet our team of expert stylists ready to transform your look</p>
          
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

      {/* Stylists Grid */}
      <section className="py-8 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {currentStylists.map((stylist, index) => (
              <Card 
                key={stylist.id}
                className="overflow-hidden border-0 p-0"
                style={{ boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)' }}
              >
                {/* Stylist Image */}
                <div className="relative h-64 bg-gray-100 overflow-hidden">
                  <img
                    src={stylist.image}
                    alt={stylist.name}
                    className="w-full h-full object-cover"
                  />
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
                  
                  <p className="text-[#160B53] font-poppins font-medium text-sm mb-1">{stylist.specialty}</p>
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
                        View Profile
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
              <h3 className="text-xl font-poppins font-semibold text-gray-600 mb-2">No stylists found</h3>
              <p className="text-gray-500">Try selecting a different category</p>
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

      {/* Call to Action Section */}
      <section className="py-16 px-6 bg-[#160B53] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-poppins font-bold mb-4" style={{ fontSize: '50px' }}>Ready to Book with Our Experts?</h2>
          <p className="text-xl mb-8 opacity-90">Choose your preferred stylist and schedule your appointment today</p>
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

