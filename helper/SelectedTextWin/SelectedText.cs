using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows.Automation;
using System.Security.Principal;

class SelectionResult
{
    public bool success { get; set; }
    public string selectedText { get; set; }
    public string appName { get; set; }
    public string error { get; set; }
    public string type { get; set; } = "text";
}

class Program
{
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [STAThread]
    static void Main(string[] args)
    {
        // Set higher thread priority for more reliable execution
        Thread.CurrentThread.Priority = ThreadPriority.AboveNormal;

        // Log permission status for debugging
        bool isElevated = IsElevated();
        Console.Error.WriteLine($"Running with elevated permissions: {isElevated}");

        // Special mode to test UI Automation permissions without needing a foreground window
        if (args.Length > 0 && args[0] == "test-permissions")
        {
            TestUIAutomationPermissions();
            return;
        }

        bool clipboardEnabled = false;
        if (args.Length > 0 && bool.TryParse(args[0], out bool argVal))
            clipboardEnabled = argVal;

        IntPtr foregroundWindowHandle = GetForegroundWindow();
        string appName = "Unknown";
        if (foregroundWindowHandle != IntPtr.Zero)
        {
            uint pid;
            GetWindowThreadProcessId(foregroundWindowHandle, out pid);
            try
            {
                var proc = Process.GetProcessById((int)pid);
                appName = proc.MainModule?.ModuleName ?? "Unknown";
            }
            catch (Exception procEx)
            {
                Console.Error.WriteLine($"Could not get process info: {procEx.Message}");
                // Continue with default app name
            }
        }
        else
        {
            Console.Error.WriteLine("Warning: No foreground window detected");
        }

        // Try UI Automation first
        var axuiResult = TryGetSelectedTextFromUIAutomation(foregroundWindowHandle, appName);
        if (axuiResult.success)
        {
            PrintResult(axuiResult);
            return;
        }
        else
        {
            Console.Error.WriteLine($"UI Automation failed: {axuiResult.error}");
        }

        // Only try clipboard method if enabled
        if (clipboardEnabled)
        {
            Console.Error.WriteLine("Falling back to clipboard method");
            var clipboardResult = GetSelectedTextClipboard(foregroundWindowHandle, appName);
            if (clipboardResult.success)
            {
                PrintResult(clipboardResult);
                return;
            }

            // If clipboard fallback fails, return its error
            Console.Error.WriteLine($"Clipboard method failed: {clipboardResult.error}");
            PrintResult(clipboardResult);
            Environment.Exit(1);
        }
        else
        {
            Console.Error.WriteLine("Clipboard fallback is disabled by settings");
        }

        // If both fail, return error with last appName
        var failResult = new SelectionResult
        {
            success = false,
            selectedText = null,
            appName = appName,
            error = "No text selected and clipboard fallback disabled",
            type = "text"
        };
        PrintResult(failResult);
        Environment.Exit(1);
    }

    // Additional Win32 API declarations for window focus handling
    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool IsWindowEnabled(IntPtr hWnd);

    // Keyboard state handling for modifier keys
    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    // Constants for keyboard events and virtual key codes
    private const int VK_SHIFT = 0x10;
    private const int VK_CONTROL = 0x11;
    private const int VK_MENU = 0x12;   // Alt key
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const uint KEYEVENTF_KEYDOWN = 0x0000;

    // Special method to test UI Automation permissions without needing a foreground window
    static void TestUIAutomationPermissions()
    {
        try
        {
            // Try to access desktop element - this is a reliable way to test UI Automation permissions
            AutomationElement desktopElement = AutomationElement.RootElement;

            // If we can get some basic property from the desktop element, we have UI Automation access
            bool hasAccess = desktopElement != null && desktopElement.Current.Name != null;

            // Create a simple result object just for permission testing
            var result = new
            {
                success = true,
                hasUIAutomationAccess = hasAccess,
                isElevated = IsElevated(),
                error = hasAccess ? null : "Failed to access UI Automation"
            };

            var options = new JsonSerializerOptions
            {
                WriteIndented = true,
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
            };

            Console.WriteLine(JsonSerializer.Serialize(result, options));
        }
        catch (Exception ex)
        {
            // Handle any errors
            var errorResult = new
            {
                success = false,
                hasUIAutomationAccess = false,
                isElevated = IsElevated(),
                error = $"UI Automation test failed: {ex.GetType().Name}: {ex.Message}"
            };

            var options = new JsonSerializerOptions
            {
                WriteIndented = true,
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
            };

            Console.WriteLine(JsonSerializer.Serialize(errorResult, options));
        }
    }

    // Check if the application is running with elevated permissions
    private static bool IsElevated()
    {
        try
        {
            using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
            {
                WindowsPrincipal principal = new WindowsPrincipal(identity);
                return principal.IsInRole(WindowsBuiltInRole.Administrator);
            }
        }
        catch
        {
            return false;
        }
    }

    // Try to get selected text using UI Automation, return SelectionResult
    static SelectionResult TryGetSelectedTextFromUIAutomation(IntPtr foregroundWindowHandle, string appName)
    {
        var result = new SelectionResult();
        result.appName = appName;
        result.type = "text";
        try
        {
            if (foregroundWindowHandle == IntPtr.Zero)
            {
                result.success = false;
                result.selectedText = null;
                result.error = "No foreground window found";
                return result;
            }

            // Verify window is still valid and accessible
            if (!IsWindow(foregroundWindowHandle) || !IsWindowEnabled(foregroundWindowHandle))
            {
                result.success = false;
                result.selectedText = null;
                result.error = "Window is no longer valid or accessible";
                return result;
            }

            // Ensure window has focus (might help with permission issues)
            SetForegroundWindow(foregroundWindowHandle);
            Thread.Sleep(20);

            AutomationElement element = null;
            try {
                element = AutomationElement.FromHandle(foregroundWindowHandle);
            }
            catch (Exception automationEx) {
                result.success = false;
                result.selectedText = null;
                result.error = $"UI Automation access denied: {automationEx.Message}. " +
                              $"Elevated permissions: {IsElevated()}. Try running with administrator privileges.";
                return result;
            }

            if (element == null)
            {
                result.success = false;
                result.selectedText = null;
                result.error = "No AutomationElement found for window";
                return result;
            }

            // Try TextPattern
            object patternObj = null;
            try
            {
                if (element.TryGetCurrentPattern(TextPattern.Pattern, out patternObj))
                {
                    var textPattern = (TextPattern)patternObj;
                    var selection = textPattern.GetSelection();
                    if (selection != null && selection.Length > 0)
                    {
                        var text = selection[0].GetText(-1);
                        if (!string.IsNullOrEmpty(text))
                        {
                            result.success = true;
                            result.selectedText = text;
                            result.error = null;
                            return result;
                        }
                    }
                }
            }
            catch (Exception patternEx)
            {
                // Log pattern access error but continue trying other patterns
                Console.Error.WriteLine($"TextPattern access error: {patternEx.Message}");
            }

            // Try ValuePattern (for editable controls)
            try
            {
                if (element.TryGetCurrentPattern(ValuePattern.Pattern, out patternObj))
                {
                    var valuePattern = (ValuePattern)patternObj;
                    var text = valuePattern.Current.Value;
                    if (!string.IsNullOrEmpty(text))
                    {
                        result.success = true;
                        result.selectedText = text;
                        result.error = null;
                        return result;
                    }
                }
            }
            catch (Exception patternEx)
            {
                // Log pattern access error but continue
                Console.Error.WriteLine($"ValuePattern access error: {patternEx.Message}");
            }

            result.success = false;
            result.selectedText = null;
            result.error = "No text selected or attribute not available";
            return result;
        }
        catch (Exception ex)
        {
            result.success = false;
            result.selectedText = null;
            // More detailed error information
            result.error = $"UI Automation error: {ex.GetType().Name}: {ex.Message}";
            Console.Error.WriteLine($"UI Automation exception: {ex}");
            return result;
        }
    }

    // Simulate Ctrl+C, read clipboard, and restore clipboard, return SelectionResult
    static SelectionResult GetSelectedTextClipboard(IntPtr foregroundWindowHandle, string appName)
    {
        var result = new SelectionResult();
        result.appName = appName;
        result.type = "text";
        try
        {
            if (foregroundWindowHandle == IntPtr.Zero)
            {
                result.success = false;
                result.selectedText = null;
                result.error = "No foreground window found";
                return result;
            }

            // Ensure the window has focus before attempting to send keys
            if (!SetForegroundWindow(foregroundWindowHandle))
            {
                result.success = false;
                result.selectedText = null;
                result.error = "Failed to set focus to target window";
                return result;
            }

            Thread.Sleep(30);

            // Save old clipboard content
            string oldClipboard = null;
            try
            {
                if (Clipboard.ContainsText())
                    oldClipboard = Clipboard.GetText();
            }
            catch (Exception clipEx)
            {
                Console.Error.WriteLine($"Failed to access initial clipboard: {clipEx.Message}");
                // Continue anyway - we'll try to restore later if possible
            }

            // Check which modifier keys are currently pressed
            bool shiftPressed = (GetAsyncKeyState(VK_SHIFT) & 0x8000) != 0;
            bool ctrlPressed = (GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0;
            bool altPressed = (GetAsyncKeyState(VK_MENU) & 0x8000) != 0;

            // Simulate Ctrl+C - try multiple times in case of timing issues
            int retries = 3;
            string copiedText = null;

            while (retries > 0)
            {
                try
                {
                    // Temporarily reset modifier key states to avoid triggering other shortcuts
                    if (shiftPressed)
                        keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

                    if (ctrlPressed)
                        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

                    if (altPressed)
                        keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

                    // Small delay to allow the key state changes to take effect
                    Thread.Sleep(30);

                    // Send our own clean Ctrl+C without other modifiers interfering
                    SendKeys.SendWait("^c");
                    Thread.Sleep(150);

                    // Restore original modifier key states
                    if (shiftPressed)
                        keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero);

                    if (ctrlPressed)
                        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero);

                    if (altPressed)
                        keybd_event(VK_MENU, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero);

                    if (Clipboard.ContainsText())
                    {
                        copiedText = Clipboard.GetText();
                        if (!string.IsNullOrEmpty(copiedText))
                            break; // Successfully got text
                    }
                }
                catch (Exception sendKeysEx)
                {
                    Console.Error.WriteLine($"SendKeys or clipboard read error: {sendKeysEx.Message}");
                }

                retries--;
                if (retries > 0)
                    Thread.Sleep(25); // Minimal delay before retry
            }

            // Restore clipboard with better error handling
            try
            {
                Clipboard.Clear();
                if (!string.IsNullOrEmpty(oldClipboard))
                {
                    Clipboard.SetText(oldClipboard);
                    // Minimal verification delay
                    Thread.Sleep(20);
                    if (!Clipboard.ContainsText() || Clipboard.GetText() != oldClipboard)
                    {
                        Console.Error.WriteLine("Warning: Failed to restore original clipboard content");
                    }
                }
            }
            catch (Exception restoreEx)
            {
                Console.Error.WriteLine($"Failed to restore clipboard: {restoreEx.Message}");
                // Continue with result processing even if restore fails
            }

            // Only return success if clipboard changed and is non-empty
            if (!string.IsNullOrEmpty(copiedText) && copiedText != oldClipboard)
            {
                result.success = true;
                result.selectedText = copiedText;
                result.error = null;
                return result;
            }

            result.success = false;
            result.selectedText = null;
            result.error = "No text selected or clipboard unchanged";
            return result;
        }
        catch (Exception ex)
        {
            result.success = false;
            result.selectedText = null;
            // More detailed error information
            result.error = $"Clipboard error: {ex.GetType().Name}: {ex.Message}";
            Console.Error.WriteLine($"Clipboard exception: {ex}");
            return result;
        }
    }

    static void PrintResult(SelectionResult result)
    {
        try
        {
            var options = new JsonSerializerOptions
            {
                WriteIndented = true,
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
            };
            var json = JsonSerializer.Serialize(result, options);
            Console.WriteLine(json);
        }
        catch (Exception jsonEx)
        {
            // Fallback to manual JSON in case of serialization error
            Console.Error.WriteLine($"Error serializing result: {jsonEx.Message}");

            string manualJson = $@"{{
                ""success"": {result.success.ToString().ToLower()},
                ""selectedText"": {(result.selectedText != null ? $@"""{result.selectedText.Replace("\"", "\\\"").Replace("\n", "\\n")}""" : "null")},
                ""appName"": {(result.appName != null ? $@"""{result.appName.Replace("\"", "\\\"")}"" " : "null")},
                ""error"": {(result.error != null ? $@"""{result.error.Replace("\"", "\\\"").Replace("\n", "\\n")}""" : "null")},
                ""type"": ""text""
            }}";
            Console.WriteLine(manualJson);
        }
    }
}
