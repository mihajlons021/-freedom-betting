import { Connection, PublicKey, Transaction, Keypair, ComputeBudgetProgram } from "@solana/web3.js";
import { getMint, getAssociatedTokenAddress, createTransferCheckedInstruction } from "@solana/spl-token";
import bs58 from "bs58";

const FREEDOM_MINT  = "DGNPSiTrX5xnKcpVKBaXUsWBZbFuA2cJcb7fUJmoAJrd";
const HELIUS_RPC    = "https://mainnet.helius-rpc.com/?api-key=45c09379-40fc-49f0-93a0-733d9d41d1a4";
const API_KEY       = "DGN_FREEDOM_SECRET_2024_XKZP9";
const PRIORITY_FEE  = 500000;
const PLATFORM_FEE  = 0.05; // 5%

export default async function handler(req, res) {
  // Only POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth check — same API key as Battleship
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { betId, winnerWallet, amount } = req.body;

  if (!winnerWallet || !amount) {
    return res.status(400).json({ error: "Missing winnerWallet or amount" });
  }
  if (!process.env.ESCROW_PRIVATE_KEY) {
    return res.status(500).json({ error: "Escrow key not configured" });
  }

  try {
    // Load escrow keypair from env
    const secretKey = bs58.decode(process.env.ESCROW_PRIVATE_KEY);
    const escrowKeypair = Keypair.fromSecretKey(secretKey);

    const connection    = new Connection(HELIUS_RPC, "confirmed");
    const mintPubkey    = new PublicKey(FREEDOM_MINT);
    const winnerPubkey  = new PublicKey(winnerWallet);

    // Get token decimals
    const mintInfo  = await getMint(connection, mintPubkey);
    const decimals  = mintInfo.decimals;

    // Winner gets (amount * 2) * 95% — both players staked 'amount'
    const payoutTokens  = amount * 2 * (1 - PLATFORM_FEE);
    const amountBigInt  = BigInt(Math.floor(payoutTokens * Math.pow(10, decimals)));

    // Associated token accounts
    const fromATA = await getAssociatedTokenAddress(mintPubkey, escrowKeypair.publicKey);
    const toATA   = await getAssociatedTokenAddress(mintPubkey, winnerPubkey);

    // Build transaction
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = escrowKeypair.publicKey;
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEE }));
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }));
    tx.add(
      createTransferCheckedInstruction(
        fromATA,
        mintPubkey,
        toATA,
        escrowKeypair.publicKey,
        amountBigInt,
        decimals
      )
    );

    // Sign and send
    tx.sign(escrowKeypair);
    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    // Wait for confirmation (up to 60s)
    let confirmed = false;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 1500));
      const status = await connection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      });
      const conf = status?.value?.confirmationStatus;
      if (conf === "confirmed" || conf === "finalized") {
        confirmed = true;
        break;
      }
      if (status?.value?.err) throw new Error("TX failed on chain");
    }

    if (!confirmed) throw new Error("Timeout — check Solana Explorer");

    console.log(`[PAYOUT] Bet ${betId} → ${winnerWallet} | ${payoutTokens} $FREE | TX: ${signature}`);

    return res.status(200).json({
      success: true,
      signature,
      amount: payoutTokens,
    });

  } catch (e) {
    console.error("[PAYOUT ERROR]", e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
