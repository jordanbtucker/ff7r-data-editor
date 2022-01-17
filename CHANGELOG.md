# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Data can now be imported and exported to and from CSV files.

### Changed

- The Find feature works on headers now.
- The Open File window now remembers the last used location.

### Fixed

- Boolean values in arrays are read properly now. This fixes an issue with
  `BattleAICharaSpec` files.
- The Save menu option is now disabled until a file has been opened.
- The correct filename now shows in the save notificaiton.
- A visual bug causing some text to appear over headers is fixed.
- A bug causing text values to appear next to text IDs is fixed.

## [1.0.0-b.7] - 2022-01-11

### Changed

- The index column stays in place to help you keep track of which row you're
  editing.

### Fixed

- A bug that caused arrays to be saved incorrectly is fixed.

## [1.0.0-b.6] - 2022-01-10

### Added

- Text can be search for via Edit > Find.

## [1.0.0-b.5] - 2022-01-09

### Fixed

- Incorrect characters in text values are fixed.

## [1.0.0-b.4] - 2022-01-09

### Added

- Numeric values are validated for type and range.

## [1.0.0-b.3] - 2022-01-09

### Added

- Text IDs can be shown as their values. This is enabled by default.

## [1.0.0-b.2] - 2022-01-09

### Added

- FName elements in arrays can be modified.

## [1.0.0-b.1] - 2022-01-09

### Fixed

- Fixed a bug that caused FString values to not show.

## [1.0.0-b.0] - 2022-01-09

### Added

- Elements in arrays can be modified, but not the length of the array.
- Files can be opened and saved via the menu and shortcut keys.
- The Open and Save buttons stay on screen instead of scrolling.

## [1.0.0-a.1] - 2021-12-30

### Added

- FName values can be changed.

### Changed

- Cells show as green instead of yellow to indicate they've been changed.

## [1.0.0-a.0] - 2021-12-30

### Added

- Initial implementation

[unreleased]:
  https://github.com/jordanbtucker/ff7r-data-editor/compare/v1.0.0-b.7...HEAD
[1.0.0-b.7]:
  https://github.com/jordanbtucker/ff7r-data-editor/compare/v1.0.0-b.6...v1.0.0-b.7
[1.0.0-b.6]:
  https://github.com/jordanbtucker/ff7r-data-editor/compare/v1.0.0-b.5...v1.0.0-b.6
[1.0.0-b.5]:
  https://github.com/jordanbtucker/ff7r-data-editor/compare/v1.0.0-b.4...v1.0.0-b.5
[1.0.0-b.4]:
  https://github.com/jordanbtucker/ff7r-data-editor/compare/v1.0.0-b.3...v1.0.0-b.4
[1.0.0-b.3]:
  https://github.com/jordanbtucker/ff7r-data-editor/compare/v1.0.0-b.2...v1.0.0-b.3
[1.0.0-b.2]:
  https://github.com/jordanbtucker/ff7r-data-editor/compare/v1.0.0-b.1...v1.0.0-b.2
[1.0.0-b.1]:
  https://github.com/jordanbtucker/ff7r-data-editor/compare/v1.0.0-b.0...v1.0.0-b.1
[1.0.0-b.0]:
  https://github.com/jordanbtucker/ff7r-data-editor/compare/v1.0.0-a.1...v1.0.0-b.0
[1.0.0-a.1]:
  https://github.com/jordanbtucker/ff7r-data-editor/compare/v1.0.0-a.0...v1.0.0-a.1
[1.0.0-a.0]:
  https://github.com/jordanbtucker/ff7r-data-editor/releases/tag/v1.0.0-a.0
