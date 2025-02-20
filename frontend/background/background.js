chrome.runtime.onInstalled.addListener(() => {
  console.log('Fluflo installed');

  chrome.storage.sync.set({ isEnabled: true }, () => {
    console.log('Translation feature enabled by default.');
  });
}); 

const API_ENDPOINT = 'https://fluflo.onrender.com/api/chat';  // Your backend server endpoint

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request);
  
  if (request.action === 'analyzeText') {
    console.log('Analyzing text:', request.text);
    analyzeText(request.text, request.targetLanguage)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Required for async response
  }
});

async function analyzeText(text, targetLanguage) {
  const systemPrompt = `You are a helpful translation assistant. Translate text to ${targetLanguage} naturally and accurately.`;
  const userPrompt = `Translate this text into ${targetLanguage}: "${text}"
  Respond only with the translation, no explanations or additional text, without quotes or punctuation.`;

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    // The server returns the message directly from OpenAI's response
    const translation = data.content.trim();
    
    return {
      translation: translation
    };

  } catch (error) {
    console.error('Error analyzing text:', error);
    throw error;
  }
} 