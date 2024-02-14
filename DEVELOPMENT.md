The code is based on the [Hello World](https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/hello-world) sample extension that demonstrates how to set up and use a [SolidJS](https://www.solidjs.com/) + [Webview UI Toolkit](https://github.com/microsoft/vscode-webview-ui-toolkit) webview extension.

Once you've pulled the repo you need to install dependencies.
```bash
# Navigate to project folder

# Install dependencies for both the extension and webview UI source code
npm run install:all

# Build webview UI source code
npm run build:webview

# Open project in VS Code
code .
```
Note that when you change the webview you must rebuild it using the NPM script (bottom of explorer window) or the command above.