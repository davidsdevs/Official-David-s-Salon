# 🎨 Cloudinary & Brevo Setup Guide

Complete setup guide for profile images and custom emails.

---

## 📸 CLOUDINARY SETUP (Profile Images)

### **Step 1: Create Account** (5 minutes)

1. Go to https://cloudinary.com
2. Click **"Sign Up for Free"**
3. Fill in details:
   - Email
   - Password
   - Cloud Name (choose carefully - this is permanent!)
4. Verify email
5. Login to dashboard

### **Step 2: Get Cloud Name** (1 minute)

1. Go to **Dashboard**
2. Copy your **Cloud Name**
   ```
   Example: dv4abcd123
   ```
3. Save this for `.env` file

### **Step 3: Create Upload Preset** (3 minutes)

1. Go to **Settings** (gear icon)
2. Click **Upload** tab
3. Scroll to **Upload presets**
4. Click **Add upload preset**
5. Configure:
   - **Preset name:** `dsms_avatars`
   - **Signing Mode:** Unsigned ✅ (important!)
   - **Folder:** `avatars`
   - **Use filename:** Yes
   - **Unique filename:** Yes
   - **Overwrite:** Yes
   - **Resource type:** Image
   - **Format:** jpg, png
   - **Transformation:**
     ```
     Width: 400
     Height: 400
     Crop: Fill
     Gravity: Face
     Quality: auto
     ```
6. Click **Save**
7. Copy **Preset name** for `.env` file

### **Step 4: Add to Environment Variables**

Update `.env` file:
```bash
REACT_APP_CLOUDINARY_CLOUD_NAME=dv4abcd123
REACT_APP_CLOUDINARY_UPLOAD_PRESET=dsms_avatars
```

### **✅ Test Upload**

1. Run app: `npm start`
2. Login
3. Go to Profile page
4. Click "Edit Profile"
5. Click on avatar
6. Upload image
7. Check Cloudinary dashboard - image should appear!

### **📊 Free Tier Limits:**
- ✅ 25 GB storage/month
- ✅ 25 GB bandwidth/month
- ✅ 25,000 transformations/month
- ✅ No credit card required
- ✅ Enough for ~50,000 profile photos!

---

## 📧 BREVO SETUP (Custom Emails)

### **Step 1: Create Account** (5 minutes)

1. Go to https://www.brevo.com
2. Click **"Sign Up Free"**
3. Fill in details:
   - Email
   - Password
   - Company name: "David's Salon"
4. Verify email
5. Login to dashboard

### **Step 2: Get API Key** (2 minutes)

1. Go to **SMTP & API** from top menu
2. Click **API Keys** tab
3. Click **Generate a new API key**
4. Name: `DSMS Production`
5. Copy the API key immediately (won't show again!)
6. Save for `.env` file

### **Step 3: Verify Sender Email** (5 minutes)

1. Go to **Senders** from top menu
2. Click **Add a sender**
3. Fill in:
   - **Email:** noreply@davidsalon.com
   - **Name:** David's Salon
4. Click **Add**
5. Check your email for verification
6. Click verification link

**Note:** Use your real domain email or a test email you control.

### **Step 4: Add to Environment Variables**

Update `.env` file:
```bash
REACT_APP_BREVO_API_KEY=xkeysib-abc123def456...
REACT_APP_SENDER_EMAIL=noreply@davidsalon.com
REACT_APP_SENDER_NAME=David's Salon
```

### **Step 5: Test Email Sending**

1. Restart app: `npm start`
2. Register new user
3. Check email inbox
4. Should receive:
   - Firebase verification email
   - Custom welcome email (from Brevo) ✨

### **📊 Free Tier Limits:**
- ✅ 300 emails/day
- ✅ 9,000 emails/month
- ✅ Unlimited contacts
- ✅ Email templates
- ✅ No credit card required

### **📧 Email Types Implemented:**

1. **Welcome Email** - When user registers
2. **User Created Email** - When admin creates staff
3. **Account Activated** - When admin activates account
4. **Account Deactivated** - When admin deactivates account
5. **Password Reset Notification** - When password reset requested

---

## 🔒 SECURITY NOTES

### **API Key Protection:**

1. **Never commit .env file to Git!**
   ```bash
   # .env is already in .gitignore
   ```

2. **Client-side API keys are visible** (acceptable for Phase 1)
   - Brevo API key is visible in browser (low risk)
   - Cloudinary uses unsigned uploads (no security risk)
   - Both services have rate limits to prevent abuse

3. **Monitor usage regularly:**
   - Check Cloudinary dashboard
   - Check Brevo dashboard
   - Set up alerts if available

4. **Production recommendation:**
   - Move to Cloud Functions (server-side) when budget allows
   - Upgrade to Firebase Blaze plan (~₱300/month)
   - Secure API keys on server

---

## 🚀 DEPLOYMENT NOTES

### **For Production (Netlify/Vercel):**

1. Add environment variables in hosting dashboard
2. Don't include `.env` file in deployment
3. Add all `REACT_APP_*` variables:
   ```
   REACT_APP_CLOUDINARY_CLOUD_NAME
   REACT_APP_CLOUDINARY_UPLOAD_PRESET
   REACT_APP_BREVO_API_KEY
   REACT_APP_SENDER_EMAIL
   REACT_APP_SENDER_NAME
   REACT_APP_URL
   ```

---

## 🧪 TESTING CHECKLIST

### **Cloudinary (Images):**
- [ ] Account created
- [ ] Cloud name obtained
- [ ] Upload preset created (unsigned!)
- [ ] Environment variables added
- [ ] App restarted
- [ ] Image upload works
- [ ] Image appears in profile
- [ ] Image visible in Cloudinary dashboard

### **Brevo (Emails):**
- [ ] Account created
- [ ] API key generated
- [ ] Sender email verified
- [ ] Environment variables added
- [ ] App restarted
- [ ] Registration sends welcome email
- [ ] User creation sends notification
- [ ] All emails received

---

## ❓ TROUBLESHOOTING

### **Cloudinary Issues:**

**Problem:** "Upload failed: Invalid signature"
- **Solution:** Make sure upload preset is set to **Unsigned**

**Problem:** "Invalid cloud name"
- **Solution:** Check `.env` file, cloud name should match dashboard

**Problem:** Image not uploading
- **Solution:** 
  1. Check browser console for errors
  2. Verify file size < 5MB
  3. Verify file is image type (jpg, png, etc.)

### **Brevo Issues:**

**Problem:** "Invalid API key"
- **Solution:** Check `.env` file, copy API key exactly (no extra spaces)

**Problem:** Emails not sending
- **Solution:**
  1. Check browser console
  2. Verify sender email is verified
  3. Check Brevo dashboard > Logs
  4. Verify daily limit not reached (300/day)

**Problem:** "Sender not verified"
- **Solution:** Check email for verification link from Brevo

---

## 💰 COST BREAKDOWN

### **Current Setup (FREE):**
```
Firebase Spark Plan:     ₱0/month
Cloudinary FREE:         ₱0/month (25GB)
Brevo FREE:              ₱0/month (300/day)
───────────────────────────────────────
TOTAL:                   ₱0/month ✅
```

### **When to Upgrade:**

**Cloudinary ($99/month):**
- If > 25GB storage needed
- If > 25GB bandwidth needed
- Probably won't need for years!

**Brevo ($25/month):**
- If > 300 emails/day needed
- If need advanced automation
- 10,000-20,000 emails/month tier

**Firebase Blaze (₱300/month estimated):**
- When need Cloud Functions
- When need server-side security
- When app is profitable

---

## 📝 SUMMARY

**Setup Time:** 20 minutes total
- Cloudinary: 10 minutes
- Brevo: 10 minutes

**Monthly Cost:** ₱0.00

**Features Unlocked:**
- ✅ Professional profile photos
- ✅ Branded welcome emails
- ✅ Account notification emails
- ✅ Password reset notifications
- ✅ Better user experience

**Next Steps:**
1. Create both accounts
2. Get credentials
3. Update `.env` file
4. Restart app
5. Test features!

---

**Need help?** Check troubleshooting section above or contact support.
