# Boggle Word Finder — GitHub Pages Edition

Visible build: **v6.1 · 5×5 GRID FIX**

This folder is already built as a static website. No npm installation or build command is required.

## Publish on GitHub Pages

1. Create a new GitHub repository.
2. Upload every file in this folder to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`, then save.
6. Wait for GitHub to display the website address.

Do not upload only the ZIP. Extract it first and upload everything inside it.

The camera scanner requires HTTPS, which GitHub Pages provides automatically.

This release follows the working PPAI live inventory scanner's real camera path: it opens the camera immediately and analyzes Canvas frames continuously without waiting for OpenCV.

Version 6.1 detects the repeating 4×4 or 5×5 tile pattern before reading letters. It also includes camera-distance game-font samples, corrected DL/DW/TL/TW color mappings, and a thumbnail of every actual tile crop on the review screen.

Hold the board steady until the live tiles stabilize, then select **Use live reading**.
