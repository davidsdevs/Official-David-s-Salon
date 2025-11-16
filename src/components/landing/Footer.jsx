import { Link } from "react-router-dom"
import { Phone, MapPin } from "lucide-react"

export default function Footer() {
  return (
    <footer className="w-full bg-white" style={{ height: '360px', minHeight: '360px', borderTop: '1px solid #C4C4C4' }}>
      <div className="max-w-[1440px] mx-auto h-full flex flex-col justify-center px-2 sm:px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-16 lg:gap-20 justify-items-center md:justify-items-start">
          <div className="text-center md:text-left">
            <Link to="/">
              <img
                src="/logo.png"
                alt="David's Salon Logo"
                className="h-12 sm:h-16 mb-4 mx-auto md:mx-0"
              />
            </Link>
            <p className="text-gray-600 text-base leading-relaxed max-w-sm mx-auto md:mx-0">
              Premium hair and beauty services at our Harbor Point Ayala location. We offer
              specialized services tailored for our local community.
            </p>
          </div>

          <div className="text-center md:text-left">
            <h3 className="font-semibold text-[#160B53] mb-4 text-base">Quick Links</h3>
            <ul className="space-y-2 text-base text-gray-600">
              <li>
                <Link to="/" className="hover:text-[#160B53]">
                  Our Location
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-[#160B53]">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-[#160B53]">
                  Contact
                </Link>
              </li>
              <li>
                <Link to="/" className="hover:text-[#160B53]">
                  Book Online
                </Link>
              </li>
            </ul>
          </div>

          <div className="text-center md:text-left">
            <h3 className="font-semibold text-[#160B53] mb-4 text-base">Contact Info</h3>
            <div className="space-y-3 text-base text-gray-600">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <Phone className="w-4 h-4 text-gray-600" />
                <span>+63 930 222 9659</span>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2">
                <MapPin className="w-4 h-4 text-gray-600" />
                <span>Makati, Philippines</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 text-center text-base text-gray-500" style={{ borderTop: '1px solid #D4D4D4' }}>
          © 2025 David's Salon. All Rights Reserved.
        </div>
      </div>
    </footer>
  )
}

