module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { betDesc, claimedBy, claimedSide, proofUrl, proofNote } = req.body;
  const token   = process.env.TELEGRAM_BOT_TOKEN;
  const adminId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  const message = `🚨 NEW CLAIM — ACTION REQUIRED\n\n📋 Bet: ${betDesc}\n👤 By: ${claimedBy}\n🎯 Claims: ${claimedSide} wins\n🔗 Proof: ${proofUrl}\n📝 Note: ${proofNote || "—"}\n\n👉 https://freedom-betting.vercel.app/`;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: adminId, text: message }),
      }
    );
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};