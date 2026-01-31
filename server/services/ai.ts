/**
 * AI Service - LLM integration for agent reasoning
 * Supports Anthropic Claude and OpenAI
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { settingsService } from './settings';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  tokensUsed?: number;
}

export class AIService {
  private static instance: AIService;
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Initialize AI clients based on settings
   */
  private async getClient(): Promise<{ provider: string; anthropic?: Anthropic; openai?: OpenAI } | null> {
    const settings = await settingsService.getSettings();

    if (!settings.aiEnabled || !settings.aiApiKey) {
      return null;
    }

    if (settings.aiProvider === 'anthropic') {
      if (!this.anthropic) {
        this.anthropic = new Anthropic({ apiKey: settings.aiApiKey });
      }
      return { provider: 'anthropic', anthropic: this.anthropic };
    }

    if (settings.aiProvider === 'openai') {
      if (!this.openai) {
        this.openai = new OpenAI({ apiKey: settings.aiApiKey });
      }
      return { provider: 'openai', openai: this.openai };
    }

    return null;
  }

  /**
   * Check if AI is enabled and configured
   */
  async isEnabled(): Promise<boolean> {
    const settings = await settingsService.getSettings();
    return settings.aiEnabled && !!settings.aiApiKey;
  }

  /**
   * Send a chat completion request
   */
  async chat(messages: AIMessage[], systemPrompt?: string): Promise<AIResponse | null> {
    const client = await this.getClient();
    if (!client) return null;

    const settings = await settingsService.getSettings();

    try {
      if (client.provider === 'anthropic' && client.anthropic) {
        const response = await client.anthropic.messages.create({
          model: settings.aiModel || 'claude-sonnet-4-20250514',
          max_tokens: settings.aiMaxTokens || 1024,
          system: systemPrompt || 'You are a helpful trading assistant.',
          messages: messages.map(m => ({
            role: m.role === 'system' ? 'user' : m.role,
            content: m.content,
          })),
        });

        const textContent = response.content.find(c => c.type === 'text');
        return {
          content: textContent?.text || '',
          model: response.model,
          tokensUsed: response.usage?.output_tokens,
        };
      }

      if (client.provider === 'openai' && client.openai) {
        const allMessages = systemPrompt
          ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
          : messages;

        const response = await client.openai.chat.completions.create({
          model: settings.aiModel || 'gpt-4',
          max_tokens: settings.aiMaxTokens || 1024,
          temperature: settings.aiTemperature || 0.7,
          messages: allMessages,
        });

        return {
          content: response.choices[0]?.message?.content || '',
          model: response.model,
          tokensUsed: response.usage?.total_tokens,
        };
      }
    } catch (error) {
      console.error('AI request failed:', error);
      throw error;
    }

    return null;
  }

  /**
   * Analyze market data and provide trading insight
   */
  async analyzeMarket(data: {
    price: number;
    change24h: number;
    technicalSummary: any;
    positions: any[];
  }): Promise<AIResponse | null> {
    const systemPrompt = `You are an expert Bitcoin trader analyzing LN Markets data.
Provide concise, actionable analysis. Be direct and specific.
Focus on: entry/exit points, risk levels, and confidence.
Keep responses under 200 words.`;

    const messages: AIMessage[] = [{
      role: 'user',
      content: `Analyze this market data and provide trading insight:

Current BTC Price: $${data.price.toLocaleString()}
24h Change: ${data.change24h.toFixed(2)}%

Technical Summary:
${JSON.stringify(data.technicalSummary, null, 2)}

Open Positions: ${data.positions.length}
${data.positions.map(p => `- ${p.side}: ${p.margin} sats @ $${p.entryPrice}, P&L: ${p.pl} sats`).join('\n')}

What's your analysis and recommendation?`,
    }];

    return this.chat(messages, systemPrompt);
  }

  /**
   * Get AI opinion on a trade proposal
   */
  async evaluateTrade(proposal: {
    direction: 'long' | 'short';
    confidence: number;
    reason: string;
    marketData: any;
    riskAssessment: any;
  }): Promise<{
    opinion: 'approve' | 'reject' | 'neutral';
    confidence: number;
    reason: string;
  }> {
    const enabled = await this.isEnabled();
    if (!enabled) {
      return {
        opinion: 'neutral',
        confidence: 50,
        reason: 'AI not enabled',
      };
    }

    const systemPrompt = `You are a trading risk analyst. Evaluate trade proposals and respond in JSON format only.
Your response must be valid JSON with exactly these fields:
{"opinion": "approve|reject|neutral", "confidence": 0-100, "reason": "brief explanation"}`;

    const messages: AIMessage[] = [{
      role: 'user',
      content: `Evaluate this trade proposal:

Direction: ${proposal.direction.toUpperCase()}
Proposer Confidence: ${proposal.confidence}%
Reason: ${proposal.reason}

Market Data:
${JSON.stringify(proposal.marketData, null, 2)}

Risk Assessment:
${JSON.stringify(proposal.riskAssessment, null, 2)}

Respond with JSON only.`,
    }];

    try {
      const response = await this.chat(messages, systemPrompt);
      if (response?.content) {
        // Try to parse JSON from response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            opinion: parsed.opinion || 'neutral',
            confidence: parsed.confidence || 50,
            reason: parsed.reason || response.content,
          };
        }
      }
    } catch (error) {
      console.error('AI trade evaluation failed:', error);
    }

    return {
      opinion: 'neutral',
      confidence: 50,
      reason: 'AI evaluation failed',
    };
  }

  /**
   * Generate a chat response for the swarm
   */
  async generateAgentResponse(
    agentName: string,
    agentRole: string,
    query: string,
    context: any
  ): Promise<string | null> {
    const enabled = await this.isEnabled();
    if (!enabled) return null;

    const systemPrompt = `You are ${agentName}, a ${agentRole} in a Bitcoin trading swarm.
You analyze data and provide insights based on your specialty.
Be concise, direct, and use trading terminology appropriately.
Format responses in markdown for readability.`;

    const messages: AIMessage[] = [{
      role: 'user',
      content: `Query: ${query}

Your current data:
${JSON.stringify(context, null, 2)}

Provide your analysis as ${agentName}.`,
    }];

    const response = await this.chat(messages, systemPrompt);
    return response?.content || null;
  }

  /**
   * Generate swarm discussion on a topic
   */
  async facilitateDiscussion(
    topic: string,
    agentInputs: { agentId: string; name: string; analysis: any }[]
  ): Promise<string | null> {
    const enabled = await this.isEnabled();
    if (!enabled) return null;

    const systemPrompt = `You are the swarm coordinator summarizing agent discussions.
Synthesize the inputs from all agents into a coherent trading recommendation.
Be objective, weigh different perspectives, and provide a clear conclusion.`;

    const agentSummaries = agentInputs.map(a => 
      `**${a.name}**: ${JSON.stringify(a.analysis)}`
    ).join('\n\n');

    const messages: AIMessage[] = [{
      role: 'user',
      content: `Topic: ${topic}

Agent Inputs:
${agentSummaries}

Synthesize these perspectives into a unified trading recommendation.`,
    }];

    const response = await this.chat(messages, systemPrompt);
    return response?.content || null;
  }

  /**
   * Clear cached clients (call when settings change)
   */
  clearClients(): void {
    this.anthropic = null;
    this.openai = null;
  }
}

export const aiService = AIService.getInstance();
