export const electronService = {
  closeChatPopup: () => {
    if (typeof window !== 'undefined' && window.electronAPI?.closeChatPopup) {
      window.electronAPI.closeChatPopup();
    }
  },
};
