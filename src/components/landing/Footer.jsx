import { Link } from "react-router-dom"
import { Phone, MapPin } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { marketingContentService } from "../../services/marketingContentService"
import { useAuth } from "../../context/AuthContext"
import { USER_ROLES } from "../../utils/constants"
import InlineEditable from "../cms/InlineEditable"
import FloatingSaveButton from "../cms/FloatingSaveButton"

export default function Footer({ embedded = false, cmsEditMode } = {}) {
  const { userData, userRoles } = useAuth()
  const isSystemAdmin =
    userRoles?.includes(USER_ROLES.SYSTEM_ADMIN) ||
    userRoles?.includes('system_admin') ||
    userData?.role === USER_ROLES.SYSTEM_ADMIN ||
    userData?.role === 'system_admin'
  const effectiveEditMode = typeof cmsEditMode === 'boolean' ? cmsEditMode : false

  const [content, setContent] = useState(null)
  const [localContent, setLocalContent] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [saving, setSaving] = useState(false)
  const hasChangesRef = useRef(false)

  useEffect(() => {
    hasChangesRef.current = hasChanges
  }, [hasChanges])

  useEffect(() => {
    const loadContent = async () => {
      try {
        const result = await marketingContentService.getLayoutContent()
        if (result.success && result.content) {
          setContent(result.content)
          if (!hasChangesRef.current) {
            setLocalContent(result.content)
          }
        }
      } catch (error) {
        console.error('Error loading layout content:', error)
      }
    }

    const unsubscribe = marketingContentService.subscribeToContent('layout', 'layout', (result) => {
      if (result.success && result.content) {
        setContent(result.content)
        if (!hasChangesRef.current) {
          setLocalContent(result.content)
        }
      }
    })

    loadContent()
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (content && !localContent) {
      setLocalContent(content)
    }
  }, [content, localContent])

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

  const handleSave = async () => {
    if (!localContent || !userData) return

    try {
      setSaving(true)
      const payload = {
        footer: (localContent?.footer || {})
      }
      const result = await marketingContentService.updateContent('layout', 'layout', {
        ...payload,
        updatedBy: userData.uid
      })
      if (result.success) {
        setContent(localContent)
        setHasChanges(false)
      }
    } catch (error) {
      console.error('Error saving layout content:', error)
    } finally {
      setSaving(false)
    }
  }

  const displayContent = hasChanges ? localContent : content
  const footer = displayContent?.footer || {}
  const quickLinks = footer.quickLinks || {}

  return (
    <>
      {isSystemAdmin && embedded && (
        <FloatingSaveButton
          onSave={handleSave}
          saving={saving}
          hasChanges={hasChanges}
        />
      )}

      <footer className="w-full bg-white" style={{ height: '360px', minHeight: '360px', borderTop: '1px solid #C4C4C4' }}>
        <div className="max-w-[1440px] mx-auto h-full flex flex-col justify-center px-2 sm:px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-16 lg:gap-20 justify-items-center md:justify-items-start">
            <div className="text-center md:text-left">
              <Link to="/">
                <img
                  src="/logo.jpg"
                  alt="David's Salon Logo"
                  className="h-12 sm:h-16 mb-4 mx-auto md:mx-0"
                />
              </Link>
              <p className="text-gray-600 text-base leading-relaxed max-w-sm mx-auto md:mx-0">
                <InlineEditable
                  value={footer.description || 'Premium hair and beauty services at our Harbor Point Ayala location. We offer specialized services tailored for our local community.'}
                  onSave={handleContentUpdate}
                  fieldPath="footer.description"
                  enabled={isSystemAdmin && effectiveEditMode}
                  multiline
                  className="text-base"
                />
              </p>
            </div>

            <div className="text-center md:text-left">
              <h3 className="font-semibold text-[#160B53] mb-4 text-base">
                <InlineEditable
                  value={footer.quickLinksTitle || 'Quick Links'}
                  onSave={handleContentUpdate}
                  fieldPath="footer.quickLinksTitle"
                  enabled={isSystemAdmin && effectiveEditMode}
                  className="font-semibold text-[#160B53]"
                />
              </h3>
              <ul className="space-y-2 text-base text-gray-600">
                <li>
                  <Link to="/" className="hover:text-[#160B53]">
                    <InlineEditable
                      value={quickLinks.location || 'Our Location'}
                      onSave={handleContentUpdate}
                      fieldPath="footer.quickLinks.location"
                      enabled={isSystemAdmin && effectiveEditMode}
                      className="text-base"
                    />
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="hover:text-[#160B53]">
                    <InlineEditable
                      value={quickLinks.about || 'About Us'}
                      onSave={handleContentUpdate}
                      fieldPath="footer.quickLinks.about"
                      enabled={isSystemAdmin && effectiveEditMode}
                      className="text-base"
                    />
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="hover:text-[#160B53]">
                    <InlineEditable
                      value={quickLinks.contact || 'Contact'}
                      onSave={handleContentUpdate}
                      fieldPath="footer.quickLinks.contact"
                      enabled={isSystemAdmin && effectiveEditMode}
                      className="text-base"
                    />
                  </Link>
                </li>
                <li>
                  <Link to="/" className="hover:text-[#160B53]">
                    <InlineEditable
                      value={quickLinks.bookOnline || 'Book Online'}
                      onSave={handleContentUpdate}
                      fieldPath="footer.quickLinks.bookOnline"
                      enabled={isSystemAdmin && effectiveEditMode}
                      className="text-base"
                    />
                  </Link>
                </li>
              </ul>
            </div>

            <div className="text-center md:text-left">
              <h3 className="font-semibold text-[#160B53] mb-4 text-base">
                <InlineEditable
                  value={footer.contactInfoTitle || 'Contact Info'}
                  onSave={handleContentUpdate}
                  fieldPath="footer.contactInfoTitle"
                  enabled={isSystemAdmin && effectiveEditMode}
                  className="font-semibold text-[#160B53]"
                />
              </h3>
              <div className="space-y-3 text-base text-gray-600">
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <Phone className="w-4 h-4 text-gray-600" />
                  <span>
                    <InlineEditable
                      value={footer.phone || '+63 930 222 9659'}
                      onSave={handleContentUpdate}
                      fieldPath="footer.phone"
                      enabled={isSystemAdmin && effectiveEditMode}
                      className="text-base"
                    />
                  </span>
                </div>
                <div className="flex items-center justify-center md:justify-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-600" />
                  <span>
                    <InlineEditable
                      value={footer.address || 'Makati, Philippines'}
                      onSave={handleContentUpdate}
                      fieldPath="footer.address"
                      enabled={isSystemAdmin && effectiveEditMode}
                      className="text-base"
                    />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 text-center text-base text-gray-500" style={{ borderTop: '1px solid #D4D4D4' }}>
          <InlineEditable
            value={footer.copyright || "© 2025 David's Salon. All Rights Reserved."}
            onSave={handleContentUpdate}
            fieldPath="footer.copyright"
            enabled={isSystemAdmin && effectiveEditMode}
            className="text-base"
          />
        </div>
      </footer>
    </>
  )
}

