import * as vscode from "vscode";

import { GitExtension, API, Status } from "./api/git";

// alpha of 0.05(5%) should allow for subtle overlay on dark or light backgrounds
// These are also defined in the configuration
let COLOR_MODIFIED: string | undefined = "rgba(255, 165, 0, 0.05)";
let COLOR_UNTRACKED: string | undefined = "rgba(71, 255, 25, 0.05)";
let COLOR_BEHIND: string | undefined = "rgba(255, 0, 0, 0.05)";

const enum XStatus {
  CHANGED_ON_SERVER = 100
}

let git: API | undefined = undefined;

// Keep track of current doecorations so that they can be removed
let currentDecorations: {
  [path: string]: vscode.TextEditorDecorationType | undefined;
} = {};

let fileStatusCache: {
  [path: string]: Status | XStatus | undefined;
} = {};

export async function activate(context: vscode.ExtensionContext) {
  const ext = vscode.extensions.getExtension<GitExtension>("vscode.git");

  await ext?.activate();
  git = ext!.exports.getAPI(1);

  git.onDidChangeState;

  context.subscriptions.push(
    // Handle switching (or opening) documentt tabs
    vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor),

    // Handle scrolling in the document.
    vscode.window.onDidChangeTextEditorVisibleRanges(
      onDidChangeTextEditorVisibleRanges
    ),

    // File saved so pick up any changes because of saving
    vscode.workspace.onDidSaveTextDocument((e) => {}),

    // Potentially large number of files changed - just reset the status cache (lazy but effective)
    vscode.workspace.onDidChangeWorkspaceFolders((e) => {
      fileStatusCache = {};
    }),
    vscode.workspace.onDidCreateFiles((e) => {
      fileStatusCache = {};
    }),
    vscode.workspace.onDidDeleteFiles((e) => {
      fileStatusCache = {};
    }),
    vscode.workspace.onDidRenameFiles((e) => {
      fileStatusCache = {};
    })
  );

  // Check for initial document
  onDidChangeActiveTextEditor(vscode.window.activeTextEditor);
}

function onFileSaved(e: vscode.TextDocument) {
  // Document may have been colored before saving but shouldn't be colored after
  // - therefore remove any existing coloring
  var existing = currentDecorations[e.fileName];

  if (existing) {
    vscode.window?.activeTextEditor?.setDecorations(existing, []);
  }

  // Delete the cached status because it may have changed because saving
  fileStatusCache[e.fileName] = undefined;

  // Update the coloring of the document
  SetColorToStatus(vscode.window.activeTextEditor);
}

function onDidChangeTextEditorVisibleRanges(
  e: vscode.TextEditorVisibleRangesChangeEvent
) {
  let changedRanges: vscode.Range[] = [];

  changedRanges = changedRanges.concat(e.visibleRanges);

  SetColorToStatus(e.textEditor, changedRanges);
}

function onDidChangeActiveTextEditor(editor?: vscode.TextEditor) {
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

  let untracked: any = config.get("gitstatusbg.untrackedFileBackground");

  if (untracked) {
    COLOR_UNTRACKED = untracked;
  }

  let modified: any = config.get("gitstatusbg.modifiedFileBackground");

  if (modified) {
    COLOR_MODIFIED = modified;
  }
}

async function SetColorToStatus(
  editor?: vscode.TextEditor,
  range?: vscode.Range[]
) {
  let rangeToUse;
  if (range) {
    rangeToUse = range;
  } else {
    rangeToUse = editor?.visibleRanges;
  }

  if (!rangeToUse || !editor || !isTextEditor(editor)) {
    return;
  }

  let status = await GetStatus(editor.document.uri.fsPath);

  if (status) {
    let bgcolor = undefined;

    switch (status) {
      case Status.MODIFIED: {
        bgcolor = COLOR_MODIFIED;
        break;
      }
      case Status.UNTRACKED: {
        bgcolor = COLOR_UNTRACKED;
        break;
      }
      case XStatus.CHANGED_ON_SERVER: {
        bgcolor = COLOR_BEHIND;
        break;
      }
    }

    if (bgcolor) {
      ColorBackground(bgcolor, editor, rangeToUse);
    }
  }
}

async function GetStatus(_fspath: string) {
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

  await repo.status();

  let result = undefined;

  repo.state.workingTreeChanges.forEach((value, _index, _changes) => {
    if (value.uri.fsPath === _fspath) {
      switch (value.status) {
        case Status.MODIFIED:
        case Status.UNTRACKED: {
          result = value.status;
          fileStatusCache[_fspath] = result;
          break;
        }
      }
    }
  });

  let behind = repo.state.HEAD?.behind;
  if (!behind ? false : behind > 0)
  {
    // There are changes on the server
    let upstream = repo.state.HEAD?.upstream;
    if (upstream && upstream.name && upstream.remote)
    {
      let upstreamDiff = await repo.diffWith(`${upstream?.remote}/${upstream?.name}`);

      upstreamDiff.forEach((value, _index, _changes) => {
        if (value.uri.fsPath === _fspath)
        {
          result = XStatus.CHANGED_ON_SERVER;
          fileStatusCache[_fspath] = result;
        }
      });
    }
  }

  return result;
}

function ColorBackground(
  color: string,
  editor?: vscode.TextEditor,
  range?: vscode.Range[]
) {
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
enum DocumentSchemes {
  DebugConsole = "debug",
  Output = "output",
}

function isTextEditor(editor: vscode.TextEditor): boolean {
  const scheme = editor.document.uri.scheme;
  return (
    scheme !== DocumentSchemes.Output && scheme !== DocumentSchemes.DebugConsole
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
