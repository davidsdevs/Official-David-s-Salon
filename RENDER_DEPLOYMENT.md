# Render Deployment Guide

This guide will help you deploy the David's Salon Management System to Render.

## Prerequisites

1. A Render account (sign up at https://render.com)
2. Your project pushed to a Git repository (GitHub, GitLab, or Bitbucket)
3. All environment variables ready

## Deployment Steps

### 1. Prepare Your Repository

Make sure your code is pushed to your Git repository:
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 2. Create a New Static Site on Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Click **"New +"** → **"Static Site"**
3. Connect your Git repository
4. Configure the service:
   - **Name**: `david-salon-management-system` (or your preferred name)
   - **Branch**: `main` (or your default branch)
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

### 3. Configure Environment Variables

In the Render dashboard, go to your service → **Environment** tab and add the following environment variables:

#### Firebase Configuration
- `VITE_FIREBASE_API_KEY` - Your Firebase API key
- `VITE_FIREBASE_AUTH_DOMAIN` - Your Firebase auth domain
- `VITE_FIREBASE_PROJECT_ID` - Your Firebase project ID
- `VITE_FIREBASE_STORAGE_BUCKET` - Your Firebase storage bucket
- `VITE_FIREBASE_MESSAGING_SENDER_ID` - Your Firebase messaging sender ID
- `VITE_FIREBASE_APP_ID` - Your Firebase app ID

#### Email Service (SendGrid)
- `VITE_SENDGRID_API_KEY` - Your SendGrid API key
- `VITE_SENDGRID_FROM_EMAIL` - Your SendGrid from email address

#### Cloudinary (Image Upload)
- `VITE_CLOUDINARY_CLOUD_NAME` - Your Cloudinary cloud name
- `VITE_CLOUDINARY_UPLOAD_PRESET` - Your Cloudinary upload preset

#### OpenAI (Optional - for AI features)
- `VITE_OPENAI_API_KEY` - Your OpenAI API key (if using AI features)

### 4. Deploy Using render.yaml (Alternative Method)

If you prefer using the `render.yaml` file:

1. Go to your Render dashboard
2. Click **"New +"** → **"Blueprint"**
3. Connect your repository
4. Render will automatically detect and use the `render.yaml` file
5. Configure the environment variables in the dashboard

### 5. Custom Domain (Optional)

1. Go to your service settings
2. Click **"Custom Domains"**
3. Add your domain and follow the DNS configuration instructions

## Important Notes

### SPA Routing
The `public/_redirects` file ensures that all routes are redirected to `index.html` for proper client-side routing. This is required for React Router to work correctly.

### Build Output
- The build command outputs to the `dist` directory
- Make sure `dist` is in your `.gitignore` (it should be)
- Render will build the project during deployment

### Environment Variables
- All environment variables must be prefixed with `VITE_` to be accessible in the Vite build
- Never commit `.env` files to your repository
- Use Render's environment variable management for sensitive data

### Firebase Configuration
- Make sure your Firebase project allows requests from your Render domain
- Update Firebase Authentication authorized domains if needed
- Check Firestore security rules for production

## Troubleshooting

### Build Fails
- Check the build logs in Render dashboard
- Ensure all dependencies are in `package.json`
- Verify Node.js version compatibility (Render uses Node 18+ by default)

### Routing Issues
- Verify `public/_redirects` file exists
- Check that all routes redirect to `/index.html`

### Environment Variables Not Working
- Ensure variables are prefixed with `VITE_`
- Rebuild the service after adding new environment variables
- Check that variables are set in the Render dashboard (not just in code)

### Firebase Errors
- Verify Firebase configuration values are correct
- Check Firebase console for any restrictions
- Ensure Firestore rules allow access from your domain

## Post-Deployment Checklist

- [ ] Test all authentication flows
- [ ] Verify Firebase connection
- [ ] Test file uploads (Cloudinary)
- [ ] Check email sending (SendGrid)
- [ ] Test all major features
- [ ] Verify mobile responsiveness
- [ ] Check console for any errors
- [ ] Test with different user roles

## Support

For issues specific to:
- **Render**: Check Render documentation or support
- **Firebase**: Check Firebase console and documentation
- **Application**: Check application logs in Render dashboard

