# ⚡ LN Markets Trading Bot

Automated Bitcoin trading on [LN Markets](https://lnmarkets.com) powered by a swarm of AI trading agents.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-22+-green.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)

## Features

- **🤖 Trading Swarm** - Multiple specialized agents work together:
  - **Market Analyst** - Technical analysis across multiple timeframes
  - **Risk Manager** - Position sizing, stop losses, drawdown protection
  - **Execution Agent** - Smart order execution with signal validation
  - **Researcher** - News sentiment and Fear & Greed index

- **📊 Technical Analysis** - 20+ indicators:
  - RSI, MACD, Bollinger Bands, ADX, ATR
  - Stochastic, Williams %R, CCI, MFI
  - Support/Resistance detection
  - Pattern recognition (engulfing, doji, hammer, etc.)

- **🛡️ Risk Management**:
  - Position sizing based on confidence
  - Maximum exposure limits
  - Daily loss limits
  - Automatic stop losses

- **📱 Dashboard** - Real-time monitoring:
  - Balance and P&L tracking
  - Open positions management
  - Agent status monitoring
  - Market analysis views

## Quick Start

### Prerequisites

- Node.js 22+
- Docker & Docker Compose (recommended)
- LN Markets account with API keys

### 1. Clone and Install

```bash
git clone https://github.com/ray-bun/LNMarkets_Trading_Bot.git
cd LNMarkets_Trading_Bot
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your LN Markets API credentials:

```env
LNMARKETS_KEY=your_api_key
LNMARKETS_SECRET=your_api_secret
LNMARKETS_PASSPHRASE=your_passphrase
LNMARKETS_NETWORK=testnet  # Start with testnet!
```

### 3. Run with Docker (Recommended)

```bash
docker compose up -d
```

### 3b. Or Run Locally

```bash
# Start database
docker compose up -d db

# Run migrations
npm run db:migrate

# Start development server
npm run dev
```

### 4. Access Dashboard

Open [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTO_START_SWARM` | `false` | Auto-start agents on boot |
| `AUTO_EXECUTE_TRADES` | `false` | Enable automatic trading |
| `MIN_TRADE_CONFIDENCE` | `70` | Min confidence to trade (0-100) |
| `MAX_OPEN_POSITIONS` | `3` | Maximum concurrent positions |
| `MAX_POSITION_SIZE_PERCENT` | `10` | Max % of balance per trade |
| `MAX_EXPOSURE_PERCENT` | `50` | Max total exposure |
| `MAX_LEVERAGE` | `25` | Maximum leverage |
| `DEFAULT_STOP_LOSS_PERCENT` | `5` | Default stop loss |
| `MAX_DAILY_LOSS_PERCENT` | `10` | Daily loss limit |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Swarm Coordinator                         │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│   Market    │    Risk     │  Execution  │    Researcher    │
│   Analyst   │   Manager   │    Agent    │                  │
├─────────────┴─────────────┴─────────────┴──────────────────┤
│                   LN Markets Service (SDK v3)               │
├─────────────────────────────────────────────────────────────┤
│              Technical Analysis Service                      │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | System and agent status |
| `/api/market` | GET | Ticker and analysis data |
| `/api/positions` | GET | Open positions |
| `/api/positions` | POST | Close/modify positions |

## Development

```bash
# Type checking
npm run typecheck

# Generate database migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Build for production
npm run build
```

## ⚠️ Disclaimer

**This is for educational purposes only. Trading involves significant risk.**

- Never trade with funds you cannot afford to lose
- Start with testnet before using real funds
- The developers are not responsible for any financial losses
- Past performance does not guarantee future results

## License

MIT - See [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## Links

- [LN Markets](https://lnmarkets.com)
- [LN Markets API Docs](https://api.lnmarkets.com/v3/)
- [SDK Documentation](https://github.com/ln-markets/sdk-typescript)
