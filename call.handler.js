// call.handler.js

import { config } from "./config.js";

export const handleCall = async (sock, call) => {
  if (config.antiCall) {
    console.log("Menolak panggilan dari:", call.from);
    await sock.rejectCall(call.id, call.from);
  }
};