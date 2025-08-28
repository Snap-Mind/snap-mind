# SnapMind Log Files

This document explains where to find log files for SnapMind on different platforms.

## Log File Locations

SnapMind uses electron-log to store logs. The log files are located in the following directories:

### Windows

```
%USERPROFILE%\AppData\Roaming\SnapMind\logs\main.log
```

### macOS

```
~/Library/Logs/SnapMind/main.log
```

### Linux

```
~/.config/SnapMind/logs/main.log
```

## How to Access Logs

There are two ways to access the log files:

1. **From the Settings UI**: Go to Settings > General, scroll to the bottom, and click "Show Log Files". This will either display the path or open the folder containing the logs.

2. **Manually**: Navigate to the directories listed above in your file explorer.

## Log File Format

The log files are in plain text format and contain timestamped entries. Example:

```
[2023-08-08 12:34:56.789] [info] Application started
[2023-08-08 12:34:56.790] [info] Platform: darwin
[2023-08-08 12:34:56.791] [info] Log file location: /Users/username/Library/Logs/SnapMind/main.log
```

## Troubleshooting with Logs

When reporting an issue, please include the relevant log files or log excerpts. The logs contain important information that can help diagnose problems, including:

- Application startup information
- Error messages
- Application state changes
- User interactions with hotkeys

## Log Rotation

Log files are automatically rotated when they reach a certain size. Old log files are named with a date suffix, e.g., `main.log.2023-08-07`.
