using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows.Automation;
using System.Windows.Forms;
using System.Threading;

class SelectionResult
{
    public bool success { get; set; }
    public string selectedText { get; set; }
    public string appName { get; set; }
    public string error { get; set; }
    public string type { get; set; } = "text";
    public string source { get; set; }
}

class Program
{
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    // For precise key simulation and modifier control
    [DllImport("user32.dll")]
    private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    // Detect clipboard updates reliably
    [DllImport("user32.dll")]
    private static extern uint GetClipboardSequenceNumber();

    private const int VK_CONTROL = 0x11;
    private const int VK_SHIFT = 0x10;
    private const int VK_MENU = 0x12; // Alt
    private const int VK_C = 0x43;    // 'C'
    private const uint KEYEVENTF_KEYDOWN = 0x0000;
    private const uint KEYEVENTF_KEYUP = 0x0002;

    [STAThread]
    static void Main(string[] args)
    {
        // Default behavior: clipboard fallback enabled unless explicitly disabled
        bool clipboardEnabled = true;
        if (args != null && args.Length > 0)
        {
            if (bool.TryParse(args[0], out bool parsed))
            {
                clipboardEnabled = parsed;
            }
        }

        IntPtr hwnd = GetForegroundWindow();
        string appName = GetAppName(hwnd);

        string selected = TryGetSelectedTextFromUIAutomation();
        string error = null;
        string source = null;

        if (string.IsNullOrEmpty(selected))
        {
            if (clipboardEnabled)
            {
                selected = TryGetSelectedTextViaClipboard(hwnd, out error);
                if (!string.IsNullOrEmpty(selected)) source = "clipboard";
            }
            else
            {
                error = "Clipboard fallback disabled";
                source = "disabled";
            }
        }
        else
        {
            source = "uia";
        }

        var result = new SelectionResult
        {
            success = !string.IsNullOrEmpty(selected),
            selectedText = string.IsNullOrEmpty(selected) ? null : selected,
            appName = appName,
            error = string.IsNullOrEmpty(selected) ? (error ?? "No selection detected") : null,
            type = "text",
            source = source
        };

        PrintResult(result);
    }

    static string GetAppName(IntPtr hwnd)
    {
        if (hwnd == IntPtr.Zero) return "Unknown";
        try
        {
            GetWindowThreadProcessId(hwnd, out uint pid);
            var proc = Process.GetProcessById((int)pid);
            return proc.MainModule?.ModuleName ?? proc.ProcessName ?? "Unknown";
        }
        catch
        {
            return "Unknown";
        }
    }

    // UI Automation: read selected text from the focused element only.
    static string TryGetSelectedTextFromUIAutomation()
    {
        try
        {
            AutomationElement focused = AutomationElement.FocusedElement;
            if (focused == null) return null;

            if (focused.TryGetCurrentPattern(TextPattern.Pattern, out object patObj))
            {
                var tp = (TextPattern)patObj;
                var ranges = tp.GetSelection();
                if (ranges != null && ranges.Length > 0)
                {
                    string text = ranges[0]?.GetText(-1);
                    return string.IsNullOrEmpty(text) ? null : text;
                }
            }
        }
        catch
        {
            // Ignore and fall back
        }
        return null;
    }

    // Clipboard fallback: send a single Ctrl+C and read clipboard once; restore previous content.
    static string TryGetSelectedTextViaClipboard(IntPtr hwnd, out string error)
    {
        error = null;
        try
        {
            // Do not change foreground window here to avoid stealing focus from the caller.

            string original = null;
            bool hadOriginal = false;
            uint originalSeq = 0;
            try
            {
                if (Clipboard.ContainsText())
                {
                    original = Clipboard.GetText();
                    hadOriginal = true;
                }
                // Track clipboard change via global sequence number
                originalSeq = GetClipboardSequenceNumber();
            }
            catch { /* ignore */ }

            // Ensure keystrokes go to the original app with the selection
            if (hwnd != IntPtr.Zero)
            {
                try { SetForegroundWindow(hwnd); } catch { /* ignore */ }
            }

            // Send Ctrl+C using keybd_event to avoid interacting with external modifier states
            try
            {
                // Ensure modifiers like Shift/Alt do not affect the copy combination
                keybd_event((byte)VK_SHIFT, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                keybd_event((byte)VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

                // Press Ctrl down, send 'C', then release Ctrl
                keybd_event((byte)VK_CONTROL, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero);
                Thread.Sleep(10);
                keybd_event((byte)VK_C, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero);
                keybd_event((byte)VK_C, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                Thread.Sleep(10);
                keybd_event((byte)VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

                // As a final guard, force-release Shift/Alt to avoid stuck modifier states
                keybd_event((byte)VK_SHIFT, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                keybd_event((byte)VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            }
            catch (Exception e)
            {
                error = $"Failed to send copy: {e.Message}";
            }

            string copied = null;
            try
            {
                // Wait for clipboard to change (apps update asynchronously)
                var sw = Stopwatch.StartNew();
                bool changed = false;
                uint timeoutMs = 700; // generous but snappy
                uint lastSeq = originalSeq;

                while (sw.ElapsedMilliseconds < timeoutMs)
                {
                    uint currentSeq = GetClipboardSequenceNumber();
                    if (currentSeq != lastSeq)
                    {
                        changed = true;
                        break;
                    }
                    Thread.Sleep(15);
                }

                // If we saw a change (or even if we didn't, try once), read clipboard
                // A short extra delay can help apps that post on the UI thread
                if (!changed)
                {
                    Thread.Sleep(50);
                }

                if (Clipboard.ContainsText())
                {
                    // Prefer Unicode text if available
                    copied = Clipboard.GetText(TextDataFormat.UnicodeText);
                    if (string.IsNullOrEmpty(copied))
                    {
                        copied = Clipboard.GetText();
                    }
                }
            }
            catch (Exception e)
            {
                error = $"Failed to read clipboard: {e.Message}";
            }

            // Restore clipboard to original state
            try
            {
                if (hadOriginal)
                {
                    Clipboard.SetText(original);
                }
                else
                {
                    Clipboard.Clear();
                }
            }
            catch { /* ignore restore errors */ }

            if (string.IsNullOrEmpty(copied))
            {
                error ??= "Clipboard empty";
                return null;
            }
            // Return whatever was copied; do not treat equality with original as failure.
            return copied;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return null;
        }
    }

    static void PrintResult(SelectionResult result)
    {
        var options = new JsonSerializerOptions
        {
            WriteIndented = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
        Console.WriteLine(JsonSerializer.Serialize(result, options));
    }
}
