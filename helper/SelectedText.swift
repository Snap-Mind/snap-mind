import Cocoa
import ApplicationServices
import Foundation
import CoreGraphics

// NOTE: This helper prints exactly one JSON object to STDOUT and nothing else.

// Configuration constants
private enum SelectionConfig {
    static let clipboardTimeout: TimeInterval = 0.5
    static let clipboardPollInterval: TimeInterval = 0.01
    static let clipboardMicroDelay: TimeInterval = 0.005
}

struct SelectionResult: Codable {
    let success: Bool
    let selectedText: String?
    let appName: String?
    let error: String?
    let type: String // For future extensibility: "text", "file", "image", etc.
    let source: String?
}

func getSelectedTextAXUI() -> SelectionResult {
    guard let frontApp = NSWorkspace.shared.frontmostApplication else {
        return SelectionResult(
            success: false,
            selectedText: nil,
            appName: nil,
            error: "No frontmost application found",
            type: "text",
            source: nil
        )
    }

    let appName = frontApp.localizedName ?? "Unknown"
    let pid = frontApp.processIdentifier
    let appElement = AXUIElementCreateApplication(pid)

    var focusedElement: AnyObject?
    let focusedResult = AXUIElementCopyAttributeValue(appElement, kAXFocusedUIElementAttribute as CFString, &focusedElement)

    guard focusedResult == .success, let element = focusedElement else {
        return SelectionResult(
            success: false,
            selectedText: nil,
            appName: appName,
            error: "No focused UI element found",
            type: "text",
            source: nil
        )
    }

    var selectedText: AnyObject?
    let result = AXUIElementCopyAttributeValue(element as! AXUIElement, kAXSelectedTextAttribute as CFString, &selectedText)

    if result == .success, let text = selectedText as? String, !text.isEmpty {
        return SelectionResult(
            success: true,
            selectedText: text,
            appName: appName,
            error: nil,
            type: "text",
            source: "uia"
        )
    }

    return SelectionResult(
        success: false,
        selectedText: nil,
        appName: appName,
    error: "No text selected or attribute not available",
    type: "text",
    source: nil
    )
}

func getSelectedTextClipboard() -> SelectionResult {
    guard let frontApp = NSWorkspace.shared.frontmostApplication else {
    return SelectionResult(success: false, selectedText: nil, appName: nil,
                 error: "No frontmost application found", type: "text", source: nil)
    }

    let appName = frontApp.localizedName ?? "Unknown"

    let pasteboard = NSPasteboard.general
    // Preserve full pasteboard contents by snapshotting data for each item & type.
    // We cannot re-use NSPasteboardItem instances (exception: already associated with another pasteboard),
    // so we clone their data later.
    let originalItemsData: [[NSPasteboard.PasteboardType: Data]]? = pasteboard.pasteboardItems?.map { item in
        var dict: [NSPasteboard.PasteboardType: Data] = [:]
        for type in item.types {
            if let data = item.data(forType: type) {
                dict[type] = data
            }
        }
        return dict
    }
    // Additionally keep a plain-string fallback (in case we cannot restore rich content)
    let oldStringFallback = pasteboard.string(forType: .string)

    let source = CGEventSource(stateID: .hidSystemState)
    let keyDown = CGEvent(keyboardEventSource: source, virtualKey: 0x08, keyDown: true)
    let keyUp = CGEvent(keyboardEventSource: source, virtualKey: 0x08, keyDown: false)

    keyDown?.flags = .maskCommand
    keyUp?.flags = .maskCommand

    keyDown?.post(tap: .cghidEventTap)
    keyUp?.post(tap: .cghidEventTap)

    // Poll for pasteboard change (up to 500ms) instead of fixed sleep
    let beforeChangeCount = pasteboard.changeCount
    let timeout = SelectionConfig.clipboardTimeout
    let pollInterval = SelectionConfig.clipboardPollInterval
    let startTime = Date()
    while Date().timeIntervalSince(startTime) < timeout {
        // If changeCount advanced, break
        if pasteboard.changeCount != beforeChangeCount { break }
        RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(pollInterval))
    }
    // One final tiny delay to allow the data to materialize if changeCount bumped very recently
    if pasteboard.changeCount != beforeChangeCount {
        Thread.sleep(forTimeInterval: SelectionConfig.clipboardMicroDelay)
    }

    let copiedText = pasteboard.string(forType: .string) ?? ""

    // Restore clipboard (attempt to restore original rich content if any) safely by cloning items
    pasteboard.clearContents()
    if let itemsData = originalItemsData, !itemsData.isEmpty {
        for itemData in itemsData {
            let newItem = NSPasteboardItem()
            for (type, data) in itemData {
                newItem.setData(data, forType: type)
            }
            pasteboard.writeObjects([newItem])
        }
    } else if let oldStr = oldStringFallback, !oldStr.isEmpty {
        pasteboard.setString(oldStr, forType: .string)
    }

    // Only return success if clipboard changed and is non-empty
    if !copiedText.isEmpty {
        return SelectionResult(success: true, selectedText: copiedText, appName: appName,
                             error: nil, type: "text", source: "clipboard")
    }

    return SelectionResult(success: false, selectedText: nil, appName: appName,
                          error: "No text selected or clipboard unchanged", type: "text", source: nil)
}

var clipboardEnabled = false
if CommandLine.arguments.count > 1 {
    clipboardEnabled = CommandLine.arguments[1].lowercased() == "true"
}

// Try methods based on settings
let result = {
    let axuiResult = getSelectedTextAXUI()
    if axuiResult.success {
        return axuiResult
    }

    // Only try clipboard method if enabled
    if clipboardEnabled {
        return getSelectedTextClipboard()
    }

    return SelectionResult(success: false, selectedText: nil, appName: axuiResult.appName,
                          error: "No text selected and clipboard fallback disabled", type: "text", source: "disabled")
}()

do {
    let encoder = JSONEncoder()
    encoder.outputFormatting = .prettyPrinted
    let jsonData = try encoder.encode(result)
    if let jsonString = String(data: jsonData, encoding: .utf8) {
        print(jsonString)
    }
} catch {
    let errMsg = "JSON encoding failed: \(error.localizedDescription)"
    let fallback = SelectionResult(success: false, selectedText: nil, appName: nil, error: errMsg, type: "text", source: nil)
    if let data = try? JSONEncoder().encode(fallback), let s = String(data: data, encoding: .utf8) {
        print(s)
    } else {
        print("{\"success\": false, \"selectedText\": null, \"appName\": null, \"error\": \"Unknown error\"}")
    }
}