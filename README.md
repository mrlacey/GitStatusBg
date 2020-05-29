# GitStatusBg (Git Status Background)

Visual Studio Code extension that sets the background color of the editor to indicate the Git status of the file.

## Features

Color the background of the editor based on the Git status of that file.
This is to help you easily identify these files, and help avoid making changes in the wrong place or when they may be overwritten.

The following statuses are supported

* Untracked
* Modified (locally)
* Behind the remote version

The images below show open modified and untracked files in the editor.

![Example using dark theme](assets/screenshot-dark.png)
![Example using light theme](assets/screenshot-light.png)

If you would prefer to use different colors (or they don't work with your chosen theme), the colors can be changed in settings to whatever you wish.

## Requirements

The default (built-in) GIT provider is used to get the status of files. If you're not using this, or if you're not using GIT as a source control system, this extension isn't going to be of much use to you.

## Extension Settings

Settings exist to adjust the tint color that is applied to the background. Adjust based on your preference.

* `gitstatusbg.untrackedFileBackground`: the tint color to use for untracked files
* `gitstatusbg.modifiedFileBackground`: the tint color to use for modified files
* `gitstatusbg.behindRemoteFileBackground`: the tint color to use for files that have been modified remotely but those changes have not been pulled locally

## Known Issues

None yet. If you find something wrong or have a suggestion, please [raise an issue](https://github.com/mrlacey/GitStatusBg/issues).

## Release Notes

### 1.1.0

* Added coloring of files that are behind the remote.
* Fixed bug where coloring may not be updated after saving a document.

### 1.0.0

Initial release.
