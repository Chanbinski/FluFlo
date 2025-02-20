import { franc } from 'franc-min';

// State Management
const state = {
    isEnabled: false,
    targetLangCode: '',
    sourceLangCodes: [],
    typingTimer: null
};

// Storage Management
const storage = {
    load: function() {
        chrome.storage.sync.get(['isEnabled', 'targetLangCode', 'sourceLangCodes'], (data) => {
            state.isEnabled = data.isEnabled;
            state.targetLangCode = data.targetLangCode;
            state.sourceLangCodes = data.sourceLangCodes || [];
        });
    }
};

// Message Handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'toggleTranslation':
            state.isEnabled = request.enabled;
            break;
        case 'updateLanguages':
            state.targetLangCode = request.targetLangCode;
            state.sourceLangCodes = request.sourceLangCodes;
            break;
    }
});

// UI Management
const ui = {
    createSuggestionDiv: function(element) {
        let suggestionDiv = element.parentElement.querySelector('.fluflo-suggestion');
        if (!suggestionDiv) {
            suggestionDiv = document.createElement('div');
            suggestionDiv.className = 'fluflo-suggestion';
            suggestionDiv.style.cssText = `
                position: fixed;
                background: white;
                border: 1px solid #ccc;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 14px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                z-index: 1000;
                display: none;
                max-width: 200px;
                word-wrap: break-word;
                cursor: pointer;
                user-select: none;
            `;
            document.body.appendChild(suggestionDiv);

            suggestionDiv.addEventListener('click', function() {
                const translation = this.dataset.translation;
                const originalWord = this.dataset.originalWord;
                
                // Get the element below the suggestion div
                const divRect = this.getBoundingClientRect();
                const elemBelow = document.elementFromPoint(
                    divRect.left,
                    divRect.bottom + 1
                );
                
                // Temporarily hide the suggestion div to get the correct element below
                const originalDisplay = this.style.display;
                this.style.display = 'none';
                const inputElement = document.elementFromPoint(
                    divRect.left,
                    divRect.bottom + 1
                );
                this.style.display = originalDisplay;
                
                if (translation && 
                    inputElement && 
                    (inputElement.tagName === 'INPUT' || inputElement.tagName === 'TEXTAREA')) {
                    textAnalysis.replaceLastWord(inputElement, translation, originalWord);
                    this.style.display = 'none';
                }
            });
        }
        return suggestionDiv;
    },

    updateSuggestionPosition: function(element, suggestionDiv) {
        const rect = element.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        
        // Get input coordinates
        const inputStyle = window.getComputedStyle(element);
        const paddingLeft = parseFloat(inputStyle.paddingLeft);
        const lineHeight = parseFloat(inputStyle.lineHeight);
        
        // Get cursor position
        const cursorPosition = element.selectionEnd;
        const text = element.value;
        const textBeforeCursor = text.substring(0, cursorPosition);
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines.length;
        const currentLineText = lines[lines.length - 1];
        
        // Create a temporary span to measure text width
        const span = document.createElement('span');
        span.style.cssText = `
            position: absolute;
            visibility: hidden;
            white-space: pre;
            font-family: ${inputStyle.fontFamily};
            font-size: ${inputStyle.fontSize};
            letter-spacing: ${inputStyle.letterSpacing};
        `;
        span.textContent = currentLineText;
        document.body.appendChild(span);
        
        // Calculate cursor coordinates
        const cursorX = rect.left + paddingLeft + span.offsetWidth;
        const cursorY = rect.top + (currentLine - 1) * lineHeight;
        
        document.body.removeChild(span);
        
        // Position the suggestion div
        suggestionDiv.style.left = `${cursorX + scrollX}px`;
        suggestionDiv.style.top = `${cursorY + scrollY - suggestionDiv.offsetHeight - 8}px`;
        
        // Ensure the suggestion stays within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const divRect = suggestionDiv.getBoundingClientRect();
        
        // Adjust horizontal position if off-screen
        if (divRect.right > viewportWidth) {
            suggestionDiv.style.left = `${viewportWidth - divRect.width - 10 + scrollX}px`;
        }
        
        // Adjust vertical position if off-screen
        if (divRect.top < 0) {
            // Place below the cursor if not enough space above
            suggestionDiv.style.top = `${cursorY + scrollY + lineHeight + 8}px`;
        }
    }
};

// Text Analysis
const textAnalysis = {
    handleInput: function(element, suggestionDiv) {
        if (!state.isEnabled) return;
        
        clearTimeout(state.typingTimer);
        
        const cursorAtEnd = element.selectionStart === element.value.length;
        if (!cursorAtEnd) {
            return;
        }
        
        state.typingTimer = setTimeout(async () => {
            const text = element.value;
            if (text.length > 0) {
                const words = text.trim().split(/\s+/);
                let lastWords = [];
                
                for (let i = words.length - 1; i >= 0; i--) {
                    const currentWord = words[i];
                    const detectedLang = franc(currentWord, { 
                        only: state.sourceLangCodes,
                        minLength: 1 
                    });
                    if (detectedLang !== state.targetLangCode && detectedLang !== 'und') {
                        lastWords.unshift(currentWord);
                    } else {
                        break;
                    }
                }
                
                if (lastWords.length > 0) {
                    const phraseToTranslate = lastWords.join(' ');
                    ui.updateSuggestionPosition(element, suggestionDiv);
                    
                    const inputId = Date.now().toString();
                    suggestionDiv.dataset.originalWord = phraseToTranslate;
                    suggestionDiv.dataset.inputId = inputId;
                    element.dataset.flufloId = inputId;

                    try {
                        // Send message to background script for translation
                        chrome.runtime.sendMessage({
                            action: 'analyzeText',
                            text: phraseToTranslate,
                            targetLanguage: state.targetLangCode
                        }, response => {
                            if (response.error) {
                                throw new Error(response.error);
                            }
                            const translation = response.translation;

                            // Update suggestion div with translation
                            suggestionDiv.textContent = translation;
                            suggestionDiv.dataset.translation = translation;
                            suggestionDiv.style.display = 'block';
                        });

                    } catch (error) {
                        console.error("Translation error:", error);
                        suggestionDiv.style.display = 'none';
                    }
                } else {
                    suggestionDiv.style.display = 'none';
                }
            }
        }, 1000);
    },

    replaceLastWord: function(element, translation, originalWord) {
        if (!originalWord) {
            return;
        }

        const text = element.value;
        const lastIndex = text.lastIndexOf(originalWord);
        
        if (lastIndex === -1) {
            return;
        }

        // Replace only the last occurrence of the word
        const newText = text.substring(0, lastIndex) + 
                       translation + 
                       text.substring(lastIndex + originalWord.length);
        
        element.value = newText;
        element.selectionStart = element.selectionEnd = newText.length;
    }
};

// Event Listeners
document.addEventListener('input', (e) => {
    const element = e.target;
    if (element.tagName === 'INPUT' || 
        element.tagName === 'TEXTAREA' ||
        element.tagName === 'CANVAS') {
        const suggestionDiv = ui.createSuggestionDiv(element);
        if (suggestionDiv) {
            suggestionDiv.style.display = 'none';
            textAnalysis.handleInput(element, suggestionDiv);
        }
    }
});

// Add keydown listener to hide suggestion when typing starts
document.addEventListener('keydown', (e) => {
    const element = e.target;
    if (element.tagName === 'INPUT' || 
        element.tagName === 'TEXTAREA' ||
        element.tagName === 'CANVAS') {
        const suggestionDiv = document.querySelector(`.fluflo-suggestion[data-input-id="${element.dataset.flufloId}"]`);
        if (suggestionDiv) {
            suggestionDiv.style.display = 'none';
        }
    }
});

// Initialize
storage.load();

