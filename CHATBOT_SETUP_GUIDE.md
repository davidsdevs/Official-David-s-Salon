# Chatbot Setup Guide - Quick Start

## What Was Added

A free, custom chatbot that appears on your landing page and can answer questions about David's Salon.

## How to Use

### For Visitors
1. Visit the homepage
2. Look for the purple chat button in the bottom-right corner
3. Click to open the chat
4. Type questions or click quick reply buttons
5. Get instant answers about services, booking, branches, etc.

## Customizing the Chatbot

### 1. Change Responses

**File**: `src/components/chatbot/ChatbotWidget.jsx`

**Location**: Lines 15-80 (the `responses` object)

**Example**: Add a new response about gift cards:

```javascript
const responses = {
  // ... existing responses
  giftcards: [
    "Yes! We offer gift cards perfect for any occasion. You can purchase them at any David's Salon branch. They make great gifts for birthdays, holidays, or just to treat someone special!"
  ],
  // ... rest of responses
};
```

Then add keyword matching (around line 120):

```javascript
if (lowerInput.includes('gift card') || lowerInput.includes('gift certificate')) {
  return responses.giftcards[0];
}
```

### 2. Add Quick Reply Buttons

**File**: `src/components/chatbot/ChatbotWidget.jsx`

**Location**: Lines 82-89 (the `quickReplies` array)

**Example**: Add a "Gift Cards" button:

```javascript
const quickReplies = [
  { text: "Services", keyword: "services" },
  { text: "Book Appointment", keyword: "booking" },
  { text: "Branches", keyword: "branches" },
  { text: "Promotions", keyword: "promotions" },
  { text: "Gift Cards", keyword: "giftcards" }, // NEW
  { text: "Contact", keyword: "contact" }
];
```

### 3. Change Colors

**Chat Button Color**:
```javascript
// Line ~200
className="... bg-gradient-to-r from-[#160B53] to-[#2D1B69] ..."
```

**User Message Color**:
```javascript
// Line ~280
className="... bg-[#160B53] text-white ..."
```

### 4. Change Position

**Move to Bottom-Left**:
```javascript
// Line ~200 and ~230
className="fixed bottom-6 left-6 ..." // Change right-6 to left-6
```

**Move Higher on Page**:
```javascript
// Line ~200 and ~230
className="fixed bottom-20 right-6 ..." // Change bottom-6 to bottom-20
```

## Testing the Chatbot

### Test Questions to Try:
1. "What services do you offer?"
2. "How do I book an appointment?"
3. "Where are your branches?"
4. "What are your hours?"
5. "Do you have any promotions?"
6. "How much does a haircut cost?"
7. "Tell me about your loyalty program"
8. "How do I cancel my appointment?"
9. "What's your contact information?"

### Expected Behavior:
- ✅ Chat button appears in bottom-right corner
- ✅ Green pulsing dot shows it's "online"
- ✅ Clicking opens the chat window
- ✅ Welcome message appears automatically
- ✅ Quick reply buttons are visible
- ✅ Bot responds within 1 second
- ✅ Typing indicator shows before response
- ✅ Messages scroll automatically
- ✅ Can close and reopen chat

## Troubleshooting

### Chat Button Not Showing
1. Check if you're on the homepage (not embedded view)
2. Clear browser cache (Ctrl+Shift+R)
3. Check browser console for errors

### Bot Not Responding
1. Check if message was sent (press Enter or click Send)
2. Try a different question
3. Check browser console for errors

### Styling Issues
1. Check for CSS conflicts
2. Verify Tailwind CSS is loaded
3. Try in incognito mode

## Alternative: Use Tawk.to (Free Live Chat)

If you want human support instead of automated responses:

### Step 1: Sign Up
1. Go to https://www.tawk.to/
2. Create free account
3. Add your website
4. Get your Property ID

### Step 2: Update Code
**File**: `src/components/chatbot/TawkToChat.jsx`

**Line 18**: Replace with your IDs:
```javascript
s1.src = 'https://embed.tawk.to/YOUR_PROPERTY_ID/YOUR_WIDGET_ID';
```

### Step 3: Switch Components
**File**: `src/pages/public/HomePage.jsx`

**Line 10**: Change import:
```javascript
// FROM:
import ChatbotWidget from "../../components/chatbot/ChatbotWidget"

// TO:
import TawkToChat from "../../components/chatbot/TawkToChat"
```

**Line 906**: Change component:
```javascript
// FROM:
{!embedded && <ChatbotWidget />}

// TO:
{!embedded && <TawkToChat />}
```

### Tawk.to Benefits:
- Real human support
- Mobile app for agents
- Chat history
- File sharing
- Visitor monitoring
- Free forever

## Quick Reference

### Files Modified:
- ✅ `src/components/chatbot/ChatbotWidget.jsx` (NEW)
- ✅ `src/components/chatbot/TawkToChat.jsx` (NEW - alternative)
- ✅ `src/pages/public/HomePage.jsx` (MODIFIED)

### What It Does:
- Answers common questions automatically
- Available 24/7
- No external services needed
- Free to use
- Fully customizable

### What It Knows:
- Services offered
- Booking process
- Branch locations
- Operating hours
- Pricing information
- Promotions
- Loyalty program
- Products
- Cancellation policy
- Contact information

## Need Help?

1. Check `CHATBOT_INTEGRATION.md` for detailed documentation
2. Review the code comments in `ChatbotWidget.jsx`
3. Test with the questions listed above
4. Check browser console for errors

## Next Steps

1. ✅ Test the chatbot on your homepage
2. ✅ Try different questions
3. ✅ Customize responses for your needs
4. ✅ Add more quick reply buttons
5. ✅ Consider Tawk.to for human support
6. ✅ Monitor common questions
7. ✅ Update responses based on feedback

Enjoy your new chatbot! 🤖💬
