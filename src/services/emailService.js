/**
 * Email Service
 * Handles email notifications via SendGrid
 * 
 * To use this service, configure SendGrid API key in environment variables:
 * VITE_SENDGRID_API_KEY=your_api_key_here
 */

/**
 * Send email via SendGrid
 * @param {Object} emailData - Email data
 * @param {string} emailData.to - Recipient email
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.text - Plain text content
 * @param {string} emailData.html - HTML content (optional)
 * @returns {Promise<Object>} Send result
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  const apiKey = import.meta.env.VITE_SENDGRID_API_KEY;
  const fromEmail = import.meta.env.VITE_SENDGRID_FROM_EMAIL || 'noreply@davidsalon.com';
  
  if (!apiKey) {
    console.warn('SendGrid API key not configured. Email not sent.');
    return {
      success: false,
      error: 'SendGrid API key not configured'
    };
    }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }]
        }],
        from: { email: fromEmail },
        subject: subject,
        content: [
          {
            type: 'text/plain',
            value: text
          },
          ...(html ? [{
            type: 'text/html',
            value: html
          }] : [])
        ]
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`SendGrid API error: ${response.status} - ${errorData}`);
    }
    
    return {
      success: true,
      message: 'Email sent successfully'
    };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email'
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
