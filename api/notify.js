export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { betDesc, claimedBy, claimedSide, proofUrl, proofNote } = req.body;

  const token   = process.env.TELEGRAM_BOT_TOKEN;
  const adminId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  const message = `
🚨 *NEW CLAIM — ACTION REQUIRED*

📋 *Bet:* ${betDesc}
👤 *Claimed by:* ${claimedBy}
🎯 *Claims side:* ${claimedSide} wins
🔗 *Proof:* ${proofUrl}
📝 *Note:* ${proofNote || "—"}

👉 Open admin panel:
https://freedom-betting.vercel.app/
  `.trim();

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:    adminId,
        text:       message,
        parse_mode: "Markdown",
      }),
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}