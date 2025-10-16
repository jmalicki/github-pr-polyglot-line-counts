# 🚀 Installation Guide

## Loading the Extension in Chrome

### Step 1: Open Extensions Page
Open Chrome and navigate to:
```
chrome://extensions/
```

Or: Menu (⋮) → Extensions → Manage Extensions

### Step 2: Enable Developer Mode
Toggle the **Developer mode** switch in the top right corner.

### Step 3: Load Unpacked Extension
1. Click the **"Load unpacked"** button (top left)
2. Navigate to and **select this directory**:
   ```
   /home/jmalicki/src/github-linecount
   ```
3. Click "Select Folder"

**Important:** Select the **FOLDER/DIRECTORY**, not a specific file!

The folder should contain:
- ✅ manifest.json
- ✅ content.js
- ✅ styles.css
- ✅ icons/

### Step 4: Verify Installation
You should see:
```
📊 GitHub PR Language Stats
   Version 1.0.0
   ID: [random ID]
   ✅ Enabled
```

### Step 5: Test It!
1. Navigate to any GitHub pull request, e.g.:
   ```
   https://github.com/jmalicki/arsync/pull/55/files
   ```

2. You should see a panel appear below the PR header:
   ```
   📊 Language Statistics     ☑️ Exclude generated
       📝 Est. Review Time: 22-34 min ⚠️
   
   Markdown  2 files  +1422  -0    56.7%
   Rust      6 files  +870   -216  43.3%
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Total              +2292  -216  100%
   ```

## Troubleshooting

### Extension doesn't load
- ✅ Make sure you selected the directory, not a file
- ✅ Check that manifest.json exists in the directory
- ✅ Look for errors in the extensions page

### Panel doesn't appear
1. Open browser console (F12)
2. Look for "[PR Lang Stats]" messages
3. Check you're on /files tab: `{repo}/pull/{number}/files`
4. Try refreshing the page

### Stats are wrong
- ✅ Open browser console and check for errors
- ✅ Make sure all files have loaded (scroll down)
- ✅ Try toggling "Exclude generated" checkbox

## Updating the Extension

After making code changes:

1. Go to `chrome://extensions/`
2. Find "GitHub PR Language Stats"  
3. Click the **refresh icon** (🔄)
4. Refresh the GitHub PR page

## Uninstalling

Click the **Remove** button on the extensions page.

## Next: Publish to Chrome Web Store

See Chrome's [publishing guide](https://developer.chrome.com/docs/webstore/publish/) for details.

---

**Path to select:** `/home/jmalicki/src/github-linecount`  
**Make sure:** Select the folder, not manifest.json!
