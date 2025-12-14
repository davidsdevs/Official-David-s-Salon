import { useState, useEffect } from "react"
import Button from "../ui/Button"
import { Card, CardContent } from "../ui/Card"
import { X, Gift, Scissors, Sparkles } from "lucide-react"

export default function PromotionPopup() {
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    // Check if popup was already shown in this session
    const popupShown = sessionStorage.getItem('promotionPopupShown')
    
    if (!popupShown) {
      // Show popup after 2 seconds
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isVisible) {
        handleClose()
      }
    }

    if (isVisible) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isVisible])

  const handleClose = () => {
    setIsClosing(true)
    // Mark as shown in session storage
    sessionStorage.setItem('promotionPopupShown', 'true')
    
    // Remove popup after animation
    setTimeout(() => {
      setIsVisible(false)
    }, 300)
  }

  const handleJoinNow = () => {
    // Mark as shown and close
    sessionStorage.setItem('promotionPopupShown', 'true')
    setIsVisible(false)
    // In a real app, this would redirect to membership page or open a form
    console.log('Redirecting to membership signup...')
  }

  if (!isVisible) return null

  return (
    <div 
      className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div 
        className={`transform transition-all duration-300 ${
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="relative max-w-4xl w-full mx-auto overflow-hidden border-0 bg-white rounded-2xl" 
              style={{ boxShadow: '0 20px 60px 0 rgba(0, 0, 0, 0.15)' }}>
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex flex-col lg:flex-row min-h-[500px]">
            {/* Left Section - Text and Form */}
            <div className="flex-1 p-8 lg:p-12 flex flex-col justify-center">
              <div className="max-w-md mx-auto lg:mx-0">
                {/* Brand Name */}
                <h1 className="text-3xl lg:text-4xl font-bold text-[#160B53] mb-2">
                  DAVID'S SALON
                </h1>
                
                {/* Main Offer */}
                <h2 className="text-2xl lg:text-3xl font-bold text-[#160B53] mb-3">
                  MYSTERY DISCOUNT
                </h2>
                
                {/* Subtext */}
                <p className="text-gray-600 text-lg mb-8">
                  Get up to 50% off + free consultation, always ❤️
                </p>

                {/* Email Form */}
                <div className="space-y-4">
                  <input
                    type="email"
                    placeholder="your email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-[#160B53] focus:border-transparent"
                  />
                  
                  <Button 
                    onClick={handleJoinNow}
                    className="w-full bg-[#160B53] hover:bg-[#160B53]/90 text-white font-bold text-lg py-3 rounded-lg"
                  >
                    REVEAL MY DEAL
                  </Button>
                  
                  <button 
                    onClick={handleClose}
                    className="text-gray-400 text-sm hover:text-gray-600 transition-colors"
                  >
                    nah, I'm good
                  </button>
                </div>
              </div>
            </div>

            {/* Right Section - Visuals and Products */}
            <div className="flex-1 relative bg-gradient-to-br from-blue-50 to-purple-50 p-8 lg:p-12 flex items-center justify-center">
              {/* Offer Badge */}
              <div className="absolute top-6 right-6 bg-[#160B53] text-white px-4 py-2 rounded-full font-bold text-sm transform rotate-12">
                50% OFF
              </div>

              {/* Products Display */}
              <div className="relative w-full max-w-md">
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl opacity-50"></div>
                
                {/* Salon Services Icons */}
                <div className="relative z-10 grid grid-cols-2 gap-6 p-8">
                  {/* Hair Cut Service */}
                  <div className="bg-white rounded-xl p-6 shadow-lg text-center transform rotate-3 hover:rotate-0 transition-transform">
                    <Scissors className="w-12 h-12 text-[#160B53] mx-auto mb-3" />
                    <h3 className="font-bold text-[#160B53] text-sm mb-1">HAIR CUT</h3>
                    <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full inline-block">
                      NEW
                    </div>
                  </div>

                  {/* Hair Color Service */}
                  <div className="bg-white rounded-xl p-6 shadow-lg text-center transform -rotate-2 hover:rotate-0 transition-transform">
                    <Sparkles className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                    <h3 className="font-bold text-purple-600 text-sm mb-1">HAIR COLOR</h3>
                    <div className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full inline-block">
                      POPULAR
                    </div>
                  </div>

                  {/* Hair Treatment Service */}
                  <div className="bg-white rounded-xl p-6 shadow-lg text-center transform rotate-1 hover:rotate-0 transition-transform col-span-2">
                    <Gift className="w-12 h-12 text-pink-500 mx-auto mb-3" />
                    <h3 className="font-bold text-pink-500 text-sm mb-1">HAIR TREATMENT</h3>
                    <div className="bg-pink-100 text-pink-800 text-xs px-2 py-1 rounded-full inline-block">
                      FREE
                    </div>
                  </div>
                </div>

                {/* Floating Elements */}
                <div className="absolute -top-4 -left-4 w-8 h-8 bg-yellow-300 rounded-full opacity-60"></div>
                <div className="absolute -bottom-4 -right-4 w-6 h-6 bg-pink-300 rounded-full opacity-60"></div>
                <div className="absolute top-1/2 -right-8 w-4 h-4 bg-blue-300 rounded-full opacity-60"></div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

