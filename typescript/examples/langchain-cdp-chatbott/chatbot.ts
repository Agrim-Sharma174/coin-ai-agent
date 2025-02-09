import {
  AgentKit,
  CdpWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  pythActionProvider,
  customActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as readline from "readline";
import { z } from "zod";
import axios from "axios";
// import { SystemMessage } from "@langchain/core/messages";

dotenv.config();

const COIN_CATEGORIES = {
  MEME: "meme-token",
  DEFI: "decentralized-finance-defi",
  AI: "artificial-intelligence",
  ZK: "zero-knowledge-zk",
} as const;

interface CoinGeckoResponse {
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number;
  total_volume: number;
  market_cap: number;
}

/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  const requiredVars = ["OPENAI_API_KEY", "CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY"];
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach(varName => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }

  if (!process.env.NETWORK_ID) {
    console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet");
  }
}

validateEnvironment();

/**
 * Analyzes coins based on category and limit
 *
 * @param category - The category of coins to analyze
 * @param limit - Maximum number of coins to analyze
 * @returns Array of analyzed coin data
 */
async function analyzeCoins(category: string, limit: number) {
  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    if (!apiKey) return "Error: CoinGecko API key not configured.";

    const response = await axios.get<CoinGeckoResponse[]>(
      "https://api.coingecko.com/api/v3/coins/markets",
      {
        params: {
          vs_currency: "usd",
          category,
          order: "volume_desc",
          per_page: limit,
          sparkline: false,
        },
        headers: {
          accept: "application/json",
          "x-cg-demo-api-key": apiKey,
        },
      },
    );

    return response.data.map(coin => ({
      symbol: coin.symbol.toUpperCase(),
      price: coin.current_price,
      priceChange24h: coin.price_change_percentage_24h,
      volume: coin.total_volume,
      marketCap: coin.market_cap,
      liquidityScore: (coin.total_volume / coin.market_cap) * 100,
      riskLevel: getRiskLevel(coin.total_volume, coin.market_cap, coin.price_change_percentage_24h),
    }));
  } catch (error) {
    console.error(`Failed to fetch ${category} data:`, error);
    return [];
  }
}

/**
 * Creates a coin analysis action provider for a specific category
 *
 * @param category - The category of coins to analyze
 * @returns CustomActionProvider for the specified category
 */
function createCoinAnalysisAction(category: keyof typeof COIN_CATEGORIES) {
  return customActionProvider<CdpWalletProvider>({
    name: `analyze_${category.toLowerCase()}`,
    description: `Fetches and analyzes top ${category} coins for investment potential`,
    schema: z.object({
      limit: z.number().optional().default(10),
    }),
    invoke: async (_, { limit }) => {
      const data = await analyzeCoins(COIN_CATEGORIES[category], limit);
      return JSON.stringify({
        data,
        message: `Top ${limit} ${category} coins analyzed`,
        category,
        timestamp: new Date().toISOString(),
      });
    },
  });
}

/**
 * Determines the risk level of a cryptocurrency based on market metrics
 *
 * @param volume - Trading volume
 * @param marketCap - Market capitalization
 * @param priceChange24h - 24-hour price change percentage
 * @returns Risk level assessment
 */
function getRiskLevel(volume: number, marketCap: number, priceChange24h: number): string {
  const liquidityRatio = volume / marketCap;
  const volatility = Math.abs(priceChange24h);

  if (liquidityRatio < 0.05 || volatility > 50) return "VERY_HIGH";
  if (liquidityRatio < 0.1 || volatility > 30) return "HIGH";
  if (liquidityRatio < 0.15 || volatility > 20) return "MEDIUM";
  return "LOW";
}

/**
 * Simulates a swap transaction
 *
 * @param walletProvider - CDP wallet provider
 * @param tokenAddress - Address of token to swap
 * @param amount - Amount to swap
 * @param slippage - Maximum slippage percentage
 * @returns Transaction hash
 */
async function performSwapTransaction(
  walletProvider: CdpWalletProvider,
  tokenAddress: string,
  amount: number,
  slippage: number,
): Promise<string> {
  console.log(`Swapping ${amount} ETH for ${tokenAddress} with ${slippage}% slippage tolerance...`);
  return "0x1234567890abcdef";
}

// Create action providers for each category
const memecoinActionProvider = createCoinAnalysisAction("MEME");
const defiActionProvider = createCoinAnalysisAction("DEFI");
const aiActionProvider = createCoinAnalysisAction("AI");
const zkActionProvider = createCoinAnalysisAction("ZK");

// Investment action provider
const investActionProvider = customActionProvider<CdpWalletProvider>({
  name: "invest_in_coin",
  description: "Executes a swap to invest in specified cryptocurrency with risk management",
  schema: z.object({
    tokenAddress: z.string().describe("Contract address of the token to invest in"),
    amount: z.number().describe("Amount of ETH to invest"),
    slippage: z.number().optional().describe("Max slippage percentage, default 2%"),
    category: z.enum(["MEME", "DEFI", "AI", "ZK"]).describe("Category of the token"),
  }),
  invoke: async (walletProvider, args) => {
    try {
      const balance = await walletProvider.getBalance();
      if (balance < args.amount) {
        return `Insufficient mainnet balance (${balance} ETH). Please top up your wallet to invest ${args.amount} ETH in ${args.category} token.`;
      }

      const txHash = await performSwapTransaction(
        walletProvider,
        args.tokenAddress,
        args.amount,
        args.slippage || 2,
      );

      return `Invested ${args.amount} ETH in ${args.category} token (${args.tokenAddress}). TX Hash: ${txHash}`;
    } catch (error) {
      return `Investment failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

// Define the expected data structure (Optional)
interface KewordResponse {
  time?: string;
  timePeriod?: string;
  trend?: string;
  volume?: string;
}
const KeyWordActionProvider = customActionProvider<CdpWalletProvider>({
  name: "fetch_keyword",
  description: "Fetches the top trending keywords on Twitter",
  schema: z.object({
    platform: z.string().describe("Which platform to fetch keywords from"),
  }),
  invoke: async () => {
    try {
      const response = await axios.get<KewordResponse[]>(
        `https://api.apify.com/v2/datasets/0VEWlmNYYkmymxOC3/items?token=${process.env.APIFY_KEYWORDS_API_KEY}`,
      );

      const formattedData = response.data
        .map(
          keyword =>
            `Keyword: ${keyword.trend || "N/A"}\n` +
            `Trending since: ${keyword.time || "N/A"}\n` +
            `Tweets: ${keyword.volume || "N/A"}\n` +
            `Status: ${keyword.timePeriod || "N/A"}`,
        )
        .join("\n\n");

      return formattedData;
    } catch (error) {
      return `Failed to fetch keywords: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

const WALLET_DATA_FILE = "wallet_data.txt";

/**
 * Initializes the agent with CDP Agentkit
 *
 * @returns Agent executor and config
 */
async function initializeAgent() {
  try {
    const llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    let walletDataStr: string | null = null;

    if (fs.existsSync(WALLET_DATA_FILE)) {
      try {
        walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
      } catch (error) {
        console.error("Error reading wallet data:", error);
      }
    }

    const config = {
      apiKeyName: process.env.CDP_API_KEY_NAME,
      apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      cdpWalletData: walletDataStr || undefined,
      networkId: process.env.NETWORK_ID || "base-sepolia",
    };

    const walletProvider = await CdpWalletProvider.configureWithWallet(config);

    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        wethActionProvider(),
        pythActionProvider(),
        walletActionProvider(),
        erc20ActionProvider(),
        cdpApiActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
        cdpWalletActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
        memecoinActionProvider,
        defiActionProvider,
        aiActionProvider,
        zkActionProvider,
        investActionProvider,
        KeyWordActionProvider,
      ],
    });

    const tools = await getLangChainTools(agentkit);
    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "CDP AgentKit Chatbot Example!" } };

    const messageModifier = `
You are a cryptocurrency investment expert specializing in MEME, DeFi, AI, and ZK coins. Follow these rules:

1. Identify requested category from user query:
   - Meme coins: Use analyze_meme
   - DeFi: Use analyze_defi
   - AI coins: Use analyze_ai
   - ZK tech: Use analyze_zk
   - Getting the most trending keywords: Use fetch_keyword, out of all the keywords which you received, strategically predict which of them have the potential to become trending memecoin in future.

2. For price inquiries:
   - Always check latest prices using appropriate analysis tool
   - Compare with 24h price change
   - Mention liquidity and market cap

3. Investment process:
   a) Check mainnet balance before any investment
   b) If balance < requested amount:
      - Clearly state current balance
      - Explain needed top-up amount
      - Offer to help with deposit process
   c) For sufficient balance:
      - Verify contract address
      - Check liquidity score
      - Confirm risk level
      - Execute invest_in_coin with proper parameters

4. Risk management:
   - Never recommend >15% portfolio in one asset
   - Always suggest stop-loss orders
   - Prefer audited contracts
   - Highlight volatility warnings

5. Educational guidance:
   - Explain ZK technology benefits
   - Differentiate AI utility vs hype
   - Compare DeFi vs traditional finance
   - Analyze meme coin cultural factors

6. Security:
   - Warn against unaudited contracts
   - Recommend hardware wallets
   - Suggest verifying contract addresses
   - Mention common scam patterns
`;

    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: messageModifier,
    });

    const exportedWallet = await walletProvider.exportWallet();
    fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

/**
 * Runs the agent in autonomous mode
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 * @param config.configurable - Configuration settings for the agent
 * @param config.configurable.thread_id - Unique identifier for the chat thread
 * @param interval - Time interval between actions in seconds
 */
async function runAutonomousMode(
  agent: ReturnType<typeof createReactAgent>,
  config: { configurable: { thread_id: string } },
  interval = 10,
) {
  console.log("Starting autonomous mode...");

  const isRunning = true;
  while (isRunning) {
    try {
      const thought =
        "Be creative and do something interesting on the blockchain. " +
        "Choose an action or set of actions and execute it that highlights your abilities.";

      const stream = await agent.stream(
        {
          messages: [new HumanMessage(thought)],
        },
        config,
      );

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          console.log(chunk.tools.messages[0].content);
        }
        console.log("-------------------");
      }

      await new Promise(resolve => setTimeout(resolve, interval * 1000));
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error:", error.message);
      }
      process.exit(1);
    }
  }
}

/**
 * Runs the agent in interactive chat mode
 *
 * @param agent - The agent executor
 * @param config - Agent configuration object
 * @param config.configurable - Configuration settings for the agent
 * @param config.configurable.thread_id - Unique identifier for the chat thread
 * @returns {Promise<void>} A promise that resolves when the chat session ends
 */
async function runChatMode(
  agent: ReturnType<typeof createReactAgent>,
  config: { configurable: { thread_id: string } },
) {
  console.log("Starting chat mode... Type 'exit' to end.");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  try {
    let isRunning = true;
    while (isRunning) {
      const userInput = await question("\nPrompt: ");

      if (userInput.toLowerCase() === "exit") {
        isRunning = false;
        continue;
      }

      const stream = await agent.stream(
        {
          messages: [new HumanMessage(userInput)], // Only include HumanMessage
        },
        config,
      );

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          console.log(chunk.tools.messages[0].content);
        }
        console.log("-------------------");
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

/**
 * Prompts user to choose between autonomous and chat mode
 *
 * @returns Selected mode
 */
async function chooseMode(): Promise<"chat" | "auto"> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  const choosing = true;
  while (choosing) {
    console.log("\nAvailable modes:");
    console.log("1. chat    - Interactive chat mode");
    console.log("2. auto    - Autonomous action mode");

    const choice = (await question("\nChoose a mode (enter number or name): "))
      .toLowerCase()
      .trim();

    if (choice === "1" || choice === "chat") {
      rl.close();
      return "chat";
    } else if (choice === "2" || choice === "auto") {
      rl.close();
      return "auto";
    }
    console.log("Invalid choice. Please try again.");
    console.log("Invalid choice. Please try again.");
  }
  return "chat"; // Default fallback, though this line should never be reached
}

/**
 * Main function to start the chatbot agent
 */
async function main() {
  try {
    const { agent, config } = await initializeAgent();
    const mode = await chooseMode();

    if (mode === "chat") {
      await runChatMode(agent, config);
    } else {
      await runAutonomousMode(agent, config);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  console.log("Starting Agent...");
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
