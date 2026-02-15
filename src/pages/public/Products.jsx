import { useEffect, useMemo, useRef, useState } from "react";
import { Filter } from "lucide-react";
import Navigation from "../../components/landing/Navigation";
import Footer from "../../components/landing/Footer";
import { SearchInput } from "../../components/ui/SearchInput";
import { ConsistentCard, ConsistentCardContent } from "../../components/ui/ConsistentCard";
import Button from "../../components/ui/Button";
import { productService } from "../../services/productService";
import { marketingContentService } from "../../services/marketingContentService";
import { useAuth } from "../../context/AuthContext";
import { USER_ROLES } from "../../utils/constants";
import InlineEditable from "../../components/cms/InlineEditable";
import FloatingSaveButton from "../../components/cms/FloatingSaveButton";

export default function Products({ embedded = false, cmsEditMode } = {}) {
  const { userData, userRoles } = useAuth();
  const isSystemAdmin =
    userRoles?.includes(USER_ROLES.SYSTEM_ADMIN) ||
    userRoles?.includes("system_admin") ||
    userData?.role === USER_ROLES.SYSTEM_ADMIN ||
    userData?.role === "system_admin";
  const effectiveEditMode = typeof cmsEditMode === "boolean" ? cmsEditMode : true;

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isVisible, setIsVisible] = useState(false);

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState(null);

  const [content, setContent] = useState(null);
  const [localContent, setLocalContent] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasChangesRef = useRef(false);
  const localContentRef = useRef(null);
  const editRevisionRef = useRef(0);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    hasChangesRef.current = hasChanges;
  }, [hasChanges]);

  useEffect(() => {
    localContentRef.current = localContent;
  }, [localContent]);

  useEffect(() => {
    const loadContent = async () => {
      try {
        const result = await marketingContentService.getProductsPageContent();
        if (result.success && result.content) {
          setContent(result.content);
        }
      } catch (error) {
        console.error("Error loading products page content:", error);
      }
    };

    const unsubscribe = marketingContentService.subscribeToContent("products", "products", (result) => {
      if (result.success && result.content) {
        setContent(result.content);
        if (!hasChangesRef.current) {
          setLocalContent(result.content);
        }
      }
    });

    loadContent();

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (content && !localContent) {
      setLocalContent(content);
    }
  }, [content, localContent]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoadingProducts(true);
        setProductsError(null);

        const result = await productService.getAllProducts();
        if (!result?.success) {
          setProducts([]);
          setProductsError(result?.message || "Failed to load products");
          return;
        }

        const mapped = (Array.isArray(result.products) ? result.products : [])
          .filter((p) => {
            const status = String(p?.status || "").toLowerCase();
            return status === "" || status === "active";
          })
          .map((p) => {
            const priceValue = p.otcPrice ?? p.price ?? p.salonUsePrice;
            const num = Number(priceValue);
            const price = Number.isFinite(num)
              ? `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              : "";

            return {
              id: p.id,
              category: p.category || "Other",
              brand: p.brand || "",
              name: p.name || "",
              description: p.description || "",
              price,
              image: p.imageUrl || p.thumbnailUrl || p.image || ""
            };
          });

        setProducts(mapped);
      } catch (error) {
        setProducts([]);
        setProductsError(error?.message || "Failed to load products");
      } finally {
        setLoadingProducts(false);
      }
    };

    loadProducts();
  }, []);

  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        !normalized ||
        product.name.toLowerCase().includes(normalized) ||
        product.brand.toLowerCase().includes(normalized) ||
        product.category.toLowerCase().includes(normalized);
      const matchesCategory = selectedCategory === "All" || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const displayContent = hasChanges ? localContent : content;
  const primaryColor = displayContent?.theme?.primaryColor || "#160B53";
  const headerContent = displayContent?.header || {
    title: "Products Catalog",
    subtitle: "Browse our professional salon products",
    searchPlaceholder: "Search products, brands..."
  };

  const handleContentUpdate = (fieldPath, value) => {
    if (!localContent) return;

    const keys = fieldPath.split(".");
    const newContent = { ...localContent };
    let current = newContent;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    setLocalContent(newContent);
    editRevisionRef.current += 1;
    setHasChanges(true);
  };

  const handleSave = async () => {
    const contentToSave = localContentRef.current;
    if (!contentToSave || !userData) return;

    try {
      const saveRevision = editRevisionRef.current;
      setSaving(true);
      const { id, ...payload } = contentToSave;
      const result = await marketingContentService.updateContent("products", "products", {
        ...payload,
        updatedBy: userData.uid
      });

      if (result.success) {
        setContent(contentToSave);
        if (editRevisionRef.current === saveRevision) {
          setHasChanges(false);
        }
      }
    } catch (error) {
      console.error("Error saving products page content:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {!embedded && <Navigation />}
      {embedded && <Navigation embedded={true} cmsEditMode={cmsEditMode} />}

      {isSystemAdmin && (
        <FloatingSaveButton onSave={handleSave} saving={saving} hasChanges={hasChanges} />
      )}

      <main
        className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${
          embedded ? "mt-0" : "mt-[80px]"
        }`}
      >
        <div
          className={`text-center mb-8 transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {isSystemAdmin ? (
            <h1 className="font-poppins font-bold mb-4 sm:mb-6 text-3xl sm:text-4xl md:text-5xl lg:text-[50px]" style={{ color: primaryColor }}>
              <InlineEditable
                enabled={effectiveEditMode}
                value={headerContent.title}
                onSave={(path, value) => handleContentUpdate("header.title", value)}
                fieldPath="header.title"
                className=""
              />
            </h1>
          ) : (
            <h1 className="font-poppins font-bold mb-4 sm:mb-6 text-3xl sm:text-4xl md:text-5xl lg:text-[50px]" style={{ color: primaryColor }}>
              {headerContent.title}
            </h1>
          )}

          {isSystemAdmin ? (
            <p className="text-base sm:text-lg text-gray-600 mb-4 sm:mb-6 px-2">
              <InlineEditable
                enabled={effectiveEditMode}
                value={headerContent.subtitle}
                onSave={(path, value) => handleContentUpdate("header.subtitle", value)}
                fieldPath="header.subtitle"
                multiline={true}
                className=""
              />
            </p>
          ) : (
            <p className="text-base sm:text-lg text-gray-600 mb-4 sm:mb-6 px-2">{headerContent.subtitle}</p>
          )}

          <div className="flex flex-wrap justify-center gap-2 mb-4 sm:mb-6 px-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                style={selectedCategory === category ? { backgroundColor: primaryColor } : undefined}
                className={`px-4 py-2 rounded-full text-sm font-poppins font-medium transition-all duration-300 ${
                  selectedCategory === category
                    ? "text-white scale-105"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:scale-105"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4 mb-6">
            <p className="text-gray-600 text-center sm:text-left">
              {loadingProducts
                ? "Loading products..."
                : `Showing ${filteredProducts.length} product${filteredProducts.length !== 1 ? "s" : ""}`}
              {!loadingProducts && searchTerm && ` for "${searchTerm}"`}
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
              <SearchInput
                placeholder={headerContent.searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:flex-1 font-poppins"
              />
              <button
                style={{ backgroundColor: primaryColor }}
                className="text-white px-4 py-2 rounded-lg font-poppins font-medium transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 whitespace-nowrap"
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {filteredProducts.map((product) => (
            <ConsistentCard key={product.id} shadowVariant="custom" hoverable={false}>
              <div className="relative h-48 bg-gray-100 overflow-hidden">
                <img
                  src={product.image || "/placeholder.svg"}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                <div
                  style={{ backgroundColor: primaryColor }}
                  className="absolute top-3 left-3 text-white px-3 py-1 rounded-full text-sm font-poppins font-medium"
                >
                  {product.category}
                </div>
              </div>

              <ConsistentCardContent className="p-4">
                <p className="text-xs uppercase tracking-wide mb-1 text-gray-500">{product.brand}</p>
                <h3 className="font-poppins font-semibold mb-2 line-clamp-2 text-gray-900">
                  {product.name}
                </h3>
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>

                <div className="flex items-center gap-2">
                  <span className="text-lg font-poppins font-bold" style={{ color: primaryColor }}>
                    {product.price}
                  </span>
                </div>
              </ConsistentCardContent>
            </ConsistentCard>
          ))}
        </div>

        {!loadingProducts && filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🛍️</div>
            <h3 className="text-xl font-poppins font-semibold text-gray-600 mb-2">No products found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria</p>
          </div>
        )}

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

      {!embedded && <Footer />}
      {embedded && <Footer embedded={true} cmsEditMode={cmsEditMode} />}
    </>
  );
}
