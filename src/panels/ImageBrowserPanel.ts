import * as protocol from "../protocol";
import * as vscode from "vscode";
import { imageSearchMultipleFolders } from '../imageSearch';
import { EXTENSION_ID } from '../extension';
import * as path from 'path'

type MessageHandler = (message: protocol.Message) => void;

/**
 * This class manages the state and behavior of the webview panel.
 */
export class ImageBrowserPanel {
    public static _singleton: ImageBrowserPanel | undefined;

    private readonly _panel: vscode.WebviewPanel;
    private readonly _disposables: vscode.Disposable[] = [];
    private readonly _messageHandlers: { [key: string]: MessageHandler; };
    private readonly _config: protocol.Configuration;

    private _results: protocol.ProjectDirCollection = { commonBase: '', dirs: [] };

    private constructor(extensionUri: vscode.Uri) {
        // Init extension config
        const configuration = vscode.workspace.getConfiguration(EXTENSION_ID);
        this._config = {
            includeFolders: configuration.get("includeFolders", "").split(';'),
            excludeFolders: configuration.get("excludeFolders", "node_modules").split(';'),
            includeProjectFolders: configuration.get("includeProjectFolders", {}),
            imageBackground: configuration.get("imageBackground", "transparent"),
            imageSize: configuration.get("imageSize", 100),
            lazyLoading: configuration.get("lazyLoading", true),
        };
        const viewColumn = Number(vscode.ViewColumn[configuration.get("viewColumn", "One")]) ?? vscode.ViewColumn.One;

        // Create panel
        const panel = vscode.window.createWebviewPanel("image-browser", "Image Browser", viewColumn,
            { enableScripts: true });
        panel.onDidDispose(() => this.dispose(), null, this._disposables);
        panel.webview.html = this._getWebviewContent(panel.webview, extensionUri);
        panel.webview.onDidReceiveMessage((message: protocol.Message) => this._messageHandlers[message.command]?.(message), undefined, this._disposables);
        this._panel = panel;

        // Configure message handling
        this._messageHandlers = {
            [protocol.ClientCommand.InitComplete]: () => { this._sendConfig(); this._onRequestImageData(); },
            [protocol.ClientCommand.PostConfig]: this._onReceieveConfig,
            [protocol.ClientCommand.GetImageData]: this._onRequestImageData,
        };
    }

    public static show(extensionUri: vscode.Uri) {
        if (ImageBrowserPanel._singleton)
            ImageBrowserPanel._singleton._panel.reveal(vscode.ViewColumn.One);
        else
            ImageBrowserPanel._singleton = new ImageBrowserPanel(extensionUri);
        ImageBrowserPanel._singleton._validateConfig();
    }

    public static get instance() {
        return this._singleton;
    }

    public dispose() {
        ImageBrowserPanel._singleton = undefined;
        this._panel.dispose();

        for (const disposible of this._disposables)
            disposible?.dispose();
        this._disposables.length = 0;
    }

    // Return an on the image from it's Uri
    public findImageFromUri(uri: string) {
        for (const folder of this._results.dirs) {
            const image = folder.imgs.find(img => img.uri == uri);
            if (image)
                return { projectDir: path.join(this._results.commonBase, folder.base), image };
        }
    }

    // Send the server config to the client
    private _sendConfig() {
        this._panel.webview.postMessage({ command: protocol.ServerCommand.PostConfig, data: this._config } as protocol.Message);
    }

    // Recieve a new config from the client
    private _onReceieveConfig = (message: protocol.Message) => {
        const newConfig = message.data as protocol.Configuration;

        const filterChanged = this._config.includeFolders.join() != newConfig.includeFolders.join()
            || this._config.excludeFolders.join() != newConfig.excludeFolders.join()
            || !!Object.keys(newConfig.includeProjectFolders).find(key => this._config.includeProjectFolders[key] != newConfig.includeProjectFolders[key]);

        Object.assign(this._config, newConfig);

        const configuration = vscode.workspace.getConfiguration(EXTENSION_ID);
        configuration.update("includeFolders", this._config.includeFolders.join(';'));
        configuration.update("excludeFolders", this._config.excludeFolders.join(';'));
        configuration.update("includeProjectFolders", this._config.includeProjectFolders);
        configuration.update("imageBackground", this._config.imageBackground);
        configuration.update("imageSize", this._config.imageSize);

        if (filterChanged)
            this._onRequestImageData();
    }

    // Searches for images in the project and sends the paths to the webview
    private _onRequestImageData = () => {
        const webview = this._panel.webview;
        const includeProjectFolders = this._config.includeProjectFolders;
        const enabledProjectFolders = Object.keys(includeProjectFolders).filter((folder) => includeProjectFolders[folder]);

        this._results = imageSearchMultipleFolders(enabledProjectFolders, this._config.includeFolders, this._config.excludeFolders, webview);

        webview.postMessage({ command: protocol.ServerCommand.PostImageData, data: this._results } as protocol.Message);
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const stylesUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.css"]);
        const scriptUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.js"]);
        return /*html*/ `
            <!DOCTYPE html>
            <html lang="en">
                <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; img-src 'self' ${webview.cspSource} data:">
                <link rel="stylesheet" type="text/css" href="${stylesUri}">
                <title>Image Browser</title>
                </head>
                <body>
                <div id="root"></div>
                <script type="module" src="${scriptUri}"></script>
                </body>
            </html>
        `;
    }

    // Reads the config file and preprocesses it to ensure the contents are valid against the current workspace
    private _validateConfig() {
        const config = this._config;
        const projectPaths = getAllProjectPaths();

        // ensure we have entries for all project files and remove ones which no longer exist
        if (!config.includeProjectFolders)
            config.includeProjectFolders = {};
        config.includeProjectFolders = Object.assign({}, ...projectPaths.map((folder) => ({ [folder]: config.includeProjectFolders[folder] ?? true })));
    }
}

/**
 * A helper function that returns a unique alphanumeric identifier called a nonce.
 *
 * @remarks This function is primarily used to help enforce content security
 * policies for resources/scripts being executed in a webview context.
 *
 * @returns A nonce
 */
export function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * A helper function which will get the webview URI of a given file or resource.
 *
 * @remarks This URI can be used within a webview's HTML as a link to the
 * given file/resource.
 *
 * @param webview A reference to the extension webview
 * @param extensionUri The URI of the directory containing the extension
 * @param pathList An array of strings representing the path to a file/resource
 * @returns A URI pointing to the file/resource
 */
export function getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]) {
    return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
}

/**
 * get all project workspace folders
 */
export function getAllProjectPaths() {
    return vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.map(folder => folder.uri.fsPath) : [];
}