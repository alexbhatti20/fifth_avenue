const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@zoirobroast.com';
const SENDER_NAME = 'Zoiro Broast';
const COMPANY_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const LOGO_URL = 'https://eqfeeiryzslccyivkphf.supabase.co/storage/v1/object/public/images/website/images.png';

// Brand Colors
const BRAND_RED = '#C8102E';
const BRAND_DARK = '#1a1a1a';
const BRAND_WHITE = '#ffffff';
const BRAND_LIGHT_BG = '#f9f9f9';

// Shared email header component
const getEmailHeader = (title: string, subtitle?: string) => `
  <div style="background: ${BRAND_DARK}; padding: 30px 20px; text-align: center;">
    <img src="${LOGO_URL}" alt="ZOIRO Broast" style="height: 60px; margin-bottom: 15px;" />
    <h1 style="color: ${BRAND_WHITE}; margin: 0; font-size: 24px; font-weight: bold;">${title}</h1>
    ${subtitle ? `<p style="color: #cccccc; margin: 10px 0 0; font-size: 14px;">${subtitle}</p>` : ''}
  </div>
`;

// Shared email footer component
const getEmailFooter = () => `
  <div style="background: ${BRAND_DARK}; color: ${BRAND_WHITE}; padding: 30px; text-align: center;">
    <img src="${LOGO_URL}" alt="ZOIRO Broast" style="height: 40px; margin-bottom: 15px;" />
    <p style="margin: 5px 0; font-size: 14px;"><strong>ZOIRO Broast</strong></p>
    <p style="margin: 5px 0; font-size: 12px; color: #aaa;">Injected Broast - Saucy. Juicy. Crispy.</p>
    <p style="margin: 15px 0 5px; font-size: 12px; color: #888;">
      📞 +92 300 1234567 | 📧 info@zoiro.com
    </p>
    <div style="margin: 15px 0;">
      <a href="#" style="color: ${BRAND_RED}; text-decoration: none; margin: 0 10px;">Facebook</a>
      <a href="#" style="color: ${BRAND_RED}; text-decoration: none; margin: 0 10px;">Instagram</a>
      <a href="${COMPANY_URL}" style="color: ${BRAND_RED}; text-decoration: none; margin: 0 10px;">Website</a>
    </div>
    <p style="font-size: 11px; color: #666; margin-top: 20px;">
      © ${new Date().getFullYear()} Zoiro Broast. All rights reserved.<br>
      This is an automated email. Please do not reply directly.
    </p>
  </div>
`;

// Shared button style
const getButton = (text: string, url: string) => `
  <a href="${url}" style="display: inline-block; background: ${BRAND_RED}; color: ${BRAND_WHITE}; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 15px 0;">${text}</a>
`;

interface EmailParams {
  to: string;
  subject: string;
  htmlContent: string;
}

// Generate random 6-digit OTP
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Base email sending function
export async function sendEmail({ to, subject, htmlContent }: EmailParams): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    if (!BREVO_API_KEY) {
      console.error('[Brevo] No API key configured');
      return { success: false, error: 'Email service not configured' };
    }
    
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('[Brevo] API error:', data);
      return { success: false, error: data?.message || `HTTP ${response.status}` };
    }
    
    return { success: true, data };
  } catch (error: any) {
    console.error('[Brevo] Send error:', error);
    return { success: false, error: String(error?.message || 'Send failed') };
  }
}

// Send OTP for password reset
export async function sendPasswordResetOTP(email: string, name: string, otp: string) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: ${BRAND_WHITE};">
        ${getEmailHeader('🔐 Password Reset', 'Reset your account password')}
        
        <div style="padding: 30px;">
          <h2 style="color: ${BRAND_DARK}; margin-top: 0;">Hello ${name}! 👋</h2>
          <p>We received a request to reset your password. Use the OTP below to proceed:</p>
          
          <div style="background: ${BRAND_LIGHT_BG}; border: 2px solid ${BRAND_RED}; border-radius: 10px; padding: 25px; text-align: center; margin: 25px 0;">
            <p style="margin: 0 0 10px; font-size: 14px; color: #666;">Your Reset Code</p>
            <div style="font-size: 36px; font-weight: bold; color: ${BRAND_RED}; letter-spacing: 8px; font-family: monospace;">${otp}</div>
            <p style="margin: 10px 0 0; font-size: 12px; color: #999;">⚠️ Valid for 2 minutes only</p>
          </div>
          
          <div style="background: #fee2e2; border-left: 4px solid ${BRAND_RED}; padding: 12px 15px; margin: 20px 0;">
            <strong>🔒 Security Notice:</strong>
            <ul style="margin: 10px 0 0; padding-left: 20px;">
              <li>This OTP expires in <strong>2 minutes</strong></li>
              <li>Never share this code with anyone</li>
              <li>If you didn't request this, secure your account immediately</li>
              <li>You can only request 3 times before a 2-hour cooldown</li>
            </ul>
          </div>
          
          <p>For additional security:</p>
          <ul style="color: #444;">
            <li>Choose a strong password (min 8 characters)</li>
            <li>Use a mix of uppercase, lowercase, and numbers</li>
            <li>Don't reuse passwords from other accounts</li>
          </ul>
        </div>
        
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `${otp} - Reset Your ZOIRO Broast Password`,
    htmlContent,
  });
}

// Send OTP for registration
export async function sendRegistrationOTP(email: string, name: string, otp: string) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to ZOIRO Broast</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: ${BRAND_WHITE};">
        ${getEmailHeader('Welcome to ZOIRO Broast!', 'Complete your registration')}
        
        <div style="padding: 30px;">
          <h2 style="color: ${BRAND_DARK}; margin-top: 0;">Hello ${name}! 👋</h2>
          <p>Thank you for joining the ZOIRO Broast family. To complete your registration, please verify your email with the OTP below:</p>
          
          <div style="background: ${BRAND_LIGHT_BG}; border: 2px dashed ${BRAND_RED}; border-radius: 10px; padding: 25px; text-align: center; margin: 25px 0;">
            <p style="margin: 0 0 10px; font-size: 14px; color: #666;">Your Verification Code</p>
            <div style="font-size: 36px; font-weight: bold; color: ${BRAND_RED}; letter-spacing: 8px; font-family: monospace;">${otp}</div>
            <p style="margin: 10px 0 0; font-size: 12px; color: #999;">Valid for 10 minutes</p>
          </div>
          
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px 15px; margin: 20px 0;">
            <strong>⚠️ Important:</strong>
            <ul style="margin: 10px 0 0; padding-left: 20px;">
              <li>This OTP is valid for 10 minutes only</li>
              <li>Do not share this code with anyone</li>
              <li>If you didn't request this, please ignore this email</li>
            </ul>
          </div>
          
          <p style="margin-top: 25px;">Once verified, you'll enjoy:</p>
          <ul style="color: #444;">
            <li>✅ Delicious meals delivered to your door</li>
            <li>✅ Real-time order tracking</li>
            <li>✅ Exclusive deals and loyalty rewards</li>
            <li>✅ Save your favorites for quick reordering</li>
          </ul>
          
          <div style="text-align: center; margin-top: 30px;">
            ${getButton('Visit Our Menu', `${COMPANY_URL}/menu`)}
          </div>
        </div>
        
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `${otp} is your ZOIRO Broast verification code`,
    htmlContent,
  });
}

// Send OTP for login
export async function sendLoginOTP(email: string, name: string, otp: string) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login Verification</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: ${BRAND_WHITE};">
        ${getEmailHeader('🔐 Login Verification', 'Secure access to your account')}
        
        <div style="padding: 30px;">
          <h2 style="color: ${BRAND_DARK}; margin-top: 0;">Hello ${name}! 👋</h2>
          <p>We received a login request for your account. Use the OTP below to complete your login:</p>
          
          <div style="background: ${BRAND_LIGHT_BG}; border: 2px solid ${BRAND_RED}; border-radius: 10px; padding: 25px; text-align: center; margin: 25px 0;">
            <p style="margin: 0 0 10px; font-size: 14px; color: #666;">Your Login Code</p>
            <div style="font-size: 36px; font-weight: bold; color: ${BRAND_RED}; letter-spacing: 8px; font-family: monospace;">${otp}</div>
            <p style="margin: 10px 0 0; font-size: 12px; color: #999;">Valid for 10 minutes</p>
          </div>
          
          <div style="background: #fee2e2; border-left: 4px solid ${BRAND_RED}; padding: 12px 15px; margin: 20px 0;">
            <strong>🔒 Security Alert:</strong> If you didn't attempt to log in, please secure your account immediately.
          </div>
          
          <p>For your security:</p>
          <ul style="color: #444;">
            <li>Never share this OTP with anyone</li>
            <li>ZOIRO Broast staff will never ask for your OTP</li>
            <li>This code expires in 10 minutes</li>
          </ul>
        </div>
        
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `${otp} is your ZOIRO Broast login code`,
    htmlContent,
  });
}

// Send employee activation email
export async function sendEmployeeActivation(
  email: string,
  name: string,
  employeeId: string,
  role: string,
  otp: string
) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Employee Account Activation</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: ${BRAND_WHITE};">
        ${getEmailHeader('👔 Welcome to the Team!', 'Employee Account Activation')}
        
        <div style="padding: 30px;">
          <h2 style="color: ${BRAND_DARK}; margin-top: 0;">Hello ${name}! 🎉</h2>
          <p>Your employee account has been created. Here are your details:</p>
          
          <div style="background: ${BRAND_LIGHT_BG}; border-left: 4px solid ${BRAND_RED}; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Employee ID:</strong> ${employeeId}</p>
            <p style="margin: 5px 0;"><strong>Role:</strong> ${role.toUpperCase()}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
          </div>
          
          <p><strong>To activate your account:</strong></p>
          <ol style="color: #444;">
            <li>Visit the activation page</li>
            <li>Enter Employee ID: <strong>${employeeId}</strong></li>
            <li>Verify with the OTP below</li>
          </ol>
          
          <div style="background: ${BRAND_LIGHT_BG}; border: 2px solid ${BRAND_RED}; border-radius: 10px; padding: 25px; text-align: center; margin: 25px 0;">
            <p style="margin: 0 0 10px; font-size: 14px; color: #666;">Activation Code</p>
            <div style="font-size: 36px; font-weight: bold; color: ${BRAND_RED}; letter-spacing: 8px; font-family: monospace;">${otp}</div>
            <p style="margin: 10px 0 0; font-size: 12px; color: #999;">Valid for 10 minutes</p>
          </div>
          
          <p>After activation, you'll be able to:</p>
          <ul style="color: #444;">
            <li>✅ Access the employee portal</li>
            <li>✅ Manage orders and tables</li>
            <li>✅ View kitchen updates</li>
            <li>✅ Track performance metrics</li>
          </ul>
          
          <div style="text-align: center; margin-top: 30px;">
            ${getButton('Activate Account', `${COMPANY_URL}/portal/activate`)}
          </div>
        </div>
        
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Welcome to ZOIRO Broast - Activate Your Employee Account`,
    htmlContent,
  });
}

// Send order confirmation
export async function sendOrderConfirmation(
  email: string,
  name: string,
  orderNumber: string,
  orderDetails: {
    items: any[];
    subtotal: number;
    tax: number;
    deliveryFee: number;
    discount: number;
    total: number;
  }
) {
  const itemsHtml = orderDetails.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">Rs. ${item.price.toLocaleString()}</td>
      </tr>
    `
    )
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmed</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: ${BRAND_WHITE};">
        ${getEmailHeader('✅ Order Confirmed!', `Order #${orderNumber}`)}
        
        <div style="padding: 30px;">
          <h2 style="color: ${BRAND_DARK}; margin-top: 0;">Thank you, ${name}! 🍗</h2>
          <p>Your order has been confirmed and is being prepared with love.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: ${BRAND_WHITE}; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background: ${BRAND_DARK}; color: ${BRAND_WHITE};">
                <th style="padding: 12px; text-align: left;">Item</th>
                <th style="padding: 12px; text-align: center;">Qty</th>
                <th style="padding: 12px; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr>
                <td colspan="2" style="padding: 12px; text-align: right; border-top: 1px solid #ddd;">Subtotal:</td>
                <td style="padding: 12px; text-align: right; border-top: 1px solid #ddd;">Rs. ${orderDetails.subtotal.toLocaleString()}</td>
              </tr>
              <tr>
                <td colspan="2" style="padding: 8px 12px; text-align: right;">Tax (5% GST):</td>
                <td style="padding: 8px 12px; text-align: right;">Rs. ${orderDetails.tax.toLocaleString()}</td>
              </tr>
              ${orderDetails.deliveryFee > 0 ? `
              <tr>
                <td colspan="2" style="padding: 8px 12px; text-align: right;">Delivery Fee:</td>
                <td style="padding: 8px 12px; text-align: right;">Rs. ${orderDetails.deliveryFee.toLocaleString()}</td>
              </tr>
              ` : ''}
              ${orderDetails.discount > 0 ? `
              <tr>
                <td colspan="2" style="padding: 8px 12px; text-align: right; color: #22c55e;">Discount:</td>
                <td style="padding: 8px 12px; text-align: right; color: #22c55e;">- Rs. ${orderDetails.discount.toLocaleString()}</td>
              </tr>
              ` : ''}
              <tr style="background: ${BRAND_DARK}; color: ${BRAND_WHITE};">
                <td colspan="2" style="padding: 15px 12px; text-align: right; font-size: 18px; font-weight: bold;">Total:</td>
                <td style="padding: 15px 12px; text-align: right; font-size: 18px; font-weight: bold;">Rs. ${orderDetails.total.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          
          <div style="text-align: center; margin-top: 30px;">
            ${getButton('Track Your Order', `${COMPANY_URL}/orders/${orderNumber}`)}
          </div>
        </div>
        
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `🍗 Order Confirmed - #${orderNumber}`,
    htmlContent,
  });
}

// Alias for sendEmail with different interface for convenience
interface BrevoEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendBrevoEmail({ to, subject, html }: BrevoEmailParams) {
  return sendEmail({ to, subject, htmlContent: html });
}

// Generic OTP email sender for various purposes
export async function sendOTPEmail(
  email: string, 
  name: string, 
  otp: string, 
  purpose: 'registration' | 'login' | 'password_change' | 'verification' = 'verification'
) {
  const purposeText = {
    registration: 'complete your registration',
    login: 'log in to your account',
    password_change: 'change your password',
    verification: 'verify your request',
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .otp-box { background: white; border: 2px dashed #ff6b6b; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
        .otp-code { font-size: 32px; font-weight: bold; color: #ff6b6b; letter-spacing: 8px; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Verification Code</h1>
        </div>
        <div class="content">
          <h2>Hello ${name}!</h2>
          <p>Use the following code to ${purposeText[purpose]}:</p>
          
          <div class="otp-box">
            <p style="margin: 0; font-size: 14px; color: #666;">Your OTP Code</p>
            <div class="otp-code">${otp}</div>
            <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Valid for 2 minutes only</p>
          </div>
          
          <p><strong>Security Notice:</strong></p>
          <ul>
            <li>This OTP expires in 2 minutes</li>
            <li>Never share this code with anyone</li>
            <li>Zoiro Broast will never ask for your OTP</li>
            <li>If you didn't request this, please ignore this email</li>
          </ul>
          
          <p>Best regards,<br>The Zoiro Broast Team</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Zoiro Broast. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Your Verification Code - ${otp.substring(0, 3)}***`,
    htmlContent,
  });
}

// Send Promo Code Email to Customer
export interface PromoCodeEmailParams {
  to: string;
  customerName: string;
  promoCode: string;
  promoType: 'percentage' | 'fixed_amount';
  value: number;
  maxDiscount?: number;
  expiresAt: string;
  loyaltyPointsEarned?: number;
  promoName?: string;
}

export async function sendPromoCodeEmail({
  to,
  customerName,
  promoCode,
  promoType,
  value,
  maxDiscount,
  expiresAt,
  loyaltyPointsEarned,
  promoName,
}: PromoCodeEmailParams) {
  const discountText = promoType === 'percentage' 
    ? `${value}% OFF` 
    : `Rs. ${value} OFF`;
  
  const maxDiscountText = maxDiscount && promoType === 'percentage'
    ? `(up to Rs. ${maxDiscount})`
    : '';
    
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-PK', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { 
          background: linear-gradient(135deg, #C8102E 0%, #ff6b6b 100%); 
          color: white; 
          padding: 40px 30px; 
          text-align: center; 
          border-radius: 15px 15px 0 0;
        }
        .header-icon { font-size: 60px; margin-bottom: 10px; }
        .header h1 { margin: 0; font-size: 28px; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .content { background: #ffffff; padding: 40px 30px; }
        .promo-box { 
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); 
          border: 3px dashed #f59e0b;
          border-radius: 15px; 
          padding: 30px; 
          text-align: center; 
          margin: 25px 0;
          position: relative;
        }
        .promo-label { 
          font-size: 14px; 
          color: #92400e; 
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 10px;
        }
        .promo-code { 
          font-size: 36px; 
          font-weight: bold; 
          color: #C8102E; 
          letter-spacing: 4px;
          padding: 15px 25px;
          background: white;
          border-radius: 10px;
          display: inline-block;
          margin: 10px 0;
          box-shadow: 0 4px 15px rgba(200, 16, 46, 0.2);
        }
        .discount-value {
          font-size: 48px;
          font-weight: bold;
          color: #16a34a;
          margin: 15px 0;
        }
        .discount-note {
          font-size: 14px;
          color: #666;
        }
        .expiry-box {
          background: #fef2f2;
          border-left: 4px solid #C8102E;
          padding: 15px 20px;
          margin: 20px 0;
          border-radius: 0 8px 8px 0;
        }
        .expiry-box strong {
          color: #C8102E;
        }
        .how-to-use {
          background: #f0fdf4;
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .how-to-use h3 {
          margin: 0 0 15px 0;
          color: #16a34a;
        }
        .how-to-use ol {
          margin: 0;
          padding-left: 20px;
        }
        .how-to-use li {
          margin: 8px 0;
        }
        .cta-button {
          display: inline-block;
          background: #C8102E;
          color: white;
          padding: 15px 40px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          font-size: 16px;
          margin: 20px 0;
        }
        .footer { 
          background: #f9fafb;
          text-align: center; 
          padding: 25px;
          font-size: 12px; 
          color: #666;
          border-radius: 0 0 15px 15px;
        }
        .social-links {
          margin: 15px 0;
        }
        .social-links a {
          color: #C8102E;
          text-decoration: none;
          margin: 0 10px;
        }
        ${loyaltyPointsEarned ? `
        .loyalty-badge {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          color: white;
          padding: 10px 20px;
          border-radius: 20px;
          display: inline-block;
          font-weight: bold;
          margin-bottom: 20px;
        }
        ` : ''}
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="header-icon">🎁</div>
          <h1>You've Earned a Special Reward!</h1>
          <p>Thank you for being a loyal customer</p>
        </div>
        <div class="content">
          <h2>Congratulations, ${customerName}! 🎉</h2>
          
          ${loyaltyPointsEarned ? `
          <div style="text-align: center;">
            <div class="loyalty-badge">
              ⭐ You earned ${loyaltyPointsEarned} Loyalty Points!
            </div>
          </div>
          ` : ''}
          
          <p>As a valued member of the ZOIRO Broast family, you've unlocked an exclusive promo code just for you!</p>
          
          <div class="promo-box">
            <div class="promo-label">Your Exclusive Promo Code</div>
            <div class="promo-code">${promoCode}</div>
            <div class="discount-value">${discountText}</div>
            ${maxDiscountText ? `<div class="discount-note">${maxDiscountText}</div>` : ''}
            ${promoName ? `<div class="discount-note">${promoName}</div>` : ''}
          </div>
          
          <div class="expiry-box">
            ⏰ <strong>Valid until:</strong> ${expiryDate}<br>
            <small>Don't miss out - use it before it expires!</small>
          </div>
          
          <div class="how-to-use">
            <h3>🍗 How to Use Your Promo Code</h3>
            <ol>
              <li>Visit our restaurant or order online</li>
              <li>Add your favorite items to cart</li>
              <li>Enter code <strong>${promoCode}</strong> at checkout</li>
              <li>Enjoy your discount!</li>
            </ol>
          </div>
          
          <div style="text-align: center;">
            <a href="${COMPANY_URL}/menu" class="cta-button">Order Now →</a>
          </div>
          
          <p style="margin-top: 30px;">
            <strong>Terms & Conditions:</strong>
          </p>
          <ul style="font-size: 12px; color: #666;">
            <li>This promo code is exclusively for you and cannot be transferred</li>
            <li>Valid for one-time use only</li>
            <li>Cannot be combined with other offers</li>
            <li>Valid on all menu items</li>
          </ul>
        </div>
        <div class="footer">
          <p><strong>ZOIRO Broast</strong></p>
          <p>Injected Broast - Saucy. Juicy. Crispy.</p>
          <div class="social-links">
            <a href="#">Facebook</a> |
            <a href="#">Instagram</a> |
            <a href="${COMPANY_URL}">Website</a>
          </div>
          <p>© ${new Date().getFullYear()} Zoiro Broast. All rights reserved.</p>
          <p style="font-size: 10px; color: #999;">
            You received this email because you are a registered customer of ZOIRO Broast.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `🎁 Your Exclusive ${discountText} Promo Code - ${promoCode}`,
    htmlContent,
  });
}

// ==========================================
// SEND INVOICE EMAIL
// Send bill/receipt details to customer
// ==========================================

interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
  total?: number;
}

interface SendInvoiceEmailParams {
  to: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  orderType: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  serviceCharge: number;
  deliveryFee: number;
  tip: number;
  total: number;
  paymentMethod: string;
  tableNumber?: string;
  pointsEarned?: number;
  rewardPromoCode?: string;
}

export async function sendInvoiceEmail({
  to,
  customerName,
  invoiceNumber,
  invoiceDate,
  orderType,
  items,
  subtotal,
  discount,
  tax,
  serviceCharge,
  deliveryFee,
  tip,
  total,
  paymentMethod,
  tableNumber,
  pointsEarned,
  rewardPromoCode,
}: SendInvoiceEmailParams) {
  const formattedDate = new Date(invoiceDate).toLocaleDateString('en-PK', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const paymentMethodLabels: Record<string, string> = {
    cash: '💵 Cash',
    card: '💳 Card',
    online: '📱 Online Payment',
  };

  const orderTypeLabels: Record<string, string> = {
    'dine-in': '🍽️ Dine-In',
    'online': '🛵 Delivery',
    'walk-in': '🚶 Walk-In / Takeaway',
  };

  // Generate items HTML
  const itemsHtml = items.map((item: InvoiceItem) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">Rs. ${item.price?.toLocaleString()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">Rs. ${(item.total || item.price * item.quantity).toLocaleString()}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice - ${invoiceNumber}</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: ${BRAND_WHITE};">
        <!-- Header with Logo -->
        <div style="background: ${BRAND_DARK}; padding: 30px 20px; text-align: center;">
          <img src="${LOGO_URL}" alt="ZOIRO Broast" style="height: 60px; margin-bottom: 10px;" />
          <h1 style="color: ${BRAND_WHITE}; margin: 0; font-size: 24px;">Your Receipt</h1>
          <p style="color: #aaa; margin: 5px 0 0; font-size: 14px;">Thank you for dining with us!</p>
        </div>
        
        <!-- Invoice Info Bar -->
        <div style="background: #fef2f2; padding: 20px 30px; border-bottom: 3px solid ${BRAND_RED};">
          <table style="width: 100%;">
            <tr>
              <td style="padding: 5px 0;">
                <span style="font-size: 12px; color: #666; text-transform: uppercase;">Invoice #</span><br>
                <strong style="font-size: 16px; color: ${BRAND_DARK};">${invoiceNumber}</strong>
              </td>
              <td style="padding: 5px 0;">
                <span style="font-size: 12px; color: #666; text-transform: uppercase;">Date</span><br>
                <strong style="font-size: 14px; color: ${BRAND_DARK};">${formattedDate}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 5px 0;">
                <span style="font-size: 12px; color: #666; text-transform: uppercase;">Order Type</span><br>
                <strong style="font-size: 14px; color: ${BRAND_DARK};">${orderTypeLabels[orderType] || orderType}</strong>
              </td>
              ${tableNumber ? `
              <td style="padding: 5px 0;">
                <span style="font-size: 12px; color: #666; text-transform: uppercase;">Table</span><br>
                <strong style="font-size: 14px; color: ${BRAND_DARK};">Table #${tableNumber}</strong>
              </td>
              ` : '<td></td>'}
            </tr>
          </table>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
          <p style="font-size: 18px; margin-top: 0;">
            Hello <strong>${customerName}</strong>! 👋<br>
            <span style="font-size: 14px; color: #666;">Here's your detailed bill receipt:</span>
          </p>
          
          <!-- Items Table -->
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="background: ${BRAND_DARK}; color: ${BRAND_WHITE};">
                <th style="padding: 12px; text-align: left; font-weight: 600;">Item</th>
                <th style="padding: 12px; text-align: center; font-weight: 600;">Qty</th>
                <th style="padding: 12px; text-align: right; font-weight: 600;">Price</th>
                <th style="padding: 12px; text-align: right; font-weight: 600;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <!-- Totals Section -->
          <div style="background: ${BRAND_LIGHT_BG}; padding: 20px; border-radius: 10px; margin-top: 20px;">
            <div style="display: flex; justify-content: space-between; padding: 8px 0;">
              <span>Subtotal</span>
              <span>Rs. ${subtotal.toLocaleString()}</span>
            </div>
            ${discount > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; color: #22c55e;">
              <span>Discount</span>
              <span>- Rs. ${discount.toLocaleString()}</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; padding: 8px 0;">
              <span>Tax (5% GST)</span>
              <span>Rs. ${tax.toLocaleString()}</span>
            </div>
            ${serviceCharge > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 8px 0;">
              <span>Service Charge</span>
              <span>Rs. ${serviceCharge.toLocaleString()}</span>
            </div>
            ` : ''}
            ${deliveryFee > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 8px 0;">
              <span>Delivery Fee</span>
              <span>Rs. ${deliveryFee.toLocaleString()}</span>
            </div>
            ` : ''}
            ${tip > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 8px 0;">
              <span>Tip</span>
              <span>Rs. ${tip.toLocaleString()}</span>
            </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; padding: 15px 0 0; margin-top: 10px; border-top: 2px solid ${BRAND_RED}; font-size: 20px; font-weight: bold; color: ${BRAND_RED};">
              <span>Total Paid</span>
              <span>Rs. ${total.toLocaleString()}</span>
            </div>
          </div>
          
          <!-- Payment Badge -->
          <div style="text-align: center; margin-top: 20px;">
            <span style="display: inline-block; background: #dcfce7; color: #166534; padding: 10px 20px; border-radius: 25px; font-weight: 600;">
              ✅ Paid via ${paymentMethodLabels[paymentMethod] || paymentMethod}
            </span>
          </div>
          
          ${pointsEarned && pointsEarned > 0 ? `
          <!-- Loyalty Points Earned -->
          <div style="background: #eff6ff; border-radius: 10px; padding: 20px; text-align: center; margin: 25px 0;">
            <div style="font-size: 14px; color: #666; margin-bottom: 5px;">🌟 Loyalty Points Earned</div>
            <div style="font-size: 32px; font-weight: bold; color: #3b82f6;">+${pointsEarned} Points</div>
            <div style="font-size: 12px; color: #666; margin-top: 5px;">Keep ordering to unlock more rewards!</div>
          </div>
          ` : ''}
          
          ${rewardPromoCode ? `
          <!-- Reward Promo Code -->
          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 3px dashed #f59e0b; border-radius: 12px; padding: 25px; margin: 25px 0; text-align: center;">
            <h3 style="color: #92400e; margin: 0 0 10px; font-size: 20px;">🎁 You've Earned a Reward!</h3>
            <p style="margin: 10px 0; color: #92400e;">Use this exclusive promo code on your next order:</p>
            <div style="font-size: 28px; font-weight: bold; color: ${BRAND_RED}; letter-spacing: 3px; background: ${BRAND_WHITE}; padding: 15px 25px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              ${rewardPromoCode}
            </div>
            <p style="font-size: 12px; color: #92400e; margin-top: 15px;">Valid for 60 days • Single use only</p>
          </div>
          ` : ''}
          
          <!-- CTA Button -->
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #666; margin-bottom: 15px;">
              Questions about your order?<br>
              Call us at <a href="tel:+923001234567" style="color: ${BRAND_RED}; text-decoration: none; font-weight: 600;">+92 300 1234567</a>
            </p>
            ${getButton('Order Again 🍗', `${COMPANY_URL}/menu`)}
          </div>
        </div>
        
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `🧾 Your ZOIRO Broast Receipt - ${invoiceNumber}`,
    htmlContent,
  });
}
// ==========================================
// SEND EMPLOYEE WELCOME EMAIL
// Send credentials to new employee
// ==========================================

interface SendEmployeeWelcomeEmailParams {
  to: string;
  employeeName: string;
  employeeId: string;
  licenseId: string;
  role: string;
  salary: number;
  hireDate: string;
  portalEnabled: boolean;
}

export async function sendEmployeeWelcomeEmail({
  to,
  employeeName,
  employeeId,
  licenseId,
  role,
  salary,
  hireDate,
  portalEnabled,
}: SendEmployeeWelcomeEmailParams) {
  const formattedHireDate = new Date(hireDate).toLocaleDateString('en-PK', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    manager: 'Manager',
    waiter: 'Waiter',
    billing_staff: 'Billing Staff',
    kitchen_staff: 'Kitchen Staff',
    delivery_rider: 'Delivery Rider',
    other: 'Staff Member',
  };

  const formattedSalary = new Intl.NumberFormat('en-PK').format(salary);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to ZOIRO Broast Team!</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: ${BRAND_WHITE};">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, ${BRAND_DARK} 0%, #2d2d2d 100%); padding: 40px 20px; text-align: center;">
          <img src="${LOGO_URL}" alt="ZOIRO Broast" style="height: 60px; margin-bottom: 15px;" />
          <h1 style="color: ${BRAND_WHITE}; margin: 0; font-size: 28px;">Welcome to the Team! 🎉</h1>
          <p style="color: #ccc; margin: 10px 0 0; font-size: 16px;">You're now part of the ZOIRO Broast family</p>
        </div>
        
        <!-- Employee Info Card -->
        <div style="margin: -20px 20px 0; background: ${BRAND_WHITE}; border-radius: 15px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); padding: 25px; position: relative; z-index: 10;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eee;">
            <div style="width: 80px; height: 80px; background: linear-gradient(135deg, ${BRAND_RED}, #ff6b6b); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; font-size: 32px; color: white; font-weight: bold;">
              ${employeeName.charAt(0).toUpperCase()}
            </div>
            <h2 style="margin: 0; color: ${BRAND_DARK}; font-size: 24px;">${employeeName}</h2>
            <p style="margin: 5px 0 0; color: #666; font-size: 16px;">${roleLabels[role] || role}</p>
          </div>
          
          <div style="padding: 20px 0;">
            <table style="width: 100%;">
              <tr>
                <td style="padding: 10px 0; color: #666; font-size: 14px;">Employee ID</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 600; font-family: monospace; font-size: 16px; color: ${BRAND_DARK};">${employeeId}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666; font-size: 14px;">Start Date</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 500;">${formattedHireDate}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #666; font-size: 14px;">Base Salary</td>
                <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #22c55e;">Rs. ${formattedSalary}/month</td>
              </tr>
            </table>
          </div>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
          <h3 style="color: ${BRAND_DARK}; margin-top: 0;">Hello ${employeeName}! 👋</h3>
          <p>Congratulations on joining the ZOIRO Broast team! We're excited to have you with us.</p>
          
          ${portalEnabled ? `
          <!-- Activation Section -->
          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 3px dashed #f59e0b; border-radius: 15px; padding: 25px; margin: 25px 0; text-align: center;">
            <h3 style="color: #92400e; margin: 0 0 10px;">🔑 Your Portal Activation Key</h3>
            <p style="color: #92400e; margin: 10px 0; font-size: 14px;">Use this key to activate your employee portal account</p>
            <div style="background: ${BRAND_WHITE}; padding: 15px 25px; border-radius: 10px; margin: 15px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
              <div style="font-size: 28px; font-weight: bold; color: ${BRAND_RED}; letter-spacing: 3px; font-family: monospace;">
                ${licenseId}
              </div>
            </div>
            <p style="font-size: 12px; color: #92400e; margin: 0;">⚠️ This key is valid for 7 days only</p>
          </div>
          
          <!-- How to Activate -->
          <div style="background: #f0fdf4; padding: 25px; border-radius: 12px; margin: 25px 0;">
            <h3 style="color: #166534; margin: 0 0 15px;">🚀 How to Activate Your Account</h3>
            <ol style="margin: 0; padding-left: 20px; color: #166534;">
              <li style="margin: 10px 0;">Visit the activation page at <a href="${COMPANY_URL}/portal/activate" style="color: ${BRAND_RED};">${COMPANY_URL}/portal/activate</a></li>
              <li style="margin: 10px 0;">Enter your License Key: <strong>${licenseId}</strong></li>
              <li style="margin: 10px 0;">Create a secure password for your account</li>
              <li style="margin: 10px 0;">Start using the employee portal!</li>
            </ol>
          </div>
          
          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            ${getButton('Activate Your Account', `${COMPANY_URL}/portal/activate`)}
          </div>
          ` : `
          <!-- Portal Disabled Info -->
          <div style="background: #fef2f2; border-left: 4px solid ${BRAND_RED}; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <h4 style="color: ${BRAND_RED}; margin: 0 0 10px;">ℹ️ Portal Access</h4>
            <p style="margin: 0; color: #666;">Your portal access is currently set up offline. Please contact your manager for any updates.</p>
          </div>
          `}
          
          <!-- What to Expect -->
          <div style="background: ${BRAND_LIGHT_BG}; padding: 25px; border-radius: 12px; margin: 25px 0;">
            <h3 style="color: ${BRAND_DARK}; margin: 0 0 15px;">📋 What to Expect</h3>
            <ul style="margin: 0; padding-left: 20px; color: #444;">
              <li style="margin: 8px 0;">Access to the employee management portal</li>
              <li style="margin: 8px 0;">Manage your attendance and schedule</li>
              <li style="margin: 8px 0;">View your payroll and earnings</li>
              <li style="margin: 8px 0;">Access to role-specific features</li>
            </ul>
          </div>
          
          <!-- Important Info -->
          <div style="background: #fef2f2; border-left: 4px solid ${BRAND_RED}; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <strong style="color: ${BRAND_RED};">⚠️ Important:</strong>
            <ul style="margin: 10px 0 0; padding-left: 20px; color: #666; font-size: 14px;">
              <li>Keep your License Key confidential</li>
              <li>Do not share your login credentials</li>
              <li>Contact HR if you face any issues</li>
            </ul>
          </div>
          
          <p style="margin-top: 30px;">
            Welcome aboard! We're thrilled to have you join us. If you have any questions, 
            don't hesitate to reach out to your manager or HR department.
          </p>
          
          <p>Best regards,<br><strong>The ZOIRO Broast Team</strong></p>
        </div>
        
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `🎉 Welcome to ZOIRO Broast, ${employeeName}! - Your Employee Credentials`,
    htmlContent,
  });
}

// =============================================
// EMPLOYEE STATUS NOTIFICATIONS
// =============================================

// Predefined block reasons
export const EMPLOYEE_BLOCK_REASONS = [
  { id: 'performance', label: 'Performance Issues', description: 'Consistent underperformance or failure to meet job requirements' },
  { id: 'attendance', label: 'Attendance Problems', description: 'Repeated absences or failure to follow attendance policy' },
  { id: 'misconduct', label: 'Workplace Misconduct', description: 'Violation of workplace rules or inappropriate behavior' },
  { id: 'policy_violation', label: 'Policy Violation', description: 'Breach of company policies or procedures' },
  { id: 'investigation', label: 'Under Investigation', description: 'Pending investigation of reported incident' },
  { id: 'restructuring', label: 'Organizational Changes', description: 'Temporary suspension due to restructuring' },
  { id: 'other', label: 'Other Reason', description: 'Custom reason to be specified' },
];

// Send employee blocked notification
export async function sendEmployeeBlockedNotification(
  email: string,
  name: string,
  employeeId: string,
  reason: string,
  blockedDate: string
) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Status Update</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: ${BRAND_WHITE};">
        ${getEmailHeader('⚠️ Account Status Update', 'Important Notice')}
        
        <div style="padding: 30px;">
          <h2 style="color: ${BRAND_DARK}; margin-top: 0;">Dear ${name},</h2>
          
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
              <span style="font-size: 24px; margin-right: 10px;">🔒</span>
              <h3 style="color: #dc2626; margin: 0;">Account Temporarily Suspended</h3>
            </div>
            <p style="margin: 0; color: #666;">Your employee portal access has been temporarily suspended as of <strong>${blockedDate}</strong>.</p>
          </div>
          
          <div style="background: ${BRAND_LIGHT_BG}; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <h4 style="color: ${BRAND_DARK}; margin: 0 0 10px;">📋 Account Details</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Employee ID:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${employeeId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Status:</td>
                <td style="padding: 8px 0; text-align: right;"><span style="background: #fef2f2; color: #dc2626; padding: 4px 12px; border-radius: 20px; font-weight: 600;">Blocked</span></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Effective Date:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 500;">${blockedDate}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #fff7ed; border-left: 4px solid #f97316; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <h4 style="color: #c2410c; margin: 0 0 10px;">📝 Reason for Suspension</h4>
            <p style="margin: 0; color: #666;">${reason}</p>
          </div>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <h4 style="color: #0369a1; margin: 0 0 15px;">🔄 Next Steps</h4>
            <ul style="margin: 0; padding-left: 20px; color: #666;">
              <li style="margin: 8px 0;">Your portal access has been disabled during this period</li>
              <li style="margin: 8px 0;">Please contact HR or your manager for further details</li>
              <li style="margin: 8px 0;">You will be notified via email once your account is reactivated</li>
            </ul>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            If you believe this is an error or have any questions, please contact the HR department immediately.
          </p>
          
          <p style="margin-top: 30px;">
            Regards,<br>
            <strong>ZOIRO Broast HR Department</strong>
          </p>
        </div>
        
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `⚠️ Account Status Update - ZOIRO Broast`,
    htmlContent,
  });
}

// Predefined activation reasons
export const EMPLOYEE_ACTIVATION_REASONS = [
  { id: 'investigation_cleared', label: 'Investigation Cleared', description: 'Investigation completed with no issues found' },
  { id: 'performance_improved', label: 'Performance Improved', description: 'Employee has demonstrated improved performance' },
  { id: 'suspension_ended', label: 'Suspension Period Ended', description: 'Temporary suspension period has completed' },
  { id: 'resolved', label: 'Issue Resolved', description: 'Previous concerns have been addressed and resolved' },
  { id: 'reinstated', label: 'Reinstated by Management', description: 'Management decision to reinstate the employee' },
  { id: 'appeal_accepted', label: 'Appeal Accepted', description: 'Employee appeal has been reviewed and accepted' },
  { id: 'other', label: 'Other Reason', description: 'Custom reason to be specified' },
];

// Send employee activated notification
export async function sendEmployeeActivatedNotification(
  email: string,
  name: string,
  employeeId: string,
  reason: string,
  newLicenseId: string | null,
  activatedDate: string
) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Reactivated</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: ${BRAND_WHITE};">
        ${getEmailHeader('🎉 Account Reactivated!', 'Welcome Back')}
        
        <div style="padding: 30px;">
          <h2 style="color: ${BRAND_DARK}; margin-top: 0;">Welcome back, ${name}! 🎊</h2>
          
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
              <span style="font-size: 24px; margin-right: 10px;">✅</span>
              <h3 style="color: #16a34a; margin: 0;">Your Account Has Been Reactivated</h3>
            </div>
            <p style="margin: 0; color: #666;">We're pleased to inform you that your employee portal access has been restored as of <strong>${activatedDate}</strong>.</p>
          </div>
          
          <div style="background: ${BRAND_LIGHT_BG}; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <h4 style="color: ${BRAND_DARK}; margin: 0 0 10px;">📋 Account Details</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Employee ID:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${employeeId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Status:</td>
                <td style="padding: 8px 0; text-align: right;"><span style="background: #f0fdf4; color: #16a34a; padding: 4px 12px; border-radius: 20px; font-weight: 600;">Active</span></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Activation Date:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 500;">${activatedDate}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <h4 style="color: #0369a1; margin: 0 0 10px;">📝 Activation Note</h4>
            <p style="margin: 0; color: #666;">${reason}</p>
          </div>
          
          ${newLicenseId ? `
          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 3px dashed #f59e0b; border-radius: 15px; padding: 25px; margin: 25px 0; text-align: center;">
            <h3 style="color: #92400e; margin: 0 0 10px;">🔑 Your New Portal Access Key</h3>
            <p style="color: #92400e; margin: 10px 0; font-size: 14px;">Use this key to log back into the portal</p>
            <div style="background: ${BRAND_WHITE}; padding: 15px 25px; border-radius: 10px; margin: 15px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
              <div style="font-size: 24px; font-weight: bold; color: ${BRAND_RED}; letter-spacing: 3px; font-family: monospace;">
                ${newLicenseId}
              </div>
            </div>
            <p style="font-size: 12px; color: #92400e; margin: 0;">⚠️ This key is valid for 30 days</p>
          </div>
          ` : ''}
          
          <div style="background: #f0fdf4; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <h4 style="color: #166534; margin: 0 0 15px;">🚀 What You Can Do Now</h4>
            <ul style="margin: 0; padding-left: 20px; color: #666;">
              <li style="margin: 8px 0;">Log in to the employee portal</li>
              <li style="margin: 8px 0;">Access your dashboard and assignments</li>
              <li style="margin: 8px 0;">View your schedule and attendance</li>
              <li style="margin: 8px 0;">Check your payroll information</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            ${getButton('Access Employee Portal', `${COMPANY_URL}/portal`)}
          </div>
          
          <p style="margin-top: 30px;">
            Welcome back to the team! We're glad to have you with us again.<br><br>
            Best regards,<br>
            <strong>ZOIRO Broast HR Department</strong>
          </p>
        </div>
        
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `🎉 Welcome Back! Your Account Has Been Reactivated - ZOIRO Broast`,
    htmlContent,
  });
}

// Predefined unblock reasons
export const EMPLOYEE_UNBLOCK_REASONS = [
  { id: 'resolved', label: 'Issue Resolved', description: 'The issue that led to blocking has been resolved' },
  { id: 'investigation_complete', label: 'Investigation Complete', description: 'Investigation completed with no action required' },
  { id: 'leave_ended', label: 'Leave Ended', description: 'Employee returning from leave of absence' },
  { id: 'appeal_approved', label: 'Appeal Approved', description: 'Employee appeal has been reviewed and approved' },
  { id: 'reinstatement', label: 'Reinstatement', description: 'Employee being reinstated after suspension period' },
  { id: 'error_correction', label: 'Error Correction', description: 'Previous block was made in error' },
  { id: 'other', label: 'Other Reason', description: 'Custom reason to be specified' },
];

// Send employee unblocked notification
export async function sendEmployeeUnblockedNotification(
  email: string,
  name: string,
  employeeId: string,
  reason: string,
  unblockedDate: string
) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Portal Access Restored</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: ${BRAND_WHITE};">
        ${getEmailHeader('🎉 Portal Access Restored!', 'Welcome Back')}
        
        <div style="padding: 30px;">
          <h2 style="color: ${BRAND_DARK}; margin-top: 0;">Good news, ${name}! 🎊</h2>
          
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <div style="display: flex; align-items: center; margin-bottom: 15px;">
              <span style="font-size: 24px; margin-right: 10px;">✅</span>
              <h3 style="color: #16a34a; margin: 0;">Your Portal Access Has Been Restored</h3>
            </div>
            <p style="margin: 0; color: #666;">Your employee portal access has been restored as of <strong>${unblockedDate}</strong>. You can now log in and resume your work.</p>
          </div>
          
          <div style="background: ${BRAND_LIGHT_BG}; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <h4 style="color: ${BRAND_DARK}; margin: 0 0 10px;">📋 Account Details</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Employee ID:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${employeeId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Status:</td>
                <td style="padding: 8px 0; text-align: right;"><span style="background: #f0fdf4; color: #16a34a; padding: 4px 12px; border-radius: 20px; font-weight: 600;">Active</span></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Restored Date:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 500;">${unblockedDate}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <h4 style="color: #0369a1; margin: 0 0 10px;">📝 Reason for Restoration</h4>
            <p style="margin: 0; color: #666;">${reason}</p>
          </div>
          
          <div style="background: #f0fdf4; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <h4 style="color: #166534; margin: 0 0 15px;">🚀 What You Can Do Now</h4>
            <ul style="margin: 0; padding-left: 20px; color: #666;">
              <li style="margin: 8px 0;">Log in to the employee portal</li>
              <li style="margin: 8px 0;">Access your dashboard and assignments</li>
              <li style="margin: 8px 0;">View your schedule and attendance</li>
              <li style="margin: 8px 0;">Check your payroll information</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            ${getButton('Access Employee Portal', `${COMPANY_URL}/portal`)}
          </div>
          
          <p style="margin-top: 30px;">
            We're glad to have you back!<br><br>
            Best regards,<br>
            <strong>ZOIRO Broast HR Department</strong>
          </p>
        </div>
        
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `🎉 Portal Access Restored - ZOIRO Broast`,
    htmlContent,
  });
}

// Send employee deletion notification
export async function sendEmployeeDeletedNotification(
  email: string,
  name: string,
  employeeId: string,
  reason: string,
  deletionDate: string
) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Termination Notice</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: ${BRAND_WHITE};">
        ${getEmailHeader('Account Termination Notice', 'Important Notice')}
        
        <div style="padding: 30px;">
          <h2 style="color: ${BRAND_DARK}; margin-top: 0;">Dear ${name},</h2>
          
          <p>This email is to inform you that your employee account at ZOIRO Broast has been terminated as of <strong>${deletionDate}</strong>.</p>
          
          <div style="background: ${BRAND_LIGHT_BG}; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <h4 style="color: ${BRAND_DARK}; margin: 0 0 10px;">📋 Account Details</h4>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Employee ID:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 600;">${employeeId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Termination Date:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 500;">${deletionDate}</td>
              </tr>
            </table>
          </div>
          
          ${reason ? `
          <div style="background: #fef2f2; border-left: 4px solid ${BRAND_RED}; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <h4 style="color: #dc2626; margin: 0 0 10px;">📝 Reason</h4>
            <p style="margin: 0; color: #666;">${reason}</p>
          </div>
          ` : ''}
          
          <div style="background: #fff7ed; padding: 20px; border-radius: 12px; margin: 20px 0;">
            <h4 style="color: #c2410c; margin: 0 0 15px;">📌 Important Information</h4>
            <ul style="margin: 0; padding-left: 20px; color: #666;">
              <li style="margin: 8px 0;">Your portal access has been permanently revoked</li>
              <li style="margin: 8px 0;">All associated data has been archived</li>
              <li style="margin: 8px 0;">Please contact HR for any final settlements</li>
            </ul>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            If you have any questions regarding this termination or need any documents, please contact our HR department.
          </p>
          
          <p style="margin-top: 30px;">
            We thank you for your time with ZOIRO Broast.<br><br>
            Regards,<br>
            <strong>ZOIRO Broast HR Department</strong>
          </p>
        </div>
        
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Account Termination Notice - ZOIRO Broast`,
    htmlContent,
  });
}

// ==========================================
// CUSTOMER BAN REASONS
// ==========================================
export const CUSTOMER_BAN_REASONS = [
  'Fraudulent activity or payment issues',
  'Abusive behavior towards staff',
  'Multiple order cancellations',
  'Fake or spam reviews',
  'Violating terms of service',
  'Suspicious account activity',
  'Multiple chargebacks',
  'Providing false information',
  'Harassment or threats',
  'Other policy violations',
];

export const CUSTOMER_UNBAN_REASONS = [
  'Issue resolved with customer',
  'Customer appeal approved',
  'False positive - account cleared',
  'Payment issues resolved',
  'Probation period completed',
  'Management decision',
  'Customer verification completed',
  'Other reason',
];

// ==========================================
// SEND CUSTOMER BANNED EMAIL
// Notify customer when their account is banned
// ==========================================
export async function sendCustomerBannedNotification(
  email: string,
  name: string,
  reason: string
) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Suspended</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: ${BRAND_WHITE};">
        ${getEmailHeader('Account Suspended', 'Important Notice')}
        
        <div style="padding: 30px;">
          <div style="text-align: center; margin-bottom: 25px;">
            <div style="display: inline-block; background: #fef2f2; border-radius: 50%; padding: 20px;">
              <span style="font-size: 48px;">🚫</span>
            </div>
          </div>
          
          <h2 style="color: ${BRAND_DARK}; margin-top: 0; text-align: center;">Dear ${name},</h2>
          
          <p style="text-align: center; color: #666;">
            We regret to inform you that your ZOIRO Broast customer account has been suspended.
          </p>
          
          <div style="background: #fef2f2; border-left: 4px solid ${BRAND_RED}; padding: 20px; margin: 25px 0; border-radius: 0 10px 10px 0;">
            <h4 style="color: #dc2626; margin: 0 0 10px;">📝 Reason for Suspension</h4>
            <p style="margin: 0; color: #666; font-size: 15px;">${reason}</p>
          </div>
          
          <div style="background: ${BRAND_LIGHT_BG}; padding: 20px; border-radius: 12px; margin: 25px 0;">
            <h4 style="color: ${BRAND_DARK}; margin: 0 0 15px;">What This Means</h4>
            <ul style="margin: 0; padding-left: 20px; color: #666;">
              <li style="margin: 8px 0;">You will not be able to log in to your account</li>
              <li style="margin: 8px 0;">Any pending orders may be cancelled</li>
              <li style="margin: 8px 0;">Your loyalty points are frozen</li>
              <li style="margin: 8px 0;">You cannot place new orders</li>
            </ul>
          </div>
          
          <div style="background: #eff6ff; padding: 20px; border-radius: 12px; margin: 25px 0; text-align: center;">
            <h4 style="color: #1d4ed8; margin: 0 0 10px;">Need Help?</h4>
            <p style="margin: 0; color: #666; font-size: 14px;">
              If you believe this is a mistake or would like to appeal this decision, 
              please contact our support team:
            </p>
            <p style="margin: 15px 0 0;">
              <a href="mailto:support@zoiro.com" style="color: ${BRAND_RED}; text-decoration: none; font-weight: bold;">support@zoiro.com</a>
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center; margin-top: 25px;">
            We value all our customers and hope to resolve this matter promptly.
          </p>
        </div>
        
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `⚠️ Your ZOIRO Broast Account Has Been Suspended`,
    htmlContent,
  });
}

// ==========================================
// SEND CUSTOMER UNBANNED EMAIL
// Notify customer when their account is restored
// ==========================================
export async function sendCustomerUnbannedNotification(
  email: string,
  name: string,
  reason?: string
) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Restored</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: ${BRAND_WHITE};">
        ${getEmailHeader('Account Restored! 🎉', 'Good News!')}
        
        <div style="padding: 30px;">
          <div style="text-align: center; margin-bottom: 25px;">
            <div style="display: inline-block; background: #dcfce7; border-radius: 50%; padding: 20px;">
              <span style="font-size: 48px;">✅</span>
            </div>
          </div>
          
          <h2 style="color: ${BRAND_DARK}; margin-top: 0; text-align: center;">Welcome Back, ${name}!</h2>
          
          <p style="text-align: center; color: #666; font-size: 16px;">
            Great news! Your ZOIRO Broast account has been restored and you can now access all features again.
          </p>
          
          ${reason ? `
          <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; margin: 25px 0; border-radius: 0 10px 10px 0;">
            <h4 style="color: #166534; margin: 0 0 10px;">📝 Resolution Note</h4>
            <p style="margin: 0; color: #666; font-size: 15px;">${reason}</p>
          </div>
          ` : ''}
          
          <div style="background: ${BRAND_LIGHT_BG}; padding: 20px; border-radius: 12px; margin: 25px 0;">
            <h4 style="color: ${BRAND_DARK}; margin: 0 0 15px;">🎁 What You Can Do Now</h4>
            <ul style="margin: 0; padding-left: 20px; color: #666;">
              <li style="margin: 8px 0;">Log in to your account</li>
              <li style="margin: 8px 0;">Browse our delicious menu</li>
              <li style="margin: 8px 0;">Access your loyalty points</li>
              <li style="margin: 8px 0;">Place new orders</li>
              <li style="margin: 8px 0;">Use your saved promo codes</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            ${getButton('Order Now 🍗', `${COMPANY_URL}/menu`)}
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center;">
            Thank you for your patience and understanding.<br>
            We're glad to have you back!
          </p>
        </div>
        
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `✅ Your ZOIRO Broast Account Has Been Restored`,
    htmlContent,
  });
}

// =============================================
// MAINTENANCE MODE EMAIL NOTIFICATION
// =============================================

const REASON_LABELS: Record<string, string> = {
  'update': 'System Update',
  'bug_fix': 'Bug Fix',
  'changes': 'Improvements',
  'scheduled': 'Scheduled Maintenance',
  'custom': 'Maintenance',
};

const REASON_ICONS: Record<string, string> = {
  'update': '🔄',
  'bug_fix': '🔧',
  'changes': '✨',
  'scheduled': '📅',
  'custom': '🛠️',
};

/**
 * Send maintenance mode notification to a user
 */
export async function sendMaintenanceNotification(
  email: string,
  name: string,
  details: {
    reasonType: string;
    customReason?: string;
    title: string;
    message?: string;
    estimatedRestoreTime?: string;
  }
) {
  const { reasonType, customReason, title, message, estimatedRestoreTime } = details;
  
  const reasonLabel = REASON_LABELS[reasonType] || 'Maintenance';
  const reasonIcon = REASON_ICONS[reasonType] || '🛠️';
  const displayReason = reasonType === 'custom' && customReason ? customReason : reasonLabel;
  
  // Format restore time
  let restoreTimeText = 'We will notify you when we\'re back online.';
  if (estimatedRestoreTime) {
    const restoreDate = new Date(estimatedRestoreTime);
    restoreTimeText = `Expected completion: ${restoreDate.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Scheduled Maintenance</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: ${BRAND_WHITE};">
        ${getEmailHeader(`${reasonIcon} ${title}`, 'Important System Notice')}
        
        <div style="padding: 40px 30px;">
          <p style="font-size: 16px;">Dear ${name || 'Valued Customer'},</p>
          
          <p style="color: #666; font-size: 16px;">
            We're writing to inform you that the ZOIRO Broast website will be temporarily unavailable due to ${displayReason.toLowerCase()}.
          </p>
          
          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 0 12px 12px 0;">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
              <span style="font-size: 24px; margin-right: 10px;">⏰</span>
              <h4 style="color: #92400e; margin: 0;">Maintenance Details</h4>
            </div>
            <p style="margin: 0; color: #78350f; font-size: 15px; font-weight: 500;">
              ${restoreTimeText}
            </p>
          </div>
          
          ${message ? `
          <div style="background: ${BRAND_LIGHT_BG}; padding: 20px; border-radius: 12px; margin: 25px 0;">
            <h4 style="color: ${BRAND_DARK}; margin: 0 0 10px;">📋 What's Happening</h4>
            <p style="margin: 0; color: #666; font-size: 15px;">${message}</p>
          </div>
          ` : ''}
          
          <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 20px; border-radius: 12px; margin: 25px 0;">
            <h4 style="color: #065f46; margin: 0 0 15px;">💡 What You Can Do</h4>
            <ul style="margin: 0; padding-left: 20px; color: #047857;">
              <li style="margin: 8px 0;">Save your favorite items for later</li>
              <li style="margin: 8px 0;">Follow us on social media for updates</li>
              <li style="margin: 8px 0;">Call us for urgent orders: <strong>+92 300 1234567</strong></li>
            </ul>
          </div>
          
          <p style="color: #666; font-size: 14px; text-align: center; margin-top: 30px;">
            We apologize for any inconvenience this may cause.<br>
            Thank you for your patience and understanding!
          </p>
          
          <div style="text-align: center; margin: 25px 0; padding: 20px; background: ${BRAND_LIGHT_BG}; border-radius: 12px;">
            <p style="margin: 0 0 10px; color: #666; font-size: 14px;">Questions? Contact us:</p>
            <p style="margin: 0;">
              <a href="tel:+923001234567" style="color: ${BRAND_RED}; text-decoration: none; font-weight: bold;">📞 +92 300 1234567</a>
            </p>
          </div>
        </div>
        
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `${reasonIcon} ZOIRO Broast - ${title}`,
    htmlContent,
  });
}

/**
 * Send maintenance emails to multiple recipients (batch)
 * Returns count of successfully sent emails
 */
export async function sendMaintenanceNotificationBatch(
  recipients: { email: string; name: string }[],
  details: {
    reasonType: string;
    customReason?: string;
    title: string;
    message?: string;
    estimatedRestoreTime?: string;
  }
): Promise<{ success: boolean; sentCount: number; errors: string[] }> {
  let sentCount = 0;
  const errors: string[] = [];
  
  try {
    // Send in batches of 10 to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      // Send batch in parallel
      const results = await Promise.allSettled(
        batch.map(r => sendMaintenanceNotification(r.email, r.name, details))
      );
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          sentCount++;
        } else {
          const email = batch[index]?.email || 'unknown';
          const reason = result.status === 'rejected' 
            ? String(result.reason || 'Unknown error')
            : 'Send failed';
          errors.push(`Failed: ${email} - ${reason}`);
        }
      });
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return { success: sentCount > 0 || recipients.length === 0, sentCount, errors };
  } catch (error: any) {
    console.error('[Brevo Batch] Error:', error);
    errors.push(`Batch error: ${error?.message || 'Unknown error'}`);
    return { success: false, sentCount, errors };
  }
}

// =============================================
// CONTACT MESSAGE REPLY EMAIL
// For replying to customer contact form submissions
// =============================================

/**
 * Send reply to a contact form message
 */
export async function sendContactMessageReply(
  recipientEmail: string,
  recipientName: string,
  originalMessage: string,
  replyMessage: string,
  repliedByName: string,
  originalSubject?: string
) {
  const truncatedOriginal = originalMessage.length > 500 
    ? originalMessage.substring(0, 500) + '...' 
    : originalMessage;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reply from ZOIRO Broast</title>
    </head>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: ${BRAND_WHITE};">
        ${getEmailHeader('📬 Reply to Your Message', 'Thank you for contacting us')}
        
        <div style="padding: 30px;">
          <h2 style="color: ${BRAND_DARK}; margin-top: 0;">Hello ${recipientName}! 👋</h2>
          
          <p>Thank you for reaching out to us. We've reviewed your message and here is our response:</p>
          
          <!-- Reply Message -->
          <div style="background: #f0fdf4; border: 2px solid #22c55e; border-radius: 10px; padding: 20px; margin: 25px 0;">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
              <span style="font-size: 24px; margin-right: 10px;">💬</span>
              <strong style="color: #16a34a;">Our Response</strong>
            </div>
            <div style="color: ${BRAND_DARK}; white-space: pre-wrap; font-size: 15px;">${replyMessage}</div>
          </div>
          
          <!-- Original Message Reference -->
          <div style="background: ${BRAND_LIGHT_BG}; border-left: 4px solid ${BRAND_RED}; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0 0 8px; color: #666; font-size: 13px;">
              <strong>Your Original Message${originalSubject ? ` (Re: ${originalSubject})` : ''}:</strong>
            </p>
            <p style="margin: 0; color: #555; font-size: 14px; font-style: italic;">"${truncatedOriginal}"</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
          
          <p style="margin-bottom: 5px;">Need more help? Don't hesitate to reach out:</p>
          <ul style="color: #444; margin: 10px 0;">
            <li>📞 Call us: <a href="tel:+923046292822" style="color: ${BRAND_RED};">+92 304 629 2822</a></li>
            <li>💬 WhatsApp: <a href="https://wa.me/923046292822" style="color: ${BRAND_RED};">+92 304 629 2822</a></li>
            <li>📧 Email: <a href="mailto:zorobroast@gmail.com" style="color: ${BRAND_RED};">zorobroast@gmail.com</a></li>
          </ul>
          
          <div style="text-align: center; margin-top: 30px;">
            ${getButton('Visit Our Menu', `${COMPANY_URL}/menu`)}
          </div>
          
          <p style="margin-top: 25px; font-size: 13px; color: #888;">
            Responded by: <strong>${repliedByName}</strong> from ZOIRO Broast Team
          </p>
        </div>
        
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;

  const subjectLine = originalSubject 
    ? `Re: ${originalSubject} - ZOIRO Broast` 
    : `Reply to your message - ZOIRO Broast`;

  return sendEmail({
    to: recipientEmail,
    subject: subjectLine,
    htmlContent,
  });
}

// =============================================
// SALARY SLIP / PAYSLIP EMAIL NOTIFICATION
// =============================================

export async function sendPayslipNotification({
  employeeEmail,
  employeeName,
  employeeId,
  periodStart,
  periodEnd,
  baseSalary,
  overtimePay,
  bonuses,
  deductions,
  taxAmount,
  netSalary,
  paymentMethod,
  status,
  paidAt,
  processedBy,
}: {
  employeeEmail: string;
  employeeName: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  overtimePay: number;
  bonuses: number;
  deductions: number;
  taxAmount: number;
  netSalary: number;
  paymentMethod?: string;
  status: string;
  paidAt?: string;
  processedBy?: string;
}) {
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' });
  const formatCurrency = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;

  const isPaid = status === 'paid';
  const statusColor = isPaid ? '#22c55e' : '#eab308';
  const statusLabel = isPaid ? 'PAID' : 'PENDING';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; background: ${BRAND_WHITE};">
        
        ${getEmailHeader('Salary Slip', `Pay Period: ${formatDate(periodStart)} - ${formatDate(periodEnd)}`)}
        
        <div style="padding: 30px;">
          <!-- Status Badge -->
          <div style="text-align: center; margin-bottom: 25px;">
            <span style="display: inline-block; background: ${statusColor}15; color: ${statusColor}; padding: 8px 24px; border-radius: 20px; font-weight: bold; font-size: 14px; border: 1px solid ${statusColor}30;">
              ● ${statusLabel}
            </span>
          </div>

          <!-- Employee Info -->
          <div style="background: ${BRAND_LIGHT_BG}; border-radius: 12px; padding: 20px; margin-bottom: 25px; border-left: 4px solid ${BRAND_RED};">
            <h3 style="margin: 0 0 10px; color: ${BRAND_DARK}; font-size: 16px;">Employee Details</h3>
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="padding: 4px 0; color: #666;">Name</td>
                <td style="padding: 4px 0; font-weight: bold; text-align: right;">${employeeName}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #666;">Employee ID</td>
                <td style="padding: 4px 0; font-weight: bold; text-align: right;">${employeeId}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #666;">Pay Period</td>
                <td style="padding: 4px 0; text-align: right;">${formatDate(periodStart)} - ${formatDate(periodEnd)}</td>
              </tr>
              ${paymentMethod ? `<tr>
                <td style="padding: 4px 0; color: #666;">Payment Method</td>
                <td style="padding: 4px 0; text-align: right;">${paymentMethod.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
              </tr>` : ''}
            </table>
          </div>

          <!-- Salary Breakdown -->
          <div style="background: ${BRAND_WHITE}; border: 1px solid #e5e5e5; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
            <h3 style="margin: 0 0 15px; color: ${BRAND_DARK}; font-size: 16px;">Salary Breakdown</h3>
            
            <!-- Earnings -->
            <p style="margin: 0 0 8px; color: #22c55e; font-weight: bold; font-size: 13px; text-transform: uppercase;">Earnings</p>
            <table style="width: 100%; font-size: 14px; margin-bottom: 15px;">
              <tr>
                <td style="padding: 6px 0; color: #444;">Base Salary</td>
                <td style="padding: 6px 0; text-align: right; font-weight: 600;">${formatCurrency(baseSalary)}</td>
              </tr>
              ${overtimePay > 0 ? `<tr>
                <td style="padding: 6px 0; color: #444;">Overtime Pay</td>
                <td style="padding: 6px 0; text-align: right; color: #22c55e;">+${formatCurrency(overtimePay)}</td>
              </tr>` : ''}
              ${bonuses > 0 ? `<tr>
                <td style="padding: 6px 0; color: #444;">Bonuses</td>
                <td style="padding: 6px 0; text-align: right; color: #22c55e;">+${formatCurrency(bonuses)}</td>
              </tr>` : ''}
            </table>

            <!-- Deductions -->
            ${(deductions > 0 || taxAmount > 0) ? `
            <p style="margin: 0 0 8px; color: #ef4444; font-weight: bold; font-size: 13px; text-transform: uppercase;">Deductions</p>
            <table style="width: 100%; font-size: 14px; margin-bottom: 15px;">
              ${deductions > 0 ? `<tr>
                <td style="padding: 6px 0; color: #444;">Deductions</td>
                <td style="padding: 6px 0; text-align: right; color: #ef4444;">-${formatCurrency(deductions)}</td>
              </tr>` : ''}
              ${taxAmount > 0 ? `<tr>
                <td style="padding: 6px 0; color: #444;">Tax</td>
                <td style="padding: 6px 0; text-align: right; color: #ef4444;">-${formatCurrency(taxAmount)}</td>
              </tr>` : ''}
            </table>
            ` : ''}

            <!-- Net Salary -->
            <div style="border-top: 2px solid ${BRAND_RED}; padding-top: 15px; margin-top: 10px;">
              <table style="width: 100%;">
                <tr>
                  <td style="font-size: 16px; font-weight: bold; color: ${BRAND_DARK};">Net Salary</td>
                  <td style="font-size: 22px; font-weight: bold; color: #22c55e; text-align: right;">${formatCurrency(netSalary)}</td>
                </tr>
              </table>
            </div>
          </div>

          ${paidAt ? `
          <div style="background: #22c55e10; border: 1px solid #22c55e30; border-radius: 12px; padding: 15px; margin-bottom: 25px; text-align: center;">
            <p style="margin: 0; color: #22c55e; font-weight: bold;">✅ Payment processed on ${formatDate(paidAt)}</p>
          </div>
          ` : ''}

          ${processedBy ? `
          <p style="font-size: 13px; color: #888; text-align: center;">
            Processed by: <strong>${processedBy}</strong>
          </p>
          ` : ''}

          <div style="text-align: center; margin-top: 20px;">
            ${getButton('View in Portal', `${COMPANY_URL}/portal/payroll`)}
          </div>
          
          <p style="font-size: 12px; color: #aaa; text-align: center; margin-top: 20px;">
            This is an automated salary notification from ZOIRO Broast. If you have any questions, please contact your administrator.
          </p>
        </div>
        
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: employeeEmail,
    subject: `Salary Slip - ${formatDate(periodStart)} to ${formatDate(periodEnd)} | ZOIRO Broast`,
    htmlContent,
  });
}
