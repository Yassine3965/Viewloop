// src/types/chrome.d.ts

// This file extends the global Window interface to include the `chrome` object,
// which is specific to Google Chrome and its extensions. This prevents
// TypeScript errors when accessing `window.chrome`.

declare global {
    interface Window {
      chrome?: {
        runtime: {
          id?: string;
          sendMessage: (
            extensionId: string,
            message: any,
            options?: object,
            responseCallback?: (response: any) => void
          ) => void;
          lastError?: {
            message?: string;
          };
        };
      };
    }
}
  
// This export statement is necessary to make this file a module.
export {};
    