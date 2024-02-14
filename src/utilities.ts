import * as vscode from "vscode";
import * as path from 'path'
import { exec, execFile } from 'child_process';
import * as os from 'os';

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

/* tiny-open: https://github.com/fabiospampinato/tiny-open/tree/master */
export function openInApp(path: string) {

    if (process.platform === 'win32' || (process.platform === 'linux' && os.release().toLowerCase().includes('windows'))) {
        execFile('cmd.exe', ['/c', 'start', '', path.replace(/[&^]/g, '^$&')]);
    }
    else if (process.platform === 'linux') {
        execFile('xdg-open', [path]);
    }
    else if (process.platform === 'darwin') {
        execFile('open', [path]);
    }
    else {
        throw new Error(`Unsupported platform, could not open "${path}"`);
    }
};


export function openFileLocation(path: string) {
    if (process.platform === 'win32' || (process.platform === 'linux' && os.release().toLowerCase().includes('windows'))) {
        exec('explorer ' + path.replace(/[&^]/g, '^$&'));
    }
    else if (process.platform === 'linux') {
        // todo
    }
    else if (process.platform === 'darwin') {
        exec(`open path`)
    }
    else {
        throw new Error(`Unsupported platform, could not open "${path}"`);
    }
}