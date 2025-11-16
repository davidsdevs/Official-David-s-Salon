import Button from "../../../components/ui/Button"
import { Card } from "../../../components/ui/Card"
import { CTAButton, SecondaryButton } from "../../../components/ui/ConsistentButton"
import { Filter, X, Calendar, User, Tag } from "lucide-react"
import { useParams } from "react-router-dom"
import BranchNavigation from "../../../components/landing/BranchNavigation"
import BranchFooter from "../../../components/landing/BranchFooter"
import { useState, useEffect } from "react"

export default function BranchGalleryPage() {
  const { slug } = useParams()
  const branchName = slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
  
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [isVisible, setIsVisible] = useState(false)
  const [hoveredImage, setHoveredImage] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedImage, setSelectedImage] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const imagesPerPage = 8

  useEffect(() => {
    setIsVisible(true)
  }, [])

  const galleryImages = [
    {
      id: 1,
      category: "Hair Transformation",
      title: "Before & After Transformation",
      description: "Stunning hair transformation showing dramatic before and after results",
      stylist: "Maria Santos",
      beforeImage: "/images/gallery/hair-transformations/before.jpg",
      afterImage: "/images/gallery/hair-transformations/after.jpg",
      isBeforeAfter: true,
      tag: "Hair Transformation"
    },
    {
      id: 2,
      category: "Hair Transformation",
      title: "Complete Hair Makeover",
      description: "Another amazing transformation showcasing our expert styling skills",
      stylist: "John Cruz",
      beforeImage: "/images/gallery/hair-transformations/before01.jpg",
      afterImage: "/images/gallery/hair-transformations/after01.jpg",
      isBeforeAfter: true,
      tag: "Hair Transformation"
    },
    {
      id: 3,
      category: "Color Work",
      title: "Hair Coloring Excellence",
      description: "Expert hair coloring work with vibrant and natural-looking results",
      stylist: "Maria Santos",
      image: "/images/gallery/color-work/haircolor.jpg",
      isBeforeAfter: false,
      tag: "Color Work"
    },
    {
      id: 4,
      category: "Hair Treatment",
      title: "Hair Treatment & Color",
      description: "Combined hair treatment and coloring for healthy, beautiful hair",
      stylist: "Anna Reyes",
      image: "/images/gallery/color-work/haircolor_hairtreatment.jpg",
      isBeforeAfter: false,
      tag: "Hair Treatment"
    },
    {
      id: 5,
      category: "Styling",
      title: "Professional Hair Styling",
      description: "Expert hair styling and cutting techniques for modern looks",
      stylist: "Sarah Johnson",
      image: "/images/gallery/styling/styling01.jpg",
      isBeforeAfter: false,
      tag: "Styling"
    },
    {
      id: 6,
      category: "Styling",
      title: "Creative Hair Design",
      description: "Innovative hair styling showcasing artistic creativity and skill",
      stylist: "Michael Chen",
      image: "/images/gallery/styling/styling02.jpg",
      isBeforeAfter: false,
      tag: "Styling"
    },
    {
      id: 7,
      category: "Styling",
      title: "Elegant Hair Styling",
      description: "Sophisticated hair styling perfect for special occasions",
      stylist: "Lisa Rodriguez",
      image: "/images/gallery/styling/styling03.jpg",
      isBeforeAfter: false,
      tag: "Styling"
    }
  ]

  const categories = ["All", "Hair Transformation", "Color Work", "Hair Treatment", "Styling"]

  const filteredImages = galleryImages.filter(image => {
    if (selectedCategory === "All") return true
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
    <>
      {/* Branch Navigation */}
      <BranchNavigation branchName={`${branchName} Branch`} />
      
      {/* Header Section */}
      <section className="py-12 px-6 bg-gray-50 mt-[122px]">
        <div className={`max-w-6xl mx-auto text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h1 className="text-5xl font-poppins font-bold text-[#160B53] mb-4">Gallery</h1>
          <p className="text-xl text-gray-600 mb-6">Meet our team of expert stylists ready to transform your look</p>
          
          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryChange(category)}
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

      {/* Gallery Grid */}
      <section className="py-8 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
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
                    src={image.isBeforeAfter ? image.afterImage : image.image}
                    alt={image.title}
                    className={`w-full h-full object-cover transition-transform duration-300 ${
                      hoveredImage === image.id ? 'scale-110' : 'scale-100'
                    }`}
                  />
                  {/* Category Tag */}
                  <div className="absolute top-3 left-3 bg-[#160B53] text-white px-3 py-1 rounded-full text-sm font-poppins font-medium">
                    {image.tag}
                  </div>
                  {/* Before/After Indicator */}
                  {image.isBeforeAfter && (
                    <div className="absolute top-3 right-3 bg-gradient-to-r from-red-500 to-green-500 text-white px-3 py-1 rounded-full text-sm font-poppins font-medium">
                      Before & After
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className={`font-poppins font-bold mb-1 transition-colors duration-300 ${
                    hoveredImage === image.id ? 'text-[#160B53]' : 'text-gray-900'
                  }`}>
                    {image.title}
                  </h3>
                  
                  <p className="text-gray-600 text-sm mb-2">{image.description}</p>
                  
                  {image.stylist && (
                    <p className="text-[#160B53] font-poppins font-medium text-sm">
                      by {image.stylist}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Empty State */}
          {currentImages.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📸</div>
              <h3 className="text-xl font-poppins font-semibold text-gray-600 mb-2">No images found</h3>
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
          <h2 className="font-poppins font-bold mb-4" style={{ fontSize: '50px' }}>Inspired by Our Work?</h2>
          <p className="text-xl mb-8 opacity-90">Book your appointment today and let us create your perfect look</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <CTAButton className="bg-white text-[#160B53] hover:bg-gray-100">
              Book Appointment
            </CTAButton>
            <SecondaryButton className="border-white text-white hover:bg-white hover:text-[#160B53]">
              View Services
            </SecondaryButton>
          </div>
        </div>
      </section>

      {/* Gallery Detail Modal */}
      {isModalOpen && selectedImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#D4D4D4' }}>
              <h2 className="text-2xl font-poppins font-bold text-[#160B53]">{selectedImage.title}</h2>
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
                {selectedImage.isBeforeAfter ? (
                  <div className="grid grid-cols-2 gap-4">
                    {/* Before Image */}
                    <div className="relative">
                      <img
                        src={selectedImage.beforeImage}
                        alt={`${selectedImage.title} - Before`}
                        className="w-full h-96 object-cover rounded-lg"
                      />
                      <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-poppins font-medium">
                        BEFORE
                      </div>
                    </div>
                    {/* After Image */}
                    <div className="relative">
                      <img
                        src={selectedImage.afterImage}
                        alt={`${selectedImage.title} - After`}
                        className="w-full h-96 object-cover rounded-lg"
                      />
                      <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-poppins font-medium">
                        AFTER
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <img
                      src={selectedImage.image}
                      alt={selectedImage.title}
                      className="w-full h-96 object-cover rounded-lg"
                    />
                    <div className="absolute top-4 left-4 bg-[#160B53] text-white px-3 py-1 rounded-full text-sm font-poppins font-medium">
                      {selectedImage.tag}
                    </div>
                  </div>
                )}
              </div>

                {/* Details */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-poppins font-bold text-gray-900 mb-2">Description</h3>
                    <p className="text-gray-600 leading-relaxed">{selectedImage.description}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#160B53]/10 rounded-full flex items-center justify-center">
                        <Tag className="w-5 h-5 text-[#160B53]" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Category</p>
                        <p className="font-poppins font-medium text-gray-900">{selectedImage.category}</p>
                      </div>
                    </div>

                    {selectedImage.stylist && (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#160B53]/10 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-[#160B53]" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Stylist</p>
                          <p className="font-poppins font-medium text-gray-900">{selectedImage.stylist}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#160B53]/10 rounded-full flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-[#160B53]" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Branch</p>
                        <p className="font-poppins font-medium text-gray-900">{branchName} Branch</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button 
                      className="w-full bg-[#160B53] hover:bg-[#160B53]/90 text-white font-poppins font-semibold"
                      onClick={() => {
                        // Navigate to booking or services
                        console.log('Book appointment for this service')
                      }}
                    >
                      Book This Service
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
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

