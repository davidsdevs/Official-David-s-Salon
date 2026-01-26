/**
 * Custom Chatbot Widget for David's Salon
 * Simple FAQ-based chatbot with common questions
 */

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';

const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Predefined responses about David's Salon
  const responses = {
    greeting: [
      "Hello! I'm Dave, your David's Salon assistant! 👋 How can I help you today?",
      "Hi there! I'm Dave, and I'm here to help you with any questions about David's Salon. What would you like to know?"
    ],
    services: [
      "David's Salon offers a wide range of services including:\n\n• Haircut and Blowdry\n• Hair Coloring\n• Straightening & Forming\n• Hair & Make Up\n• Hair Treatment\n• Nail Care / Waxing / Threading\n\nWould you like to book an appointment?"
    ],
    booking: [
      "You can book an appointment in two ways:\n\n1. Online: Click 'Book Appointment' on our website\n2. Call us: Contact your preferred branch directly\n\nWould you like me to help you find a branch?"
    ],
    branches: [
      "David's Salon has multiple branches across the Philippines! You can view all our branches and their locations on our website. Each branch offers specialized services tailored to the local community.\n\nWould you like to see our branch locations?"
    ],
    hours: [
      "Most David's Salon branches are open:\n\nMonday - Saturday: 9:00 AM - 6:00 PM\nSunday: Varies by branch\n\nPlease check your specific branch for exact hours as they may vary."
    ],
    prices: [
      "Our prices vary by branch and service. You can:\n\n1. View prices when booking online\n2. Contact your preferred branch directly\n3. Check our services page for general pricing\n\nWould you like to book an appointment to see specific prices?"
    ],
    promotions: [
      "We regularly offer promotions and special deals! Check our Promotions page to see current offers. You can also sign up for our loyalty program to earn rewards with every visit!"
    ],
    loyalty: [
      "Our Loyalty Program rewards you for every visit!\n\n• Earn points with each service\n• Get exclusive discounts\n• Birthday specials\n• Referral bonuses\n\nSign up when you create an account on our website!"
    ],
    products: [
      "We offer premium hair care products from top brands. You can:\n\n• Purchase products at any branch\n• Ask your stylist for recommendations\n• View available products on our website\n\nOur stylists can help you choose the perfect products for your hair type!"
    ],
    cancel: [
      "To cancel or reschedule an appointment:\n\n1. Log in to your account\n2. Go to 'My Appointments'\n3. Select the appointment\n4. Choose 'Cancel' or 'Reschedule'\n\nPlease note our cancellation policy to avoid any fees."
    ],
    contact: [
      "You can reach us:\n\n📧 Email: info@davidssalon.ph\n📱 Phone: Check your branch's contact info\n🌐 Website: www.davidssalon.ph\n\nOr use this chat to ask me anything!"
    ],
    default: [
      "I'm not sure about that, but I'd love to help! You can:\n\n• Ask about our services\n• Book an appointment\n• Find a branch\n• Learn about promotions\n\nWhat would you like to know?"
    ]
  };

  // Quick reply buttons
  const quickReplies = [
    { text: "Services", keyword: "services" },
    { text: "Book Appointment", keyword: "booking" },
    { text: "Branches", keyword: "branches" },
    { text: "Promotions", keyword: "promotions" },
    { text: "Contact", keyword: "contact" }
  ];

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Send welcome message when chat opens
      setTimeout(() => {
        addBotMessage(responses.greeting[0]);
      }, 500);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addBotMessage = (text) => {
    setMessages(prev => [...prev, { text, sender: 'bot', timestamp: new Date() }]);
    setIsTyping(false);
  };

  const addUserMessage = (text) => {
    setMessages(prev => [...prev, { text, sender: 'user', timestamp: new Date() }]);
  };

  const getResponse = (input) => {
    const lowerInput = input.toLowerCase();
    
    // Check for greetings
    if (lowerInput.match(/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/)) {
      return responses.greeting[Math.floor(Math.random() * responses.greeting.length)];
    }
    
    // Check for specific keywords
    if (lowerInput.includes('service') || lowerInput.includes('what do you offer')) {
      return responses.services[0];
    }
    if (lowerInput.includes('book') || lowerInput.includes('appointment') || lowerInput.includes('schedule')) {
      return responses.booking[0];
    }
    if (lowerInput.includes('branch') || lowerInput.includes('location') || lowerInput.includes('where')) {
      return responses.branches[0];
    }
    if (lowerInput.includes('hour') || lowerInput.includes('open') || lowerInput.includes('close') || lowerInput.includes('time')) {
      return responses.hours[0];
    }
    if (lowerInput.includes('price') || lowerInput.includes('cost') || lowerInput.includes('how much')) {
      return responses.prices[0];
    }
    if (lowerInput.includes('promo') || lowerInput.includes('deal') || lowerInput.includes('discount') || lowerInput.includes('sale')) {
      return responses.promotions[0];
    }
    if (lowerInput.includes('loyalty') || lowerInput.includes('reward') || lowerInput.includes('point')) {
      return responses.loyalty[0];
    }
    if (lowerInput.includes('product') || lowerInput.includes('shampoo') || lowerInput.includes('conditioner')) {
      return responses.products[0];
    }
    if (lowerInput.includes('cancel') || lowerInput.includes('reschedule')) {
      return responses.cancel[0];
    }
    if (lowerInput.includes('contact') || lowerInput.includes('email') || lowerInput.includes('phone') || lowerInput.includes('call')) {
      return responses.contact[0];
    }
    
    return responses.default[0];
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;

    addUserMessage(inputValue);
    setInputValue('');
    setIsTyping(true);

    // Simulate typing delay
    setTimeout(() => {
      const response = getResponse(inputValue);
      addBotMessage(response);
    }, 1000);
  };

  const handleQuickReply = (keyword) => {
    addUserMessage(quickReplies.find(q => q.keyword === keyword)?.text || keyword);
    setIsTyping(true);

    setTimeout(() => {
      const response = responses[keyword] ? responses[keyword][0] : responses.default[0];
      addBotMessage(response);
    }, 1000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-[#160B53] to-[#2D1B69] text-white rounded-full p-4 shadow-2xl hover:shadow-3xl hover:scale-110 transition-all duration-300 group"
          aria-label="Open chat"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
          
          {/* Tooltip */}
          <span className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Chat with us!
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border-2 border-gray-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#160B53] to-[#2D1B69] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6 text-[#160B53]" />
              </div>
              <div>
                <h3 className="font-bold">Dave</h3>
                <p className="text-xs text-white/80">Your David's Salon Assistant</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    message.sender === 'user'
                      ? 'bg-[#160B53] text-white rounded-br-none'
                      : 'bg-white text-gray-800 rounded-bl-none shadow-md'
                  }`}
                >
                  <p className="text-sm whitespace-pre-line">{message.text}</p>
                  <p className={`text-xs mt-1 ${message.sender === 'user' ? 'text-white/70' : 'text-gray-500'}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-bl-none px-4 py-3 shadow-md">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          {messages.length > 0 && !isTyping && (
            <div className="px-4 py-2 bg-white border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                {quickReplies.map((reply) => (
                  <button
                    key={reply.keyword}
                    onClick={() => handleQuickReply(reply.keyword)}
                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-full transition-colors"
                  >
                    {reply.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#160B53] focus:border-transparent"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="bg-[#160B53] text-white rounded-full p-2 hover:bg-[#1a0f63] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;
