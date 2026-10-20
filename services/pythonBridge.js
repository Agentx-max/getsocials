const { spawn } = require("child_process");
const path = require("path");

/**
 * Bridge to the Python extraction helpers.
 *
 * Facebook and Instagram need purpose-built extractors (yt-dlp and
 * instaloader). They are invoked as separate programs with an argument array
 * and `shell: false`, so a submitted URL is always a single argv entry and can
 * never be interpreted as a shell command.
 *
 * The helper scripts only ever read metadata — they never download or write
 * files.
 */

const SCRIPT = path.join(__dirname, "..", "scripts", "media_probe.py");
const DEFAULT_TIMEOUT = 45000;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

/**
 * Resolves the python executable to use.
 * @returns {string}
 */
function pythonCommand() {
  return process.env.PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
}

/**
 * Runs the extraction helper and parses its JSON output.
 *
 * @param {'instagram'|'facebook'} platform
 * @param {string} url
 * @param {{timeout?: number}} [options]
 * @returns {Promise<object>}
 */
function runProbe(platform, url, options = {}) {
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  return new Promise((resolve, reject) => {
    let child;

    try {
      child = spawn(pythonCommand(), [SCRIPT, platform, url], {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });
    } catch (err) {
      reject(new Error(`Could not start the extraction tool: ${err.message}`));
      return;
    }

    let stdout = "";
    let stderr = "";
    let bytes = 0;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error("The extraction tool timed out. Please try again."));
    }, timeout);

    child.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        return;
      }
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      if (stderr.length < 4000) stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err.code === "ENOENT") {
        reject(
          new Error(
            "Python is not available on this server, so this platform cannot be extracted."
          )
        );
        return;
      }
      reject(new Error(`The extraction tool could not run: ${err.message}`));
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      const output = stdout.trim();
      if (!output) {
        reject(
          new Error(
            stderr.trim().slice(0, 200) ||
              "The extraction tool returned no result."
          )
        );
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(output);
      } catch {
        reject(new Error("The extraction tool returned an unreadable response."));
        return;
      }

      if (parsed && parsed.error) {
        reject(new Error(String(parsed.error).slice(0, 250)));
        return;
      }

      if (code !== 0) {
        reject(new Error("The extraction tool failed."));
        return;
      }

      resolve(parsed);
    });
  });
}

module.exports = { runProbe, pythonCommand };
