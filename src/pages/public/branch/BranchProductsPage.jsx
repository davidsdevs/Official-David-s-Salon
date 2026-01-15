import { useState, useEffect, useRef } from "react"
import { Filter } from "lucide-react"
import { SearchInput } from "../../../components/ui/SearchInput"
import { ConsistentCard, ConsistentCardContent } from "../../../components/ui/ConsistentCard"
import Button from "../../../components/ui/Button"
import { useParams } from "react-router-dom"
import BranchNavigation from "../../../components/landing/BranchNavigation"
import BranchFooter from "../../../components/landing/BranchFooter"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../../../config/firebase"
import { productService } from "../../../services/productService"
import { marketingContentService } from "../../../services/marketingContentService"
import { useAuth } from "../../../context/AuthContext"
import { USER_ROLES } from "../../../utils/constants"
import InlineEditable from "../../../components/cms/InlineEditable"
import FloatingSaveButton from "../../../components/cms/FloatingSaveButton"
import InlineColorPicker from "../../../components/cms/InlineColorPicker"

export default function BranchProductsPage({ embedded = false, cmsEditMode, cmsBranchId = null, cmsBranchName = '', cmsBranchSlug = '' } = {}) {
  const { userData, userRoles } = useAuth()
  const params = useParams()
  const slug = cmsBranchSlug || params.slug

  const computedBranchName = slug ? slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : ''
  const branchName = cmsBranchName || computedBranchName

  const effectiveEditMode = typeof cmsEditMode === 'boolean' ? cmsEditMode : true
  const isSystemAdmin =
    userRoles?.includes(USER_ROLES.SYSTEM_ADMIN) ||
    userRoles?.includes('system_admin') ||
    userData?.role === USER_ROLES.SYSTEM_ADMIN ||
    userData?.role === 'system_admin'

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [isVisible, setIsVisible] = useState(false)

  const [branchId, setBranchId] = useState(null)
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [productsError, setProductsError] = useState(null)

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

  const slugify = (value) => {
    if (!value) return ""
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
  }

  const formatPrice = (value) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return ""
    return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  // Resolve branchId by slug (matches BranchPage/BranchServicesPage behavior)
  useEffect(() => {
    const findBranch = async () => {
      try {
        const branchesRef = collection(db, "branches")

        const slugQuery = query(branchesRef, where("slug", "==", slug))
        const slugSnapshot = await getDocs(slugQuery)
        if (!slugSnapshot.empty) {
          setBranchId(slugSnapshot.docs[0].id)
          return
        }

        const slugNormalized = slugify(slug)
        const slugAlt = slugNormalized.endsWith("-branch")
          ? slugNormalized.replace(/-branch$/, "")
          : `${slugNormalized}-branch`

        const allSnapshot = await getDocs(branchesRef)
        const match = allSnapshot.docs.find((d) => {
          const data = d.data() || {}
          const candidates = [slugify(data.slug), slugify(data.name), slugify(data.branchName)].filter(Boolean)
          return candidates.includes(slugNormalized) || candidates.includes(slugAlt)
        })

        setBranchId(match ? match.id : null)
      } catch (error) {
        console.error("Error finding branch by slug:", error)
        setBranchId(null)
      }
    }

    if (slug) {
      findBranch()
    }
  }, [slug])

  const marketingContentId = cmsBranchId
    ? `branch_${cmsBranchId}`
    : branchId
      ? `branch_${branchId}`
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
    if (content && !localContent) {
      setLocalContent(content)
    }
  }, [content, localContent])

  // Fetch products for resolved branchId
  useEffect(() => {
    const loadProducts = async () => {
      if (!branchId) {
        setProducts([])
        setLoadingProducts(false)
        return
      }

      try {
        setLoadingProducts(true)
        setProductsError(null)
        const result = await productService.getBranchProducts(branchId)
        if (!result?.success) {
          setProducts([])
          setProductsError(result?.message || "Failed to load products")
          return
        }

        const mapped = (Array.isArray(result.products) ? result.products : []).map((p) => {
          const priceValue = p.otcPrice ?? p.price ?? p.salonUsePrice
          return {
            id: p.id,
            category: p.category || "Other",
            brand: p.brand || "",
            name: p.name || "",
            description: p.description || "",
            price: formatPrice(priceValue) || "",
            originalPrice: "",
            branchExclusive: Array.isArray(p.branches) ? p.branches.length === 1 && p.branches.includes(branchId) : false,
            image: p.imageUrl || p.thumbnailUrl || p.image || ""
          }
        })

        setProducts(mapped)
      } catch (error) {
        console.error("Error loading branch products:", error)
        setProducts([])
        setProductsError(error?.message || "Failed to load products")
      } finally {
        setLoadingProducts(false)
      }
    }

    loadProducts()
  }, [branchId])

  const displayContent = hasChanges ? localContent : content
  const productsPage = displayContent?.productsPage || {}
  const headerContent = productsPage.header || {}
  const theme = displayContent?.theme || {}
  const primaryColor = theme.primaryColor || '#160B53'

  const headerTitle = headerContent.title || 'Products Catalog'
  const headerSubtitle = headerContent.subtitle || `Professional hair care products available at ${branchName} Branch`
  const searchPlaceholder = productsPage.searchPlaceholder || 'Search products, brands...'

  const renderTemplate = (value) => {
    if (typeof value !== 'string') return value
    return value.replace(/\{branchName\}/g, branchName)
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
    if (!contentToSave || !userData || !marketingContentId) return

    try {
      const saveRevision = editRevisionRef.current
      setSaving(true)
      const { id, ...payload } = contentToSave
      const result = await marketingContentService.updateContent(marketingContentId, 'branch', {
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
      console.error('Error saving branch products content:', error)
    } finally {
      setSaving(false)
    }
  }

  // Filter products based on search term and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.category.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "All" || product.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categories = ["All", ...new Set(products.map(product => product.category))]

  return (
    <>
      {/* Branch Navigation */}
      {!embedded && <BranchNavigation branchName={`${branchName} Branch`} />}

      {/* Floating Save Button for System Admin */}
      {isSystemAdmin && (
        <FloatingSaveButton
          onSave={handleSave}
          saving={saving}
          hasChanges={hasChanges}
        />
      )}
      
      {/* Main Content */}
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${embedded ? '' : 'mt-[122px]'}`}>
        {/* Page Header */}
        <div className={`text-center mb-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {isSystemAdmin && effectiveEditMode && (
            <div className="inline-flex items-center gap-3 mb-4 bg-white/95 text-gray-900 rounded-lg border border-gray-200 shadow p-3" data-cms-allow-interaction="true">
              <div className="text-xs font-semibold text-gray-700">Theme</div>
              <InlineColorPicker
                label="Primary"
                value={primaryColor}
                onChange={(value) => handleContentUpdate('theme.primaryColor', value)}
              />
            </div>
          )}

          <h1 className="font-poppins font-bold mb-6 animate-pulse-slow" style={{ fontSize: '50px', color: primaryColor }}>
            <InlineEditable
              value={headerTitle}
              onSave={handleContentUpdate}
              fieldPath="productsPage.header.title"
              enabled={isSystemAdmin && effectiveEditMode}
              className="font-poppins font-bold"
            />
          </h1>

          <p className="text-lg text-gray-600 mb-6">
            <InlineEditable
              value={renderTemplate(headerSubtitle)}
              onSave={handleContentUpdate}
              fieldPath="productsPage.header.subtitle"
              enabled={isSystemAdmin && effectiveEditMode}
              multiline
              className="text-lg"
            />
          </p>
          
          {/* Category Filter Pills */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                style={selectedCategory === category ? { backgroundColor: primaryColor } : undefined}
                className={`px-4 py-2 rounded-full text-sm font-poppins font-medium transition-all duration-300 ${
                  selectedCategory === category
                    ? 'text-white scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
            <p className="text-gray-600">
              {loadingProducts
                ? 'Loading products...'
                : `Showing ${filteredProducts.length} product${filteredProducts.length !== 1 ? 's' : ''}`}
              {!loadingProducts && searchTerm && ` for "${searchTerm}"`}
            </p>
            <div className="flex items-center gap-4">
              <SearchInput
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-80 font-poppins"
              />
              <button
                style={{ backgroundColor: primaryColor }}
                className="text-white px-4 py-2 rounded-lg font-poppins font-medium transition-all duration-300 hover:scale-105 flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filter
              </button>
            </div>
          </div>
        </div>

        {productsError && (
          <div className="text-center py-8">
            <p className="text-red-600 font-poppins">{productsError}</p>
          </div>
        )}

      {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {filteredProducts.map((product, index) => (
            <ConsistentCard
                key={product.id}
              shadowVariant="custom"
              hoverable={false}
              >
                {/* Product Image */}
                <div className="relative h-48 bg-gray-100 overflow-hidden">
                  <img
                  src={product.image || "/placeholder.svg"}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                {/* Category Tag */}
                <div
                  style={{ backgroundColor: primaryColor }}
                  className="absolute top-3 left-3 text-white px-3 py-1 rounded-full text-sm font-poppins font-medium"
                >
                  {product.category}
                </div>
                
                {/* Branch Exclusive Badge */}
                {product.branchExclusive && (
                  <div className="absolute top-3 right-3 bg-yellow-500 text-white px-2 py-1 rounded-full text-xs font-poppins font-bold">
                    EXCLUSIVE
                  </div>
                )}
                  
                </div>

              {/* Product Info */}
              <ConsistentCardContent className="p-4">
                  <p className="text-xs uppercase tracking-wide mb-1 text-gray-500">
                    {product.brand}
                  </p>
                  <h3 className="font-poppins font-semibold mb-2 line-clamp-2 text-gray-900">
                    {product.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>

                  {/* Price */}
                <div className="flex items-center gap-2">
                      <span className="text-lg font-poppins font-bold" style={{ color: primaryColor }}>
                        {product.price}
                      </span>
                      {product.originalPrice && (
                        <span className="text-sm text-gray-500 line-through">{product.originalPrice}</span>
                      )}
                </div>
              </ConsistentCardContent>
            </ConsistentCard>
            ))}
          </div>

          {/* Empty State */}
          {!loadingProducts && filteredProducts.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🛍️</div>
              <h3 className="text-xl font-poppins font-semibold text-gray-600 mb-2">No products found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria</p>
            </div>
          )}

        {/* Pagination */}
        <div className="flex justify-center mt-8 space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-8 h-8 p-0 bg-transparent text-gray-700 border-gray-300 hover:bg-gray-50 transition-all duration-300 hover:scale-110 hover:border-[#160B53]/50"
          >
            {"<"}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-8 h-8 p-0 bg-[#160B53] text-white border-[#160B53] transition-all duration-300 hover:scale-110"
          >
            1
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-8 h-8 p-0 bg-transparent text-gray-700 border-gray-300 hover:bg-gray-50 transition-all duration-300 hover:scale-110 hover:border-[#160B53]/50"
          >
            2
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-8 h-8 p-0 bg-transparent text-gray-700 border-gray-300 hover:bg-gray-50 transition-all duration-300 hover:scale-110 hover:border-[#160B53]/50"
          >
            {">"}
          </Button>
        </div>

        </main>
        
        {/* Footer */}
        {!embedded && (
          <BranchFooter 
            branchName={`${branchName} Branch`}
            branchPhone="+63 930 222 9659"
            branchAddress={`${branchName}, Philippines`}
            branchSlug={slug}
          />
        )}
      </>
    )
}

