// modules/ai/veo.js
// .veo <prompt> (reply gambar)  ATAU  .veo <image_url> | <prompt>

import axios from "axios";
import FormData from "form-data";
import * as cheerio from "cheerio";

import H from "../../helper.js";

// =====================================================
// VEO CLIENT (DITANEM DI SINI, NO EXTRA FILE)
// Diadaptasi dari veo.js kamu (base, endpoint, headers, task polling) 1
// =====================================================
const veo = {
  api: {
    base: "http://4.246.123.87:8000",
    endpoint: {
      upload: "/",
      result: "/result",
    },
  },

  headers: {
    "user-agent": "NB Android/1.0.0",
    origin: "http://4.246.123.87:8000",
    referer: "http://4.246.123.87:8000/",
    "upgrade-insecure-requests": "1",
  },

  valid: {
    maxSize: 1 * 1024 * 1024, // 1MB
  },

  isUrl: (base, src) =>
    !src ? null : /^https?:\/\//i.test(src) ? src : `${base}/${src.replace(/^\/+/, "")}`,

  sleep: (ms) => new Promise((res) => setTimeout(res, ms)),

  generate: async (imageUrl, prompt) => {
    const startTime = new Date();

    if (!prompt || !prompt.trim()) {
      return { success: false, code: 400, result: { error: "Prompt kosong." } };
    }
    if (!/^https?:\/\//i.test(imageUrl)) {
      return { success: false, code: 400, result: { error: "imageUrl harus URL http/https." } };
    }

    // Download image URL -> buffer (VEO server kamu butuh multipart userimage)
    let buf, contentType, filename;
    try {
      const res = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 30_000,
        maxContentLength: veo.valid.maxSize * 2,
      });

      contentType = res.headers["content-type"] || "image/jpeg";
      if (!contentType.startsWith("image/")) {
        return { success: false, code: 400, result: { error: "Itu bukan link image." } };
      }

      buf = Buffer.from(res.data);
      const size = parseInt(res.headers["content-length"] || "", 10) || buf.length;

      if (size > veo.valid.maxSize) {
        return {
          success: false,
          code: 400,
          result: { error: `Gambar kegedean (${(size / 1024).toFixed(1)}KB). Max 1MB.` },
        };
      }

      const urlObj = new URL(imageUrl);
      filename = urlObj.pathname.split("/").filter(Boolean).pop() || "image.jpg";
    } catch (e) {
      return { success: false, code: e?.response?.status || 500, result: { error: e.message } };
    }

    // Multipart upload ke VEO
    const form = new FormData();
    form.append("userimage", buf, { filename, contentType });
    form.append("userprompt", prompt.trim());

    try {
      const res = await axios.post(`${veo.api.base}${veo.api.endpoint.upload}`, form, {
        headers: { ...veo.headers, ...form.getHeaders() },
        timeout: 60_000,
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
      });

      const redirectx = res.headers.location;
      if (!redirectx) {
        return { success: false, code: 500, result: { error: "Upload gagal: redirect kosong." } };
      }

      const match = redirectx.match(/operationname=([^&]+)/);
      if (!match) {
        return {
          success: false,
          code: 500,
          result: { error: "Task id gak ketemu di redirect.", redirect: redirectx },
        };
      }

      const task_id = match[1];
      return {
        success: true,
        code: 200,
        result: { task_id, status: "queued", start_time: startTime.toISOString() },
      };
    } catch (e) {
      return { success: false, code: e?.response?.status || 500, result: { error: e.message } };
    }
  },

  task: async (task_id) => {
    const startTime = new Date();
    const url = `${veo.api.base}${veo.api.endpoint.result}?operationname=${task_id}`;

    const maxAttempts = 10;
    let attempt = 0;
    let lastCode = null;
    let image = null;
    let video = null;
    let status = "queued";

    try {
      while (attempt < maxAttempts) {
        attempt++;

        const res = await axios.get(url, {
          headers: veo.headers,
          timeout: 60_000,
          validateStatus: (s) => s >= 200 && s < 500,
        });

        const $ = cheerio.load(res.data);
        const im = $("img").first().attr("src") || null;
        const vid = $("source").first().attr("src") || null;

        image = veo.isUrl(veo.api.base, im);
        video = veo.isUrl(veo.api.base, vid);

        if (!video) {
          status = "processing";
        } else {
          try {
            const head = await axios.head(video, {
              timeout: 10_000,
              validateStatus: (s) => s >= 200 && s < 500,
            });

            lastCode = head.status;

            if (head.status === 200) {
              status = "completed";
              break;
            } else if (head.status === 404) {
              status = "processing";
            } else {
              status = "error";
            }
          } catch (e) {
            lastCode = e?.response?.status || 500;
            status = "error";
          }
        }

        if (status !== "completed") {
          const wait = 2000 + attempt * 1000;
          await veo.sleep(wait);
        }
      }

      const endTime = new Date();
      const duration = endTime - startTime;

      return {
        success: status === "completed",
        code: status === "completed" ? 200 : lastCode || 202,
        result: {
          task_id,
          image,
          video,
          status,
          attempts: attempt,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration_ms: duration,
        },
      };
    } catch (e) {
      return { success: false, code: e?.response?.status || 500, result: { error: e.message } };
    }
  },
};

// =====================================================
// COMMAND MODULE
// =====================================================
export const aliases = ["veo2video", "img2veo", "img2video"];

function parseUrlAndPrompt(raw) {
  // format: "<url> | <prompt>"
  const parts = (raw || "").split("|").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2 && /^https?:\/\//i.test(parts[0])) {
    return { imageUrl: parts[0], prompt: parts.slice(1).join(" | ") };
  }
  return { imageUrl: null, prompt: (raw || "").trim() };
}

export default async function veoCommand(sock, message, args, query, sender) {
  try {
    const raw = (query || "").trim();
    const { imageUrl: urlFromText, prompt } = parseUrlAndPrompt(raw);

    if (!prompt) {
      return H.sendText(
        sock,
        sender,
        "Pake gini:\n" +
          "1) Reply gambar: .veo <prompt>\n" +
          "2) URL: .veo <image_url> | <prompt>\n\n" +
          "Contoh:\n.veo https://example.com/a.jpg | cinematic slow zoom, 4K"
      );
    }

    let imageUrl = urlFromText;

    // Kalau gak ada URL, ambil dari reply media -> upload ke server kamu -> jadi URL
    if (!imageUrl) {
      const media = await H.downloadMedia(message);
      if (!media?.buffer) {
        return H.sendText(
          sock,
          sender,
          "Lu harus **reply gambar** atau kasih **URL gambar**.\n" +
            "Contoh: reply gambar + `.veo cinematic dolly in, smooth motion`"
        );
      }

      // Pre-check size biar gak buang waktu (VEO server max 1MB) 2
      if (media.buffer.length > veo.valid.maxSize) {
        return H.sendText(
          sock,
          sender,
          `Gambarnya kegedean (${(media.buffer.length / 1024).toFixed(1)}KB). Max 1MB.\n` +
            `Tips: kirim gambar yang lebih kecil / kompres dulu.`
        );
      }

      // Upload ke Szyrine uploader kamu -> dapat URL publik 3
      imageUrl = await H.uploadImage(media.buffer, media.mimetype || "image/jpeg");
    }

    await H.react(sock, sender, message.key, "⏳");

    // 1) generate -> dapat task_id
    const gen = await veo.generate(imageUrl, prompt);
    if (!gen?.success || !gen?.result?.task_id) {
      await H.react(sock, sender, message.key, "❌");
      return H.sendText(sock, sender, `❌ VEO gagal: ${gen?.result?.error || "unknown error"}`);
    }

    const taskId = gen.result.task_id;

    // 2) poll task -> tunggu video ready
    const res = await veo.task(taskId);

    if (!res?.success || res?.result?.status !== "completed" || !res?.result?.video) {
      await H.react(sock, sender, message.key, "⚠️");
      return H.sendText(
        sock,
        sender,
        "⚠️ Belum kelar / gagal.\n" +
          `task_id: ${taskId}\n` +
          `status: ${res?.result?.status || "unknown"}\n` +
          `attempts: ${res?.result?.attempts || "?"}\n` +
          (res?.result?.error ? `error: ${res.result.error}\n` : "")
      );
    }

    await H.react(sock, sender, message.key, "✅");

    // kirim video + preview image kalau ada
    await H.sendVideo(sock, sender, res.result.video, "🎬 VEO Result"); // helper sendVideo 4
    if (res.result.image) await H.sendImage(sock, sender, res.result.image, "🖼️ Preview");

    await H.sendText(
      sock,
      sender,
      `✅ Done!\ntask_id: ${taskId}\nattempts: ${res.result.attempts}\ndurasi: ${res.result.duration_ms}ms`
    );
  } catch (e) {
    await H.react(sock, sender, message.key, "❌");
    return H.sendText(sock, sender, `❌ Error: ${e.message}`);
  }
}

export const cost = 15;
