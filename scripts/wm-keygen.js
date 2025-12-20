import fs from "node:fs";
import crypto from "node:crypto";

const privPath = "wm_private.pem";
const pubPath = "wm_public.pem";
const fpPath = "wm_public_fingerprint.txt";

if (fs.existsSync(privPath) || fs.existsSync(pubPath)) {
  console.log("Keys already exist. Delete wm_private.pem & wm_public.pem kalau mau regenerate.");
  process.exit(0);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

const privPem = privateKey.export({ type: "pkcs8", format: "pem" });
const pubPem = publicKey.export({ type: "spki", format: "pem" });

fs.writeFileSync(privPath, privPem);
fs.writeFileSync(pubPath, pubPem);

const fp = crypto.createHash("sha256").update(pubPem).digest("hex").slice(0, 16);
fs.writeFileSync(fpPath, fp);

console.log("OK: generated keys");
console.log("- Private:", privPath);
console.log("- Public :", pubPath);
console.log("- Pub FP :", fp);
console.log("\nRULE:");
console.log("- wm_private.pem jangan pernah lu share / commit ke GitHub.");
console.log("- wm_public.pem boleh ditempel di web verifier / dibagi buat verifikasi.");