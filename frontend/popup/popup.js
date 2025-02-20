import { SUPPORTED_LANGUAGES, LANGUAGE_CODES } from '../languages.js';

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const elements = {
        toggle: {
            checkbox: document.getElementById('toggleTranslation'),
            switch: document.querySelector('.toggle-switch')
        },
        single: {
            container: document.getElementById('single-select-container'),
            input: document.querySelector('#single-select-container .select-input'),
            dropdown: document.querySelector('#single-select-container .select-dropdown'),
            selected: document.getElementById('selected-single-item'),
            placeholder: document.querySelector('#single-select-container .select-placeholder')
        },
        multi: {
            container: document.getElementById('multi-select-container'),
            input: document.querySelector('#multi-select-container .select-input'),
            dropdown: document.querySelector('#multi-select-container .select-dropdown'),
            selected: document.getElementById('selected-items'),
            placeholder: document.querySelector('#multi-select-container .select-placeholder')
        }
    };

    // Helper Functions
    function updateToggleState(isEnabled) {
        // Get current language selections
        const targetLanguage = elements.single.selected.querySelector('.selected-item span')?.textContent;
        const sourceLanguages = Array.from(elements.multi.selected.querySelectorAll('.selected-item span'))
            .map(span => span.textContent);

        // Only allow toggle if both target and source languages are selected
        const canEnable = targetLanguage && sourceLanguages.length > 0;
        
        if (!canEnable && isEnabled) {
            // Update placeholder messages based on what's missing
            if (!targetLanguage) {
                elements.single.placeholder.textContent = 'Select a target language';
                elements.single.placeholder.style.color = '#ff6b6b';
            }
            if (sourceLanguages.length === 0) {
                elements.multi.placeholder.textContent = 'Select source languages';
                elements.multi.placeholder.style.color = '#ff6b6b';
            }
            
            // Reset toggle state
            elements.toggle.checkbox.checked = false;
            elements.toggle.switch.classList.add('disabled');
            chrome.storage.sync.set({ isEnabled: false });
        } else if (canEnable) {
            // Only update if languages are selected
            elements.toggle.switch.classList.toggle('disabled', !isEnabled);
            elements.toggle.checkbox.checked = isEnabled;
            chrome.storage.sync.set({ isEnabled: isEnabled });
            
            // Reset placeholder texts and colors
            elements.single.placeholder.textContent = 'Select target language';
            elements.multi.placeholder.textContent = 'Select source languages';
            elements.single.placeholder.style.color = '';
            elements.multi.placeholder.style.color = '';
        }
    }

    function updateSingleSelection(value) {
        if (!elements.single.selected) return;
        elements.single.selected.innerHTML = '';
        elements.single.placeholder.style.display = 'none';
        
        const item = document.createElement('div');
        item.className = 'selected-item';
        item.innerHTML = `
            <span>${value}</span>
            <button type="button" class="remove-btn">x</button>
        `;
        
        item.querySelector('.remove-btn').addEventListener('click', function(e) {
            clearSingleSelection();
            savePickerStates();
            e.stopPropagation();
        });
        
        elements.single.selected.appendChild(item);
    }

    function clearSingleSelection() {
        elements.single.selected.innerHTML = '';
        elements.single.placeholder.style.display = 'block';
        elements.single.placeholder.textContent = 'Select target language';
        elements.single.placeholder.style.color = '';  // Reset color
        updateToggleState(false);
        savePickerStates();
    }

    function addMultiSelectedItem(value) {
        const item = document.createElement('div');
        item.className = 'selected-item';
        item.innerHTML = `
            <span>${value}</span>
            <button type="button" class="remove-btn">x</button>
        `;
        
        item.querySelector('.remove-btn').addEventListener('click', function(e) {
            item.remove();
            updateMultiPlaceholder();
            savePickerStates();
            e.stopPropagation();
        });
        
        elements.multi.selected.appendChild(item);
    }

    function updateMultiPlaceholder() {
        elements.multi.placeholder.style.display = 
            elements.multi.selected.children.length > 0 ? 'none' : 'block';
    }

    function isItemSelectedInSingle(value) {
        const selectedItem = elements.single.selected.querySelector('.selected-item span');
        return selectedItem && selectedItem.textContent === value;
    }

    function isItemSelectedInMulti(value) {
        return Array.from(elements.multi.selected.querySelectorAll('.selected-item span'))
            .some(span => span.textContent === value);
    }

    function removeFromMultiSelect(value) {
        const items = elements.multi.selected.querySelectorAll('.selected-item');
        for (let item of items) {
            if (item.querySelector('span').textContent === value) {
                item.remove();
                updateMultiPlaceholder();
                if (elements.multi.selected.querySelectorAll('.selected-item').length === 0) {
                    elements.multi.placeholder.textContent = 'Select source languages';
                    elements.multi.placeholder.style.color = '';  // Reset color
                    updateToggleState(false);
                }
                savePickerStates();
                break;
            }
        }
    }

    function savePickerStates() {
        const singleLanguageName = elements.single.selected.querySelector('.selected-item span')?.textContent;
        const targetLangCode = LANGUAGE_CODES[singleLanguageName];

        const sourceLangCodes = Array.from(elements.multi.selected.querySelectorAll('.selected-item span'))
            .map(span => LANGUAGE_CODES[span.textContent]);
        
        // Save to chrome storage
        chrome.storage.sync.set({ 
            targetLangCode, 
            sourceLangCodes,
            isEnabled: elements.toggle.checkbox.checked
        }, () => {
            // Notify content script of the change
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'updateLanguages',
                    targetLangCode,
                    sourceLangCodes,
                    isEnabled: elements.toggle.checkbox.checked
                });
            });
        });
    }

    function populateDropdowns() {
        [elements.single.dropdown, elements.multi.dropdown].forEach(dropdown => {
            dropdown.innerHTML = '';
            console.log(SUPPORTED_LANGUAGES);
            Object.entries(SUPPORTED_LANGUAGES).forEach(([code, name]) => {
                const option = document.createElement('div');
                option.className = 'select-option';
                option.dataset.value = code;
                option.textContent = name;
                dropdown.appendChild(option);
            });
        });
    }

    // Initialize
    populateDropdowns();

    // Load saved states
    chrome.storage.sync.get(['isEnabled', 'targetLangCode', 'sourceLangCodes'], (data) => {
        if (data.targetLangCode) {
            updateSingleSelection(SUPPORTED_LANGUAGES[data.targetLangCode]);
        }
        if (data.sourceLangCodes && Array.isArray(data.sourceLangCodes)) {
            data.sourceLangCodes.forEach(code => {
                addMultiSelectedItem(SUPPORTED_LANGUAGES[code]);
            });
            updateMultiPlaceholder();
        }

        // Load toggle state after languages are set
        const isEnabled = data.isEnabled;
        if (elements.toggle.checkbox) {
            elements.toggle.checkbox.checked = isEnabled;
            updateToggleState(isEnabled);
        }
    });

    // Update toggle event listener
    if (elements.toggle.checkbox) {
        elements.toggle.checkbox.addEventListener('change', () => {
            const isEnabled = elements.toggle.checkbox.checked;
            updateToggleState(isEnabled);
            savePickerStates();
        });
    }

    // Add event listeners
    elements.single.input.addEventListener('click', function(e) {
        elements.single.dropdown.classList.toggle('show');
        elements.single.input.classList.toggle('active');
        e.stopPropagation();
    });

    elements.multi.input.addEventListener('click', function(e) {
        elements.multi.dropdown.classList.toggle('show');
        elements.multi.input.classList.toggle('active');
        e.stopPropagation();
    });

    // Add click listeners for options
    elements.single.dropdown.addEventListener('click', function(e) {
        const option = e.target.closest('.select-option');
        if (option) {
            const code = option.dataset.value;
            const name = SUPPORTED_LANGUAGES[code];
            
            if (isItemSelectedInMulti(name)) {
                removeFromMultiSelect(name);
                updateMultiPlaceholder();
            }
            
            updateSingleSelection(name);
            elements.single.dropdown.classList.remove('show');
            elements.single.input.classList.remove('active');
            savePickerStates();
            e.stopPropagation();
        }
    });

    elements.multi.dropdown.addEventListener('click', function(e) {
        const option = e.target.closest('.select-option');
        if (option) {
            const code = option.dataset.value;
            const name = SUPPORTED_LANGUAGES[code];
            
            if (isItemSelectedInSingle(name)) {
                clearSingleSelection();
            }
            
            if (!isItemSelectedInMulti(name)) {
                addMultiSelectedItem(name);
                updateMultiPlaceholder();
                savePickerStates();
            }
            e.stopPropagation();
        }
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function() {
        elements.single.dropdown.classList.remove('show');
        elements.multi.dropdown.classList.remove('show');
        elements.single.input.classList.remove('active');
        elements.multi.input.classList.remove('active');
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const simpleSelect = document.getElementById('simple-single-select');
    const selectSelected = simpleSelect.querySelector('.select-selected');
    const selectItems = simpleSelect.querySelector('.select-items');

    selectSelected.addEventListener('click', function() {
        selectItems.classList.toggle('select-hide');
    });

    selectItems.addEventListener('click', function(event) {
        if (event.target && event.target.nodeName === "DIV") {
            const selectedValue = event.target.getAttribute('data-value');
            selectSelected.textContent = selectedValue;
            selectItems.classList.add('select-hide');
        }
    });

    // Close the dropdown if the user clicks outside of it
    document.addEventListener('click', function(event) {
        if (!simpleSelect.contains(event.target)) {
            selectItems.classList.add('select-hide');
        }
    });
});