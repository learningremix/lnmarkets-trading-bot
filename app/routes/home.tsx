/**
 * Home Route - Landing page and quick start
 */

import type { Route } from './+types/home';
import { Link } from 'react-router';
import { Zap, Bot, Shield, TrendingUp, ArrowRight, Github, BookOpen } from 'lucide-react';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'LN Markets Trading Bot - Bitcoin Lightning Trading' },
    { name: 'description', content: 'Automated Bitcoin trading on LN Markets with AI-powered swarm agents' },
  ];
}

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Zap className="w-12 h-12 text-orange-500" />
            <h1 className="text-4xl md:text-6xl font-bold text-white">
              LN Markets <span className="text-orange-500">Trading Bot</span>
            </h1>
          </div>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            Automated Bitcoin trading powered by a swarm of AI agents. 
            Stack sats on the Lightning Network with intelligent market analysis 
            and risk management.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
            >
              Open Dashboard
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="https://github.com/ray-bun/LNMarkets_Trading_Bot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
            >
              <Github className="w-5 h-5" />
              GitHub
            </a>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          <FeatureCard
            icon={<Bot className="w-8 h-8" />}
            title="Trading Swarm"
            description="Multiple specialized agents work together: Market Analyst, Risk Manager, Execution Agent, and Researcher."
          />
          <FeatureCard
            icon={<TrendingUp className="w-8 h-8" />}
            title="Technical Analysis"
            description="20+ indicators including RSI, MACD, Bollinger Bands, with pattern recognition and support/resistance detection."
          />
          <FeatureCard
            icon={<Shield className="w-8 h-8" />}
            title="Risk Management"
            description="Position sizing, stop losses, daily loss limits, and maximum drawdown protection built-in."
          />
          <FeatureCard
            icon={<Zap className="w-8 h-8" />}
            title="Lightning Fast"
            description="Built on LN Markets API v3 for instant Bitcoin futures trading on the Lightning Network."
          />
          <FeatureCard
            icon={<BookOpen className="w-8 h-8" />}
            title="Market Research"
            description="Aggregates news sentiment, Fear & Greed index, and on-chain metrics for informed decisions."
          />
          <FeatureCard
            icon={<Github className="w-8 h-8" />}
            title="Open Source"
            description="Fully open source. Customize strategies, add new agents, or contribute improvements."
          />
        </div>

        {/* Quick Start */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-8 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-4">Quick Start</h2>
          <div className="space-y-4 text-gray-300">
            <Step number={1} title="Configure API Keys">
              Get your API key, secret, and passphrase from{' '}
              <a
                href="https://lnmarkets.com/en/user/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 hover:underline"
              >
                LN Markets API settings
              </a>
            </Step>
            <Step number={2} title="Set Environment Variables">
              <code className="bg-gray-900 px-2 py-1 rounded text-sm">
                LNMARKETS_KEY, LNMARKETS_SECRET, LNMARKETS_PASSPHRASE
              </code>
            </Step>
            <Step number={3} title="Start the Bot">
              Run <code className="bg-gray-900 px-2 py-1 rounded text-sm">npm run dev</code> and
              open the dashboard to monitor trading
            </Step>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 text-gray-500">
          <p className="mb-2">
            ⚠️ Trading involves risk. Use at your own risk. Not financial advice.
          </p>
          <p>
            Built with ❤️ for the Bitcoin community
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6 hover:border-orange-500/50 transition-colors">
      <div className="text-orange-500 mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0 text-white font-bold">
        {number}
      </div>
      <div>
        <h4 className="font-medium text-white">{title}</h4>
        <p className="text-gray-400">{children}</p>
      </div>
    </div>
  );
}
