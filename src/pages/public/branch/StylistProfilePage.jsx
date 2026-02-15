import Button from "../../../components/ui/Button"
import { Card, CardContent } from "../../../components/ui/Card"
import { ArrowLeft, Clock, ChevronLeft, ChevronRight } from "lucide-react"
import { useParams, Link } from "react-router-dom"
import { useState, useEffect } from "react"
import BranchNavigation from "../../../components/landing/BranchNavigation"
import BranchFooter from "../../../components/landing/BranchFooter"
import { getUserById } from "../../../services/userService"
import { getAllBranches } from "../../../services/branchService"
import { getPortfoliosByStylist } from "../../../services/portfolioService"
import { USER_ROLES } from "../../../utils/constants"
import { getFullName } from "../../../utils/helpers"
import { doc, getDoc } from "firebase/firestore"
import { db } from "../../../config/firebase"

export default function StylistProfilePage() {
  const { slug, stylistId } = useParams()

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

  const [isVisible, setIsVisible] = useState(false)
  const [currentPortfolioPage, setCurrentPortfolioPage] = useState(1)

  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [stylistUser, setStylistUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [portfolioItems, setPortfolioItems] = useState([])
  const [loadingPortfolio, setLoadingPortfolio] = useState(false)

  const [specialtyServices, setSpecialtyServices] = useState([])
  const [loadingSpecialtyServices, setLoadingSpecialtyServices] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

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
      setSelectedBranch(match)
      return
    }

    setSelectedBranch(null)
  }, [slug, branches])

  useEffect(() => {
    const loadStylist = async () => {
      if (!stylistId) return
      try {
        setLoading(true)
        setNotFound(false)

        const user = await getUserById(stylistId)
        if (!user) {
          setStylistUser(null)
          setNotFound(true)
          return
        }

        const roles = user.roles || (user.role ? [user.role] : [])
        if (!Array.isArray(roles) || !roles.includes(USER_ROLES.STYLIST)) {
          setStylistUser(null)
          setNotFound(true)
          return
        }

        if (selectedBranch?.id && user.branchId && user.branchId !== selectedBranch.id) {
          setStylistUser(null)
          setNotFound(true)
          return
        }

        setStylistUser(user)
      } catch (e) {
        console.error('Error loading stylist:', e)
        setStylistUser(null)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    loadStylist()
  }, [stylistId, selectedBranch?.id])

  useEffect(() => {
    let cancelled = false

    const loadPortfolio = async () => {
      if (!stylistId) {
        setPortfolioItems([])
        return
      }

      try {
        setLoadingPortfolio(true)
        const items = await getPortfoliosByStylist(stylistId)
        if (cancelled) return

        const approved = (Array.isArray(items) ? items : []).filter(
          (p) => p?.status === 'active' || p?.status === 'approved'
        )
        setPortfolioItems(approved)
        setCurrentPortfolioPage(1)
      } catch (e) {
        if (cancelled) return
        console.error('Error loading stylist portfolio:', e)
        setPortfolioItems([])
      } finally {
        if (cancelled) return
        setLoadingPortfolio(false)
      }
    }

    loadPortfolio()

    return () => {
      cancelled = true
    }
  }, [stylistId])

  useEffect(() => {
    let cancelled = false

    const loadSpecialtyServices = async () => {
      try {
        setLoadingSpecialtyServices(true)

        const serviceIds = Array.from(
          new Set((Array.isArray(stylistUser?.service_id) ? stylistUser.service_id : []).filter(Boolean))
        )
        if (serviceIds.length === 0) {
          if (cancelled) return
          setSpecialtyServices([])
          return
        }

        const items = []
        for (const serviceId of serviceIds) {
          if (cancelled) return
          try {
            const snap = await getDoc(doc(db, 'services', serviceId))
            if (!snap.exists()) continue
            const data = snap.data() || {}
            if (data?.isActive === false) continue
            items.push({ id: snap.id, ...data })
          } catch (e) {
            // ignore individual missing/blocked services
          }
        }

        items.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))

        if (cancelled) return
        setSpecialtyServices(items)
      } catch (e) {
        if (cancelled) return
        console.error('Error loading specialty services:', e)
        setSpecialtyServices([])
      } finally {
        if (cancelled) return
        setLoadingSpecialtyServices(false)
      }
    }

    loadSpecialtyServices()

    return () => {
      cancelled = true
    }
  }, [stylistUser])

  const branchName = selectedBranch?.__name || computedBranchName
  const branchPhone = selectedBranch?.contact || "+63 930 222 9659"
  const branchAddress = selectedBranch?.address || `${branchName}, Philippines`

  if (loading) {
    return (
      <>
        <BranchNavigation branchName={`${branchName} Branch`} branchSlug={slug} />
        <section className="py-8 sm:py-12 px-4 sm:px-6 bg-gray-50 mt-[80px]">
          <div className="max-w-6xl mx-auto text-center">
            <h1 className="text-3xl font-poppins font-bold text-[#160B53]">Loading stylist...</h1>
          </div>
        </section>
        <BranchFooter
          branchName={`${branchName} Branch`}
          branchPhone={branchPhone}
          branchAddress={branchAddress}
          branchSlug={slug}
        />
      </>
    )
  }

  if (notFound) {
    return (
      <>
        <BranchNavigation branchName={`${branchName} Branch`} branchSlug={slug} />
        <section className="py-8 sm:py-12 px-4 sm:px-6 bg-gray-50 mt-[80px]">
          <div className="max-w-6xl mx-auto text-center">
            <h1 className="text-3xl font-poppins font-bold text-[#160B53]">Stylist not found</h1>
            <div className="mt-6">
              <Link
                to={`/branch/${slug}/stylists`}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-poppins font-medium transition-colors rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Stylists
              </Link>
            </div>
          </div>
        </section>
        <BranchFooter
          branchName={`${branchName} Branch`}
          branchPhone={branchPhone}
          branchAddress={branchAddress}
          branchSlug={slug}
        />
      </>
    )
  }

  // Mock stylist data - in real app, this would come from API/database
  const stylistFallback = {
    id: 1,
    name: "Maria Santos",
    specialty: "Color Specialist",
    experience: "8 years experience",
    image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face",
  }

  const years = stylistUser?.yearsExperience || stylistUser?.experienceYears || stylistUser?.experience
  const experienceText =
    typeof years === 'number'
      ? `${years} years experience`
      : (typeof years === 'string' ? years : stylistFallback.experience)

  const stylist = stylistUser
    ? {
        ...stylistFallback,
        id: stylistUser.id,
        name: getFullName(stylistUser),
        specialty: stylistUser.specialty || stylistUser.primarySpecialty || stylistFallback.specialty,
        experience: experienceText,
        image:
          stylistUser.imageURL ||
          stylistUser.imageUrl ||
          stylistUser.photoURL ||
          stylistUser.photoUrl ||
          stylistUser.avatarUrl ||
          stylistUser.profileImageUrl ||
          stylistFallback.image
      }
    : stylistFallback

  const portfolioPerPage = 6
  const totalPortfolioPages = Math.ceil(portfolioItems.length / portfolioPerPage)
  const startPortfolioIndex = (currentPortfolioPage - 1) * portfolioPerPage
  const currentPortfolioItems = portfolioItems.slice(startPortfolioIndex, startPortfolioIndex + portfolioPerPage)


  const availableDays = [
    {
      day: "Monday",
      status: "Closed at Selected Branch",
      available: false
    },
    {
      day: "Tuesday",
      status: "Closed at Selected Branch",
      available: false
    },
    {
      day: "Wednesday",
      status: "Closed at Selected Branch",
      available: false
    },
    {
      day: "Thursday",
      status: "Closed at Selected Branch",
      available: false
    },
    {
      day: "Friday",
      status: "Closed at Selected Branch",
      available: false
    },
    {
      day: "Saturday",
      status: "Closed at Selected Branch",
      available: false
    }
  ]

  return (
    <>
      <BranchNavigation branchName={`${branchName} Branch`} branchSlug={slug} />
      
      {/* Hero Section */}
      <section className="relative py-16 px-6 bg-[#160B53] text-white" style={{ paddingTop: '180px' }}>
        <div className="max-w-6xl mx-auto">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Stylist Image */}
            <div className="relative">
              <img
                src={stylist.image}
                alt={stylist.name}
                className="w-full max-w-sm mx-auto h-80 object-cover rounded-lg shadow-lg"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = stylistFallback.image
                }}
              />
            </div>

            {/* Stylist Info */}
            <div className={`transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <h1 className="text-4xl font-poppins font-bold mb-2">{stylist.name}</h1>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link 
                  to={`/branch/${slug}/stylists`}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-white text-white hover:text-white/80 font-poppins font-medium transition-colors rounded-lg bg-transparent"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Specialty Services */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-poppins font-bold text-center text-[#160B53] mb-12">Specialty Services</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loadingSpecialtyServices ? (
              <div className="col-span-full text-center py-10 text-gray-500">Loading services…</div>
            ) : specialtyServices.length === 0 ? (
              <div className="col-span-full text-center py-10 text-gray-500">No services found.</div>
            ) : specialtyServices.map((service, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-shadow" style={{ 
                borderColor: '#DBDBDB',
                boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)'
              }}>
                <CardContent className="p-0">
                  <h3 className="text-xl font-poppins font-bold text-gray-900 mb-2">{service.name || 'Service'}</h3>
                  <p className="text-gray-600 text-sm mb-4">{service.description || ''}</p>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>
                        {typeof service.duration === 'number'
                          ? `${service.duration} mins`
                          : (service.duration || '—')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-poppins font-bold text-center text-[#160B53] mb-12">Portfolio</h2>

          {loadingPortfolio ? (
            <div className="text-center py-12 text-gray-500">Loading portfolio…</div>
          ) : currentPortfolioItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No portfolio items yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {currentPortfolioItems.map((item, index) => {
                const imageUrl = item?.thumbnailUrl || item?.imageUrl
                return (
                  <div
                    key={item?.id || `${startPortfolioIndex}-${index}`}
                    className="aspect-square bg-gray-200 rounded-lg overflow-hidden hover:scale-105 transition-transform duration-300 cursor-pointer"
                    style={{
                      borderColor: '#DBDBDB',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      boxShadow: '0 2px 15px 0 rgba(0, 0, 0, 0.25)'
                    }}
                    title={item?.title || 'Portfolio'}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={item?.title || `Portfolio ${startPortfolioIndex + index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">No image</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Portfolio Pagination */}
          {totalPortfolioPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <button
                onClick={() => setCurrentPortfolioPage(Math.max(1, currentPortfolioPage - 1))}
                disabled={currentPortfolioPage === 1}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {[...Array(totalPortfolioPages)].map((_, index) => {
                const page = index + 1
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPortfolioPage(page)}
                    className={`w-10 h-10 rounded-lg font-poppins font-medium transition-all duration-300 ${
                      currentPortfolioPage === page
                        ? 'bg-[#160B53] text-white scale-105'
                        : 'bg-transparent text-gray-700 border border-gray-300 hover:bg-gray-50 hover:scale-105'
                    }`}
                  >
                    {page}
                  </button>
                )
              })}
              
              <button
                onClick={() => setCurrentPortfolioPage(Math.min(totalPortfolioPages, currentPortfolioPage + 1))}
                disabled={currentPortfolioPage === totalPortfolioPages}
                className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Stylist's Schedule */}
      <section className="py-16 px-6 bg-[#160B53] text-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-poppins font-bold text-center mb-12">Stylist's Schedule</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableDays.map((day, index) => (
              <Card key={index} className="bg-white text-gray-900 p-6">
                <CardContent className="p-0">
                  <h3 className="text-xl font-poppins font-bold mb-2">{day.day}</h3>
                  <p className="text-sm text-gray-600 mb-4">{day.status}</p>
                  <Button 
                    size="sm" 
                    disabled={!day.available}
                    className={`w-full font-poppins font-medium ${
                      day.available 
                        ? 'bg-[#160B53] hover:bg-[#160B53]/90 text-white'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {day.available ? 'Book Now' : 'Book Now'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      
      <BranchFooter 
        branchName={`${branchName} Branch`}
        branchPhone={branchPhone}
        branchAddress={branchAddress}
        branchSlug={slug}
      />
    </>
  )
}

