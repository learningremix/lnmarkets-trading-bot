/**
 * Chat API - Human interaction with the trading swarm
 */

import type { Route } from "./+types/api.chat";
import { getSwarmCoordinator, getSwarmChat, getMessageBus } from "../../server/agents";
import { bootstrapTradingSwarm } from "../../server/bootstrap";

// Ensure swarm is initialized
let swarmInitialized = false;
async function ensureSwarm() {
  if (!swarmInitialized) {
    await bootstrapTradingSwarm();
    swarmInitialized = true;
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  await ensureSwarm();

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session");
  const action = url.searchParams.get("action") || "history";

  const chat = getSwarmChat();

  if (action === "history" && sessionId) {
    const history = chat.getSessionHistory(sessionId);
    return Response.json({ 
      success: true, 
      data: { sessionId, messages: history } 
    });
  }

  if (action === "agents") {
    return Response.json({
      success: true,
      data: {
        summary: chat.getSwarmSummary(),
      },
    });
  }

  if (action === "messages") {
    const bus = getMessageBus();
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const messages = bus.getMessages({ limit });
    return Response.json({ success: true, data: { messages } });
  }

  if (action === "proposals") {
    const bus = getMessageBus();
    const proposals = bus.getPendingProposals();
    return Response.json({ success: true, data: { proposals } });
  }

  return Response.json({ 
    success: true, 
    data: { 
      message: "Use POST to chat, or ?action=history&session=X for history" 
    } 
  });
}

export async function action({ request }: Route.ActionArgs) {
  await ensureSwarm();

  if (request.method !== "POST") {
    return Response.json(
      { success: false, error: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const body = await request.json();
    const { message, sessionId, action: chatAction } = body;

    const chat = getSwarmChat();
    const swarm = getSwarmCoordinator();

    // Handle different chat actions
    if (chatAction === "trade_opinion") {
      // Ask swarm for trade opinion
      const { direction, context } = body;
      if (!direction) {
        return Response.json(
          { success: false, error: "direction is required" },
          { status: 400 }
        );
      }

      const result = await chat.askForTradeOpinion(direction, context);
      return Response.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    }

    if (chatAction === "propose_trade") {
      // Create a trade proposal for voting
      const { direction, confidence, reason } = body;
      if (!direction) {
        return Response.json(
          { success: false, error: "direction is required" },
          { status: 400 }
        );
      }

      const bus = getMessageBus();
      const proposal = bus.createProposal(
        "human",
        direction,
        confidence || 70,
        reason || "Manual trade proposal"
      );

      return Response.json({
        success: true,
        data: { proposal },
        message: "Trade proposal created. Agents will vote.",
        timestamp: new Date().toISOString(),
      });
    }

    if (chatAction === "execute_trade") {
      // Execute a trade after consensus
      const { proposalId, force } = body;
      const bus = getMessageBus();

      if (proposalId) {
        const proposal = bus.getProposal(proposalId);
        if (!proposal) {
          return Response.json(
            { success: false, error: "Proposal not found" },
            { status: 404 }
          );
        }

        if (proposal.status !== "approved" && !force) {
          return Response.json(
            { 
              success: false, 
              error: `Proposal status is ${proposal.status}. Use force=true to override.` 
            },
            { status: 400 }
          );
        }

        // Execute via swarm coordinator
        try {
          const result = await swarm.executeManualTrade({
            direction: proposal.direction,
            marginPercent: 5, // Conservative default
            leverage: 10,
            stopLossPercent: 5,
            takeProfitPercent: 10,
          });

          proposal.status = "executed";

          return Response.json({
            success: true,
            data: { result, proposal },
            message: "Trade executed successfully",
            timestamp: new Date().toISOString(),
          });
        } catch (err: any) {
          return Response.json(
            { success: false, error: err.message },
            { status: 500 }
          );
        }
      }

      return Response.json(
        { success: false, error: "proposalId required" },
        { status: 400 }
      );
    }

    // Default: regular chat message
    if (!message) {
      return Response.json(
        { success: false, error: "message is required" },
        { status: 400 }
      );
    }

    const result = await chat.chat(message, sessionId);

    return Response.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Chat error:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
