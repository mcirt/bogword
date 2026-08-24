# Boggle Word Finder — GitHub Pages Edition

Visible build: **v4.1 · PPAI BOTTOM-LOAD**

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

This release uses the same OpenCV build and startup sequence as PPAI:

1. The solver interface loads first.
2. `opencv.js` loads at the bottom of the page, matching PPAI's placement.
3. `opencv-loader.js` registers the PPAI runtime callback.
4. The scanner waits for `window.ppaiCvReady` before processing a board.

Do not rename or omit `opencv.js` or `opencv-loader.js` when uploading the project.

The scanner now reads continuously from the live camera feed, just like PPAI. Hold the board steady until the live tiles stabilize, then select **Use live reading**.
