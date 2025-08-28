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
}

func getSelectedTextAXUI() -> SelectionResult {
    guard let frontApp = NSWorkspace.shared.frontmostApplication else {
        return SelectionResult(
            success: false,
            selectedText: nil,
            appName: nil,
            error: "No frontmost application found",
            type: "text"
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
            type: "text"
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
            type: "text"
        )
    }

    return SelectionResult(
        success: false,
        selectedText: nil,
        appName: appName,
        error: "No text selected or attribute not available",
        type: "text"
    )
}

func getSelectedTextClipboard() -> SelectionResult {
    guard let frontApp = NSWorkspace.shared.frontmostApplication else {
        return SelectionResult(success: false, selectedText: nil, appName: nil,
                             error: "No frontmost application found", type: "text")
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
                             error: nil, type: "text")
    }

    return SelectionResult(success: false, selectedText: nil, appName: appName,
                          error: "No text selected or clipboard unchanged", type: "text")
}

// Get clipboard enabled setting from command line arguments
let clipboardEnabled = CommandLine.arguments.count > 1 && CommandLine.arguments[1].lowercased() == "true"

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
                          error: "No text selected and clipboard fallback disabled", type: "text")
}()

do {
    let encoder = JSONEncoder()
    encoder.outputFormatting = .prettyPrinted
    let jsonData = try encoder.encode(result)
    if let jsonString = String(data: jsonData, encoding: .utf8) {
        print(jsonString)
    }
} catch {
    print("""
    {
      "success": false,
      "selectedText": null,
      "appName": null,
      "error": "JSON encoding failed: \(error.localizedDescription)",
      "type": "text"
    }
    """)
}