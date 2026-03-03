# AI Features for Zoiro Broast — Free Implementation Guide

All features below use **100% free AI APIs/tools**. No paid subscription needed.

---

## Free AI APIs to Use

| API | Free Limit | Best For |
|-----|-----------|----------|
| **Google Gemini 1.5 Flash** | 15 req/min, 1M tokens/day | Chatbot, recommendations |
| **Groq (Llama 3)** | 14,400 req/day free | Fast responses, search |
| **Hugging Face Inference** | Free tier | Text classification, sentiment |
| **Vercel AI SDK** | Free SDK | Easy Next.js AI integration |
| **OpenRouter (free models)** | Free with limits | Multiple models |

---

## Role: Customer (Public Website)

### 1. AI Chatbot (Customer Support)
- **What it does:** Floating chat button on website. Customer asks anything — "What's on the menu?", "How long is delivery?", "Do you have deals today?"
- **AI:** Google Gemini 1.5 Flash (free)
- **How to implement:** Add API route `/api/ai/chat` + floating chat widget component
- **Difficulty:** Easy ⭐

### 2. Smart Menu Recommendations
- **What it does:** "You might also like..." section on menu/cart page. AI suggests items based on what customer has in cart
- **AI:** Gemini or rule-based logic with embeddings (Hugging Face free)
- **Difficulty:** Easy ⭐

### 3. AI-Powered Menu Search
- **What it does:** Customer types "something spicy under 500 Rs" and AI finds matching menu items using natural language
- **AI:** Google Gemini or Groq
- **Difficulty:** Medium ⭐⭐

### 4. Food Description Generator (Already in DB → Auto Enhance)
- **What it does:** Auto-generate mouth-watering descriptions for menu items from just the item name
- **AI:** Gemini 1.5 Flash
- **Difficulty:** Easy ⭐

### 5. Voice Ordering
- **What it does:** Customer taps mic, says "I want 2 broast pieces and a Pepsi", AI adds items to cart
- **AI:** Browser Web Speech API (free, built-in) + Gemini for intent parsing
- **Difficulty:** Hard ⭐⭐⭐

### 6. AI Order Summary (WhatsApp Message)
- **What it does:** After order placement, AI writes a friendly WhatsApp-ready order summary message
- **AI:** Gemini
- **Difficulty:** Easy ⭐

### 7. Sentiment-Based Review Response
- **What it does:** If customer leaves a review/feedback, AI auto-generates a polite reply
- **AI:** Gemini or Groq
- **Difficulty:** Easy ⭐

---

## Role: Admin (Portal)

### 8. AI Sales Insights Dashboard
- **What it does:** Admin sees "This week your best seller is Broast Piece 2 pcs. Sales are 23% higher than last week. Consider restocking drumsticks." — natural language business reports
- **AI:** Gemini with your Supabase data
- **Difficulty:** Medium ⭐⭐

### 9. AI Promo Code Generator
- **What it does:** Admin clicks one button, AI suggests smart promo codes with names, discounts, and conditions based on current slow-selling items
- **AI:** Gemini
- **Difficulty:** Easy ⭐

### 10. AI Deal Creator
- **What it does:** Admin describes deal in plain text: "Make a family deal with broast, fries, and drinks for Friday nights", AI creates the deal structure
- **AI:** Gemini
- **Difficulty:** Medium ⭐⭐

### 11. Inventory Restock Predictor
- **What it does:** Based on order history, AI predicts which items will run low this week and alerts admin
- **AI:** Simple ML pattern + Gemini for explanation
- **Difficulty:** Medium ⭐⭐

### 12. AI Employee Performance Summary
- **What it does:** Admin gets a plain-language weekly summary: "Waiter Ahmed handled 45 orders, 3 complaints. Delivery driver completed 89% on-time."
- **AI:** Gemini (summarize database data)
- **Difficulty:** Medium ⭐⭐

### 13. AI-Powered FAQ Auto-Update
- **What it does:** AI monitors most common chat questions and suggests new FAQ entries to admin
- **AI:** Gemini
- **Difficulty:** Medium ⭐⭐

### 14. Menu Item Image Caption/Alt Generator
- **What it does:** When admin uploads food image, AI generates SEO-friendly alt text and captions automatically
- **AI:** Gemini Vision (free tier)
- **Difficulty:** Easy ⭐

---

## Role: Employee (Portal)

### 15. AI Order Priority Assistant
- **What it does:** Waiter/kitchen staff sees AI-ranked queue: "These 3 orders are time-critical. Suggested prep order: Table 5 → Table 2 → Table 8"
- **AI:** Gemini reading order data
- **Difficulty:** Medium ⭐⭐

### 16. AI Shift Summary for Employees
- **What it does:** At end of shift, employee gets: "You served 32 customers, earned Rs 450 in tips, handled 1 complaint. Great job!"
- **AI:** Gemini summarizing shift data
- **Difficulty:** Easy ⭐

### 17. Smart Upsell Suggestions for Waiters
- **What it does:** When waiter enters order, AI suggests: "Customer ordered Broast Meal — suggest adding Pepsi or Fries (80% of similar orders include these)"
- **AI:** Gemini or pattern matching
- **Difficulty:** Medium ⭐⭐

---

## Quick Implementation Priority (Start Here)

| Priority | Feature | Time to Build | Impact |
|----------|---------|--------------|--------|
| 1 | **AI Customer Chatbot** (#1) | 2-3 hours | Very High |
| 2 | **Smart Recommendations** (#2) | 1-2 hours | High |
| 3 | **AI Sales Insights** (#8) | 3-4 hours | Very High (Admin) |
| 4 | **AI Promo Generator** (#9) | 1 hour | High (Admin) |
| 5 | **AI Menu Search** (#3) | 2-3 hours | High |

---

## How to Get Started (Free Setup)

### Step 1: Get Google Gemini API Key (Free)
1. Go to [https://aistudio.google.com](https://aistudio.google.com)
2. Click "Get API Key" → Create free key
3. Add to `.env.local`:
   ```
   GEMINI_API_KEY=your_key_here
   ```

### Step 2: Install Vercel AI SDK
```bash
npm install ai @ai-sdk/google
```

### Step 3: Create AI API Route (`/app/api/ai/chat/route.ts`)
```typescript
import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = await streamText({
    model: google('gemini-1.5-flash'),  // FREE model
    system: `You are a helpful assistant for Zoiro Broast restaurant in Vehari Pakistan. 
    You help customers with menu questions, prices, delivery, and orders.
    Restaurant hours: 11am - 11pm daily. Phone: +92 304 629 2822.`,
    messages,
  });

  return result.toDataStreamResponse();
}
```

### Step 4: Add Chat Widget to Layout
```typescript
// Add <AIChatWidget /> to app/layout.tsx
```

---

## Tell GitHub Copilot Which Feature to Implement

Just say:
- *"Implement the AI chatbot"*
- *"Add AI sales insights to admin portal"*
- *"Build the smart menu recommendations"*
- *"Add AI promo code generator"*

And it will be built into your existing Next.js + Supabase project.
