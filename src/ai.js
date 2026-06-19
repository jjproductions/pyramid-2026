const extractJsonFromText = (text) => {
  try {
    return JSON.parse(text);
  } catch (e) {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (match && match[1]) {
      try { return JSON.parse(match[1]); } catch(err) {}
    }
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const jsonString = text.substring(firstBracket, lastBracket + 1);
      try { return JSON.parse(jsonString); } catch(err) {}
    }
    throw new Error("Failed to parse JSON from AI response: " + text);
  }
};

export const generatePyramidBoard = async (playerInterests, settings = {}) => {
  const provider = settings.aiProvider || import.meta.env.VITE_AI_PROVIDER || 'local';
  const numCategories = settings.numCategories || 6;
  const numWords = (settings.numWordsPerCategory || 6) + 1; // Generate 1 extra word to allow passes
  const difficulty = settings.difficulty || 'medium';
  const tone = settings.tone || 'standard';
  
  let difficultyGuideline = "The words should be moderately challenging, requiring some thought but not overly obscure.";
  if (difficulty === 'easy') {
    difficultyGuideline = "The words should be very common, simple, and straightforward for a general audience (e.g. daily household objects, common animals).";
  } else if (difficulty === 'hard') {
    difficultyGuideline = "The words should be difficult, clever, and require abstract connections or advanced vocabulary.";
  }

  let toneGuideline = "Keep the categories and words clean, fun, and engaging, similar to the TV show.";
  if (tone === 'witty') {
    toneGuideline = "Use clever puns, double entendres, and lighthearted humor/wit in the category names and word choices.";
  } else if (tone === 'inside-joke') {
    toneGuideline = "Lean heavily into the player interests, making the categories feel like a customized trivia game with fun references to their hobbies and inside jokes.";
  }

  const systemPrompt = `You are a content generator for the game $25,000 Pyramid.
Your job is to generate exactly ${numCategories} categories, and each category must contain exactly ${numWords} words.
The words must be things that fit the category perfectly.

Difficulty: ${difficulty.toUpperCase()} - ${difficultyGuideline}
Tone: ${tone.toUpperCase()} - ${toneGuideline}

Generate some categories tailored to the following player interests, and some general fun categories:
Interests: ${playerInterests.join(', ')}

Output exactly this JSON format and absolutely nothing else:
[
  { "name": "Category Name", "description": "Category Description", "words": ["Word1", "Word2", "Word3", "Word4", "Word5", "Word6", "Word7"] },
  ...
]`;

  if (provider === 'local') {
    let url = settings.localUrl || import.meta.env.VITE_LOCAL_LLM_URL || 'http://localhost:11434/v1/chat/completions';
    
    // Automatically append the OpenAI compatibility path if the user just provided the base URL
    if (url.endsWith(':11434') || url.endsWith(':11434/')) {
      url = url.replace(/\/$/, '') + '/v1/chat/completions';
    } else if (url.endsWith(':1234') || url.endsWith(':1234/')) {
      // LM Studio default port
      url = url.replace(/\/$/, '') + '/v1/chat/completions';
    }
    
    const model = settings.localModel || import.meta.env.VITE_LOCAL_LLM_MODEL || 'llama3';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt }
        ],
        temperature: 0.7,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`Local LLM Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const content = data.choices[0].message.content;
    return extractJsonFromText(content);
    
  } else if (provider === 'gemini') {
    const apiKey = settings.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API key is missing. Please configure it in the Host Settings before generating AI categories.");
    
    const model = settings.geminiModel || 'gemini-1.5-flash-latest';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: systemPrompt }]
        }]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const content = data.candidates[0].content.parts[0].text;
    return extractJsonFromText(content);
  } else {
    throw new Error(`Unknown AI provider: ${provider}`);
  }
};
