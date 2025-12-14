/**
 * Email Service
 * Handles email notifications via EmailJS
 * 
 * EmailJS Configuration:
 * - Service ID: service_david_devs
 * - Template ID: template_j6ktzo1
 * - Public Key: Set in VITE_EMAILJS_PUBLIC_KEY environment variable
 */

import { ROLE_LABELS } from '../utils/constants';
import emailjs from '@emailjs/browser';

// EmailJS configuration - using existing service and template
const EMAILJS_SERVICE_ID = 'service_david_devs';
const EMAILJS_TEMPLATE_ID = 'template_j6ktzo1';

/**
 * Verify EmailJS configuration
 * @returns {Object} Configuration status
 */
export const verifyEmailJSConfig = () => {
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  
  const config = {
    serviceId: EMAILJS_SERVICE_ID,
    templateId: EMAILJS_TEMPLATE_ID,
    publicKey: {
      exists: !!publicKey,
      value: publicKey ? `${publicKey.substring(0, 4)}...` : 'not set'
    }
  };
  
  console.log('🔍 [EMAILJS CONFIG] Configuration check:', config);
  
  if (!publicKey) {
    console.error('❌ [EMAILJS CONFIG] Missing public key!');
    console.error('❌ [EMAILJS CONFIG] Required: VITE_EMAILJS_PUBLIC_KEY');
    console.error('❌ [EMAILJS CONFIG] Service ID and Template ID are hardcoded, only public key is needed');
  } else {
    console.log('✅ [EMAILJS CONFIG] All configuration present');
    console.log('✅ [EMAILJS CONFIG] Service ID:', EMAILJS_SERVICE_ID);
    console.log('✅ [EMAILJS CONFIG] Template ID:', EMAILJS_TEMPLATE_ID);
  }
  
  return config;
};

/**
 * Send email via EmailJS
 * @param {Object} emailData - Email data
 * @param {string} emailData.to - Recipient email
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.text - Plain text content
 * @param {string} emailData.html - HTML content (optional)
 * @param {string} emailData.toName - Recipient name (optional)
 * @returns {Promise<Object>} Send result
 */
export const sendEmail = async ({ to, subject, text, html, toName }) => {
  console.log('📧 [EMAIL SERVICE] ========================================');
  console.log('📧 [EMAIL SERVICE] Starting email send via EmailJS...');
  console.log('📧 [EMAIL SERVICE] Recipient:', to);
  console.log('📧 [EMAIL SERVICE] Subject:', subject);
  
  // Verify configuration first
  const config = verifyEmailJSConfig();
  
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  
  console.log('📧 [EMAIL SERVICE] Service ID:', EMAILJS_SERVICE_ID);
  console.log('📧 [EMAIL SERVICE] Template ID:', EMAILJS_TEMPLATE_ID);
  console.log('📧 [EMAIL SERVICE] Public Key configured:', publicKey ? '✅ Yes' : '❌ No');
  
  if (!publicKey) {
    console.warn('⚠️ [EMAIL SERVICE] EmailJS public key not configured. Email not sent.');
    return {
      success: false,
      error: 'EmailJS not configured. Please set VITE_EMAILJS_PUBLIC_KEY'
    };
  }

  try {
    // Initialize EmailJS with public key
    emailjs.init(publicKey);

    // Prepare template parameters for EmailJS
    // Template format: {{name}}, {{time}}, {{message}}
    const templateParams = {
      to_email: to, // Recipient email - MUST be set in EmailJS service configuration as {{to_email}}
      name: subject || 'Special Promotion', // Maps to {{name}} in template
      time: new Date().toLocaleDateString(), // Maps to {{time}} in template
      message: html || text.replace(/\n/g, '<br>'), // Maps to {{message}} in template
      subject: subject // For EmailJS template subject line
    };

    console.log('📧 [EMAIL SERVICE] EmailJS template params prepared:', {
      to_email: templateParams.to_email,
      name: templateParams.name,
      time: templateParams.time,
      message_length: templateParams.message.length,
      subject: templateParams.subject
    });

    console.log('📧 [EMAIL SERVICE] Sending request to EmailJS...');
    console.log('📧 [EMAIL SERVICE] Service ID:', EMAILJS_SERVICE_ID);
    console.log('📧 [EMAIL SERVICE] Template ID:', EMAILJS_TEMPLATE_ID);
    
    // Send email via EmailJS
    const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
    
    console.log('📧 [EMAIL SERVICE] Response status:', response.status);
    console.log('📧 [EMAIL SERVICE] Response text:', response.text);
    
    if (response.status === 200) {
      console.log('✅ [EMAIL SERVICE] Email sent successfully via EmailJS!');
      console.log('✅ [EMAIL SERVICE] Response:', response);
      
      return {
        success: true,
        message: 'Email sent successfully',
        messageId: response.text || 'unknown',
        response: response
      };
    } else {
      throw new Error(`EmailJS returned status ${response.status}: ${response.text}`);
    }
  } catch (error) {
    console.error('❌ [EMAIL SERVICE] Error sending email:', error);
    console.error('❌ [EMAIL SERVICE] Error details:', {
      message: error.message,
      status: error.status,
      text: error.text,
      stack: error.stack
    });
    
    // Provide helpful error messages
    let errorMessage = error.message || 'Failed to send email';
    if (error.status === 400) {
      errorMessage = 'Invalid email template or parameters. Check EmailJS template configuration.';
    } else if (error.status === 401) {
      errorMessage = 'EmailJS authentication failed. Check your public key.';
    } else if (error.status === 404) {
      errorMessage = 'EmailJS service or template not found. Check your service ID and template ID.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Send purchase order email to supplier
 * @param {Object} orderData - Purchase order data
 * @param {Object} supplierData - Supplier data
 * @returns {Promise<Object>} Send result
 */
export const sendPurchaseOrderEmail = async (orderData, supplierData) => {
  if (!supplierData.email) {
    return {
      success: false,
      error: 'Supplier email not found'
    };
  }
  
  const { formatDate } = await import('../utils/helpers');
  
  // Format order items
  const itemsList = orderData.items.map((item, index) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${index + 1}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.itemName || 'Item'}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${item.quantity} ${item.unit || ''}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₱${(item.unitCost || 0).toFixed(2)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">₱${((item.quantity || 0) * (item.unitCost || 0)).toFixed(2)}</td>
    </tr>
  `).join('');
  
  const expectedDeliveryDate = orderData.expectedDeliveryDate 
    ? formatDate(orderData.expectedDeliveryDate instanceof Date ? orderData.expectedDeliveryDate : orderData.expectedDeliveryDate.toDate())
    : 'TBD';

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .order-info { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background-color: #f3f4f6; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; }
        td { padding: 8px; border-bottom: 1px solid #ddd; }
        .total { font-weight: bold; font-size: 1.1em; text-align: right; padding-top: 10px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Purchase Order</h1>
          <p>David's Salon Management System</p>
        </div>
        <div class="content">
          <p>Dear ${supplierData.name || 'Supplier'},</p>
          
          <p>We are pleased to submit the following purchase order:</p>
          
          <div class="order-info">
            <p><strong>PO Number:</strong> ${orderData.poNumber}</p>
            <p><strong>Order Date:</strong> ${formatDate(orderData.createdAt instanceof Date ? orderData.createdAt : orderData.createdAt.toDate())}</p>
            <p><strong>Expected Delivery:</strong> ${expectedDeliveryDate}</p>
            ${orderData.branchName ? `<p><strong>Branch:</strong> ${orderData.branchName}</p>` : ''}
          </div>

          <h3>Order Items:</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th style="text-align: right;">Quantity</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsList}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="4" class="total">Total Amount:</td>
                <td class="total">₱${(orderData.totalAmount || 0).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
          
          ${orderData.notes ? `<p><strong>Notes:</strong><br>${orderData.notes}</p>` : ''}
          
          <p>Please confirm receipt of this purchase order and inform us of the delivery date.</p>
          
          <p>Thank you for your continued partnership.</p>
          
          <p>Best regards,<br>
          ${orderData.createdByName || 'Inventory Team'}<br>
          David's Salon</p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply directly to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    PURCHASE ORDER - ${orderData.poNumber}
    David's Salon Management System
    
    Dear ${supplierData.name || 'Supplier'},
    
    We are pleased to submit the following purchase order:
    
    PO Number: ${orderData.poNumber}
    Order Date: ${formatDate(orderData.createdAt instanceof Date ? orderData.createdAt : orderData.createdAt.toDate())}
    Expected Delivery: ${expectedDeliveryDate}
    ${orderData.branchName ? `Branch: ${orderData.branchName}\n` : ''}
    
    Order Items:
    ${orderData.items.map((item, index) => 
      `${index + 1}. ${item.itemName || 'Item'} - ${item.quantity} ${item.unit || ''} @ ₱${(item.unitCost || 0).toFixed(2)} = ₱${((item.quantity || 0) * (item.unitCost || 0)).toFixed(2)}`
    ).join('\n')}
    
    Total Amount: ₱${(orderData.totalAmount || 0).toFixed(2)}
    
    ${orderData.notes ? `Notes:\n${orderData.notes}\n` : ''}
    
    Please confirm receipt of this purchase order and inform us of the delivery date.
    
    Thank you for your continued partnership.
    
    Best regards,
    ${orderData.createdByName || 'Inventory Team'}
    David's Salon
  `;
  
  return await sendEmail({
    to: supplierData.email,
    subject: `Purchase Order ${orderData.poNumber} - David's Salon`,
    text: textContent,
    html: htmlContent
  });
};

/**
 * Send welcome email to new user
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.displayName - User display name
 * @param {string} userData.role - User role
 * @returns {Promise<Object>} Send result
 */
export const sendWelcomeEmail = async ({ email, displayName, role }) => {
  if (!email) {
    return {
      success: false,
      error: 'Email is required'
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to David's Salon!</h1>
        </div>
        <div class="content">
          <p>Dear ${displayName || 'Valued Customer'},</p>
          
          <p>Welcome to <strong>David's Salon Management System</strong>! We're thrilled to have you join our community.</p>
          
          <p>Your account has been successfully created with the role of <strong>${role || 'Client'}</strong>.</p>
          
          <p>Here's what you can do next:</p>
          <ul>
            <li>Verify your email address by clicking the verification link we sent</li>
            <li>Complete your profile</li>
            <li>Book your first appointment</li>
            <li>Explore our services and offerings</li>
          </ul>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          
          <p>We look forward to serving you!</p>
          
          <p>Best regards,<br>
          <strong>The David's Salon Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply directly to this message.</p>
          <p>&copy; ${new Date().getFullYear()} David's Salon. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Welcome to David's Salon!
    
    Dear ${displayName || 'Valued Customer'},
    
    Welcome to David's Salon Management System! We're thrilled to have you join our community.
    
    Your account has been successfully created with the role of ${role || 'Client'}.
    
    Here's what you can do next:
    - Verify your email address by clicking the verification link we sent
    - Complete your profile
    - Book your first appointment
    - Explore our services and offerings
    
    If you have any questions or need assistance, please don't hesitate to contact our support team.
    
    We look forward to serving you!
    
    Best regards,
    The David's Salon Team
    
    ---
    This is an automated email. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  return await sendEmail({
    to: email,
    subject: 'Welcome to David\'s Salon Management System',
    text: textContent,
    html: htmlContent
  });
};

/**
 * Send account activation email to user
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.displayName - User display name
 * @returns {Promise<Object>} Send result
 */
export const sendAccountActivatedEmail = async ({ email, displayName }) => {
  if (!email) {
    return {
      success: false,
      error: 'Email is required'
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10b981; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Account Activated!</h1>
        </div>
        <div class="content">
          <p>Dear ${displayName || 'User'},</p>
          
          <p>Great news! Your account has been <strong>activated</strong> and you can now access the David's Salon Management System.</p>
          
          <p>You can now log in and start using the system.</p>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          
          <p>Welcome aboard!</p>
          
          <p>Best regards,<br>
          <strong>The David's Salon Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply directly to this message.</p>
          <p>&copy; ${new Date().getFullYear()} David's Salon. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Account Activated!
    
    Dear ${displayName || 'User'},
    
    Great news! Your account has been activated and you can now access the David's Salon Management System.
    
    You can now log in and start using the system.
    
    If you have any questions or need assistance, please don't hesitate to contact our support team.
    
    Welcome aboard!
    
    Best regards,
    The David's Salon Team
    
    ---
    This is an automated email. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  return await sendEmail({
    to: email,
    subject: 'Account Activated - David\'s Salon',
    text: textContent,
    html: htmlContent
  });
};

/**
 * Send account deactivation email to user
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.displayName - User display name
 * @param {string} userData.reason - Reason for deactivation (optional)
 * @returns {Promise<Object>} Send result
 */
export const sendAccountDeactivatedEmail = async ({ email, displayName, reason }) => {
  if (!email) {
    return {
      success: false,
      error: 'Email is required'
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #ef4444; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .warning { background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Account Deactivated</h1>
        </div>
        <div class="content">
          <p>Dear ${displayName || 'User'},</p>
          
          <div class="warning">
            <p><strong>Your account has been deactivated.</strong></p>
            <p>You will no longer be able to access the David's Salon Management System.</p>
          </div>
          
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          
          <p>If you believe this is an error or have any questions, please contact our support team.</p>
          
          <p>Thank you for using our system.</p>
          
          <p>Best regards,<br>
          <strong>The David's Salon Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply directly to this message.</p>
          <p>&copy; ${new Date().getFullYear()} David's Salon. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Account Deactivated
    
    Dear ${displayName || 'User'},
    
    Your account has been deactivated. You will no longer be able to access the David's Salon Management System.
    
    ${reason ? `Reason: ${reason}\n` : ''}
    
    If you believe this is an error or have any questions, please contact our support team.
    
    Thank you for using our system.
    
    Best regards,
    The David's Salon Team
    
    ---
    This is an automated email. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  return await sendEmail({
    to: email,
    subject: 'Account Deactivated - David\'s Salon',
    text: textContent,
    html: htmlContent
  });
};

/**
 * Send user creation notification email
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.displayName - User display name
 * @param {string} userData.role - User role
 * @param {string} userData.temporaryPassword - Temporary password (optional)
 * @returns {Promise<Object>} Send result
 */
export const sendUserCreatedEmail = async ({ email, displayName, role, temporaryPassword }) => {
  if (!email) {
    return {
      success: false,
      error: 'Email is required'
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .credentials { background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Account Created</h1>
        </div>
        <div class="content">
          <p>Dear ${displayName || 'User'},</p>
          
          <p>An account has been created for you in the <strong>David's Salon Management System</strong>.</p>
          
          <div class="credentials">
            <p><strong>Account Details:</strong></p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Role:</strong> ${role || 'Not specified'}</p>
            ${temporaryPassword ? `<p><strong>Temporary Password:</strong> ${temporaryPassword}</p>` : ''}
          </div>
          
          ${temporaryPassword ? '<p><strong>Please change your password after your first login.</strong></p>' : ''}
          
          <p>You can now log in using your email address and password.</p>
          
          <p>If you have any questions or need assistance, please contact our support team.</p>
          
          <p>Welcome to the team!</p>
          
          <p>Best regards,<br>
          <strong>The David's Salon Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply directly to this message.</p>
          <p>&copy; ${new Date().getFullYear()} David's Salon. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Account Created - David's Salon Management System
    
    Dear ${displayName || 'User'},
    
    An account has been created for you in the David's Salon Management System.
    
    Account Details:
    Email: ${email}
    Role: ${role || 'Not specified'}
    ${temporaryPassword ? `Temporary Password: ${temporaryPassword}` : ''}
    
    ${temporaryPassword ? 'Please change your password after your first login.\n' : ''}
    
    You can now log in using your email address and password.
    
    If you have any questions or need assistance, please contact our support team.
    
    Welcome to the team!
    
    Best regards,
    The David's Salon Team
    
    ---
    This is an automated email. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  return await sendEmail({
    to: email,
    subject: 'Account Created - David\'s Salon Management System',
    text: textContent,
    html: htmlContent
  });
};

/**
 * Send password reset email to user (System Admin reset)
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.firstName - User first name
 * @param {string} userData.lastName - User last name
 * @param {string} newPassword - The new default password
 * @returns {Promise<Object>} Send result
 */
export const sendPasswordResetEmail = async ({ email, firstName, lastName, rolePasswords }) => {
  console.log('🔐 [PASSWORD RESET EMAIL] Function called');
  console.log('🔐 [PASSWORD RESET EMAIL] Email:', email);
  console.log('🔐 [PASSWORD RESET EMAIL] Role passwords:', rolePasswords);
  
  if (!email) {
    console.error('❌ [PASSWORD RESET EMAIL] Email is required');
    return {
      success: false,
      error: 'Email is required'
    };
  }

  const displayName = firstName && lastName 
    ? `${firstName} ${lastName}`.trim()
    : firstName || lastName || 'User';
  
  console.log('🔐 [PASSWORD RESET EMAIL] Display name:', displayName);

  // Build role passwords list
  const rolePasswordsList = Object.entries(rolePasswords || {}).map(([role, password]) => ({
    roleLabel: ROLE_LABELS[role] || role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    password: password
  }));

  // If no role passwords provided, return error
  if (rolePasswordsList.length === 0) {
    return {
      success: false,
      error: 'No passwords provided'
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #160B53; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .credentials { background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0; border-radius: 6px; }
        .password-item { background-color: #fff; border: 2px solid #2563eb; padding: 15px; margin: 12px 0; border-radius: 6px; }
        .role-label { font-size: 14px; font-weight: bold; color: #160B53; margin-bottom: 8px; text-transform: capitalize; }
        .password-box { text-align: center; font-size: 18px; font-weight: bold; font-family: monospace; color: #160B53; padding: 10px; background-color: #f8f9fa; border-radius: 4px; }
        .info { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 6px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Notification</h1>
        </div>
        <div class="content">
          <p>Dear ${displayName},</p>
          
          <p>Your password${rolePasswordsList.length > 1 ? 's have' : ' has'} been reset by the system administrator.</p>
          
          <div class="credentials">
            <p><strong>Your new password${rolePasswordsList.length > 1 ? 's for each role' : ''} ${rolePasswordsList.length > 1 ? 'are' : 'is'}:</strong></p>
            ${rolePasswordsList.map(({ roleLabel, password }) => `
              <div class="password-item">
                <div class="role-label">${roleLabel}:</div>
                <div class="password-box">${password}</div>
              </div>
            `).join('')}
          </div>
          
          <div class="info">
            <p><strong>Important Security Information:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Please log in with the appropriate password for your role${rolePasswordsList.length > 1 ? 's' : ''} as soon as possible</li>
              <li>We strongly recommend changing your password${rolePasswordsList.length > 1 ? 's' : ''} after your first login</li>
              <li>Do not share these passwords with anyone</li>
              <li>If you did not request this password reset, please contact support immediately</li>
            </ul>
          </div>
          
          <p>You can now log in to the David's Salon Management System using your email address and the password${rolePasswordsList.length > 1 ? 's' : ''} shown above.</p>
          
          <p>If you have any questions or need assistance, please contact our support team.</p>
          
          <p>Best regards,<br>
          <strong>The David's Salon Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply directly to this message.</p>
          <p>&copy; ${new Date().getFullYear()} David's Salon. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Password Reset Notification - David's Salon Management System
    
    Dear ${displayName},
    
    Your password${rolePasswordsList.length > 1 ? 's have' : ' has'} been reset by the system administrator.
    
    Your new password${rolePasswordsList.length > 1 ? 's for each role' : ''} ${rolePasswordsList.length > 1 ? 'are' : 'is'}:
    
    ${rolePasswordsList.map(({ roleLabel, password }) => `${roleLabel}: ${password}`).join('\n    ')}
    
    Important Security Information:
    - Please log in with the appropriate password for your role${rolePasswordsList.length > 1 ? 's' : ''} as soon as possible
    - We strongly recommend changing your password${rolePasswordsList.length > 1 ? 's' : ''} after your first login
    - Do not share these passwords with anyone
    - If you did not request this password reset, please contact support immediately
    
    You can now log in to the David's Salon Management System using your email address and the password${rolePasswordsList.length > 1 ? 's' : ''} shown above.
    
    If you have any questions or need assistance, please contact our support team.
    
    Best regards,
    The David's Salon Team
    
    ---
    This is an automated email. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  console.log('🔐 [PASSWORD RESET EMAIL] Calling sendEmail function...');
  const result = await sendEmail({
    to: email,
    toName: displayName,
    subject: 'Password Reset - David\'s Salon Management System',
    text: textContent,
    html: htmlContent
  });
  
  console.log('🔐 [PASSWORD RESET EMAIL] sendEmail result:', result);
  return result;
};

/**
 * Send profile update notification email to user
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.firstName - User first name
 * @param {string} userData.lastName - User last name
 * @param {Object} changes - Object containing changed fields with from/to values
 * @param {Array} changedFields - Array of field names that changed
 * @returns {Promise<Object>} Send result
 */
export const sendProfileUpdateEmail = async ({ email, firstName, lastName, changes, changedFields }) => {
  if (!email) {
    return {
      success: false,
      error: 'Email is required'
    };
  }

  const displayName = firstName && lastName 
    ? `${firstName} ${lastName}`.trim()
    : firstName || lastName || 'User';

  // Format field labels
  const fieldLabels = {
    firstName: 'First Name',
    middleName: 'Middle Name',
    lastName: 'Last Name',
    phone: 'Phone Number',
    branchId: 'Branch Assignment',
    roles: 'Roles',
    isActive: 'Account Status',
    photoURL: 'Profile Picture'
  };

  // Build changes list
  const changesList = changedFields.map(field => {
    const label = fieldLabels[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    const change = changes[field];
    let fromValue = change?.from;
    let toValue = change?.to;

    // Format special fields
    if (field === 'roles') {
      fromValue = Array.isArray(fromValue) ? fromValue.map(r => ROLE_LABELS[r] || r).join(', ') : fromValue;
      toValue = Array.isArray(toValue) ? toValue.map(r => ROLE_LABELS[r] || r).join(', ') : toValue;
    } else if (field === 'isActive') {
      fromValue = fromValue ? 'Active' : 'Inactive';
      toValue = toValue ? 'Active' : 'Inactive';
    } else if (field === 'branchId') {
      // Branch names are already fetched in userService
      fromValue = fromValue || 'Not Assigned';
      toValue = toValue || 'Not Assigned';
    } else if (field === 'photoURL') {
      fromValue = fromValue ? 'Updated' : 'Not Set';
      toValue = toValue ? 'Updated' : 'Not Set';
    } else {
      fromValue = fromValue || 'Not Set';
      toValue = toValue || 'Not Set';
    }

    return { label, fromValue, toValue };
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #160B53; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .changes-box { background-color: #fff; border: 2px solid #2563eb; padding: 20px; margin: 20px 0; border-radius: 6px; }
        .change-item { padding: 12px; margin: 8px 0; background-color: #f8f9fa; border-left: 4px solid #2563eb; border-radius: 4px; }
        .change-label { font-weight: bold; color: #160B53; margin-bottom: 4px; }
        .change-value { color: #666; font-size: 0.9em; }
        .arrow { color: #2563eb; margin: 0 8px; font-weight: bold; }
        .info { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 6px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Profile Updated</h1>
        </div>
        <div class="content">
          <p>Dear ${displayName},</p>
          
          <p>Your profile information has been updated by the system administrator.</p>
          
          <div class="changes-box">
            <p style="font-weight: bold; color: #160B53; margin-bottom: 15px;">The following changes were made to your profile:</p>
            ${changesList.map(change => `
              <div class="change-item">
                <div class="change-label">${change.label}:</div>
                <div class="change-value">
                  <span style="text-decoration: line-through; color: #999;">${change.fromValue}</span>
                  <span class="arrow">→</span>
                  <span style="color: #2563eb; font-weight: bold;">${change.toValue}</span>
                </div>
              </div>
            `).join('')}
          </div>
          
          <div class="info">
            <p><strong>Important:</strong></p>
            <ul style="margin: 10px 0; padding-left: 20px;">
              <li>Please review the changes above</li>
              <li>If you did not request these changes, please contact support immediately</li>
              <li>You may need to log out and log back in to see all changes</li>
            </ul>
          </div>
          
          <p>If you have any questions or concerns about these changes, please contact our support team.</p>
          
          <p>Best regards,<br>
          <strong>The David's Salon Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply directly to this message.</p>
          <p>&copy; ${new Date().getFullYear()} David's Salon. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Profile Updated - David's Salon Management System
    
    Dear ${displayName},
    
    Your profile information has been updated by the system administrator.
    
    The following changes were made to your profile:
    
    ${changesList.map(change => `${change.label}:\n  From: ${change.fromValue}\n  To: ${change.toValue}\n`).join('\n')}
    
    Important:
    - Please review the changes above
    - If you did not request these changes, please contact support immediately
    - You may need to log out and log back in to see all changes
    
    If you have any questions or concerns about these changes, please contact our support team.
    
    Best regards,
    The David's Salon Team
    
    ---
    This is an automated email. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  return await sendEmail({
    to: email,
    toName: displayName,
    subject: 'Profile Updated - David\'s Salon Management System',
    text: textContent,
    html: htmlContent
  });
};

/**
 * Send password reset notification email
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.displayName - User display name
 * @returns {Promise<Object>} Send result
 */
export const sendPasswordResetNotification = async ({ email, displayName }) => {
  if (!email) {
    return {
      success: false,
      error: 'Email is required'
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f59e0b; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .info { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Dear ${displayName || 'User'},</p>
          
          <p>We received a request to reset your password for your David's Salon Management System account.</p>
          
          <div class="info">
            <p>A password reset email has been sent to your email address (${email}).</p>
            <p>Please check your inbox and follow the instructions to reset your password.</p>
          </div>
          
          <p><strong>If you did not request this password reset, please ignore this email or contact our support team immediately.</strong></p>
          
          <p>For security reasons, the password reset link will expire in 1 hour.</p>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          
          <p>Best regards,<br>
          <strong>The David's Salon Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated email. Please do not reply directly to this message.</p>
          <p>&copy; ${new Date().getFullYear()} David's Salon. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Password Reset Request - David's Salon Management System
    
    Dear ${displayName || 'User'},
    
    We received a request to reset your password for your David's Salon Management System account.
    
    A password reset email has been sent to your email address (${email}).
    Please check your inbox and follow the instructions to reset your password.
    
    If you did not request this password reset, please ignore this email or contact our support team immediately.
    
    For security reasons, the password reset link will expire in 1 hour.
    
    If you have any questions or need assistance, please don't hesitate to contact our support team.
    
    Best regards,
    The David's Salon Team
    
    ---
    This is an automated email. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  return await sendEmail({
    to: email,
    subject: 'Password Reset Request - David\'s Salon',
    text: textContent,
    html: htmlContent
  });
};

/**
 * Send promotion email to client
 * @param {Object} promotion - Promotion data
 * @param {Object} clientData - Client data with email
 * @returns {Promise<Object>} - Result of email sending
 */
export const sendPromotionEmail = async (promotion, clientData) => {
  try {
    if (!clientData.email) {
      return {
        success: false,
        message: 'Client email not found'
      };
    }

    const clientName = clientData.firstName && clientData.lastName
      ? `${clientData.firstName} ${clientData.lastName}`.trim()
      : clientData.name || 'Valued Client';

    // Fetch branch name
    let branchName = 'Unknown Branch';
    if (promotion.branchId) {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../config/firebase');
        const branchDoc = await getDoc(doc(db, 'branches', promotion.branchId));
        if (branchDoc.exists()) {
          branchName = branchDoc.data().name || branchDoc.data().branchName || 'Unknown Branch';
        }
      } catch (err) {
        console.warn('Could not fetch branch name:', err);
      }
    }

    // Format dates
    const startDate = promotion.startDate?.toDate 
      ? promotion.startDate.toDate() 
      : new Date(promotion.startDate);
    const endDate = promotion.endDate?.toDate 
      ? promotion.endDate.toDate() 
      : new Date(promotion.endDate);

    const startDateFormatted = startDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    const endDateFormatted = endDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    // Build applicable to text
    let applicableText = '';
    if (promotion.applicableTo === 'services') {
      applicableText = 'Valid on all services';
    } else if (promotion.applicableTo === 'products') {
      applicableText = 'Valid on all products';
    } else if (promotion.applicableTo === 'specific') {
      const serviceCount = promotion.specificServices?.length || 0;
      const productCount = promotion.specificProducts?.length || 0;
      const items = [];
      if (serviceCount > 0) items.push(`${serviceCount} service${serviceCount > 1 ? 's' : ''}`);
      if (productCount > 0) items.push(`${productCount} product${productCount > 1 ? 's' : ''}`);
      applicableText = `Valid on ${items.join(' and ')}`;
    } else {
      applicableText = 'Valid on all services and products';
    }

    // Build usage information
    let usageInfo = '';
    if (promotion.usageType === 'one-time') {
      usageInfo = 'Usage: One-time use per client';
    } else if (promotion.usageType === 'repeating') {
      if (promotion.maxUses) {
        usageInfo = `Usage: Can be used up to ${promotion.maxUses} time${promotion.maxUses > 1 ? 's' : ''}`;
      } else {
        usageInfo = 'Usage: Unlimited uses';
      }
    }

    // Build promotion code info
    const promotionCodeText = promotion.promotionCode 
      ? `Promotion Code: ${promotion.promotionCode}`
      : '';

    const discountText = promotion.discountType === 'percentage' 
      ? `${promotion.discountValue}% OFF`
      : `₱${promotion.discountValue} OFF`;

    // Format date range for template {{time}} variable
    const dateRange = `${startDateFormatted} to ${endDateFormatted}`;

    // Create email message content for {{message}} variable
    // This matches the template format: "✨ Enjoy Exclusive Salon Deals\nCome and experience..."
    const emailMessage = `
✨ ${promotion.title}

${promotion.description || 'No description provided.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DISCOUNT: ${discountText}
${applicableText}
${promotionCodeText ? promotionCodeText + '\n' : ''}${usageInfo}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALIDITY PERIOD:
Valid from: ${startDateFormatted}
Valid until: ${endDateFormatted}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Branch: ${branchName}

Don't miss out on this amazing offer! Visit us soon to take advantage of this promotion.

We look forward to seeing you!

---
David's Salon
    `.trim();

    // Create email content (HTML version for sendEmail function)
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #160B53, #12094A); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { padding: 30px; background: white; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px; }
          .promotion-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .discount { font-size: 24px; font-weight: bold; color: #28a745; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">🎉 Special Promotion</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">David's Salon</p>
          </div>
          <div class="content">
            <h2 style="color: #160B53; margin-top: 0;">Hello ${clientName},</h2>
            <p>We have an exciting promotion just for you!</p>
            <div class="promotion-box">
              <h3 style="color: #160B53; margin-top: 0;">${promotion.title}</h3>
              <p>${promotion.description || 'No description provided.'}</p>
              <div class="discount">${discountText}</div>
              <p><strong>${applicableText}</strong></p>
              ${promotionCodeText ? `<p><strong>${promotionCodeText}</strong></p>` : ''}
              <p>${usageInfo}</p>
            </div>
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #856404;">Validity Period:</h4>
              <p style="margin: 0; color: #856404;">
                <strong>Valid from:</strong> ${startDateFormatted}<br>
                <strong>Valid until:</strong> ${endDateFormatted}
              </p>
            </div>
            <p><strong>Branch:</strong> ${branchName}</p>
            <p>Don't miss out on this amazing offer! Visit us soon to take advantage of this promotion.</p>
            <p>We look forward to seeing you!</p>
            <div class="footer">
              <p>This is an automated email from David's Salon Management System.<br>
              Please do not reply to this email.</p>
              <p>© ${new Date().getFullYear()} David's Salon. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Hello ${clientName},

🎉 Special Promotion: ${promotion.title}

${promotion.description || 'No description provided.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DISCOUNT DETAILS:
Discount: ${discountText}
${applicableText}
${promotionCodeText ? promotionCodeText + '\n' : ''}${usageInfo}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VALIDITY PERIOD:
Valid from: ${startDateFormatted}
Valid until: ${endDateFormatted}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Branch: ${branchName}

Don't miss out on this amazing offer! Visit us soon to take advantage of this promotion.

We look forward to seeing you!

---
David's Salon
    `;

    // Send via EmailJS using the existing template format
    // Template uses: {{name}} = promotion title, {{time}} = date range, {{message}} = promotion details
    try {
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
      
      if (!publicKey) {
        return {
          success: false,
          message: 'EmailJS not configured. Please set VITE_EMAILJS_PUBLIC_KEY',
          email: clientData.email
        };
      }

      // Initialize EmailJS
      emailjs.init(publicKey);

      // Prepare template parameters matching the existing template format
      const templateParams = {
        to_email: clientData.email, // MUST be set in EmailJS service configuration
        name: promotion.title, // Maps to {{name}} in template
        time: dateRange, // Maps to {{time}} in template (e.g., "Dec 14, 2025 to Dec 31, 2025")
        message: emailMessage, // Maps to {{message}} in template
        subject: `Special Promotion: ${promotion.title}` // For EmailJS template subject
      };

      console.log('📧 [PROMOTION EMAIL] Sending via EmailJS...');
      console.log('📧 [PROMOTION EMAIL] Service ID:', EMAILJS_SERVICE_ID);
      console.log('📧 [PROMOTION EMAIL] Template ID:', EMAILJS_TEMPLATE_ID);
      console.log('📧 [PROMOTION EMAIL] To Email:', clientData.email);
      console.log('📧 [PROMOTION EMAIL] Template params:', {
        to_email: templateParams.to_email,
        name: templateParams.name,
        time: templateParams.time,
        message_length: templateParams.message.length
      });

      // Send email via EmailJS
      const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);

      console.log('✅ [PROMOTION EMAIL] Email sent successfully!');
      console.log('✅ [PROMOTION EMAIL] Response:', response);

      return {
        success: true,
        message: 'Promotion email sent successfully',
        email: clientData.email,
        messageId: response.text || 'unknown'
      };
    } catch (error) {
      console.error('❌ [PROMOTION EMAIL] Error sending email:', error);
      return {
        success: false,
        message: error.message || 'Failed to send promotion email',
        email: clientData.email,
        error: error.message
      };
    }

    return {
      success: result.success,
      message: result.success ? 'Promotion email sent successfully' : result.error || 'Failed to send email',
      email: clientData.email
    };
  } catch (error) {
    console.error('Error sending promotion email:', error);
    return {
      success: false,
      message: 'Failed to send promotion email',
      error: error.message
    };
  }
};
