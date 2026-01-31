/**
 * Swarm Chat - Human interaction with the agent swarm
 * Routes messages to appropriate agents, aggregates responses
 */

import { EventEmitter } from 'events';
import { getMessageBus, type AgentMessage, type MessageBus } from './message-bus';

export interface ChatMessage {
  id: string;
  timestamp: Date;
  role: 'user' | 'agent' | 'system';
  agentId?: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastActivityAt: Date;
}

export interface AgentCapability {
  agentId: string;
  name: string;
  description: string;
  canAnswer: (query: string) => boolean;
}

export class SwarmChat extends EventEmitter {
  private messageBus: MessageBus;
  private sessions: Map<string, ChatSession> = new Map();
  private agentCapabilities: Map<string, AgentCapability> = new Map();
  private responseTimeoutMs = 10000;
  private pendingResponses: Map<string, {
    resolve: (responses: ChatMessage[]) => void;
    responses: ChatMessage[];
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor() {
    super();
    this.messageBus = getMessageBus();
    this.setupDefaultCapabilities();
    this.listenForResponses();
  }

  private setupDefaultCapabilities(): void {
    // Market Analyst
    this.registerAgent({
      agentId: 'market-analyst',
      name: 'Market Analyst',
      description: 'Technical analysis, chart patterns, support/resistance, indicators',
      canAnswer: (q) => {
        const keywords = ['analysis', 'technical', 'chart', 'rsi', 'macd', 'trend', 
          'support', 'resistance', 'indicator', 'pattern', 'bullish', 'bearish',
          'price', 'market', 'signal'];
        return keywords.some(k => q.toLowerCase().includes(k));
      },
    });

    // Risk Manager
    this.registerAgent({
      agentId: 'risk-manager',
      name: 'Risk Manager',
      description: 'Position sizing, exposure, stop-loss, risk assessment',
      canAnswer: (q) => {
        const keywords = ['risk', 'position', 'size', 'exposure', 'stop', 'loss',
          'margin', 'leverage', 'drawdown', 'limit', 'safe'];
        return keywords.some(k => q.toLowerCase().includes(k));
      },
    });

    // Execution Agent
    this.registerAgent({
      agentId: 'execution',
      name: 'Execution Agent',
      description: 'Trade execution, orders, positions, open/close trades',
      canAnswer: (q) => {
        const keywords = ['trade', 'execute', 'order', 'position', 'open', 'close',
          'buy', 'sell', 'long', 'short', 'entry', 'exit'];
        return keywords.some(k => q.toLowerCase().includes(k));
      },
    });

    // Researcher
    this.registerAgent({
      agentId: 'researcher',
      name: 'Market Researcher',
      description: 'News, sentiment, on-chain data, fundamentals',
      canAnswer: (q) => {
        const keywords = ['news', 'sentiment', 'onchain', 'on-chain', 'funding',
          'volume', 'whale', 'exchange', 'flow', 'fundamental'];
        return keywords.some(k => q.toLowerCase().includes(k));
      },
    });

    // TradingView
    this.registerAgent({
      agentId: 'tradingview',
      name: 'TradingView Signals',
      description: 'TradingView technical analysis signals',
      canAnswer: (q) => {
        const keywords = ['tradingview', 'tv', 'external', 'signal'];
        return keywords.some(k => q.toLowerCase().includes(k));
      },
    });
  }

  private listenForResponses(): void {
    this.messageBus.on('type:response', (message: AgentMessage) => {
      if (message.replyTo && this.pendingResponses.has(message.replyTo)) {
        const pending = this.pendingResponses.get(message.replyTo)!;
        pending.responses.push({
          id: message.id,
          timestamp: message.timestamp,
          role: 'agent',
          agentId: message.from,
          content: typeof message.content === 'string' 
            ? message.content 
            : JSON.stringify(message.content, null, 2),
        });
      }
    });
  }

  // ============ AGENT REGISTRATION ============

  registerAgent(capability: AgentCapability): void {
    this.agentCapabilities.set(capability.agentId, capability);
  }

  unregisterAgent(agentId: string): void {
    this.agentCapabilities.delete(agentId);
  }

  // ============ CHAT API ============

  /**
   * Send a message to the swarm and get responses
   */
  async chat(
    message: string, 
    sessionId?: string,
    options?: { timeout?: number; waitForAll?: boolean }
  ): Promise<{
    sessionId: string;
    responses: ChatMessage[];
    targetedAgents: string[];
  }> {
    // Get or create session
    const session = this.getOrCreateSession(sessionId);
    
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      timestamp: new Date(),
      role: 'user',
      content: message,
    };
    session.messages.push(userMessage);
    session.lastActivityAt = new Date();

    // Determine which agents should respond
    const targetedAgents = this.routeMessage(message);

    if (targetedAgents.length === 0) {
      // No specific agent matched - ask all
      targetedAgents.push(...Array.from(this.agentCapabilities.keys()));
    }

    // Send to message bus
    const busMessage = this.messageBus.send({
      from: 'human',
      to: targetedAgents,
      type: 'chat',
      content: message,
      topic: 'chat',
      metadata: { sessionId: session.id },
    });

    // Wait for responses
    const responses = await this.waitForResponses(
      busMessage.id, 
      targetedAgents.length,
      options?.timeout || this.responseTimeoutMs
    );

    // Add responses to session
    session.messages.push(...responses);

    this.emit('chat', { session, userMessage, responses });

    return {
      sessionId: session.id,
      responses,
      targetedAgents,
    };
  }

  /**
   * Ask a specific question to the swarm (for trade decisions)
   */
  async askForTradeOpinion(
    direction: 'long' | 'short',
    context?: string
  ): Promise<{
    opinions: Array<{
      agentId: string;
      opinion: 'approve' | 'reject' | 'neutral';
      confidence: number;
      reason: string;
    }>;
    consensus: 'go' | 'no-go' | 'split';
    averageConfidence: number;
  }> {
    const question = `Should we open a ${direction} position? ${context || ''}`;
    
    const busMessage = this.messageBus.send({
      from: 'human',
      type: 'question',
      content: {
        type: 'trade_opinion',
        direction,
        context,
      },
      topic: 'trade_decision',
    });

    // Wait for opinions
    const responses = await this.waitForResponses(
      busMessage.id,
      this.agentCapabilities.size,
      15000 // 15 second timeout for trade decisions
    );

    const opinions = responses.map(r => {
      try {
        const parsed = typeof r.content === 'string' ? JSON.parse(r.content) : r.content;
        return {
          agentId: r.agentId || 'unknown',
          opinion: parsed.opinion || 'neutral',
          confidence: parsed.confidence || 50,
          reason: parsed.reason || r.content,
        };
      } catch {
        return {
          agentId: r.agentId || 'unknown',
          opinion: 'neutral' as const,
          confidence: 50,
          reason: r.content,
        };
      }
    });

    const approvals = opinions.filter(o => o.opinion === 'approve').length;
    const rejections = opinions.filter(o => o.opinion === 'reject').length;
    const totalConfidence = opinions.reduce((sum, o) => sum + o.confidence, 0);
    const avgConfidence = opinions.length > 0 ? totalConfidence / opinions.length : 0;

    let consensus: 'go' | 'no-go' | 'split';
    if (approvals > rejections && avgConfidence >= 60) {
      consensus = 'go';
    } else if (rejections > approvals) {
      consensus = 'no-go';
    } else {
      consensus = 'split';
    }

    return {
      opinions,
      consensus,
      averageConfidence: avgConfidence,
    };
  }

  /**
   * Get swarm status summary for chat
   */
  getSwarmSummary(): string {
    const agents = Array.from(this.agentCapabilities.values());
    return agents.map(a => `• **${a.name}**: ${a.description}`).join('\n');
  }

  // ============ SESSION MANAGEMENT ============

  getOrCreateSession(sessionId?: string): ChatSession {
    if (sessionId && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    const id = sessionId || `chat-${Date.now()}`;
    const session: ChatSession = {
      id,
      messages: [],
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };
    this.sessions.set(id, session);
    return session;
  }

  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionHistory(sessionId: string, limit = 50): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return session.messages.slice(-limit);
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  // ============ INTERNAL ============

  private routeMessage(message: string): string[] {
    const targets: string[] = [];
    const lowerMessage = message.toLowerCase();

    for (const [agentId, capability] of this.agentCapabilities) {
      if (capability.canAnswer(lowerMessage)) {
        targets.push(agentId);
      }
    }

    return targets;
  }

  private waitForResponses(
    messageId: string, 
    expectedCount: number,
    timeoutMs: number
  ): Promise<ChatMessage[]> {
    return new Promise((resolve) => {
      const pending = {
        resolve,
        responses: [] as ChatMessage[],
        timeout: setTimeout(() => {
          this.pendingResponses.delete(messageId);
          resolve(pending.responses);
        }, timeoutMs),
      };

      this.pendingResponses.set(messageId, pending);

      // Check periodically if we have all responses
      const checkInterval = setInterval(() => {
        if (pending.responses.length >= expectedCount) {
          clearInterval(checkInterval);
          clearTimeout(pending.timeout);
          this.pendingResponses.delete(messageId);
          resolve(pending.responses);
        }
      }, 100);

      // Cleanup interval on timeout
      setTimeout(() => clearInterval(checkInterval), timeoutMs + 100);
    });
  }
}

// Singleton
let chatInstance: SwarmChat | null = null;

export function getSwarmChat(): SwarmChat {
  if (!chatInstance) {
    chatInstance = new SwarmChat();
  }
  return chatInstance;
}
