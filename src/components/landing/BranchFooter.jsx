import { Link } from "react-router-dom"
import { Phone, MapPin } from "lucide-react"
import InlineEditable from "../cms/InlineEditable"

export default function BranchFooter({
  branchName,
  branchPhone,
  branchAddress,
  branchSlug,
  cmsEditable = false,
  onContentUpdate,
  footerContent
}) {
  const interpolate = (value) => {
    if (!value) return ''
    const text = String(value)
    return text.replace(/\{branchName\}/g, branchName || '')
  }

  const effectiveFooterContent = footerContent || {}
  const description =
    effectiveFooterContent.description ||
    "Premium hair and beauty services at {branchName}. We offer specialized services tailored to our local community with professional stylists and modern facilities."
  const linksTitle = effectiveFooterContent.linksTitle || "Branch Links"
  const contactTitle = effectiveFooterContent.contactTitle || "Contact Info"
  const links = effectiveFooterContent.links || {}
  const linkLabels = {
    home: links.home || "Branch Home",
    services: links.services || "Our Services",
    stylists: links.stylists || "Our Stylists",
    gallery: links.gallery || "Gallery",
    products: links.products || "Products"
  }
  const copyrightText =
    effectiveFooterContent.copyright ||
    "© 2025 David's Salon - {branchName}. All Rights Reserved."

  return (
    <footer className="w-full bg-white" style={{ height: '360px', minHeight: '360px', borderTop: '1px solid #C4C4C4' }}>
      <div className="max-w-[1440px] mx-auto h-full flex flex-col justify-center px-2 sm:px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 lg:gap-20 justify-items-center md:justify-items-start">
          <div className="text-center md:text-left">
            <h3 className="font-semibold text-[#160B53] mb-4 text-base">
              {cmsEditable ? (
                <InlineEditable
                  enabled={cmsEditable}
                  value={linksTitle}
                  onSave={onContentUpdate}
                  fieldPath="footer.linksTitle"
                  className="text-[#160B53]"
                />
              ) : (
                linksTitle
              )}
            </h3>
            <ul className="space-y-2 text-base text-gray-600">
              <li>
                <Link to={`/branch/${branchSlug}`} className="hover:text-[#160B53]">
                  {cmsEditable ? (
                    <InlineEditable
                      enabled={cmsEditable}
                      value={linkLabels.home}
                      onSave={onContentUpdate}
                      fieldPath="footer.links.home"
                      className="text-gray-600"
                    />
                  ) : (
                    linkLabels.home
                  )}
                </Link>
              </li>
              <li>
                <Link to={`/branch/${branchSlug}/services`} className="hover:text-[#160B53]">
                  {cmsEditable ? (
                    <InlineEditable
                      enabled={cmsEditable}
                      value={linkLabels.services}
                      onSave={onContentUpdate}
                      fieldPath="footer.links.services"
                      className="text-gray-600"
                    />
                  ) : (
                    linkLabels.services
                  )}
                </Link>
              </li>
              <li>
                <Link to={`/branch/${branchSlug}/stylists`} className="hover:text-[#160B53]">
                  {cmsEditable ? (
                    <InlineEditable
                      enabled={cmsEditable}
                      value={linkLabels.stylists}
                      onSave={onContentUpdate}
                      fieldPath="footer.links.stylists"
                      className="text-gray-600"
                    />
                  ) : (
                    linkLabels.stylists
                  )}
                </Link>
              </li>
              <li>
                <Link to={`/branch/${branchSlug}/gallery`} className="hover:text-[#160B53]">
                  {cmsEditable ? (
                    <InlineEditable
                      enabled={cmsEditable}
                      value={linkLabels.gallery}
                      onSave={onContentUpdate}
                      fieldPath="footer.links.gallery"
                      className="text-gray-600"
                    />
                  ) : (
                    linkLabels.gallery
                  )}
                </Link>
              </li>
              <li>
                <Link to={`/branch/${branchSlug}/products`} className="hover:text-[#160B53]">
                  {cmsEditable ? (
                    <InlineEditable
                      enabled={cmsEditable}
                      value={linkLabels.products}
                      onSave={onContentUpdate}
                      fieldPath="footer.links.products"
                      className="text-gray-600"
                    />
                  ) : (
                    linkLabels.products
                  )}
                </Link>
              </li>
            </ul>
          </div>

          <div className="text-center md:text-left">
            <h3 className="font-semibold text-[#160B53] mb-4 text-base">
              {cmsEditable ? (
                <InlineEditable
                  enabled={cmsEditable}
                  value={contactTitle}
                  onSave={onContentUpdate}
                  fieldPath="footer.contactTitle"
                  className="text-[#160B53]"
                />
              ) : (
                contactTitle
              )}
            </h3>
            <div className="space-y-3 text-base text-gray-600">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <Phone className="w-4 h-4 text-gray-600" />
                <span>{branchPhone}</span>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2">
                <MapPin className="w-4 h-4 text-gray-600" />
                <span>{branchAddress}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 text-center text-base text-gray-500" style={{ borderTop: '1px solid #D4D4D4' }}>
          {cmsEditable ? (
            <InlineEditable
              enabled={cmsEditable}
              value={copyrightText}
              onSave={onContentUpdate}
              fieldPath="footer.copyright"
              className="text-gray-500"
            />
          ) : (
            interpolate(copyrightText)
          )}
        </div>
      </div>
    </footer>
  )
}
