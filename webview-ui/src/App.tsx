import { onMount, Component, onCleanup, createSignal, createEffect, For, Accessor, Setter, Show, PropsWithChildren, createMemo, Signal } from "solid-js";
import { provideVSCodeDesignSystem, vsCodeBadge, vsCodeButton, vsCodeCheckbox, vsCodeDivider, vsCodeOption, vsCodeTextArea, vsCodeTextField } from "@vscode/webview-ui-toolkit";
import { vscode } from "./utilities/vscode";
import "./App.css";
import * as protocol from "../../src/protocol";
import { getCommonBasePathLength } from "../../src/common";

provideVSCodeDesignSystem().register(
    vsCodeButton(),
    vsCodeOption(),
    vsCodeTextField(),
    vsCodeCheckbox(),
    vsCodeTextArea(),
    vsCodeBadge(),
    vsCodeDivider(),
);

// Types for expandable/collapsable group data
type Expandable = {
    title: string;
    expanded: Accessor<boolean>;
    setExpanded: Setter<boolean>;
}

type ImageGroup = Expandable & {
    images: protocol.ImageFile[];
}

type ProjectDirGroups = Expandable & {
    groups: ImageGroup[];
}

type SavedState = {
    expansions: { [key: string]: boolean },
    filter: string
}
const defaultState: SavedState = { expansions: {}, filter: '' };

// Available background style for images. The format is [color];[classes]. Color can be any valid CSS color.
const imagebackgroundStyles = [
    'transparent',
    'transparent;checkerboard',
    'white;checkerboard',
    'black;checkerboard',
    'black',
    'white',
    'grey',
    '#CCCCCC'
];

const imageDataContext = (uri: string) => '{"webviewSection": "image", "imageUri": "' + uri + '"}';

/*----------------------------------------------------------------------------------------------------------------------
    Main component for image browser
----------------------------------------------------------------------------------------------------------------------*/

const App: Component = () => {
    let config = {} as protocol.Configuration;

    // Image data
    const [imageGroups, setImageGroups] = createSignal([] as ProjectDirGroups[]);

    // Config setting displayed on the main 
    const [imageBackground, setImageBackground] = createSignal("transparent");
    const [imageSize, setImageSize] = createSignal(100);

    // Other temporary states
    const [filter, setFilter] = createSignal(vscode.getState(defaultState).filter);
    const [viewImage, setViewImage] = createSignal<protocol.ImageFile | undefined>();
    const [showBackgroundColorModal, setShowBackgroundColorModal] = createSignal(false);
    const [showSettingsModal, setShowSettingsModal] = createSignal(false);

    onMount(() => {
        window.addEventListener("message", messageHandler);
        onCleanup(() => window.addEventListener("message", messageHandler));

        // Reload state. We will refresh the image list anyway but this preserves the group expansion state
        //setImageGroups(vscode.getState() as ProjectDirGroups[] || []);

        vscode.postMessage({ command: protocol.ClientCommand.InitComplete });
    });

    // Handles incoming server messages
    const messageHandler = (ev: MessageEvent) => {
        const message = ev.data as protocol.Message;
        switch (message.command) {
            case protocol.ServerCommand.PostConfig:
                setConfig(message.data as protocol.Configuration);
                break;
            case protocol.ServerCommand.PostImageData:
                setImageGroups(processImageData(message.data as protocol.ProjectDirCollection))
                break;
        }
    };

    // Converts the file list sent by the server into the structure we want to display by grouping images based on realtive path
    const processImageData = (ProjectDirs: protocol.ProjectDirCollection) => {
        const projectDirGroups: ProjectDirGroups[] = [];
        const state = vscode.getState(defaultState);

        for (const ProjectDir of ProjectDirs.dirs) {
            let previous = "$*";
            let group: ImageGroup | undefined;

            const title = ProjectDir.base;
            const [expanded, setExpanded] = createSignal(state.expansions[title] ?? true);
            createEffect(() => setExpansionState(title, expanded()));
            projectDirGroups.push({ title, groups: [], expanded, setExpanded });

            for (const imageFile of ProjectDir.imgs) {
                if (imageFile.path === previous) {
                    group!.images.push(imageFile);
                }
                else {
                    if (group)
                        projectDirGroups[projectDirGroups.length - 1]!.groups.push(group);

                    const expansionKey = title + imageFile.path;
                    const [expanded, setExpanded] = createSignal(state.expansions[expansionKey] ?? true);
                    createEffect(() => setExpansionState(expansionKey, expanded()));

                    group = {
                        title: imageFile.path,
                        images: [imageFile],
                        expanded,
                        setExpanded
                    };
                    previous = imageFile.path;
                }
            }
            if (group)
                projectDirGroups[projectDirGroups.length - 1]!.groups.push(group);
        }

        return projectDirGroups;
    };

    // Updates a group expansion in vscode's saved state
    const setExpansionState = (key: string, value: boolean) => {
        const state = vscode.getState(defaultState);
        if (state.expansions[key] != value && (value == false || state.expansions[key] != undefined)) {
            state.expansions[key] = value;
            vscode.setState(state);
        }
    }

    // Effect to update the saved state when the filter changes
    createEffect(() => {
        const state = vscode.getState(defaultState);
        if (state.filter != filter()) {
            state.filter = filter();
            vscode.setState(state);
        }
    });

    // Applies a new config sent from the server
    const setConfig = (newConfig: protocol.Configuration) => {
        config = newConfig;
        setImageBackground(config.imageBackground);
        setImageSize(config.imageSize);
    };

    // Called to modify local config and update the server
    const onChangeConfig = (partialConfig: Partial<protocol.Configuration>) => {
        const newConfig = Object.assign({}, config, partialConfig);
        vscode.postMessage({ command: protocol.ClientCommand.PostConfig, data: newConfig });
        setConfig(newConfig);
    };

    // Set expansion for all groups
    const onExpandAll = (expanded: boolean) => imageGroups().forEach(group => {
        group.setExpanded(expanded);
        group.groups.forEach(group => group.setExpanded(expanded));
    });

    // Handler for toolbar image size +/-
    const onImageSize = (offset: number) => onChangeConfig({ imageSize: Math.max(40, Math.min(imageSize() + offset, 200)) });

    // Background style for image list
    const backgroundStyle = createMemo(() => imageBackground().split(';'));

    // Lowest level image group
    const createImageGroup = (group: ImageGroup) => <ImageGroup
        group={group}
        background={backgroundStyle()}
        imageSize={imageSize() + 'px'}
        filter={filter().toLowerCase()}
        loading={config.lazyLoading ? "lazy" : undefined}
        onImageClick={setViewImage}
    />

    // Size for englarged image when clicked
    const getViewImageSize = () => {
        const dim = Math.max(document.documentElement.clientWidth, document.documentElement.clientHeight);
        return (dim * 0.7) + 'px';
    };

    const context = "{&quot;preventDefaultContextMenuItems&quot;: true}";
    return (
        <main data-vscode-context={context}>
            <div class="toolbar">
                {/* Expand/collapse all */}
                <vscode-button class="toolbar-pm group-expander" onclick={() => onExpandAll(true)} appearance="secondary">+</vscode-button>
                <vscode-button class="toolbar-pm group-expander right" onclick={() => onExpandAll(false)} appearance="secondary">-</vscode-button>
                {/* Filter */}
                <vscode-text-field class="filter-text" placeholder="Filter" value={filter()} onInput={(e: any) => setFilter(e.target.value)} />
                {/* Background */}
                Background:
                <vscode-button class="toolbar-button" appearance="icon" onclick={() => setShowBackgroundColorModal(true)}>
                    <Background background={backgroundStyle()} modifiers="color-button-content" />
                </vscode-button>
                {/* Image size */}
                Image Size:
                <vscode-button class="toolbar-pm group-expander" onclick={() => onImageSize(10)} appearance="secondary">+</vscode-button>
                <vscode-button class="toolbar-pm group-expander right" onclick={() => onImageSize(-10)} appearance="secondary">-</vscode-button>
                {/* Settings */}
                <div class='toolbar-spacer' />
                <vscode-button class="settings-button" onclick={() => setShowSettingsModal(true)} appearance="secondary">
                    ...
                </vscode-button>
            </div>

            {/* Actual image list */}
            <For each={imageGroups()}>
                {projectDir =>
                    <Show
                        when={imageGroups().length > 1}
                        fallback={
                            <For each={projectDir.groups}>
                                {createImageGroup}
                            </For>
                        }>
                        <Group group={projectDir} modifiers="project-dir">
                            <For each={projectDir.groups}>
                                {createImageGroup}
                            </For>
                        </Group>
                        <vscode-divider />
                    </Show>
                }
            </For>

            <Show when={showBackgroundColorModal()}>
                <ModalPanel anchorId="toolbar-background-button" modifiers='backgroundColor'>
                    {imagebackgroundStyles.map(
                        style =>
                            <vscode-button appearance="icon" onclick={() => {
                                onChangeConfig({ imageBackground: style });
                                setShowBackgroundColorModal(false);
                            }}>
                                <Background background={style.split(';')} modifiers="color-button-content" />
                            </vscode-button>
                    )}
                </ModalPanel>
            </Show>

            <Show when={showSettingsModal()}>
                <SettingsPanel config={config} onChangeConfig={onChangeConfig} onCancel={() => setShowSettingsModal(false)} />
            </Show>

            <Show when={viewImage() != undefined}>
                <ModalPanel modifiers="view-image" onbackgroundclick={() => setViewImage(undefined)}>
                    <Background background={backgroundStyle()} modifiers="view-image" size={getViewImageSize()}>
                        <img class="image" src={viewImage()!.uri}
                            data-vscode-context={imageDataContext(viewImage()!.uri)}
                        ></img>
                    </Background>
                    <div class="image-name">
                        {viewImage()!.name}
                    </div>
                </ModalPanel>
            </Show>
        </main >
    );
};

export default App;

/*----------------------------------------------------------------------------------------------------------------------
    Exandable group of other components
----------------------------------------------------------------------------------------------------------------------*/

const Group: Component<{ group: Expandable, modifiers: string, count?: number } & PropsWithChildren> = (props) => {
    return (
        <div class="group">
            <vscode-option class={"group-header " + props.modifiers}
                onmousedown={() => props.group.setExpanded(!props.group.expanded())}
            >
                <span class="group-expander">{props.group.expanded() ? "- " : "+ "}</span>
                <span class={"group-title " + props.modifiers}>{props.group.title}</span>
                <Show when={props.count != undefined}>
                    <vscode-badge class="group-badge">{props.count}</vscode-badge>
                </Show>
            </vscode-option>
            <Show when={props.group.expanded()}>
                {props.children}
            </Show>
        </div>
    );
};

/*----------------------------------------------------------------------------------------------------------------------
    An expandable list of images
----------------------------------------------------------------------------------------------------------------------*/
type ImageGroupProps = {
    group: ImageGroup;
    background: string[];
    imageSize: string;
    filter: string;
    loading: "lazy" | undefined;
    onImageClick: (image: protocol.ImageFile) => void;
}

const ImageGroup: Component<ImageGroupProps> = (props) => {
    const filteredImages = createMemo(() => props.filter.length ? props.group.images.filter(image => image.name.toLowerCase().includes(props.filter))
        : props.group.images);
    return (
        <Show when={filteredImages().length > 0}>
            <Group group={props.group} count={filteredImages().length} modifiers=''>
                <div class="image-list">
                    <For each={filteredImages()}>
                        {(image, index) =>
                            <div class={"image-box" + (index() == 0 ? " first" : "")}
                                onclick={() => props.onImageClick(image)}
                                data-vscode-context={imageDataContext(image.uri)}
                            >
                                <Background background={props.background} modifiers="" size={props.imageSize}>
                                    <img class="image" src={image.uri} loading={props.loading}></img>
                                </Background>
                                <div class="image-name small" style={{ width: props.imageSize }}>
                                    {image.name}
                                </div>
                            </div>
                        }
                    </For>
                </div>
            </Group >
        </Show>
    );
}

/*----------------------------------------------------------------------------------------------------------------------
    Component for the background of buttons and images
----------------------------------------------------------------------------------------------------------------------*/

const Background: Component<{ background: string[], modifiers: string, size?: string } & PropsWithChildren> = (props) => {
    return <div class={"background " + props.modifiers + " " + props.background[1]} style={{ "background-color": props.background[0], width: props.size, height: props.size }}>
        {props.children}
    </div>;
}

/*----------------------------------------------------------------------------------------------------------------------
    A basic modal panel for settings, menus etc.
----------------------------------------------------------------------------------------------------------------------*/

const ModalPanel: Component<{ anchorId?: string, onbackgroundclick?: () => void, modifiers: string } & PropsWithChildren> = (props) => {
    let x = 0, y = 0;
    if (props.anchorId) {
        const el = document.getElementById(props.anchorId);
        if (el) {
            x = el.getBoundingClientRect().left;
            y = el.getBoundingClientRect().bottom + 4;
        }
    }

    return (
        <div class="modal-background dark" onclick={props.onbackgroundclick}>
            <div class={"modal-panel " + props.modifiers} style={x && y ? { position: 'absolute', left: x + 'px', top: y + 'px' } : undefined}>
                {props.children}
            </div>
        </div>
    );
};

/*----------------------------------------------------------------------------------------------------------------------
    Settings Panel
----------------------------------------------------------------------------------------------------------------------*/

type SettingsPanelProps = PropsWithChildren & {
    config: protocol.Configuration;
    onChangeConfig: (partialConfig: Partial<protocol.Configuration>) => void;
    onCancel: () => void;
}

const SettingsPanel: Component<SettingsPanelProps> = (props) => {
    const [includeProjectFolders, setIncludeProjectFolders] = createSignal(props.config.includeProjectFolders);
    const [includeFolders, setIncludeFolders] = createSignal(props.config.includeFolders.join("\n"));
    const [excludeFolders, setExcludeFolders] = createSignal(props.config.excludeFolders.join("\n"));
    let projectFolders = Object.keys(includeProjectFolders());
    const commonPathLength = getCommonBasePathLength(projectFolders);

    const toggleProjectFolder = (folder: string) => {
        const folders = Object.assign({}, includeProjectFolders());
        folders[folder] = !folders[folder];
        setIncludeProjectFolders(folders);
    }
    const onOK = () => {
        props.onChangeConfig({
            includeProjectFolders: includeProjectFolders(),
            includeFolders: includeFolders().split("\n").map(i => i.trim()).filter(i => i),
            excludeFolders: excludeFolders().split("\n").map(i => i.trim()).filter(i => i),
        });
        props.onCancel();
    };

    return (
        <ModalPanel modifiers='settings'>
            <Show when={projectFolders.length > 1}>
                Included
                <For each={projectFolders}>
                    {folder =>
                        <vscode-checkbox checked={includeProjectFolders()[folder]} onchange={() => toggleProjectFolder(folder)}>
                            {folder.slice(commonPathLength)}
                        </vscode-checkbox>
                    }
                </For>
            </Show>
            <div class="section-break">Include folders - only these folders will be searched:</div>
            <vscode-text-area rows={5}
                value={includeFolders()}
                onInput={(e: any) => setIncludeFolders(e.target.value)}
            />
            <div class="section-break">Exclude folders - these folders will be ignored:</div>
            <vscode-text-area rows={5}
                value={excludeFolders()}
                onInput={(e: any) => setExcludeFolders(e.target.value)}
            />
            <div class='settings-buttons section-break'>
                <vscode-button onclick={onOK}>OK</vscode-button>
                <vscode-button class='margin-left' appearance="secondary" onclick={props.onCancel}>Cancel</vscode-button>
            </div>
        </ModalPanel >
    );
};