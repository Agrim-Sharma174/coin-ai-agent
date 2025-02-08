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
// import { ChatOpenAI } from "@langchain/openai";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as readline from "readline";
import { z } from "zod";
import axios from "axios";

dotenv.config();

/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  // Check required variables
  const requiredVars = ["OPENAI_API_KEY", "CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY"];
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  // Exit if any required variables are missing
  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach(varName => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }

  // Warn about optional NETWORK_ID
  if (!process.env.NETWORK_ID) {
    console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet");
  }
}

// Add this right after imports and before any other code
validateEnvironment();

interface CoinGeckoResponse {
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number;
  total_volume: number;
  market_cap: number;
}

const memecoinActionProvider = customActionProvider<CdpWalletProvider>({
  name: "analyze_memecoins",
  description: "Fetches and analyzes top memecoins for profit potential based on market data",
  schema: z.object({
    limit: z.number().optional().describe("Number of memecoins to analyze, default 10"),
  }),
  invoke: async () => {
    const limit = 10;
    try {
      // Add your CoinGecko API key to your .env file
      const apiKey = process.env.COINGECKO_API_KEY;
      if (!apiKey) {
        return "Error: CoinGecko API key not configured. Please contact support.";
      }

      const response = await axios.get<CoinGeckoResponse[]>(
        `https://api.coingecko.com/api/v3/coins/markets`,
        {
          params: {
            vs_currency: "usd",
            category: "meme-token",
            order: "volume_desc",
            per_page: limit,
            sparkline: false,
          },
          headers: {
            accept: "application/json",
            "x-cg-demo-api-key": "CG-3DMPfLJag2C5qnfbVMtocbz9",
          },
        },
      );

      const analysis = response.data.map((coin: CoinGeckoResponse) => ({
        symbol: coin.symbol.toUpperCase(),
        price: coin.current_price,
        priceChange24h: coin.price_change_percentage_24h,
        volume: coin.total_volume,
        marketCap: coin.market_cap,
        liquidityScore: (coin.total_volume / coin.market_cap) * 100,
        riskLevel: getRiskLevel(
          coin.total_volume,
          coin.market_cap,
          coin.price_change_percentage_24h,
        ),
      }));

      return JSON.stringify({
        data: analysis,
        timestamp: new Date().toISOString(),
        message: `Analyzed ${analysis.length} memecoins based on market data`,
      });
    } catch (error) {
      console.error("Failed to fetch memecoin data:", error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 400) {
          return "Error: Invalid request parameters. Please try different search criteria.";
        }
        if (error.response?.status === 401) {
          return "Error: Invalid CoinGecko API key. Please check your configuration.";
        }
        if (error.response?.status === 429) {
          return "Error: API rate limit exceeded. Please try again later.";
        }
      }
      return "Error: Failed to fetch market data. Please try again later.";
    }
  },
});

// Helper function to assess risk level
/**
 * Determines the risk level of a cryptocurrency based on its volume, market cap, and 24-hour price change.
 *
 * @param volume - The trading volume of the cryptocurrency
 * @param marketCap - The market capitalization of the cryptocurrency
 * @param priceChange24h - The percentage price change in the last 24 hours
 * @returns A string indicating the risk level: "VERY_HIGH", "HIGH", "MEDIUM", or "LOW"
 *
 * The risk level is calculated using:
 * - Liquidity ratio (volume/marketCap)
 * - Price volatility (absolute value of 24h price change)
 *
 * Risk levels are determined as follows:
 * - VERY_HIGH: liquidity ratio < 0.05 or volatility > 50%
 * - HIGH: liquidity ratio < 0.1 or volatility > 30%
 * - MEDIUM: liquidity ratio < 0.15 or volatility > 20%
 * - LOW: all other cases
 */
function getRiskLevel(volume: number, marketCap: number, priceChange24h: number): string {
  const liquidityRatio = volume / marketCap;
  const volatility = Math.abs(priceChange24h);

  if (liquidityRatio < 0.05 || volatility > 50) return "VERY_HIGH";
  if (liquidityRatio < 0.1 || volatility > 30) return "HIGH";
  if (liquidityRatio < 0.15 || volatility > 20) return "MEDIUM";
  return "LOW";
}

const investActionProvider = customActionProvider<CdpWalletProvider>({
  name: "invest_in_memecoin",
  description: "Executes a swap to invest in specified memecoin with risk management",
  schema: z.object({
    tokenAddress: z.string().describe("Contract address of the memecoin to invest in"),
    amount: z.number().describe("Amount of ETH to invest"),
    slippage: z.number().optional().describe("Max slippage percentage, default 2%"),
  }),
  invoke: async (walletProvider, args) => {
    try {
      if (args.amount <= 0) {
        return "Error: Investment amount must be greater than 0";
      }

      // Add actual swap implementation here
      const performSwapTransaction = async (
        walletProvider: CdpWalletProvider,
        tokenAddress: string,
        amount: number,
        slippage: number,
      ): Promise<string> => {
        // Placeholder function for actual swap transaction
        console.log(
          `Swapping ${amount} ETH for ${tokenAddress} with ${slippage}% slippage tolerance...`,
        );

        // Simulate transaction hash
        return "0x1234567890abcdef";
      };
      // This should interact with your DEX or swap protocol
      const txHash = await performSwapTransaction(
        walletProvider,
        args.tokenAddress,
        args.amount,
        args.slippage || 2,
      );

      return `Successfully invested ${args.amount} ETH in ${args.tokenAddress}. TX Hash: ${txHash}`;
    } catch (error) {
      return `Investment failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

//! Configure a file to persist the agent's CDP MPC Wallet Data
const WALLET_DATA_FILE = "wallet_data.txt";

/**
 * Initialize the agent with CDP Agentkit
 *
 * @returns Agent executor and config
 */
async function initializeAgent() {
  try {
    // Initialize LLM
    const llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    let walletDataStr: string | null = null;

    // Read existing wallet data if available
    if (fs.existsSync(WALLET_DATA_FILE)) {
      try {
        walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
      } catch (error) {
        console.error("Error reading wallet data:", error);
        // Continue without wallet data
      }
    }

    // Configure CDP Wallet Provider
    const config = {
      apiKeyName: process.env.CDP_API_KEY_NAME,
      apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      cdpWalletData: walletDataStr || undefined,
      networkId: process.env.NETWORK_ID || "base-sepolia",
    };

    const walletProvider = await CdpWalletProvider.configureWithWallet(config);

    // Initialize AgentKit
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
        investActionProvider,
      ],
    });

    const tools = await getLangChainTools(agentkit);

    // Store buffered conversation history in memory
    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "CDP AgentKit Chatbot Example!" } };

    // Create React Agent using the LLM and CDP AgentKit tools
    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
        You are a memecoin and defi investment strategy expert and you invest in them. When asked about top memecoins:
        1. First use analyze_memecoins to get market data
        2. Strategically evaluate based on liquidity (volume/mcap), recent price changes, and market trends
        3. Consider diversification and risk management
        4. If investing, use invest_in_memecoin with proper parameters
        5. Always verify contract addresses and recent transactions
        6. For user-specified coins, still perform due diligence
        7. Never invest more than 10% of portfolio in one memecoin
        8. Prefer coins with verified contracts and high liquidity
        9. Always set stop-loss and take-profit levels
        10. Stay informed about market trends and news
        11. Remember, past performance is not indicative of future results
        12. Be cautious of pump-and-dump schemes
        13. Avoid investing in unknown or unaudited projects
        14. Keep your investments secure and private
        15. Always consult with a financial advisor before making investment decisions
        
        next steps:
        If asked about investing
        i have to do for defi projects and zk and ai project's coins

        `,
    });

    // Save wallet data
    const exportedWallet = await walletProvider.exportWallet();
    fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error; // Re-throw to be handled by caller
  }
}

/**
 * Run the agent autonomously with specified intervals
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 * @param interval - Time interval between actions in seconds
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runAutonomousMode(agent: any, config: any, interval = 10) {
  console.log("Starting autonomous mode...");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const thought =
        "Be creative and do something interesting on the blockchain. " +
        "Choose an action or set of actions and execute it that highlights your abilities.";

      const stream = await agent.stream({ messages: [new HumanMessage(thought)] }, config);

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
 * Run the agent interactively based on user input
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runChatMode(agent: any, config: any) {
  console.log("Starting chat mode... Type 'exit' to end.");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const userInput = await question("\nPrompt: ");

      if (userInput.toLowerCase() === "exit") {
        break;
      }

      const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);

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
 * Choose whether to run in autonomous or chat mode based on user input
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

  // eslint-disable-next-line no-constant-condition
  while (true) {
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
  }
}

/**
 * Start the chatbot agent
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
