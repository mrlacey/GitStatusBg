"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
// alpha of 0.05(5%) should allow for subtle overlay on dark or light backgrounds
// These are also defined in the configuration
let COLOR_MODIFIED = "rgba(255, 165, 0, 0.05)";
let COLOR_UNTRACKED = "rgba(71, 255, 25, 0.05)";
let COLOR_BEHIND = "rgba(255, 0, 0, 0.05)";
let git = undefined;
// Keep track of current doecorations so that they can be removed
let currentDecorations = {};
let fileStatusCache = {};
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const ext = vscode.extensions.getExtension("vscode.git");
        yield (ext === null || ext === void 0 ? void 0 : ext.activate());
        git = ext.exports.getAPI(1);
        git.onDidChangeState;
        context.subscriptions.push(
        // Handle switching (or opening) documentt tabs
        vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor), 
        // Handle scrolling in the document.
        vscode.window.onDidChangeTextEditorVisibleRanges(onDidChangeTextEditorVisibleRanges), 
        // File saved so pick up any changes because of saving
        vscode.workspace.onDidSaveTextDocument(onFileSaved), 
        // Potentially large number of files changed - just reset the status cache (lazy but effective)
        vscode.workspace.onDidChangeWorkspaceFolders((e) => {
            fileStatusCache = {};
        }), vscode.workspace.onDidCreateFiles((e) => {
            fileStatusCache = {};
        }), vscode.workspace.onDidDeleteFiles((e) => {
            fileStatusCache = {};
        }), vscode.workspace.onDidRenameFiles((e) => {
            fileStatusCache = {};
        }));
        // Check for initial document
        RefreshCurrentEditor();
    });
}
exports.activate = activate;
function RefreshCurrentEditor() {
    onDidChangeActiveTextEditor(vscode.window.activeTextEditor);
}
function onFileSaved(e) {
    var _a, _b;
    // Document may have been colored before saving but shouldn't be colored after
    // - therefore remove any existing coloring
    var existing = currentDecorations[e.fileName];
    if (existing) {
        (_b = (_a = vscode.window) === null || _a === void 0 ? void 0 : _a.activeTextEditor) === null || _b === void 0 ? void 0 : _b.setDecorations(existing, []);
    }
    // Delete the cached status because it may have changed because saving
    fileStatusCache[e.fileName] = undefined;
    // Update the coloring of the document
    SetColorToStatus(vscode.window.activeTextEditor);
}
function onDidChangeTextEditorVisibleRanges(e) {
    let changedRanges = [];
    changedRanges = changedRanges.concat(e.visibleRanges);
    SetColorToStatus(e.textEditor, changedRanges);
}
function onDidChangeActiveTextEditor(editor) {
    if (editor === undefined) {
        return;
    }
    ReloadConfigurationInCaseChanged();
    // Clear the cached state of the file just switched to
    // - this allows for state changes of open files while another tab was displayed
    fileStatusCache[editor.document.fileName] = undefined;
    SetColorToStatus(editor);
}
function ReloadConfigurationInCaseChanged() {
    var config = vscode.workspace.getConfiguration();
    let untracked = config.get("gitstatusbg.untrackedFileBackground");
    if (untracked) {
        COLOR_UNTRACKED = untracked;
    }
    let modified = config.get("gitstatusbg.modifiedFileBackground");
    if (modified) {
        COLOR_MODIFIED = modified;
    }
    let behind = config.get("gitstatusbg.behindRemoteFileBackground");
    if (behind) {
        COLOR_BEHIND = behind;
    }
}
function SetColorToStatus(editor, range) {
    return __awaiter(this, void 0, void 0, function* () {
        let rangeToUse;
        if (range) {
            rangeToUse = range;
        }
        else {
            rangeToUse = editor === null || editor === void 0 ? void 0 : editor.visibleRanges;
        }
        if (!rangeToUse || !editor || !isTextEditor(editor)) {
            return;
        }
        let status = yield GetStatus(editor.document.uri.fsPath);
        if (status) {
            let bgcolor = undefined;
            switch (status) {
                case 5 /* MODIFIED */: {
                    bgcolor = COLOR_MODIFIED;
                    break;
                }
                case 7 /* UNTRACKED */: {
                    bgcolor = COLOR_UNTRACKED;
                    break;
                }
                case 100 /* CHANGED_ON_SERVER */: {
                    bgcolor = COLOR_BEHIND;
                    break;
                }
            }
            if (bgcolor) {
                ColorBackground(bgcolor, editor, rangeToUse);
            }
        }
    });
}
function GetStatus(_fspath) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        if (!git) {
            return undefined;
        }
        let repo = git.repositories[0];
        if (!repo) {
            return undefined;
        }
        var cached = fileStatusCache[_fspath];
        if (cached) {
            return cached;
        }
        yield repo.status();
        let result = undefined;
        repo.state.workingTreeChanges.forEach((value, _index, _changes) => {
            if (value.uri.fsPath === _fspath) {
                switch (value.status) {
                    case 5 /* MODIFIED */:
                    case 7 /* UNTRACKED */: {
                        result = value.status;
                        fileStatusCache[_fspath] = result;
                        break;
                    }
                }
            }
        });
        if (!result) {
            let behind = (_a = repo.state.HEAD) === null || _a === void 0 ? void 0 : _a.behind;
            if (!behind ? false : behind > 0) {
                // There are changes on the server
                let upstream = (_b = repo.state.HEAD) === null || _b === void 0 ? void 0 : _b.upstream;
                if (upstream && upstream.name && upstream.remote) {
                    let upstreamDiff = yield repo.diffWith(`${upstream === null || upstream === void 0 ? void 0 : upstream.remote}/${upstream === null || upstream === void 0 ? void 0 : upstream.name}`);
                    upstreamDiff.forEach((value, _index, _changes) => {
                        if (value.uri.fsPath === _fspath) {
                            result = 100 /* CHANGED_ON_SERVER */;
                            fileStatusCache[_fspath] = result;
                        }
                    });
                }
            }
        }
        return result;
    });
}
function ColorBackground(color, editor, range) {
    if (!range || !editor || !isTextEditor(editor)) {
        return;
    }
    var existing = currentDecorations[editor.document.fileName];
    if (existing) {
        editor.setDecorations(existing, []);
    }
    var myDecorator = vscode.window.createTextEditorDecorationType({
        backgroundColor: color,
        isWholeLine: true,
    });
    editor.setDecorations(myDecorator, range);
    currentDecorations[editor.document.fileName] = myDecorator;
}
// Adapted from https://github.com/cschleiden/vscode-github-actions/blob/master/src/tracker/workflowDocumentTracker.ts
var DocumentSchemes;
(function (DocumentSchemes) {
    DocumentSchemes["DebugConsole"] = "debug";
    DocumentSchemes["Output"] = "output";
})(DocumentSchemes || (DocumentSchemes = {}));
function isTextEditor(editor) {
    const scheme = editor.document.uri.scheme;
    return (scheme !== DocumentSchemes.Output && scheme !== DocumentSchemes.DebugConsole);
}
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map