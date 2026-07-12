package com.mtworld.matcher;

import com.machinezoo.sourceafis.FingerprintImage;
import com.machinezoo.sourceafis.FingerprintImageOptions;
import com.machinezoo.sourceafis.FingerprintMatcher;
import com.machinezoo.sourceafis.FingerprintTemplate;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Local-only fingerprint matching service for the MT WORLD attendance kiosk.
 *
 * Listens on 127.0.0.1:8787 (localhost only — never exposed to the network)
 * and exposes two endpoints:
 *   POST /enroll   { "employeeId": "...", "imageBase64": "..." }
 *   POST /identify { "imageBase64": "..." }
 *
 * Matching is done with SourceAFIS (https://sourceafis.machinezoo.com/java),
 * an open-source, Apache-2.0-licensed fingerprint recognition engine — no
 * license fees, no cloud dependency, all data stays on this PC.
 *
 * Enrolled templates are stored as flat files under ./templates/{employeeId}.dat
 * (SourceAFIS's own compact serialized format, not a raw image — the
 * original fingerprint image is never kept, only extracted minutiae).
 */
public class Main {

    static final Path TEMPLATE_DIR = Paths.get("templates");
    static final Map<String, FingerprintTemplate> cache = new ConcurrentHashMap<>();

    // SourceAFIS's own docs suggest ~40 as a starting match threshold.
    // Tune this after real-world testing with your scanner: raise it if
    // strangers are getting matched (false accepts), lower it if genuine
    // employees are being rejected (false rejects).
    static final double MATCH_THRESHOLD = 40;

    // The U.are.U 4500 scans at 500 DPI. Adjust if you use a different reader.
    static final double SCAN_DPI = 500;

    public static void main(String[] args) throws IOException {
        Files.createDirectories(TEMPLATE_DIR);
        loadAllTemplates();

        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 8787), 0);
        server.createContext("/enroll", Main::handleEnroll);
        server.createContext("/identify", Main::handleIdentify);
        server.createContext("/health", ex -> respond(ex, 200, "{\"status\":\"ok\",\"enrolled\":" + cache.size() + "}"));
        server.setExecutor(null);
        server.start();
        System.out.println("Fingerprint matcher running on http://127.0.0.1:8787 (" + cache.size() + " enrolled).");
    }

    static void loadAllTemplates() throws IOException {
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(TEMPLATE_DIR, "*.dat")) {
            for (Path p : stream) {
                String employeeId = p.getFileName().toString().replace(".dat", "");
                byte[] bytes = Files.readAllBytes(p);
                cache.put(employeeId, new FingerprintTemplate(bytes));
            }
        }
    }

    static void handleEnroll(HttpExchange ex) throws IOException {
        if (!"POST".equals(ex.getRequestMethod())) { respond(ex, 405, "{\"error\":\"POST only\"}"); return; }
        try {
            Map<String, String> body = parseFlatJson(readBody(ex));
            String employeeId = body.get("employeeId");
            String imageBase64 = body.get("imageBase64");
            if (employeeId == null || imageBase64 == null) {
                respond(ex, 400, "{\"error\":\"employeeId and imageBase64 are required\"}");
                return;
            }

            byte[] imageBytes = Base64.getDecoder().decode(imageBase64);
            FingerprintImage image = new FingerprintImage(imageBytes, new FingerprintImageOptions().dpi(SCAN_DPI));
            FingerprintTemplate template = new FingerprintTemplate(image);

            Files.write(TEMPLATE_DIR.resolve(employeeId + ".dat"), template.toByteArray());
            cache.put(employeeId, template);

            respond(ex, 200, "{\"success\":true,\"employeeId\":\"" + jsonEscape(employeeId) + "\"}");
        } catch (Exception e) {
            e.printStackTrace();
            respond(ex, 500, "{\"success\":false,\"error\":\"" + jsonEscape(e.getMessage()) + "\"}");
        }
    }

    static void handleIdentify(HttpExchange ex) throws IOException {
        if (!"POST".equals(ex.getRequestMethod())) { respond(ex, 405, "{\"error\":\"POST only\"}"); return; }
        try {
            Map<String, String> body = parseFlatJson(readBody(ex));
            String imageBase64 = body.get("imageBase64");
            if (imageBase64 == null) { respond(ex, 400, "{\"error\":\"imageBase64 is required\"}"); return; }

            byte[] imageBytes = Base64.getDecoder().decode(imageBase64);
            FingerprintImage image = new FingerprintImage(imageBytes, new FingerprintImageOptions().dpi(SCAN_DPI));
            FingerprintTemplate probe = new FingerprintTemplate(image);
            FingerprintMatcher matcher = new FingerprintMatcher(probe);

            String bestId = null;
            double bestScore = Double.NEGATIVE_INFINITY;
            for (Map.Entry<String, FingerprintTemplate> entry : cache.entrySet()) {
                double score = matcher.match(entry.getValue());
                if (score > bestScore) {
                    bestScore = score;
                    bestId = entry.getKey();
                }
            }

            if (bestId != null && bestScore >= MATCH_THRESHOLD) {
                respond(ex, 200, "{\"matched\":true,\"employeeId\":\"" + jsonEscape(bestId) + "\",\"score\":" + bestScore + "}");
            } else {
                respond(ex, 200, "{\"matched\":false,\"score\":" + (bestId == null ? 0 : bestScore) + "}");
            }
        } catch (Exception e) {
            e.printStackTrace();
            respond(ex, 500, "{\"error\":\"" + jsonEscape(e.getMessage()) + "\"}");
        }
    }

    // ---- minimal helpers (deliberately zero extra dependencies beyond SourceAFIS) ----

    static String readBody(HttpExchange ex) throws IOException {
        try (InputStream is = ex.getRequestBody(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
            return bos.toString("UTF-8");
        }
    }

    /**
     * Deliberately naive parser for the flat, one-level JSON objects this
     * service ever receives, e.g. {"employeeId":"123","imageBase64":"..."}.
     * Not a general-purpose JSON parser — if you need to send anything more
     * complex, swap in a real JSON library (e.g. Gson) instead.
     */
    static Map<String, String> parseFlatJson(String json) {
        Map<String, String> map = new HashMap<>();
        json = json.trim();
        if (json.startsWith("{")) json = json.substring(1);
        if (json.endsWith("}")) json = json.substring(0, json.length() - 1);

        int i = 0;
        while (i < json.length()) {
            int keyStart = json.indexOf('"', i);
            if (keyStart == -1) break;
            int keyEnd = json.indexOf('"', keyStart + 1);
            String key = json.substring(keyStart + 1, keyEnd);

            int colon = json.indexOf(':', keyEnd);
            int valStart = json.indexOf('"', colon);
            int valEnd = findUnescapedQuote(json, valStart + 1);
            String value = json.substring(valStart + 1, valEnd).replace("\\\"", "\"").replace("\\\\", "\\");

            map.put(key, value);
            i = valEnd + 1;
        }
        return map;
    }

    static int findUnescapedQuote(String s, int from) {
        int i = from;
        while (i < s.length()) {
            if (s.charAt(i) == '"' && s.charAt(i - 1) != '\\') return i;
            i++;
        }
        return s.length();
    }

    static String jsonEscape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    static void respond(HttpExchange ex, int status, String json) throws IOException {
        byte[] bytes = json.getBytes("UTF-8");
        ex.getResponseHeaders().add("Content-Type", "application/json");
        // Fine to leave permissive since this service only ever listens on
        // 127.0.0.1 (localhost) — it is not reachable from the network.
        ex.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = ex.getResponseBody()) { os.write(bytes); }
    }
}