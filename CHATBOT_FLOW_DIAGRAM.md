# Chatbot Flow Diagram

## Visual Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     HOMEPAGE LOADS                          │
│                                                             │
│  ┌──────────────────────────────────────────────────┐     │
│  │                                                   │     │
│  │         David's Salon Homepage Content           │     │
│  │                                                   │     │
│  │  [Hero Section]                                  │     │
│  │  [Services]                                      │     │
│  │  [Branches]                                      │     │
│  │  [Footer]                                        │     │
│  │                                                   │     │
│  │                                    ┌──────────┐  │     │
│  │                                    │  💬 Chat │  │     │
│  │                                    │  Button  │  │     │
│  │                                    │  🟢      │  │     │
│  │                                    └──────────┘  │     │
│  └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ User clicks chat button
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   CHAT WINDOW OPENS                         │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 🤖 David's Salon Assistant        Online ● [X]     │   │
│  ├────────────────────────────────────────────────────┤   │
│  │                                                     │   │
│  │  🤖 Hello! Welcome to David's Salon! 👋           │   │
│  │     How can I help you today?                      │   │
│  │     10:30 AM                                       │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐  │   │
│  │  │ Quick Replies:                              │  │   │
│  │  │ [Services] [Book] [Branches] [Promos]      │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  │                                                     │   │
│  ├────────────────────────────────────────────────────┤   │
│  │ Type your message...                    [Send →]   │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ User types or clicks button
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   USER SENDS MESSAGE                        │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 🤖 David's Salon Assistant        Online ● [X]     │   │
│  ├────────────────────────────────────────────────────┤   │
│  │                                                     │   │
│  │  🤖 Hello! Welcome to David's Salon! 👋           │   │
│  │     How can I help you today?                      │   │
│  │     10:30 AM                                       │   │
│  │                                                     │   │
│  │                    What services do you offer? 👤  │   │
│  │                                        10:31 AM     │   │
│  │                                                     │   │
│  │  🤖 ● ● ●  (typing...)                            │   │
│  │                                                     │   │
│  ├────────────────────────────────────────────────────┤   │
│  │ Type your message...                    [Send →]   │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Bot processes (1 second)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   BOT RESPONDS                              │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ 🤖 David's Salon Assistant        Online ● [X]     │   │
│  ├────────────────────────────────────────────────────┤   │
│  │                                                     │   │
│  │  🤖 Hello! Welcome to David's Salon! 👋           │   │
│  │     How can I help you today?                      │   │
│  │     10:30 AM                                       │   │
│  │                                                     │   │
│  │                    What services do you offer? 👤  │   │
│  │                                        10:31 AM     │   │
│  │                                                     │   │
│  │  🤖 David's Salon offers a wide range of          │   │
│  │     services including:                            │   │
│  │                                                     │   │
│  │     • Haircut and Blowdry                         │   │
│  │     • Hair Coloring                               │   │
│  │     • Straightening & Forming                     │   │
│  │     • Hair & Make Up                              │   │
│  │     • Hair Treatment                              │   │
│  │     • Nail Care / Waxing / Threading              │   │
│  │                                                     │   │
│  │     Would you like to book an appointment?         │   │
│  │     10:31 AM                                       │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐  │   │
│  │  │ [Services] [Book] [Branches] [Promos]      │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  │                                                     │   │
│  ├────────────────────────────────────────────────────┤   │
│  │ Type your message...                    [Send →]   │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Keyword Matching Logic

```
User Input: "What services do you offer?"
     │
     ▼
Convert to lowercase: "what services do you offer?"
     │
     ▼
Check for keywords:
     │
     ├─ Contains "service"? ✅ YES
     │
     ▼
Return response: responses.services[0]
     │
     ▼
Display to user with typing animation
```

## Response Categories

```
┌─────────────────────────────────────────────────────────┐
│                    CHATBOT KNOWLEDGE                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📋 SERVICES                                           │
│     Keywords: service, offer, what do you              │
│     Response: List of all services                     │
│                                                         │
│  📅 BOOKING                                            │
│     Keywords: book, appointment, schedule              │
│     Response: How to book online/phone                 │
│                                                         │
│  📍 BRANCHES                                           │
│     Keywords: branch, location, where                  │
│     Response: Branch information                       │
│                                                         │
│  🕐 HOURS                                              │
│     Keywords: hour, open, close, time                  │
│     Response: Operating hours                          │
│                                                         │
│  💰 PRICES                                             │
│     Keywords: price, cost, how much                    │
│     Response: Pricing information                      │
│                                                         │
│  🎁 PROMOTIONS                                         │
│     Keywords: promo, deal, discount, sale              │
│     Response: Current promotions                       │
│                                                         │
│  ⭐ LOYALTY                                            │
│     Keywords: loyalty, reward, point                   │
│     Response: Loyalty program details                  │
│                                                         │
│  🧴 PRODUCTS                                           │
│     Keywords: product, shampoo, conditioner            │
│     Response: Product information                      │
│                                                         │
│  ❌ CANCEL                                             │
│     Keywords: cancel, reschedule                       │
│     Response: Cancellation policy                      │
│                                                         │
│  📞 CONTACT                                            │
│     Keywords: contact, email, phone, call              │
│     Response: Contact information                      │
│                                                         │
│  👋 GREETING                                           │
│     Keywords: hi, hello, hey, good morning             │
│     Response: Friendly greeting                        │
│                                                         │
│  ❓ DEFAULT                                            │
│     No match found                                     │
│     Response: Helpful suggestions                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Component Architecture

```
HomePage.jsx
    │
    └─── ChatbotWidget.jsx
            │
            ├─── State Management
            │    ├─ isOpen (boolean)
            │    ├─ messages (array)
            │    ├─ inputValue (string)
            │    └─ isTyping (boolean)
            │
            ├─── Response System
            │    ├─ responses (object)
            │    ├─ quickReplies (array)
            │    └─ getResponse() (function)
            │
            ├─── UI Components
            │    ├─ Chat Button (floating)
            │    ├─ Chat Window (modal)
            │    ├─ Message List (scrollable)
            │    ├─ Quick Replies (buttons)
            │    └─ Input Field (text + send)
            │
            └─── Event Handlers
                 ├─ handleSend()
                 ├─ handleQuickReply()
                 ├─ handleKeyPress()
                 └─ scrollToBottom()
```

## User Journey

```
1. DISCOVERY
   └─ User lands on homepage
   └─ Sees chat button with pulsing indicator
   └─ Curious about the feature

2. ENGAGEMENT
   └─ Clicks chat button
   └─ Chat window opens smoothly
   └─ Sees welcome message
   └─ Notices quick reply buttons

3. INTERACTION
   └─ Clicks "Services" button OR types question
   └─ Sees typing indicator
   └─ Receives instant response
   └─ Reads information

4. CONTINUATION
   └─ Asks follow-up question
   └─ Uses quick replies for common questions
   └─ Gets all needed information

5. CONVERSION
   └─ Decides to book appointment
   └─ Clicks booking link in response
   └─ Proceeds to booking page

6. COMPLETION
   └─ Closes chat (optional)
   └─ Chat history preserved
   └─ Can reopen anytime
```

## Mobile Experience

```
┌──────────────────────┐
│   📱 MOBILE VIEW     │
├──────────────────────┤
│                      │
│  Homepage Content    │
│                      │
│  [Services]          │
│  [Branches]          │
│  [Footer]            │
│                      │
│         ┌──────┐     │
│         │ 💬   │     │
│         │ Chat │     │
│         └──────┘     │
│                      │
└──────────────────────┘
         │
         │ Tap
         ▼
┌──────────────────────┐
│  FULL SCREEN CHAT    │
├──────────────────────┤
│ 🤖 Assistant    [X]  │
├──────────────────────┤
│                      │
│ 🤖 Welcome!         │
│                      │
│    Hello! 👤        │
│                      │
│ 🤖 How can I help?  │
│                      │
├──────────────────────┤
│ [Services] [Book]    │
│ [Branches] [Promos]  │
├──────────────────────┤
│ Type...      [Send]  │
└──────────────────────┘
```

## Performance Flow

```
Page Load
    │
    ├─ Load React components (instant)
    ├─ Load Tailwind CSS (cached)
    └─ Initialize ChatbotWidget (instant)
         │
         └─ Component ready (no API calls)

User Opens Chat
    │
    ├─ Render chat window (instant)
    ├─ Show welcome message (500ms delay)
    └─ Ready for input

User Sends Message
    │
    ├─ Add to message list (instant)
    ├─ Show typing indicator (instant)
    ├─ Process keywords (< 1ms)
    ├─ Find response (< 1ms)
    └─ Display response (1000ms delay)

Total Response Time: ~1 second
```

---

This diagram shows the complete flow from homepage load to user interaction with the chatbot!
