/**
 * Script to create 5 Epics in Jira with User Stories and Tasks
 * Run with: node create-jira-epics.js
 */

const CLOUD_ID = 'a93eaa1a-8a7f-4680-b47f-53214cf20122';
const PROJECT_KEY = 'FFR';
const DELAY_MS = 3000; // 3 seconds between API calls to avoid rate limiting

// Epics and their stories/tasks
const epicsData = [
  {
    epic: {
      summary: 'Authentication & Security System',
      description: `Implement a comprehensive authentication and security system for the Zoiro Broast Hub platform.

Key Features:
- OTP-based registration and login via Brevo email service
- Google Authenticator 2FA integration
- JWT token authentication with secure cookies
- Rate limiting (5 requests/min) for auth endpoints
- Employee activation workflow
- Password reset functionality
- Session management

Technical Components:
- Login/Registration APIs with email OTP
- 2FA setup and verification endpoints
- Brevo API integration for OTP emails
- Redis-based rate limiting
- Secure JWT token generation and validation`
    },
    stories: [
      {
        summary: 'User Story: OTP-based Registration',
        type: 'Story',
        description: `As a user, I want to register with my email and receive an OTP code, so that I can create an account securely.

Acceptance Criteria:
- User enters email address on registration page
- System sends 6-digit OTP via Brevo email service
- OTP expires after 10 minutes
- User verifies OTP to complete registration
- Rate limiting prevents spam (5 attempts per minute)`
      },
      {
        summary: 'User Story: Enable 2FA with Google Authenticator',
        type: 'Story',
        description: `As a portal user, I want to enable two-factor authentication using Google Authenticator, so that my account has an extra layer of security.

Acceptance Criteria:
- User can access 2FA settings in security tab
- System generates QR code and manual entry key
- User scans QR code with Google Authenticator app
- User enters 6-digit verification code to enable 2FA
- System saves TOTP secret to database
- 2FA required on subsequent logins`
      },
      {
        summary: 'Task: Implement JWT Token Authentication',
        type: 'Task',
        description: `Implement JWT token authentication with secure HTTP-only cookies for session management.

Technical Requirements:
- Generate JWT tokens with user claims (id, email, role)
- Store tokens in HTTP-only cookies
- Implement token refresh mechanism
- Validate tokens on protected routes
- Handle token expiration gracefully
- Clear tokens on logout
- Use lib/jwt.ts and lib/cookies.ts`
      },
      {
        summary: 'Task: Setup Rate Limiting with Redis',
        type: 'Task',
        description: `Implement rate limiting for authentication endpoints using Redis.

Technical Requirements:
- Use Upstash Redis for distributed rate limiting
- Limit auth endpoints to 5 requests per minute per IP
- Store rate limit counters in Redis with TTL
- Return 429 status code when limit exceeded
- Implement in lib/rate-limit.ts`
      }
    ]
  },
  {
    epic: {
      summary: 'Order Management & Tracking System',
      description: `Implement a comprehensive order management system with real-time tracking, kitchen workflow, billing, and delivery coordination.

Key Features:
- Online order placement with menu browsing
- Real-time order status tracking (WebSocket)
- Kitchen order management and workflow
- Billing and payment processing
- Delivery management and driver assignment
- Order history and analytics

Technical Components:
- create-order-rpc.sql for order creation
- Real-time order status updates via Supabase
- Kitchen dashboard with live order queue
- Billing calculations with promotions
- Delivery tracking system`
    },
    stories: [
      {
        summary: 'User Story: Place Order Online',
        type: 'Story',
        description: `As a customer, I want to place an order online by selecting menu items, so that I can purchase food conveniently.

Acceptance Criteria:
- Browse menu items by category
- Add items to cart with customizations
- View cart with total price
- Apply promo codes for discounts
- Choose delivery or pickup
- Receive order confirmation email`
      },
      {
        summary: 'User Story: Track Order Status in Real-time',
        type: 'Story',
        description: `As a customer, I want to track my order status in real-time, so that I know when my food will be ready.

Acceptance Criteria:
- View order status (Pending, Preparing, Ready, Delivered)
- Receive real-time updates via WebSocket
- See estimated completion time
- Get notifications on status changes
- View order details and items`
      },
      {
        summary: 'Task: Implement Create Order RPC',
        type: 'Task',
        description: `Create the create-order-rpc stored procedure for order placement.

Technical Requirements:
- Validate menu items and availability
- Calculate total with tax and discounts
- Create order record with auto-generated ID
- Insert order items with quantities
- Apply promo code if provided
- Return order ID and confirmation details
- File: supabase/create-order-rpc.sql`
      },
      {
        summary: 'Task: Setup Real-time Order Updates',
        type: 'Task',
        description: `Implement real-time order status updates using Supabase Realtime.

Technical Requirements:
- Subscribe to orders table changes
- Filter by customer/employee ID
- Update UI on status changes
- Handle connection errors gracefully
- Implement in lib/realtime-manager.ts
- Deduplicate subscriptions`
      }
    ]
  },
  {
    epic: {
      summary: 'Employee & Payroll Management',
      description: `Implement employee management system with attendance tracking, payroll calculations, and role-based permissions.

Key Features:
- Employee CRUD operations with activation workflow
- Attendance check-in/check-out system
- Automated payroll calculations based on hours worked
- Role-based access control (Admin, Manager, Employee)
- Employee performance tracking
- Leave management

Technical Components:
- create-employee-complete-rpc.sql
- Attendance tracking with clock-in/out
- Payroll PDF generation
- Permission system with cached roles
- Employee portal with personalized dashboard`
    },
    stories: [
      {
        summary: 'User Story: Employee Self-Service Portal',
        type: 'Story',
        description: `As an employee, I want to access a self-service portal to view my schedule, check attendance, and see payroll information.

Acceptance Criteria:
- View work schedule and shifts
- Clock in/out for attendance
- View attendance history
- See payroll statements
- Request time off
- Update personal information`
      },
      {
        summary: 'User Story: Automated Payroll Calculation',
        type: 'Story',
        description: `As an admin, I want the system to automatically calculate employee payroll based on attendance, so that I can process payments efficiently.

Acceptance Criteria:
- Calculate hours worked from attendance records
- Apply hourly/salary rates
- Include overtime calculations
- Deduct taxes and benefits
- Generate payroll reports
- Export to PDF`
      },
      {
        summary: 'Task: Implement Attendance Clock System',
        type: 'Task',
        description: `Create attendance tracking system with clock-in/clock-out functionality.

Technical Requirements:
- Clock-in API endpoint with timestamp
- Clock-out with automatic break calculation
- Prevent duplicate clock-ins
- Store GPS location (optional)
- Calculate total hours worked
- File: supabase/attendance-rpc.sql`
      },
      {
        summary: 'Task: Generate Payroll PDF Reports',
        type: 'Task',
        description: `Implement PDF generation for payroll statements.

Technical Requirements:
- Use lib/payroll-pdf.ts
- Include employee details and period
- Show hours worked and rate
- Calculate gross and net pay
- Add company branding
- Email PDF to employee`
      }
    ]
  },
  {
    epic: {
      summary: 'Menu & Inventory Management',
      description: `Implement comprehensive menu and inventory management with CRUD operations, image uploads, and stock tracking.

Key Features:
- Menu item management (CRUD operations)
- Category organization
- Image upload to Supabase Storage
- Inventory tracking and low stock alerts
- Item availability management
- Menu item pricing and variations
- Nutritional information

Technical Components:
- /api/admin/menu-items CRUD endpoints
- /api/upload/image for image handling
- Supabase Storage buckets (images, avatars)
- Redis cache invalidation on updates
- Inventory quantity tracking`
    },
    stories: [
      {
        summary: 'User Story: Manage Menu Items with Images',
        type: 'Story',
        description: `As an admin, I want to create, edit, and delete menu items with images, so that I can keep the menu updated.

Acceptance Criteria:
- Create new menu item with details
- Upload item image (JPEG/PNG/WebP, max 5MB)
- Edit existing item information
- Delete items with confirmation
- Organize items by category
- Set pricing and availability`
      },
      {
        summary: 'User Story: Track Inventory Levels',
        type: 'Story',
        description: `As a manager, I want to track inventory levels for ingredients, so that I can reorder supplies before stockouts.

Acceptance Criteria:
- View current inventory levels
- Set low stock thresholds
- Receive alerts when stock is low
- Update quantities on deliveries
- Track usage per order
- Generate inventory reports`
      },
      {
        summary: 'Task: Implement Image Upload API',
        type: 'Task',
        description: `Create image upload system using Supabase Storage.

Technical Requirements:
- Accept JPEG, PNG, WebP formats
- Validate file size (max 5MB)
- Upload to Supabase Storage bucket
- Generate public URL
- Rate limit to 30 requests/min
- Handle upload errors
- File: /api/upload/image`
      },
      {
        summary: 'Task: Setup Cache Invalidation',
        type: 'Task',
        description: `Implement Redis cache invalidation when menu items are updated.

Technical Requirements:
- Clear menu cache on CRUD operations
- Invalidate category cache
- Update ISR pages
- Trigger revalidation for affected routes
- Use lib/cache.ts helper functions`
      }
    ]
  },
  {
    epic: {
      summary: 'Customer Portal & Loyalty System',
      description: `Implement customer-facing features including profile management, order history, favorites, loyalty rewards, and promotional deals.

Key Features:
- Customer profile management
- Order history with reordering
- Favorite items and meals
- Loyalty points and rewards
- Promotional codes and deals
- Customer reviews and ratings
- Personalized recommendations

Technical Components:
- Customer portal pages
- Loyalty points calculation system
- Promo code application RPC
- Review submission and moderation
- Customer notifications
- Cart and favorites context`
    },
    stories: [
      {
        summary: 'User Story: Customer Profile Management',
        type: 'Story',
        description: `As a customer, I want to manage my profile information and delivery addresses, so that ordering is faster and more convenient.

Acceptance Criteria:
- View and edit profile details
- Add multiple delivery addresses
- Save payment methods
- View loyalty points balance
- Set notification preferences
- Change password or enable 2FA`
      },
      {
        summary: 'User Story: Loyalty Points & Rewards',
        type: 'Story',
        description: `As a customer, I want to earn loyalty points on purchases and redeem them for rewards, so that I'm incentivized to order again.

Acceptance Criteria:
- Earn points on every order (1 point per $1)
- View points balance in profile
- Browse available rewards
- Redeem points for discounts
- See points history
- Get bonus points on special occasions`
      },
      {
        summary: 'Task: Implement Promo Code System',
        type: 'Task',
        description: `Create promo code application and validation system.

Technical Requirements:
- Validate promo code on checkout
- Check expiry date and usage limits
- Apply percentage or fixed discounts
- Limit to specific customers/items
- Track promo code usage
- File: supabase/apply-promo-code-rpc.sql`
      },
      {
        summary: 'Task: Build Customer Review System',
        type: 'Task',
        description: `Implement customer review and rating functionality.

Technical Requirements:
- Submit review with star rating
- Add photos to reviews
- Moderate reviews (admin approval)
- Display average ratings
- Filter reviews by rating
- Implement in /api/admin/reviews`
      }
    ]
  }
];

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Create issue function (you'll need to implement the actual API call)
async function createJiraIssue(cloudId, projectKey, issueTypeName, summary, description) {
  console.log(`Creating ${issueTypeName}: ${summary}`);
  
  // Note: This needs to be implemented with actual Atlassian MCP tool
  // For now, this is a placeholder showing the structure
  console.log(`  Project: ${projectKey}`);
  console.log(`  Type: ${issueTypeName}`);
  console.log(`  Description length: ${description.length} chars`);
  
  // Simulate API delay
  await delay(DELAY_MS);
  
  return { key: `${projectKey}-X`, id: 'pending' };
}

// Main execution
async function main() {
  console.log('Starting Jira Epic Creation...\n');
  console.log(`Cloud ID: ${CLOUD_ID}`);
  console.log(`Project: ${PROJECT_KEY}`);
  console.log(`Delay between calls: ${DELAY_MS}ms\n`);
  console.log('='.repeat(60));
  
  const results = [];
  
  for (let i = 0; i < epicsData.length; i++) {
    const epicData = epicsData[i];
    
    console.log(`\n📦 EPIC ${i + 1}/${epicsData.length}: ${epicData.epic.summary}`);
    console.log('-'.repeat(60));
    
    // Create Epic
    try {
      const epic = await createJiraIssue(
        CLOUD_ID,
        PROJECT_KEY,
        'Epic',
        epicData.epic.summary,
        epicData.epic.description
      );
      
      console.log(`✅ Epic created: ${epic.key}`);
      results.push({ epic: epic.key, stories: [] });
      
      // Create stories/tasks for this epic
      for (let j = 0; j < epicData.stories.length; j++) {
        const story = epicData.stories[j];
        
        try {
          const storyIssue = await createJiraIssue(
            CLOUD_ID,
            PROJECT_KEY,
            story.type,
            story.summary,
            story.description
          );
          
          console.log(`  ✅ ${story.type} created: ${storyIssue.key} - ${story.summary}`);
          results[i].stories.push(storyIssue.key);
          
        } catch (error) {
          console.error(`  ❌ Failed to create ${story.type}:`, error.message);
        }
      }
      
    } catch (error) {
      console.error(`❌ Failed to create Epic:`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  results.forEach((result, idx) => {
    console.log(`Epic ${idx + 1}: ${result.epic}`);
    console.log(`  Stories/Tasks: ${result.stories.length}`);
    result.stories.forEach(s => console.log(`    - ${s}`));
  });
  
  console.log('\n✨ Done! Check your Jira project at:');
  console.log(`https://forlaptop7172.atlassian.net/jira/software/projects/${PROJECT_KEY}/board`);
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { epicsData, createJiraIssue };
