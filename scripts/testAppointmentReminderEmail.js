/**
 * Test Script - Send Appointment Reminder Email
 * 
 * This script sends a sample appointment reminder email to test the template.
 * 
 * Usage: node scripts/testAppointmentReminderEmail.js
 */

// Load environment variables
import 'dotenv/config';

const BREVO_API_KEY = process.env.VITE_BREVO_API_KEY;
const SENDER_EMAIL = process.env.VITE_SENDER_EMAIL || 'chicorlcruz@gmail.com';
const SENDER_NAME = process.env.VITE_SENDER_NAME || "David's Salon";

// Test recipient email
const TEST_EMAIL = 'kcanapati6@gmail.com';

// Sample appointment data
const sampleAppointment = {
  clientName: 'Test Client',
  appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
  services: [
    { serviceName: 'Haircut', stylistName: 'Maria Santos' },
    { serviceName: 'Hair Color', stylistName: 'Maria Santos' }
  ]
};

// Sample branch data
const sampleBranch = {
  branchName: 'David\'s Salon - Makati',
  address: '123 Ayala Avenue, Makati City',
  phoneNumber: '(02) 8123-4567'
};

// Format date
const formatDate = (date) => {
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

// Format time
const formatTime = (date) => {
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true
  });
};

async function sendTestEmail() {
  console.log('🚀 Sending test appointment reminder email...');
  console.log('📧 To:', TEST_EMAIL);
  console.log('📧 From:', SENDER_EMAIL);
  console.log('');

  if (!BREVO_API_KEY) {
    console.error('❌ Error: VITE_BREVO_API_KEY not found in environment variables');
    process.exit(1);
  }

  const appointmentDate = sampleAppointment.appointmentDate;
  const formattedDate = formatDate(appointmentDate);
  const formattedTime = formatTime(appointmentDate);
  const dayOfWeek = appointmentDate.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Get service names
  const serviceNames = sampleAppointment.services.map(s => s.serviceName || s.name || 'Service');
  const servicesText = serviceNames.join(', ');
  
  // Get stylist name
  const stylistName = sampleAppointment.services[0]?.stylistName || 'TBA';
  
  const branchName = sampleBranch.branchName;
  const branchAddress = sampleBranch.address;
  const branchPhone = sampleBranch.phoneNumber;
  const clientName = sampleAppointment.clientName;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2D1B4E 0%, #3d2a5f 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; background-color: #f9fafb; border-radius: 0 0 8px 8px; }
        .appointment-box { background: white; border: 2px solid #2D1B4E; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .appointment-detail { margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .appointment-detail:last-child { border-bottom: none; }
        .label { font-weight: 600; color: #2D1B4E; display: inline-block; min-width: 120px; }
        .value { color: #333; }
        .reminder-note { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
        .button { display: inline-block; padding: 12px 24px; background-color: #2D1B4E; color: white; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 Appointment Reminder</h1>
          <p style="margin: 10px 0 0 0; font-size: 1.1em;">See you tomorrow!</p>
        </div>
        <div class="content">
          <p>Dear ${clientName},</p>
          
          <p>This is a friendly reminder that you have an appointment scheduled for <strong>tomorrow</strong>.</p>
          
          <div class="appointment-box">
            <div class="appointment-detail">
              <span class="label">📅 Date:</span>
              <span class="value">${dayOfWeek}, ${formattedDate}</span>
            </div>
            <div class="appointment-detail">
              <span class="label">🕐 Time:</span>
              <span class="value">${formattedTime}</span>
            </div>
            <div class="appointment-detail">
              <span class="label">✂️ Service:</span>
              <span class="value">${servicesText}</span>
            </div>
            <div class="appointment-detail">
              <span class="label">👤 Stylist:</span>
              <span class="value">${stylistName}</span>
            </div>
            <div class="appointment-detail">
              <span class="label">📍 Branch:</span>
              <span class="value">${branchName}</span>
            </div>
            ${branchAddress ? `
            <div class="appointment-detail">
              <span class="label">📍 Address:</span>
              <span class="value">${branchAddress}</span>
            </div>
            ` : ''}
            ${branchPhone ? `
            <div class="appointment-detail">
              <span class="label">📞 Phone:</span>
              <span class="value">${branchPhone}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="reminder-note">
            <strong>💡 Reminder:</strong> Please arrive 10-15 minutes before your scheduled time. If you need to reschedule or cancel, please contact us as soon as possible.
          </div>
          
          <p>We look forward to seeing you tomorrow!</p>
          
          <p>Best regards,<br>
          <strong>The ${branchName} Team</strong><br>
          David's Salon</p>
        </div>
        <div class="footer">
          <p>This is an automated reminder. Please do not reply directly to this message.</p>
          <p>&copy; ${new Date().getFullYear()} David's Salon. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
    Appointment Reminder - David's Salon
    
    Dear ${clientName},
    
    This is a friendly reminder that you have an appointment scheduled for TOMORROW.
    
    Appointment Details:
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Date: ${dayOfWeek}, ${formattedDate}
    Time: ${formattedTime}
    Service: ${servicesText}
    Stylist: ${stylistName}
    Branch: ${branchName}
    ${branchAddress ? `Address: ${branchAddress}\n` : ''}
    ${branchPhone ? `Phone: ${branchPhone}\n` : ''}
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    💡 Reminder: Please arrive 10-15 minutes before your scheduled time. If you need to reschedule or cancel, please contact us as soon as possible.
    
    We look forward to seeing you tomorrow!
    
    Best regards,
    The ${branchName} Team
    David's Salon
    
    ---
    This is an automated reminder. Please do not reply directly to this message.
    © ${new Date().getFullYear()} David's Salon. All rights reserved.
  `;

  try {
    const requestBody = {
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL
      },
      to: [
        {
          email: TEST_EMAIL,
          name: 'Test Recipient'
        }
      ],
      subject: `Appointment Reminder: ${formattedDate} at ${formattedTime} - ${branchName}`,
      textContent: textContent,
      htmlContent: htmlContent
    };

    console.log('📤 Sending email via Brevo API...');
    
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Error response:', errorData);
      throw new Error(`Brevo API error: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    console.log('');
    console.log('✅ Email sent successfully!');
    console.log('📬 Message ID:', result.messageId);
    console.log('');
    console.log('📧 Check inbox at:', TEST_EMAIL);
    console.log('');
    console.log('Sample Appointment Details:');
    console.log('- Client:', clientName);
    console.log('- Date:', dayOfWeek + ', ' + formattedDate);
    console.log('- Time:', formattedTime);
    console.log('- Services:', servicesText);
    console.log('- Stylist:', stylistName);
    console.log('- Branch:', branchName);
    
  } catch (error) {
    console.error('');
    console.error('❌ Failed to send email:', error.message);
    process.exit(1);
  }
}

// Run the test
sendTestEmail();

