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
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Local-only fingerprint matching service for the MT WORLD attendance kiosk.
 *
 * Listens on 127.0.0.1:8787 (localhost only) and exposes:
 *
 *   POST /enroll
 *     { "images": ["<base64 png>", "<base64 png>", "<base64 png>"] }
 *     Turns 2-3 same-finger scans into ONE best/most-consistent template.
 *     Does NOT persist anything or take an employeeId — the frontend owns
 *     persistence (it stores the returned template in Firestore under
 *     fingerprints/{employeeId}.templates[]) since this app enrolls TWO
 *     fingers per employee.
 *     -> { "success": true, "template": "<base64 serialized template>" }
 *     -> { "success": false, "error": "..." } if the 3 scans don't look
 *        like the same finger (low pairwise consistency).
 *
 *   POST /load-templates
 *     { "employeeId": "...", "templates": ["<base64>", "<base64>", ...] }
 *     Pushes an employee's already-enrolled templates (from Firestore) into
 *     this matcher's in-memory + on-disk cache, so /identify can use them.
 *     Call this once per employee after Firestore enrollment finishes, and
 *     also on kiosk startup for every enrolled employee (Java has no direct
 *     Firestore access, so the browser/Node side has to push templates down
 *     rather than the matcher pulling them itself).
 *     -> { "success": true, "employeeId": "...", "templateCount": N }
 *
 *   POST /identify
 *     { "imageBase64": "<base64 png>" }
 *     Compares against every stored template for every employee (both
 *     fingers), takes each employee's best score, then the best employee
 *     overall.
 *     -> { "matched": true, "employeeId": "...", "score": 63.2 }
 *     -> { "matched": false, "score": 8.1 }
 *
 *   GET /health -> { "status": "ok", "enrolled": <employee count> }
 *
 * Uses SourceAFIS (https://sourceafis.machinezoo.com/java), open-source,
 * Apache-2.0. All data stays on this PC.
 */
public class Main {

    static final Path TEMPLATE_DIR = Paths.get("templates");
    // employeeId -> list of templates (one per enrolled finger)
    static final Map<String, List<FingerprintTemplate>> cache = new ConcurrentHashMap<>();

    // SourceAFIS's own docs suggest ~40 as a starting match threshold.
    // Tune after real-world testing: raise it if strangers get matched,
    // lower it if genuine employees get rejected.
    static final double MATCH_THRESHOLD = 40;

    // Minimum pairwise score required between the 3 same-finger enrollment
    // scans before we trust they're really the same finger. Same-finger
    // repeat scans typically score well above MATCH_THRESHOLD, so this
    // reuses that number as a sanity floor.
    static final double ENROLL_CONSISTENCY_THRESHOLD = MATCH_THRESHOLD;

    static final double SCAN_DPI = 500; // U.are.U 4500 native resolution

    public static void main(String[] args) throws IOException {
        Files.createDirectories(TEMPLATE_DIR);
        loadAllTemplatesFromDisk();

        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 8787), 0);
        server.createContext("/enroll", Main::handleEnroll);
        server.createContext("/load-templates", Main::handleLoadTemplates);
        server.createContext("/identify", Main::handleIdentify);
        server.createContext("/health", ex -> respond(ex, 200, "{\"status\":\"ok\",\"enrolled\":" + cache.size() + "}"));
        server.setExecutor(null);
        server.start();
        System.out.println("Fingerprint matcher running on http://127.0.0.1:8787 (" + cache.size() + " employees loaded from disk).");
    }

    // ---- persistence: templates/{employeeId}__{index}.dat ----

    static void loadAllTemplatesFromDisk() throws IOException {
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(TEMPLATE_DIR, "*.dat")) {
            for (Path p : stream) {
                String fileName = p.getFileName().toString().replace(".dat", "");
                String employeeId = fileName.contains("__") ? fileName.substring(0, fileName.indexOf("__")) : fileName;
                byte[] bytes = Files.readAllBytes(p);
                FingerprintTemplate template = new FingerprintTemplate(bytes);
                cache.computeIfAbsent(employeeId, k -> new ArrayList<>()).add(template);
            }
        }
    }

    static void persistTemplate(String employeeId, int index, FingerprintTemplate template) throws IOException {
        Files.write(TEMPLATE_DIR.resolve(employeeId + "__" + index + ".dat"), template.toByteArray());
    }

    // ---- /enroll: 3 same-finger scans -> 1 best template ----

    static void handleEnroll(HttpExchange ex) throws IOException {
        if (!"POST".equals(ex.getRequestMethod())) { respond(ex, 405, "{\"error\":\"POST only\"}"); return; }
        try {
            String body = readBody(ex);
            List<String> images = parseStringArray(body, "images");
            if (images.isEmpty()) {
                respond(ex, 400, "{\"success\":false,\"error\":\"images array is required\"}");
                return;
            }

            List<FingerprintTemplate> candidates = new ArrayList<>();
            for (String imageBase64 : images) {
                byte[] imageBytes = Base64.getDecoder().decode(imageBase64);
                FingerprintImage image = new FingerprintImage(imageBytes, new FingerprintImageOptions().dpi(SCAN_DPI));
                candidates.add(new FingerprintTemplate(image));
            }

            // Pick the most "representative" candidate: the one with the
            // highest total similarity to the others. With only 1-2 images
            // just take the first — there's nothing to cross-check yet.
            FingerprintTemplate best;
            if (candidates.size() == 1) {
                best = candidates.get(0);
            } else {
                double bestScore = Double.NEGATIVE_INFINITY;
                int bestIndex = 0;
                double maxPairwiseSeen = Double.NEGATIVE_INFINITY;
                for (int i = 0; i < candidates.size(); i++) {
                    FingerprintMatcher matcher = new FingerprintMatcher(candidates.get(i));
                    double total = 0;
                    for (int j = 0; j < candidates.size(); j++) {
                        if (i == j) continue;
                        double score = matcher.match(candidates.get(j));
                        total += score;
                        if (score > maxPairwiseSeen) maxPairwiseSeen = score;
                    }
                    if (total > bestScore) { bestScore = total; bestIndex = i; }
                }
                if (maxPairwiseSeen < ENROLL_CONSISTENCY_THRESHOLD) {
                    respond(ex, 200, "{\"success\":false,\"error\":\"Those scans don't look consistent enough — try again with the same finger, placed firmly and evenly each time.\"}");
                    return;
                }
                best = candidates.get(bestIndex);
            }

            String templateBase64 = Base64.getEncoder().encodeToString(best.toByteArray());
            respond(ex, 200, "{\"success\":true,\"template\":\"" + templateBase64 + "\"}");
        } catch (Exception e) {
            e.printStackTrace();
            respond(ex, 500, "{\"success\":false,\"error\":\"" + jsonEscape(e.getMessage()) + "\"}");
        }
    }

    // ---- /load-templates: push Firestore-stored templates into this matcher's cache ----

    static void handleLoadTemplates(HttpExchange ex) throws IOException {
        if (!"POST".equals(ex.getRequestMethod())) { respond(ex, 405, "{\"error\":\"POST only\"}"); return; }
        try {
            String body = readBody(ex);
            Map<String, String> flat = parseFlatJson(body);
            String employeeId = flat.get("employeeId");
            List<String> templateStrings = parseStringArray(body, "templates");

            if (employeeId == null || templateStrings.isEmpty()) {
                respond(ex, 400, "{\"success\":false,\"error\":\"employeeId and templates[] are required\"}");
                return;
            }

            List<FingerprintTemplate> templates = new ArrayList<>();
            for (String t : templateStrings) {
                byte[] bytes = Base64.getDecoder().decode(t);
                templates.add(new FingerprintTemplate(bytes));
            }

            cache.put(employeeId, templates);
            for (int i = 0; i < templates.size(); i++) {
                persistTemplate(employeeId, i, templates.get(i));
            }

            respond(ex, 200, "{\"success\":true,\"employeeId\":\"" + jsonEscape(employeeId) + "\",\"templateCount\":" + templates.size() + "}");
        } catch (Exception e) {
            e.printStackTrace();
            respond(ex, 500, "{\"success\":false,\"error\":\"" + jsonEscape(e.getMessage()) + "\"}");
        }
    }

    // ---- /identify: probe against every template of every employee ----

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
            for (Map.Entry<String, List<FingerprintTemplate>> entry : cache.entrySet()) {
                double employeeBest = Double.NEGATIVE_INFINITY;
                for (FingerprintTemplate template : entry.getValue()) {
                    double score = matcher.match(template);
                    if (score > employeeBest) employeeBest = score;
                }
                if (employeeBest > bestScore) {
                    bestScore = employeeBest;
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

    // ---- minimal JSON helpers (deliberately zero extra dependencies beyond SourceAFIS) ----

    static String readBody(HttpExchange ex) throws IOException {
        try (InputStream is = ex.getRequestBody(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
            return bos.toString("UTF-8");
        }
    }

    /** Naive flat-object parser for simple {"key":"value", ...} bodies. */
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
            if (keyEnd == -1) break;
            String key = json.substring(keyStart + 1, keyEnd);

            int colon = json.indexOf(':', keyEnd);
            if (colon == -1) break;
            int valSearch = colon + 1;
            while (valSearch < json.length() && Character.isWhitespace(json.charAt(valSearch))) valSearch++;

            if (valSearch >= json.length()) break;
            if (json.charAt(valSearch) == '[') {
                // skip over array values here — use parseStringArray for those
                int depth = 0;
                int j = valSearch;
                do {
                    if (json.charAt(j) == '[') depth++;
                    else if (json.charAt(j) == ']') depth--;
                    j++;
                } while (j < json.length() && depth > 0);
                i = j;
                continue;
            }
            if (json.charAt(valSearch) != '"') { i = valSearch + 1; continue; }

            int valEnd = findUnescapedQuote(json, valSearch + 1);
            String value = json.substring(valSearch + 1, valEnd).replace("\\\"", "\"").replace("\\\\", "\\");
            map.put(key, value);
            i = valEnd + 1;
        }
        return map;
    }

    /** Extracts a JSON array of strings for a given field name, e.g. "images":["a","b"]. */
    static List<String> parseStringArray(String json, String fieldName) {
        List<String> result = new ArrayList<>();
        Pattern fieldPattern = Pattern.compile("\"" + Pattern.quote(fieldName) + "\"\\s*:\\s*\\[");
        Matcher m = fieldPattern.matcher(json);
        if (!m.find()) return result;

        int arrayStart = m.end();
        int i = arrayStart;
        int depth = 1;
        while (i < json.length() && depth > 0) {
            char c = json.charAt(i);
            if (c == '"') {
                int end = findUnescapedQuote(json, i + 1);
                result.add(json.substring(i + 1, end));
                i = end + 1;
            } else if (c == ']') {
                depth--;
                i++;
            } else {
                i++;
            }
        }
        return result;
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
        ex.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        ex.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = ex.getResponseBody()) { os.write(bytes); }
    }
}