// TextSelectionService.js
// Handles all text selection logic from hotkeys and clipboard
import logService from './LogService.js';

interface TextSelectionCallbacks {
  showChatPopup?: (_position: any, _initialMessages: any) => void;
  getPopupPosition?: () => any;
}

class TextSelectionService {
  private callbacks: TextSelectionCallbacks;

  constructor(callbacks: TextSelectionCallbacks) {
    this.callbacks = callbacks || {};
  }

  // Handle text selection from hotkeys or clipboard
  handleTextSelection(text, customPrompt = null, source = 'hotkey') {
    logService.debug(`Processing text from ${source}:`, text);

    // Use custom prompt if provided, otherwise use default
    const prompt = customPrompt || '';

    // Create the chat message
    const initialMessages = [
      { role: 'system', content: `${prompt}` },
      { role: 'user', content: `${text}` },
    ];

    // Show chat popup and send the message
    this.showChatPopupWithMessage(initialMessages);
  }

  // Show chat popup and send initial message
  showChatPopupWithMessage(initialMessages) {
    if (typeof this.callbacks.showChatPopup === 'function') {
      // Get position from callback
      const position = this.callbacks.getPopupPosition
        ? this.callbacks.getPopupPosition()
        : { x: 0, y: 0 };

      // Show chat popup
      this.callbacks.showChatPopup(position, initialMessages);
    } else {
      const error = new Error('No showChatPopup callback provided');
      logService.error(error.message, error);
    }
  }
}

export default TextSelectionService;
