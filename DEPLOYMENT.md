# 🚀 Deployment Guide - Resume Screener AI

Complete step-by-step guide to deploy your Resume Screener AI to GitHub Pages.

## 📋 Pre-Deployment Checklist

- [ ] GitHub account created
- [ ] Git installed on your computer
- [ ] Google Gemini API key obtained
- [ ] Google Sheet with JD template ready

---

## Step 1: Get Your Gemini API Key

1. **Visit Google AI Studio**
   - Go to: https://makersuite.google.com/app/apikey
   - Sign in with your Google account

2. **Create API Key**
   - Click "Create API key"
   - Select or create a project
   - Copy the API key (save it securely!)

3. **Test Your Key** (Optional)
   ```bash
   curl \
     -H 'Content-Type: application/json' \
     -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
     -X POST 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY'
   ```

---

## Step 2: Set Up Google Sheets Database

### Create New Sheet:

1. **Go to Google Sheets**
   - Visit: https://sheets.google.com
   - Click "Blank" to create new sheet

2. **Name Your Sheet**
   - Click on "Untitled spreadsheet"
   - Name it: "Resume Screener - JD Database"

3. **Create JD Tab**
   - Rename "Sheet1" to "JD" (exactly, case-sensitive)
   - Add headers in Row 1:
     - A1: `Position Name`
     - B1: `Job Description`

4. **Import Sample Data**
   - Download `sample-jd-template.csv` from this repo
   - File → Import → Upload
   - Select the CSV file
   - Import location: "Replace current sheet"
   - Click "Import data"

5. **Make Sheet Public**
   - Click "Share" button (top right)
   - Under "General access" click "Restricted"
   - Select "Anyone with the link"
   - Change role to "Viewer"
   - Click "Done"

6. **Get Sheet ID**
   - Look at your URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
   - Copy the SHEET_ID portion
   - Save it for later!

**Example Sheet ID:**
```
URL: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
Sheet ID: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
```

---

## Step 3: Download the Code

### Option A: Download ZIP

1. Go to the GitHub repository
2. Click green "Code" button
3. Select "Download ZIP"
4. Extract the ZIP file to your desired location

### Option B: Clone with Git

```bash
# Open terminal/command prompt
cd /path/to/your/projects

# Clone the repository
git clone https://github.com/your-username/resume-screener-ai.git

# Navigate into the directory
cd resume-screener-ai
```

---

## Step 4: Deploy to GitHub Pages

### Method 1: Using GitHub Website (Easiest)

1. **Create New Repository**
   - Go to: https://github.com/new
   - Repository name: `resume-screener-ai`
   - Description: "AI-powered resume screening tool"
   - Public repository
   - **DO NOT** initialize with README (we have one)
   - Click "Create repository"

2. **Upload Files**
   - Click "uploading an existing file" link
   - Drag all files from your downloaded folder
   - Commit message: "Initial commit"
   - Click "Commit changes"

3. **Enable GitHub Pages**
   - Go to repository Settings
   - Scroll to "Pages" section (left sidebar)
   - Under "Source":
     - Branch: `main`
     - Folder: `/ (root)`
   - Click "Save"
   - Wait 1-2 minutes
   - Your site will be live at: `https://YOUR_USERNAME.github.io/resume-screener-ai/`

### Method 2: Using Git Command Line

```bash
# Navigate to your project folder
cd /path/to/resume-screener-ai

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Resume Screener AI"

# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/resume-screener-ai.git

# Push to GitHub
git branch -M main
git push -u origin main
```

Then enable GitHub Pages:
- Go to repository Settings → Pages
- Source: `main` branch, `/ (root)` folder
- Save

### Method 3: Using GitHub Desktop

1. **Download GitHub Desktop**
   - Visit: https://desktop.github.com/
   - Install the application

2. **Add Repository**
   - File → Add Local Repository
   - Choose your project folder
   - Click "Add repository"

3. **Publish to GitHub**
   - Click "Publish repository"
   - Name: `resume-screener-ai`
   - Description: (optional)
   - Keep code public
   - Click "Publish repository"

4. **Enable Pages**
   - Go to your repository on GitHub.com
   - Settings → Pages
   - Source: `main` / `root`
   - Save

---

## Step 5: Configure the Application

1. **Open Your Deployed Site**
   - Visit: `https://YOUR_USERNAME.github.io/resume-screener-ai/`

2. **Expand API Configuration Section**
   - Click on "Gemini API Configuration"

3. **Enter Gemini API Key**
   - Paste your API key
   - It will be saved in browser localStorage

4. **Enter Google Sheets ID**
   - Paste your Sheet ID (from Step 2)
   - It will be saved in browser localStorage

5. **Test Connection**
   - The green indicator should light up
   - Position dropdown should populate with your JDs

---

## Step 6: Test the Application

1. **Prepare Test Resume**
   - Create a simple PDF resume
   - Or use a sample resume

2. **Upload Resume**
   - Drag & drop into upload zone
   - Or click to browse

3. **Select Position**
   - Choose from dropdown (populated from your sheet)

4. **Set Filters** (Optional)
   - Min experience: 2
   - Max experience: 5
   - Location: Hyderabad

5. **Analyze**
   - Click "🚀 Analyze Resumes"
   - Wait for results
   - View match score and highlights

6. **Export Results**
   - Click the 💾 button (bottom right)
   - Download CSV file

---

## 🎉 Congratulations!

Your Resume Screener AI is now live and ready to use!

**Share your deployment:**
- URL: `https://YOUR_USERNAME.github.io/resume-screener-ai/`
- Share with recruiters, HR teams, or hiring managers

---

## 🔧 Customization After Deployment

### Update Colors

Edit `index.html` lines 19-28:

```css
:root {
    --primary: #0f172a;        /* Change main color */
    --accent: #06b6d4;         /* Change accent color */
    --success: #10b981;        /* Change success color */
}
```

After editing, commit and push:
```bash
git add index.html
git commit -m "Updated color scheme"
git push
```

GitHub Pages will auto-deploy in 1-2 minutes.

### Add More JD Positions

1. Open your Google Sheet
2. Add new rows with Position Name and Description
3. Changes reflect immediately (no deployment needed!)

---

## 🚨 Troubleshooting Deployment

### Pages Not Working

**Problem:** 404 error on GitHub Pages URL

**Solution:**
1. Check Settings → Pages is enabled
2. Verify branch is set to `main` and folder to `/ (root)`
3. Wait 2-5 minutes for initial deployment
4. Clear browser cache
5. Check repository is public

### Positions Not Loading

**Problem:** Dropdown is empty

**Solution:**
1. Verify Sheet ID is correct
2. Check sheet is publicly accessible (Anyone with link)
3. Tab must be named "JD" (case-sensitive)
4. Open browser console (F12) for errors

### API Key Not Working

**Problem:** Analysis fails

**Solution:**
1. Verify API key is correct (no extra spaces)
2. Check you haven't exceeded rate limits
3. Try creating a new API key
4. Check browser console for specific error

### CORS Errors

**Problem:** Cross-origin errors in console

**Solution:**
- This shouldn't happen with GitHub Pages
- Ensure you're accessing via https:// not file://
- Clear browser cache
- Try incognito/private mode

---

## 📊 Usage Limits

### Gemini API Free Tier:
- 60 requests per minute
- 1,500 requests per day
- 1 million tokens per month

### Tips for High Volume:
1. **Create Multiple API Keys**
   - Use different Google accounts
   - Switch keys when limit reached
   - App makes switching easy!

2. **Batch Processing**
   - Process resumes in groups
   - Wait between batches

3. **Upgrade to Paid**
   - Google Cloud Console
   - Pay-as-you-go pricing
   - Higher rate limits

---

## 🔄 Updating Your Deployment

### Make Changes Locally

1. Edit `index.html` or other files
2. Test locally by opening `index.html` in browser

### Push Updates

```bash
# Stage changes
git add .

# Commit with message
git commit -m "Description of changes"

# Push to GitHub
git push
```

GitHub Pages auto-deploys in 1-2 minutes!

---

## 🎯 Next Steps

Now that you're deployed:

1. **Share with your team**
   - Send them the URL
   - They can use their own API keys
   - No installation needed!

2. **Customize for your needs**
   - Modify analysis prompts
   - Add custom filters
   - Change styling

3. **Monitor usage**
   - Check Gemini API quotas
   - Track results
   - Gather feedback

4. **Contribute back**
   - Found a bug? Report it!
   - Made improvements? Submit PR!
   - Help others in discussions

---

## 💬 Support

Need help?

1. Check the main [README.md](README.md)
2. Open an issue on GitHub
3. Check existing issues for solutions

---

## 🎊 You're All Set!

Enjoy your AI-powered resume screening tool!

**Happy Hiring! 🚀**
