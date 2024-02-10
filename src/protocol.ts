export enum ClientCommand {
    InitComplete = 'init_complete',
    PostConfig = 'post_config',
    GetImageData = 'refresh_images',
    copy_to_clipboard = 'copy_To_clipboard',
}

export enum ServerCommand {
    PostConfig = 'post_config',
    PostImageData = 'post_image_data',
}

export type Message = {
    command: ServerCommand | ClientCommand;
    data: any;
}

export type Configuration = {
    includeFolders: string[];
    excludeFolders: string[];
    includeProjectFolders: { [key: string]: boolean };

    imageBackground: string;
    imageSize: number;
    lazyLoading: boolean;
}

export type ImageFile = {
    name: string; // Filename with extension
    path: string; // Filesystem path relative to project folder
    uri: string; // Uri to image for webview
}

export type ImageFileList = {
    base: string; // Base path
    imgs: ImageFile[]; // List of images with path relative to base
}

export type MenuContext = {
    imageUri: string;
}