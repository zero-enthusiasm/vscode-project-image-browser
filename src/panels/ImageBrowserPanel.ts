import * as fs from 'fs'
import * as protocol from "../protocol"
import { Disposable, Webview, WebviewPanel, window, Uri, ViewColumn, workspace } from "vscode";
import { getUri, getNonce, getAllProjectPaths } from "../utilities";
import { imageSearchMultipleFolders } from '../imageSearch';
import { EXTENSION_ID } from '../extension';

type MessageHandler = (message: protocol.Message) => void;

/**
 * This class manages the state and behavior of the webview panel.
 */
export class ImageBrowserPanel {
    public static _singleton: ImageBrowserPanel | undefined;

    private readonly _panel: WebviewPanel;
    private readonly _disposables: Disposable[] = [];
    private readonly _messageHandlers: { [key: string]: MessageHandler; };
    private readonly _config: protocol.Configuration;

    private constructor(extensionUri: Uri) {
        const panel = window.createWebviewPanel("viewImages", "Image Browser", ViewColumn.One, { enableScripts: true });
        this._panel = panel;

        panel.onDidDispose(() => this.dispose(), null, this._disposables);
        panel.webview.html = this._getWebviewContent(panel.webview, extensionUri);
        panel.webview.onDidReceiveMessage((message: protocol.Message) => this._messageHandlers[message.command]?.(message), undefined, this._disposables);

        // Configure message handling
        this._messageHandlers = {
            [protocol.ClientCommand.InitComplete]: () => { this._sendConfig(); this._sendImageData(); },
            [protocol.ClientCommand.PostConfig]: this._receieveConfig,
            [protocol.ClientCommand.GetImageData]: this._sendImageData,
        };

        // Init extension config
        const configuration = workspace.getConfiguration(EXTENSION_ID);
        const defaultGet = (key: string, defaultValue: any) => (configuration.has(key) ? configuration.get(key) : undefined) || defaultValue;
        this._config = {
            includeFolders: defaultGet("includeFolders", "").split(';'),
            excludeFolders: defaultGet("excludeFolders", "node_modules").split(';'),
            includeProjectFolders: defaultGet("includeProjectFolders", {}),
            imageBackground: defaultGet("imageBackground", "transparent"),
            imageSize: defaultGet("imageSize", 100),
            lazyLoading: true,
        };
    }

    public static show(extensionUri: Uri) {
        if (ImageBrowserPanel._singleton)
            ImageBrowserPanel._singleton._panel.reveal(ViewColumn.One);
        else
            ImageBrowserPanel._singleton = new ImageBrowserPanel(extensionUri);
        ImageBrowserPanel._singleton._validateConfig();
    }

    public dispose() {
        ImageBrowserPanel._singleton = undefined;
        this._panel.dispose();

        for (const disposible of this._disposables)
            disposible?.dispose();
        this._disposables.length = 0;
    }

    // Send the server config to the client
    private _sendConfig = () => {
        this._panel.webview.postMessage({ command: protocol.ServerCommand.PostConfig, data: this._config } as protocol.Message);
    }

    // Recieve a new config from the client
    private _receieveConfig = (message: protocol.Message) => {
        const newConfig = message.data as protocol.Configuration;

        const filterChanged = this._config.includeFolders.join() != newConfig.includeFolders.join()
            || this._config.excludeFolders.join() != newConfig.excludeFolders.join()
            || !!Object.keys(newConfig.includeProjectFolders).find(key => this._config.includeProjectFolders[key] != newConfig.includeProjectFolders[key]);

        Object.assign(this._config, newConfig);

        const configuration = workspace.getConfiguration(EXTENSION_ID);
        configuration.update("includeFolders", this._config.includeFolders.join(';'));
        configuration.update("excludeFolders", this._config.excludeFolders.join(';'));
        configuration.update("includeProjectFolders", this._config.includeProjectFolders);
        configuration.update("imageBackground", this._config.imageBackground);
        configuration.update("imageSize", this._config.imageSize);

        if (filterChanged)
            this._sendImageData();
    }

    // Searches for images in the project and sends the paths to the webview
    private _sendImageData = () => {
        const webview = this._panel.webview;
        const includeProjectFolders = this._config.includeProjectFolders;
        const enabledProjectFolders = Object.keys(includeProjectFolders).filter((folder) => includeProjectFolders[folder]);

        const results = imageSearchMultipleFolders(enabledProjectFolders, this._config.includeFolders, this._config.excludeFolders, webview);
        webview.postMessage({ command: protocol.ServerCommand.PostImageData, data: results } as protocol.Message);
    }

    private _getWebviewContent(webview: Webview, extensionUri: Uri) {
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
