# Project Image Browser

View all of the images in your project collated into a single webview. The webview can be opened using a context menu in explorer pane.

Inspired by [Image Viewer](https://github.com/ZhangJian1713/vscode-image-viewer) but entirely rewritten to simplify the implementation of new features and allow VSCode theming of the webview.

## Features

- Support for workspaces with multiple root folders, including selectively including/excluding them.
- Webview matches VSCode theming
- Path copying, file opening via context menu
- Multiple backgrounds for images, including checkboards. More added on request.
- Image name filtering
- Basic include/exclude filters (regex filtering tbd)
- Most commonly used settings easily accessible in the webview UI

[![A screenshot of the browser.](./assets/extension-overview-thumb.png)](./assets/extension-overview.png)

## Commands

- `project-image-browser.ViewImages`: Open the image browser

## Settings

- `project-image-browser.includeFolders`: Within workspace folders only this path will be searched. For example: '\\img\\icons;\\backgrounds'.

- `project-image-browser.excludeFolders`: Folders that will be ignored when found at the end of a path. For example 'node_modules' would ignore '\\frontend\\node_modules'.

- `project-image-browser.imageBackground`: Color/pattern displayed behind images. Can be any CSS color but it's advisable to set it using the webview UI.

- `project-image-browser.imageSize`: Size of image preview in pixels. Can be adjusted in the UI

- `project-image-browser.lazyLoading`: Only load images when scrolled into view. This makes the page open faster with large collections.

- `project-image-browser.viewColumn`: The column of the editor in which to open the browser.

- `project-image-browser.pathDeliminator`: The path deliminator used when displaying and copying paths to clipboard.

- `project-image-browser.includeProjectFolders`: Determines which workspace folders will be searched. For multi-folder workspaces only and should only be configured using the UI.
