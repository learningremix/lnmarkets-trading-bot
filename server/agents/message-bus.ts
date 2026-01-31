/**
 * Message Bus - Inter-agent communication system
 * Enables agents to broadcast messages, request opinions, and reach consensus
 */

import { EventEmitter } from 'events';

export type MessageType = 
  | 'analysis'      // Share analysis results
  | 'opinion'       // Express opinion on a trade
  | 'alert'         // Urgent notification
  | 'question'      // Ask other agents
  | 'vote'          // Vote on a decision
  | 'decision'      // Final decision reached
  | 'chat'          // Human chat message
  | 'response';     // Response to chat

export interface AgentMessage {
  id: string;
  timestamp: Date;
  from: string;           // Agent ID or 'human'
  to?: string | string[]; // Target agent(s), undefined = broadcast
  type: MessageType;
  topic?: string;         // e.g., 'trade_proposal', 'market_update'
  content: any;
  replyTo?: string;       // ID of message being replied to
  metadata?: Record<string, any>;
}

export interface TradeProposal {
  id: string;
  direction: 'long' | 'short';
  confidence: number;
  reason: string;
  proposedBy: string;
  timestamp: Date;
  votes: Map<string, AgentVote>;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
}

export interface AgentVote {
  agentId: string;
  vote: 'approve' | 'reject' | 'abstain';
  confidence: number;
  reason: string;
  timestamp: Date;
}

export interface ConsensusResult {
  proposalId: string;
  approved: boolean;
  totalVotes: number;
  approveVotes: number;
  rejectVotes: number;
  abstainVotes: number;
  averageConfidence: number;
  reasons: string[];
}

export class MessageBus extends EventEmitter {
  private messages: AgentMessage[] = [];
  private proposals: Map<string, TradeProposal> = new Map();
  private maxMessages = 1000;
  private consensusThreshold = 0.6; // 60% approval needed
  private minVotesRequired = 3;

  constructor() {
    super();
  }

  // ============ MESSAGE HANDLING ============

  /**
   * Send a message to the bus
   */
  send(message: Omit<AgentMessage, 'id' | 'timestamp'>): AgentMessage {
    const fullMessage: AgentMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(),
    };

    this.messages.push(fullMessage);
    this.trimMessages();

    // Emit to specific targets or broadcast
    if (message.to) {
      const targets = Array.isArray(message.to) ? message.to : [message.to];
      for (const target of targets) {
        this.emit(`message:${target}`, fullMessage);
      }
    }
    
    // Always emit to 'all' for logging/monitoring
    this.emit('message', fullMessage);
    this.emit(`type:${message.type}`, fullMessage);

    return fullMessage;
  }

  /**
   * Broadcast to all agents
   */
  broadcast(from: string, type: MessageType, content: any, topic?: string): AgentMessage {
    return this.send({ from, type, content, topic });
  }

  /**
   * Send to specific agent(s)
   */
  sendTo(from: string, to: string | string[], type: MessageType, content: any): AgentMessage {
    return this.send({ from, to, type, content });
  }

  /**
   * Reply to a message
   */
  reply(from: string, originalMessage: AgentMessage, content: any): AgentMessage {
    return this.send({
      from,
      to: originalMessage.from,
      type: 'response',
      content,
      replyTo: originalMessage.id,
    });
  }

  // ============ TRADE PROPOSALS & VOTING ============

  /**
   * Create a trade proposal for voting
   */
  createProposal(
    proposedBy: string,
    direction: 'long' | 'short',
    confidence: number,
    reason: string
  ): TradeProposal {
    const proposal: TradeProposal = {
      id: `prop-${Date.now()}`,
      direction,
      confidence,
      reason,
      proposedBy,
      timestamp: new Date(),
      votes: new Map(),
      status: 'pending',
    };

    this.proposals.set(proposal.id, proposal);

    // Broadcast proposal for voting
    this.broadcast(proposedBy, 'vote', {
      action: 'request_vote',
      proposal,
    }, 'trade_proposal');

    this.emit('proposal:created', proposal);
    return proposal;
  }

  /**
   * Submit a vote on a proposal
   */
  vote(proposalId: string, vote: AgentVote): void {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'pending') {
      return;
    }

    proposal.votes.set(vote.agentId, vote);

    this.broadcast(vote.agentId, 'vote', {
      action: 'vote_cast',
      proposalId,
      vote,
    }, 'trade_proposal');

    this.emit('proposal:vote', { proposal, vote });

    // Check if we have enough votes
    if (proposal.votes.size >= this.minVotesRequired) {
      this.evaluateConsensus(proposalId);
    }
  }

  /**
   * Evaluate if consensus is reached
   */
  evaluateConsensus(proposalId: string): ConsensusResult | null {
    const proposal = this.proposals.get(proposalId);
    if (!proposal || proposal.status !== 'pending') {
      return null;
    }

    const votes = Array.from(proposal.votes.values());
    const approveVotes = votes.filter(v => v.vote === 'approve');
    const rejectVotes = votes.filter(v => v.vote === 'reject');
    const abstainVotes = votes.filter(v => v.vote === 'abstain');

    const effectiveVotes = approveVotes.length + rejectVotes.length;
    const approvalRate = effectiveVotes > 0 ? approveVotes.length / effectiveVotes : 0;

    const avgConfidence = approveVotes.length > 0
      ? approveVotes.reduce((sum, v) => sum + v.confidence, 0) / approveVotes.length
      : 0;

    const result: ConsensusResult = {
      proposalId,
      approved: approvalRate >= this.consensusThreshold && avgConfidence >= 60,
      totalVotes: votes.length,
      approveVotes: approveVotes.length,
      rejectVotes: rejectVotes.length,
      abstainVotes: abstainVotes.length,
      averageConfidence: avgConfidence,
      reasons: votes.map(v => `${v.agentId}: ${v.reason}`),
    };

    proposal.status = result.approved ? 'approved' : 'rejected';

    this.broadcast('consensus-engine', 'decision', {
      proposal,
      result,
    }, 'trade_decision');

    this.emit('consensus:reached', result);
    return result;
  }

  // ============ QUERIES ============

  /**
   * Get recent messages
   */
  getMessages(options?: {
    limit?: number;
    type?: MessageType;
    from?: string;
    topic?: string;
  }): AgentMessage[] {
    let result = [...this.messages];

    if (options?.type) {
      result = result.filter(m => m.type === options.type);
    }
    if (options?.from) {
      result = result.filter(m => m.from === options.from);
    }
    if (options?.topic) {
      result = result.filter(m => m.topic === options.topic);
    }

    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  /**
   * Get pending proposals
   */
  getPendingProposals(): TradeProposal[] {
    return Array.from(this.proposals.values())
      .filter(p => p.status === 'pending');
  }

  /**
   * Get proposal by ID
   */
  getProposal(id: string): TradeProposal | undefined {
    return this.proposals.get(id);
  }

  /**
   * Get conversation thread
   */
  getThread(messageId: string): AgentMessage[] {
    const thread: AgentMessage[] = [];
    const seen = new Set<string>();

    const collectThread = (id: string) => {
      const msg = this.messages.find(m => m.id === id);
      if (msg && !seen.has(msg.id)) {
        seen.add(msg.id);
        thread.push(msg);
        
        // Find replies
        this.messages
          .filter(m => m.replyTo === id)
          .forEach(m => collectThread(m.id));
      }
    };

    collectThread(messageId);
    return thread.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  // ============ CONFIGURATION ============

  setConsensusThreshold(threshold: number): void {
    this.consensusThreshold = Math.max(0.5, Math.min(1, threshold));
  }

  setMinVotesRequired(votes: number): void {
    this.minVotesRequired = Math.max(1, votes);
  }

  private trimMessages(): void {
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  // ============ CLEANUP ============

  clearOldProposals(maxAgeMs = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    for (const [id, proposal] of this.proposals) {
      if (proposal.timestamp.getTime() < cutoff) {
        this.proposals.delete(id);
      }
    }
  }
}

// Singleton
let busInstance: MessageBus | null = null;

export function getMessageBus(): MessageBus {
  if (!busInstance) {
    busInstance = new MessageBus();
  }
  return busInstance;
}
