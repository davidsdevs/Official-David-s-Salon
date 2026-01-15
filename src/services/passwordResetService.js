/**
 * Password Reset Service
 * Handles password reset using Brevo OTP
 * Updates rolePasswords in Firestore (not Firebase Auth)
 */

import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { hashPassword } from './rolePasswordService';
import { logActivity } from './activityService';

const OTP_COLLECTION = 'password_reset_otps';
const OTP_EXPIRY_MINUTES = 10; // OTP expires in 10 minutes

/**
 * Generate a random 6-digit OTP
 * @returns {string} 6-digit OTP
 */
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send password reset OTP via Brevo email
 * @param {string} email - User email
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const sendPasswordResetOTP = async (email) => {
  console.log('🔐 [Password Reset] Starting OTP send process...');
  console.log('🔐 [Password Reset] Email:', email);
  
  try {
    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();
    console.log('🔐 [Password Reset] Normalized email:', normalizedEmail);
    
    // Find user by email
    console.log('🔐 [Password Reset] Searching for user in Firestore...');
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', normalizedEmail));
    const snapshot = await getDocs(q);
    
    console.log('🔐 [Password Reset] User search result:', snapshot.size, 'users found');
    
    if (snapshot.empty) {
      console.error('❌ [Password Reset] No user found with email:', normalizedEmail);
      return {
        success: false,
        error: 'No account found with this email address'
      };
    }
    
    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;
    
    console.log('✅ [Password Reset] User found:', {
      userId,
      email: userData.email,
      name: userData.firstName || userData.displayName,
      isActive: userData.isActive
    });
    
    // Check if user is active
    if (userData.isActive === false) {
      console.error('❌ [Password Reset] User account is deactivated');
      return {
        success: false,
        error: 'Account is deactivated. Please contact administrator.'
      };
    }
    
    // Generate OTP
    const otp = generateOTP();
    console.log('🔑 [Password Reset] Generated OTP:', otp);
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);
    console.log('⏰ [Password Reset] OTP expires at:', expiresAt.toISOString());
    
    // Store OTP in Firestore
    console.log('💾 [Password Reset] Storing OTP in Firestore...');
    const otpRef = doc(db, OTP_COLLECTION, normalizedEmail);
    await setDoc(otpRef, {
      userId,
      email: normalizedEmail,
      otp,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(expiresAt),
      used: false,
      attempts: 0
    });
    console.log('✅ [Password Reset] OTP stored in Firestore');
    
    // Send OTP via Brevo
    console.log('📧 [Password Reset] Sending OTP email via Brevo...');
    const emailResult = await sendPasswordResetOTPEmail(normalizedEmail, userData.firstName || userData.displayName || 'User', otp);
    
    console.log('📧 [Password Reset] Email send result:', emailResult);
    
    if (!emailResult.success) {
      console.error('❌ [Password Reset] Failed to send email, deleting OTP...');
      // Delete OTP if email failed
      await deleteDoc(otpRef);
      return {
        success: false,
        error: emailResult.error || 'Failed to send OTP email'
      };
    }
    
    console.log('✅ [Password Reset] OTP email sent successfully!');
    
    // Log activity
    try {
      await logActivity({
        action: 'password_reset_otp_sent',
        performedBy: userId,
        targetUser: userId,
        metadata: {
          email: normalizedEmail,
          method: 'brevo_otp'
        }
      });
      console.log('✅ [Password Reset] Activity logged');
    } catch (logError) {
      console.error('⚠️ [Password Reset] Error logging OTP activity:', logError);
    }
    
    console.log('🎉 [Password Reset] OTP send process completed successfully!');
    return {
      success: true
    };
  } catch (error) {
    console.error('❌ [Password Reset] Error sending password reset OTP:', error);
    console.error('❌ [Password Reset] Error stack:', error.stack);
    return {
      success: false,
      error: error.message || 'Failed to send OTP'
    };
  }
};

/**
 * Verify OTP and reset password
 * @param {string} email - User email
 * @param {string} otp - OTP code
 * @param {string} newPassword - New password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const verifyPasswordResetOTP = async (email, otp, newPassword) => {
  try {
    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();
    
    // Validate password
    if (!newPassword || newPassword.length < 8) {
      return {
        success: false,
        error: 'Password must be at least 8 characters long'
      };
    }
    
    if (!/\d/.test(newPassword)) {
      return {
        success: false,
        error: 'Password must contain at least one number'
      };
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return {
        success: false,
        error: 'Password must contain at least one special character'
      };
    }
    
    // Get OTP record
    const otpRef = doc(db, OTP_COLLECTION, normalizedEmail);
    const otpDoc = await getDoc(otpRef);
    
    if (!otpDoc.exists()) {
      return {
        success: false,
        error: 'No OTP found for this email. Please request a new one.'
      };
    }
    
    const otpData = otpDoc.data();
    
    // Check if OTP is already used
    if (otpData.used === true) {
      return {
        success: false,
        error: 'This OTP has already been used'
      };
    }
    
    // Check if OTP is expired
    const expiresAt = otpData.expiresAt?.toDate();
    if (!expiresAt || expiresAt < new Date()) {
      await deleteDoc(otpRef);
      return {
        success: false,
        error: 'OTP has expired. Please request a new one.'
      };
    }
    
    // Check OTP value
    if (otpData.otp !== otp) {
      // Increment attempts
      const newAttempts = (otpData.attempts || 0) + 1;
      if (newAttempts >= 5) {
        // Delete OTP after 5 failed attempts
        await deleteDoc(otpRef);
        return {
          success: false,
          error: 'Too many failed attempts. Please request a new OTP.'
        };
      }
      
      await updateDoc(otpRef, {
        attempts: newAttempts
      });
      
      return {
        success: false,
        error: `Invalid OTP. ${5 - newAttempts} attempts remaining.`
      };
    }
    
    // Get user
    const userRef = doc(db, 'users', otpData.userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      await deleteDoc(otpRef);
      return {
        success: false,
        error: 'User not found'
      };
    }
    
    const userData = userDoc.data();
    const userRoles = userData.roles || (userData.role ? [userData.role] : []);
    
    if (userRoles.length === 0) {
      return {
        success: false,
        error: 'User has no roles assigned'
      };
    }
    
    // Update all role passwords
    const rolePasswords = userData.rolePasswords || {};
    
    for (const role of userRoles) {
      rolePasswords[role] = await hashPassword(newPassword);
    }
    
    await updateDoc(userRef, {
      rolePasswords,
      updatedAt: Timestamp.now(),
      updatedBy: otpData.userId
    });
    
    // Mark OTP as used
    await updateDoc(otpRef, {
      used: true,
      usedAt: Timestamp.now()
    });
    
    // Delete OTP after use
    await deleteDoc(otpRef);
    
    // Log activity
    try {
      await logActivity({
        action: 'password_reset_completed',
        performedBy: otpData.userId,
        targetUser: otpData.userId,
        metadata: {
          method: 'brevo_otp',
          rolesUpdated: userRoles
        }
      });
    } catch (logError) {
      console.error('Error logging password reset activity:', logError);
    }
    
    return {
      success: true
    };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return {
      success: false,
      error: error.message || 'Failed to verify OTP'
    };
  }
};

/**
 * Send password reset OTP email via Brevo
 * @param {string} email - User email
 * @param {string} displayName - User display name
 * @param {string} otp - OTP code
 * @returns {Promise<{success: boolean, error?: string}>}
 */
const sendPasswordResetOTPEmail = async (email, displayName, otp) => {
  console.log('📧 [OTP Email] Starting to send OTP email...');
  console.log('📧 [OTP Email] Recipient:', email);
  console.log('📧 [OTP Email] Display Name:', displayName);
  console.log('📧 [OTP Email] OTP Code:', otp);
  
  try {
    const brevoApiKey = import.meta.env.VITE_BREVO_API_KEY;
    const senderEmail = import.meta.env.VITE_SENDER_EMAIL || 'chicorlcruz@gmail.com';
    const senderName = import.meta.env.VITE_SENDER_NAME || 'David\'s Salon';
    
    console.log('📧 [OTP Email] Sender Email:', senderEmail);
    console.log('📧 [OTP Email] Sender Name:', senderName);
    
    if (!brevoApiKey) {
      console.error('❌ [OTP Email] Brevo API key not configured');
      return {
        success: false,
        error: 'Email service not configured'
      };
    }
    
    console.log('📧 [OTP Email] API Key configured:', brevoApiKey.substring(0, 15) + '...');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #160B53; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
          .otp-box { background-color: #160B53; color: white; padding: 20px; text-align: center; border-radius: 6px; margin: 20px 0; font-size: 32px; font-weight: bold; letter-spacing: 5px; }
          .info { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset OTP</h1>
          </div>
          <div class="content">
            <p>Dear ${displayName || 'User'},</p>
            
            <p>We received a request to reset your password for your David's Salon Management System account.</p>
            
            <p>Your One-Time Password (OTP) is:</p>
            
            <div class="otp-box">${otp}</div>
            
            <p>Enter this code in the password reset form to proceed.</p>
            
            <div class="info">
              <p><strong>Important:</strong></p>
              <ul>
                <li>This OTP will expire in ${OTP_EXPIRY_MINUTES} minutes</li>
                <li>Do not share this OTP with anyone</li>
                <li>If you did not request this password reset, please ignore this email</li>
              </ul>
            </div>
            
            <p>For security reasons, if you did not request this password reset, please contact our support team immediately.</p>
            
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
      Password Reset OTP - David's Salon
      
      Dear ${displayName || 'User'},
      
      We received a request to reset your password for your David's Salon Management System account.
      
      Your One-Time Password (OTP) is: ${otp}
      
      Enter this code in the password reset form to proceed.
      
      Important:
      - This OTP will expire in ${OTP_EXPIRY_MINUTES} minutes
      - Do not share this OTP with anyone
      - If you did not request this password reset, please ignore this email
      
      For security reasons, if you did not request this password reset, please contact our support team immediately.
      
      Best regards,
      The David's Salon Team
      
      ---
      This is an automated email. Please do not reply directly to this message.
      © ${new Date().getFullYear()} David's Salon. All rights reserved.
    `;

    const requestBody = {
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [
        {
          email: email,
          name: displayName || 'User'
        }
      ],
      subject: 'Your Password Reset OTP - David\'s Salon',
      htmlContent: htmlContent,
      textContent: textContent
    };
    
    console.log('📧 [OTP Email] Request body prepared:', JSON.stringify(requestBody, null, 2));
    console.log('📧 [OTP Email] Sending request to Brevo API...');

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoApiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('📧 [OTP Email] Response status:', response.status);
    console.log('📧 [OTP Email] Response status text:', response.statusText);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ [OTP Email] Brevo API error:', JSON.stringify(errorData, null, 2));
      return {
        success: false,
        error: `Failed to send email via Brevo: ${errorData.message || response.statusText}`
      };
    }
    
    const responseData = await response.json();
    console.log('✅ [OTP Email] SUCCESS! Response data:', JSON.stringify(responseData, null, 2));
    console.log('✅ [OTP Email] Message ID:', responseData.messageId);

    return {
      success: true,
      messageId: responseData.messageId
    };
  } catch (error) {
    console.error('❌ [OTP Email] Error sending OTP email:', error);
    console.error('❌ [OTP Email] Error stack:', error.stack);
    return {
      success: false,
      error: error.message || 'Failed to send email'
    };
  }
};

/**
 * Clean up expired OTPs (can be called periodically)
 * @returns {Promise<number>} Number of OTPs deleted
 */
export const cleanupExpiredOTPs = async () => {
  try {
    const otpsRef = collection(db, OTP_COLLECTION);
    const snapshot = await getDocs(otpsRef);
    const now = new Date();
    let deletedCount = 0;
    
    const deletePromises = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const expiresAt = data.expiresAt?.toDate();
      
      if (expiresAt && expiresAt < now) {
        deletePromises.push(deleteDoc(doc.ref));
        deletedCount++;
      }
    });
    
    await Promise.all(deletePromises);
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up expired OTPs:', error);
    return 0;
  }
};
