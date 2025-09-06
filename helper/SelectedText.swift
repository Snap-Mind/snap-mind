import Cocoa
import ApplicationServices
import Foundation
import CoreGraphics

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
    let oldContents = pasteboard.string(forType: .string) ?? ""

    let source = CGEventSource(stateID: .hidSystemState)
    let keyDown = CGEvent(keyboardEventSource: source, virtualKey: 0x08, keyDown: true)
    let keyUp = CGEvent(keyboardEventSource: source, virtualKey: 0x08, keyDown: false)

    keyDown?.flags = .maskCommand
    keyUp?.flags = .maskCommand

    keyDown?.post(tap: .cghidEventTap)
    keyUp?.post(tap: .cghidEventTap)

    Thread.sleep(forTimeInterval: 0.1)

    let copiedText = pasteboard.string(forType: .string) ?? ""

    // Restore clipboard
    pasteboard.clearContents()
    if !oldContents.isEmpty {
        pasteboard.setString(oldContents, forType: .string)
    }

    // Only return success if clipboard changed and is non-empty
    if !copiedText.isEmpty {
        return SelectionResult(success: true, selectedText: copiedText, appName: appName,
                             error: nil, type: "text", source: "clipboard")
    }

    return SelectionResult(success: false, selectedText: nil, appName: appName,
                          error: "No text selected or clipboard unchanged", type: "text", source: nil)
}

// Default behavior: clipboard fallback enabled unless explicitly disabled (match SelectedText.cs)
var clipboardEnabled = true
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