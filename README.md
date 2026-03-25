# 🚀 Resume Screener AI

A professional, AI-powered resume screening webapp using Google Gemini AI and Google Sheets as a database. Features a beautiful minimalist UI with smooth animations.

![Resume Screener AI](https://img.shields.io/badge/AI-Powered-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features

- 🤖 **AI-Powered Analysis** - Uses Google Gemini AI for intelligent resume screening
- 📊 **Google Sheets Database** - Job descriptions stored in Google Sheets
- 📁 **Multiple Upload Options** - Direct upload, drag & drop, Google Drive links
- 🔍 **Smart Filters** - Filter by experience and location
- 📈 **Match Scoring** - AI-generated match scores for each candidate
- 💾 **Export Results** - Download analysis as CSV
- 🎨 **Professional UI** - Minimalist design with smooth animations
- 🔐 **API Key Management** - Easy switching between Gemini accounts

## 🎯 Live Demo

**[View Live Demo](https://your-username.github.io/resume-screener-ai/)**

## 📋 Prerequisites

1. **Google Gemini API Key**
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Free tier: 60 requests/minute

2. **Google Sheets**
   - A Google Sheet with job descriptions
   - Sheet must be publicly accessible (Share → Anyone with link can view)

## 🚀 Quick Start

### 1. Clone or Download

```bash
git clone https://github.com/your-username/resume-screener-ai.git
cd resume-screener-ai
```

### 2. Set Up Google Sheets

#### Create Your JD Database Sheet:

1. **Create a new Google Sheet**
2. **Name one tab "JD"** (case-sensitive)
3. **Add columns:**
   - Column A: Position Name
   - Column B: Job Description

**Example:**

| Position Name | Job Description |
|--------------|----------------|
| Senior Software Engineer | We're looking for a Senior Software Engineer with 5+ years of experience in Python, React, and AWS. Must have strong problem-solving skills... |
| Data Scientist | Seeking a Data Scientist with expertise in ML, Python, and SQL. 3+ years experience required... |

4. **Make it public:**
   - Click "Share" button
   - Change to "Anyone with the link can view"
   - Copy the Sheet ID from URL: `docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`

### 3. Deploy to GitHub Pages

#### Option A: Deploy Your Own Copy

1. **Create a new GitHub repository**
   ```bash
   # Initialize git if not already done
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Push to GitHub**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/resume-screener-ai.git
   git branch -M main
   git push -u origin main
   ```

3. **Enable GitHub Pages**
   - Go to repository Settings → Pages
   - Source: Deploy from branch
   - Branch: `main` / `root`
   - Click Save
   - Your site will be live at: `https://YOUR_USERNAME.github.io/resume-screener-ai/`

#### Option B: Use GitHub Desktop

1. Open GitHub Desktop
2. File → Add Local Repository → Choose the folder
3. Publish repository to GitHub
4. Enable Pages in repository settings (as above)

## 📖 How to Use

### 1. Configure API & Sheets

1. Open the webapp
2. Click on **"Gemini API Configuration"** section
3. Enter your **Gemini API Key**
4. Enter your **Google Sheets ID**
5. Keys are saved in browser localStorage

### 2. Upload Resumes

**Three ways to upload:**
- **Drag & Drop**: Drag PDF/DOC files into the upload zone
- **Browse**: Click the upload zone to select files
- **Google Drive**: Paste a Drive folder link (requires backend setup*)

*Note: Google Drive integration requires backend API - currently use direct upload*

### 3. Select Job Description

1. Open the **"Job Description"** section
2. Select position from dropdown
3. Preview the JD

### 4. Apply Filters (Optional)

1. Set **Minimum Experience** (years)
2. Set **Maximum Experience** (years)
3. Enter **Location** preference
4. Leave blank to skip filtering

### 5. Analyze & View Results

1. Click **"🚀 Analyze Resumes"**
2. Wait for AI analysis (1-5 seconds per resume)
3. View results sorted by match score
4. Click **💾 FAB button** to export as CSV

## 🎨 UI Features

- **Collapsible Sections** - Click any section header to expand/collapse
- **Animated Background** - Subtle gradient animations
- **Glass Morphism** - Modern frosted glass effect
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Dark Theme** - Professional dark mode design
- **Floating Action Button** - Quick export access

## 🔧 Customization

### Change Colors

Edit CSS variables in `index.html`:

```css
:root {
    --primary: #0f172a;        /* Main dark color */
    --accent: #06b6d4;         /* Cyan accent */
    --success: #10b981;        /* Green */
    --warning: #f59e0b;        /* Orange */
    --danger: #ef4444;         /* Red */
}
```

### Modify AI Prompt

Edit the `analyzeWithGemini()` function in `index.html` to customize analysis criteria.

## 📊 Google Sheets Setup - Detailed

### Required Sheet Structure:

**Sheet Name:** `JD` (exactly this name)

**Columns:**
- **A1**: "Position Name" (header)
- **B1**: "Job Description" (header)
- **A2+**: Position names
- **B2+**: Full job descriptions

### Example Sheet:

```
+---------------------------+--------------------------------------+
| Position Name             | Job Description                      |
+---------------------------+--------------------------------------+
| Frontend Developer        | Looking for React developer with...  |
| Backend Engineer          | Python/Node.js expert needed for...  |
| DevOps Engineer           | AWS/Docker experience required...    |
+---------------------------+--------------------------------------+
```

### Sharing Settings:

1. Click "Share" in top-right
2. Under "General access" → Change to "Anyone with the link"
3. Role: **Viewer**
4. Click "Copy link"
5. Extract Sheet ID: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`

## 🔐 Security & Privacy

- **API Keys**: Stored only in browser localStorage (never sent to any server except Google)
- **Resumes**: Processed client-side, only text sent to Gemini API
- **Data**: No data is stored on any server (fully client-side app)
- **Google Sheets**: Use separate sheet for sensitive JDs if needed

### API Key Safety:

- Keys stored in browser only
- Can switch accounts anytime
- Clear browser data to remove keys
- Each user uses their own API key

## 🐛 Troubleshooting

### "Error loading positions"
- Ensure Sheet is **publicly shared** (Anyone with link can view)
- Sheet tab must be named **"JD"** (case-sensitive)
- Check Sheet ID is correct

### "Gemini API error"
- Verify API key is correct
- Check you haven't exceeded rate limits (60/min free tier)
- Try a different API key

### "PDF parsing failed"
- Ensure PDF is text-based (not scanned image)
- Try re-saving PDF from another application
- Check file isn't corrupted

### Results not showing
- Check browser console for errors (F12)
- Ensure filters aren't too restrictive
- Verify Gemini API quota

## 📈 Rate Limits

**Gemini API Free Tier:**
- 60 requests per minute
- 1,500 requests per day
- 1 million requests per month

**Pro Tips:**
- Use multiple API keys to increase limits
- Batch process large resume sets
- Consider upgrading to paid tier for high volume

## 🛠️ Technical Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **AI**: Google Gemini API (gemini-pro model)
- **Database**: Google Sheets API
- **PDF Parser**: PDF.js
- **Hosting**: GitHub Pages (static)
- **No Backend Required!**

## 📱 Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Gemini AI for powerful analysis
- PDF.js for PDF parsing
- Google Sheets for free database
- GitHub Pages for free hosting

## 📞 Support

Having issues? 

1. Check the [Troubleshooting](#-troubleshooting) section
2. Open an issue on GitHub
3. Check existing issues for solutions

## 🎯 Roadmap

- [ ] Support for Google Drive direct integration
- [ ] Batch processing with progress indicators
- [ ] Email integration for candidate outreach
- [ ] Advanced analytics dashboard
- [ ] Resume templates detection
- [ ] Multi-language support
- [ ] Calendar integration for interviews

## ⭐ Star History

If you find this useful, please consider giving it a star!

---

**Made with ❤️ using Google Gemini AI**

**[Report Bug](https://github.com/your-username/resume-screener-ai/issues)** • **[Request Feature](https://github.com/your-username/resume-screener-ai/issues)**
