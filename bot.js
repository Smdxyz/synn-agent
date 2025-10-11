// bot.js

import { connectToWhatsApp } from "./connection.js";
import { handleMessage } from "./message.handler.js";
import { handleCall } from "./call.handler.js";

async function startBot() {
  const sock = await connectToWhatsApp();

  sock.ev.on("messages.upsert", async (m) => {
    await handleMessage(sock, m);
  });

  sock.ev.on("call", async (call) => {
    await handleCall(sock, call[0]);
  });
}

startBot();