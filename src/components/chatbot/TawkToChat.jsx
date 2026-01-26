/**
 * Tawk.to Chatbot Integration
 * Free live chat widget for customer support
 * Customized for David's Salon
 */

import { useEffect } from 'react';

const TawkToChat = () => {
  useEffect(() => {
    // Tawk.to script integration
    var Tawk_API = Tawk_API || {};
    var Tawk_LoadStart = new Date();
    
    (function() {
      var s1 = document.createElement("script");
      var s0 = document.getElementsByTagName("script")[0];
      
      // You'll need to replace this with your actual Tawk.to Property ID
      // Sign up at https://www.tawk.to/ to get your free Property ID
      s1.async = true;
      s1.src = 'https://embed.tawk.to/YOUR_PROPERTY_ID/YOUR_WIDGET_ID';
      s1.charset = 'UTF-8';
      s1.setAttribute('crossorigin', '*');
      s0.parentNode.insertBefore(s1, s0);
      
      // Customize the widget for David's Salon
      s1.onload = function() {
        if (window.Tawk_API) {
          // Set visitor attributes
          window.Tawk_API.setAttributes({
            'name': 'Visitor',
            'company': 'David\'s Salon',
            'page': window.location.pathname
          }, function(error) {
            if (error) {
              console.error('Tawk.to attribute error:', error);
            }
          });

          // Add custom styling
          window.Tawk_API.customStyle = {
            visibility: {
              desktop: {
                position: 'br', // bottom-right
                xOffset: 20,
                yOffset: 20
              },
              mobile: {
                position: 'br',
                xOffset: 10,
                yOffset: 10
              }
            }
          };
        }
      };
    })();

    // Cleanup function
    return () => {
      // Remove Tawk.to widget when component unmounts
      if (window.Tawk_API && window.Tawk_API.hideWidget) {
        window.Tawk_API.hideWidget();
      }
    };
  }, []);

  return null; // This component doesn't render anything visible
};

export default TawkToChat;
