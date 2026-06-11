const { Anthropic } = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

class TokenRouter {
  constructor(maxTokens = 6000) {
    this.maxTokens = maxTokens;
  }

  async claude(prompt) {
    try {
      const trimmedPrompt = this.trimPrompt(prompt);
      const response = await anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        messages: [{ role: 'user', content: trimmedPrompt }],
      });
      return response.content[0].text;
    } catch (error) {
      console.error('Claude API error:', error);
      // Fallback to Gemini
      return this.gemini(prompt);
    }
  }

  async gemini(prompt) {
    try {
      const trimmedPrompt = this.trimPrompt(prompt);
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(trimmedPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini API error:', error);
      return 'Error: Unable to generate response from both models.';
    }
  }

  estimateTokens(text) {
    // A rough estimate of token count
    return Math.ceil(text.length / 4);
  }

  trimPrompt(prompt) {
    let tokens = this.estimateTokens(prompt);
    if (tokens > this.maxTokens) {
      const excessTokens = tokens - this.maxTokens;
      const excessChars = excessTokens * 4;
      return prompt.substring(excessChars);
    }
    return prompt;
  }
}

module.exports = TokenRouter;
