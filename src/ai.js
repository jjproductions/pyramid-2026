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

export const generatePyramidBoard = async (playerInterests) => {
  const provider = import.meta.env.VITE_AI_PROVIDER || 'local';
  
  const systemPrompt = `You are a content generator for the game $25,000 Pyramid.
Your job is to generate exactly 6 categories, and each category must contain exactly 7 words.
The words must be things that fit the category perfectly.
Generate some categories tailored to the following player interests, and some general fun categories:
Interests: ${playerInterests.join(', ')}

Output exactly this JSON format and absolutely nothing else:
[
  { "name": "Category Name", "description": "Category Description", "words": ["Word1", "Word2", "Word3", "Word4", "Word5", "Word6", "Word7"] },
  ...
]`;

  if (provider === 'local') {
    let url = import.meta.env.VITE_LOCAL_LLM_URL || 'http://localhost:11434/v1/chat/completions';
    
    // Automatically append the OpenAI compatibility path if the user just provided the base URL
    if (url.endsWith(':11434') || url.endsWith(':11434/')) {
      url = url.replace(/\/$/, '') + '/v1/chat/completions';
    } else if (url.endsWith(':1234') || url.endsWith(':1234/')) {
      // LM Studio default port
      url = url.replace(/\/$/, '') + '/v1/chat/completions';
    }
    
    const model = import.meta.env.VITE_LOCAL_LLM_MODEL || 'llama3';
    
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
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API key is missing");
    
    // Using standard Gemini REST endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
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
