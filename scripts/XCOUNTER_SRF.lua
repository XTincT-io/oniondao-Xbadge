-- STEALTH RF HUD
-- 0x XTincT x Onion DAO
-- Passive RF environment HUD with simple "viewer" awareness and mode switching.
-- Modes: SCAN (default), BROADCAST (performance), STEALTH (low-RF guidance).
-- Passive only: no deauth, spoofing, replay, or RF transmit here.

local W = 264
local H = 176
local POLL_MS = 40
local SCAN_MS = 3500
local BLE_SCAN_MS = 2500
local SUBGHZ_DWELL_MS = 220

local freqs = { 315.0, 390.0, 433.92, 868.35, 915.0 }
local pages = { "SUMMARY", "WIFI", "BLE", "SUBGHZ", "SECURITY" }
local modes = { "SCAN", "BROADCAST", "STEALTH" }

local draw

local state = {
    page = 1,
    mode = 1, -- 1=SCAN, 2=BROADCAST, 3=STEALTH
    status = "SELECT scan. L/R pages. HOLD SELECT: mode.",
    last_buttons = {},
    dirty = true,
    scan_phase = "idle", -- idle, wifi, ble, subghz, done
    scan_error = nil,
    wifi = {},
    ble = {},
    subghz = {},
    caps = {},
    delta = {},
    last_scan = 0,
    viewers = {},      -- { { kind="wifi"|"ble", addr="..", first_seen=ms, last_seen=ms, rssi=number } }
    last_viewers_poll = 0,
    select_down_ms = nil,
}

----------------------------------------------------------------
-- Platform helpers / capability detection
----------------------------------------------------------------

local function has(name)
    return type(onion[name]) == "function"
end

local function detect_caps()
    local is_sim = has("is_simulator") and onion.is_simulator()
    state.caps = {
        wifi = has("wifi_scan") or has("wifi_scan_networks") or has("wifi_ap_scan"),
        ble = has("ble_scan") or has("bluetooth_scan") or has("bt_scan"),
        subghz = not is_sim and has("subghz_begin") and has("subghz_receive"),
        subghz_rssi = not is_sim and (has("subghz_rssi") or has("subghz_get_rssi")),
        -- viewer APIs are speculative; you can wire these later
        wifi_viewers = has("wifi_clients") or has("wifi_get_clients"),
        ble_viewers = has("ble_connections") or has("ble_get_connections"),
    }
end

----------------------------------------------------------------
-- Drawing helpers
----------------------------------------------------------------

local function text(value, x, y, font)
    onion.display_text(tostring(value or ""), x, y, {
        font = font or "small",
        clear = false,
    })
end

local function line(x1, y1, x2, y2)
    onion.display_line(x1, y1, x2, y2, { clear = false })
end

local function rect(x, y, w, h, fill)
    onion.display_rect(x, y, w, h, {
        clear = false,
        color = "black",
        fill = fill or false,
    })
end

local function centered(value, y, font, char_w)
    value = tostring(value or "")
    local x = math.max(4, math.floor((W - #value * char_w) / 2))
    text(value, x, y, font)
end

local function clamp(value, lo, hi)
    if value < lo then return lo end
    if value > hi then return hi end
    return value
end

local function short_id(value)
    value = tostring(value or "?")
    value = value:gsub(":", "")
    if #value <= 4 then return value end
    return ".." .. value:sub(#value - 3)
end

local function rssi_bar(x, y, w, rssi)
    local dbm = tonumber(rssi) or -100
    local pct = clamp((dbm + 100) / 70, 0, 1)
    local fill = math.floor(w * pct)
    rect(x, y, w, 6, false)
    if fill > 0 then
        rect(x + 1, y + 1, math.max(1, fill - 1), 4, true)
    end
end

----------------------------------------------------------------
-- Button handling
----------------------------------------------------------------

local function wait_for_release()
    while true do
        local b = onion.buttons()
        if not b.select and not b.cancel and not b.up and
            not b.down and not b.left and not b.right then
            state.last_buttons = b
            return
        end
        onion.sleep(POLL_MS)
    end
end

local function edge(buttons)
    for _, name in ipairs({ "select", "cancel", "left", "right", "up", "down" }) do
        if buttons[name] and not state.last_buttons[name] then return name end
    end
    return nil
end

----------------------------------------------------------------
-- List normalization / safe calls
----------------------------------------------------------------

local function normalize_list(raw)
    if type(raw) ~= "table" then return {} end
    if type(raw.networks) == "table" then raw = raw.networks end
    if type(raw.aps) == "table" then raw = raw.aps end
    if type(raw.devices) == "table" then raw = raw.devices end
    if type(raw.results) == "table" then raw = raw.results end

    local out = {}
    for k, v in pairs(raw) do
        if type(k) == "number" and type(v) == "table" then
            out[#out + 1] = v
        end
    end
    return out
end

local function read_field(item, names, fallback)
    for _, name in ipairs(names) do
        if item[name] ~= nil then return item[name] end
    end
    return fallback
end

local function try_call(fn, arg)
    local ok, a, b = pcall(fn, arg)
    if ok then return a, b end
    return nil, a
end

local function sort_by_rssi(items)
    table.sort(items, function(a, b)
        return (tonumber(a.rssi) or -999) > (tonumber(b.rssi) or -999)
    end)
end

local function best_rssi(items)
    if type(items) ~= "table" or not items[1] then return nil end
    return tonumber(items[1].rssi)
end

local function delta_label(value)
    if value == nil then return "" end
    if value > 0 then return " +" .. tostring(value) end
    return " " .. tostring(value)
end

----------------------------------------------------------------
-- RF scanning: WiFi / BLE / SubGHz
----------------------------------------------------------------

local function scan_wifi()
    if not state.caps.wifi then
        state.wifi = {}
        return "wifi scan API missing"
    end

    local fn = onion.wifi_scan or onion.wifi_scan_networks or onion.wifi_ap_scan
    local raw, err = try_call(fn, { passive = true, timeout_ms = SCAN_MS })
    if not raw then raw, err = try_call(fn, SCAN_MS) end
    if not raw then
        state.wifi = {}
        return "wifi: " .. tostring(err or "scan failed")
    end

    local items = {}
    for _, item in ipairs(normalize_list(raw)) do
        items[#items + 1] = {
            ssid = tostring(read_field(item, { "ssid", "name" }, "(hidden)")),
            bssid = tostring(read_field(item, { "bssid", "mac", "addr" }, "?")),
            rssi = tonumber(read_field(item, { "rssi", "rssi_dbm", "dbm" }, -100)) or -100,
            channel = tonumber(read_field(item, { "channel", "chan" }, 0)) or 0,
        }
    end
    sort_by_rssi(items)
    state.wifi = items
    return nil
end

local function scan_ble()
    if not state.caps.ble then
        state.ble = {}
        return "ble scan API missing"
    end

    local fn = onion.ble_scan or onion.bluetooth_scan or onion.bt_scan
    local raw, err = try_call(fn, { passive = true, duration_ms = BLE_SCAN_MS })
    if not raw then raw, err = try_call(fn, BLE_SCAN_MS) end
    if not raw then
        state.ble = {}
        return "ble: " .. tostring(err or "scan failed")
    end

    local items = {}
    for _, item in ipairs(normalize_list(raw)) do
        items[#items + 1] = {
            name = tostring(read_field(item, { "name", "local_name" }, "(unnamed)")),
            addr = tostring(read_field(item, { "addr", "address", "mac" }, "?")),
            rssi = tonumber(read_field(item, { "rssi", "rssi_dbm", "dbm" }, -100)) or -100,
        }
    end
    sort_by_rssi(items)
    state.ble = items
    return nil
end

local function subghz_rssi()
    if has("subghz_rssi") then return onion.subghz_rssi() end
    if has("subghz_get_rssi") then return onion.subghz_get_rssi() end
    return nil
end

local function scan_subghz()
    state.subghz = {}
    if not state.caps.subghz then
        return "subghz API missing"
    end

    local active = false
    for i, freq in ipairs(freqs) do
        if i == 1 then
            local ok, err = onion.subghz_begin({ freq = freq, modulation = "ook" })
            if not ok then return "subghz: " .. tostring(err or "begin failed") end
            active = true
        elseif has("subghz_set_frequency") then
            onion.subghz_set_frequency(freq)
        else
            onion.subghz_end()
            local ok, err = onion.subghz_begin({ freq = freq, modulation = "ook" })
            if not ok then
                state.subghz[#state.subghz + 1] = { freq = freq, count = 0, len = 0 }
                active = false
            else
                active = true
            end
        end

        local start = onion.millis()
        local count = 0
        local best = nil
        local last_len = 0

        while active and onion.millis() - start < SUBGHZ_DWELL_MS do
            local pkt = onion.subghz_receive(35)
            local rssi = nil
            if type(pkt) == "table" then
                count = count + 1
                rssi = pkt.rssi_dbm or pkt.rssi
                last_len = pkt.len or #(pkt.payload or pkt.message or "")
            elseif state.caps.subghz_rssi then
                rssi = subghz_rssi()
            end
            if rssi and (not best or tonumber(rssi) > tonumber(best)) then
                best = rssi
            end
        end

        state.subghz[#state.subghz + 1] = {
            freq = freq,
            rssi = best,
            count = count,
            len = last_len,
        }
    end

    if active then onion.subghz_end() end
    table.sort(state.subghz, function(a, b)
        return (tonumber(a.rssi) or -999) > (tonumber(b.rssi) or -999)
    end)
    return nil
end

local function start_scan()
    if state.scan_phase ~= "idle" then return end

    state.scan_phase = "wifi"
    state.status = "Scanning passive RF..."
    state.dirty = true
    state.scan_error = nil
    state.delta = {}
    state.last_scan = onion.millis()

    -- Preserve previous scan results for delta calculation
    state.prev_wifi = best_rssi(state.wifi)
    state.prev_ble = best_rssi(state.ble)
    state.prev_subghz = best_rssi(state.subghz)
end

local function update_scan()
    if state.scan_phase == "idle" then return end

    state.dirty = true
    local err = nil

    if state.scan_phase == "wifi" then
        state.status = "Scanning WiFi..."
        err = scan_wifi()
        state.scan_phase = "ble"
    elseif state.scan_phase == "ble" then
        state.status = "Scanning BLE..."
        err = scan_ble()
        state.scan_phase = "subghz"
    elseif state.scan_phase == "subghz" then
        state.status = "Scanning SubGHz..."
        err = scan_subghz()
        state.scan_phase = "done"
    end

    if err then
        state.scan_error = tostring(err or "unknown error")
    end

    if state.scan_phase == "done" then
        state.delta = {
            wifi = best_rssi(state.wifi) and state.prev_wifi and (best_rssi(state.wifi) - state.prev_wifi) or nil,
            ble = best_rssi(state.ble) and state.prev_ble and (best_rssi(state.ble) - state.prev_ble) or nil,
            subghz = best_rssi(state.subghz) and state.prev_subghz and (best_rssi(state.subghz) - state.prev_subghz) or nil,
        }

        if state.scan_error then
            state.status = "Error: " .. state.scan_error:sub(1, 30)
        else
            state.status = "Scan complete. Move badge; SELECT rescans."
        end
        state.scan_phase = "idle"
    end
end

----------------------------------------------------------------
-- Viewer awareness scaffold
----------------------------------------------------------------

local function upsert_viewer(kind, addr, rssi)
    addr = tostring(addr or "?")
    local now = onion.millis()
    for _, v in ipairs(state.viewers) do
        if v.kind == kind and v.addr == addr then
            v.last_seen = now
            v.rssi = rssi or v.rssi
            return
        end
    end
    state.viewers[#state.viewers + 1] = {
        kind = kind,
        addr = addr,
        first_seen = now,
        last_seen = now,
        rssi = rssi,
    }
    state.status = "New " .. kind .. " viewer " .. short_id(addr)
end

-- These are placeholders; wire them to real Onion APIs if available.
local function poll_viewers_wifi()
    if not state.caps.wifi_viewers then return end
    local fn = onion.wifi_clients or onion.wifi_get_clients
    if not fn then return end
    local raw, err = try_call(fn, nil)
    if not raw then
        onion.log("wifi_viewers error: " .. tostring(err))
        return
    end
    for _, c in ipairs(normalize_list(raw)) do
        local mac = read_field(c, { "mac", "addr", "bssid" }, "?")
        local rssi = tonumber(read_field(c, { "rssi", "dbm" }, -100)) or -100
        upsert_viewer("wifi", mac, rssi)
    end
end

local function poll_viewers_ble()
    if not state.caps.ble_viewers then return end
    local fn = onion.ble_connections or onion.ble_get_connections
    if not fn then return end
    local raw, err = try_call(fn, nil)
    if not raw then
        onion.log("ble_viewers error: " .. tostring(err))
        return
    end
    for _, c in ipairs(normalize_list(raw)) do
        local addr = read_field(c, { "addr", "address", "mac" }, "?")
        local rssi = tonumber(read_field(c, { "rssi", "dbm" }, -100)) or -100
        upsert_viewer("ble", addr, rssi)
    end
end

local function poll_viewers()
    local now = onion.millis()
    if now - (state.last_viewers_poll or 0) < 1000 then return end
    state.last_viewers_poll = now
    poll_viewers_wifi()
    poll_viewers_ble()
end

----------------------------------------------------------------
-- Drawing pages
----------------------------------------------------------------

local function draw_header()
    rect(2, 2, W - 4, H - 4, false)
    centered(pages[state.page], 8, "bold", 8)
    -- Mode indicator in top-right
    local mode_label = modes[state.mode]
    text(mode_label, W - 70, 8, "small")
    line(6, 26, W - 6, 26)
end

local function draw_list(items, start_y, rows, kind)
    if #items == 0 then
        centered("No data yet", 74, "bold", 8)
        centered("SELECT to scan", 94, "small", 6)
        return
    end

    for i = 1, math.min(rows, #items) do
        local item = items[i]
        local y = start_y + (i - 1) * 24
        if kind == "wifi" then
            local ssid = item.ssid
            if #ssid > 16 then ssid = ssid:sub(1, 16) end
            text(ssid, 8, y, "small")
            text("ch" .. tostring(item.channel), 116, y, "small")
            text(tostring(item.rssi) .. "dBm", 152, y, "small")
            text(short_id(item.bssid), 220, y, "small")
            rssi_bar(8, y + 12, 110, item.rssi)
        elseif kind == "ble" then
            local name = item.name
            if #name > 18 then name = name:sub(1, 18) end
            text(name, 8, y, "small")
            text(tostring(item.rssi) .. "dBm", 152, y, "small")
            text(short_id(item.addr), 220, y, "small")
            rssi_bar(8, y + 12, 110, item.rssi)
        else
            text(string.format("%.2f MHz", item.freq), 8, y, "small")
            local level = item.rssi and (tostring(item.rssi) .. "dBm") or "no RSSI"
            text(level, 100, y, "small")
            text("hits " .. tostring(item.count), 176, y, "small")
            rssi_bar(8, y + 12, 110, item.rssi or -100)
        end
    end
end

local function draw_summary()
    local wifi_best = state.wifi[1]
    local ble_best = state.ble[1]
    local sub_best = state.subghz[1]

    text("WiFi APs: " .. #state.wifi, 8, 38, "bold")
    if wifi_best then
        text("Best ch" .. wifi_best.channel .. " " .. wifi_best.rssi .. "dBm" ..
            delta_label(state.delta.wifi), 8, 54, "small")
    else
        text(state.caps.wifi and "Ready" or "API missing", 8, 54, "small")
    end

    text("BLE adv: " .. #state.ble, 8, 78, "bold")
    if ble_best then
        text("Best " .. ble_best.rssi .. "dBm" .. delta_label(state.delta.ble) ..
            " " .. short_id(ble_best.addr), 8, 94, "small")
    else
        text(state.caps.ble and "Ready" or "API missing", 8, 94, "small")
    end

    text("SubGHz: " .. #state.subghz .. " freqs", 8, 118, "bold")
    if sub_best then
        local label = sub_best.rssi and (sub_best.rssi .. "dBm" ..
            delta_label(state.delta.subghz)) or (sub_best.count .. " hits")
        text(string.format("%.2f MHz %s", sub_best.freq, label), 8, 134, "small")
    else
        text(state.caps.subghz and "Ready" or "API missing", 8, 134, "small")
    end
end

local function draw_security()
    -- Viewer summary
    local viewer_count = #state.viewers
    text("Viewers: " .. viewer_count, 8, 38, "bold")

    if viewer_count == 0 then
        text("No active viewers detected.", 8, 54, "small")
    else
        local max_rows = 3
        for i = 1, math.min(max_rows, viewer_count) do
            local v = state.viewers[i]
            local y = 54 + (i - 1) * 20
            local label = v.kind .. " " .. short_id(v.addr)
            text(label, 8, y, "small")
            if v.rssi then
                text(tostring(v.rssi) .. "dBm", 140, y, "small")
                rssi_bar(8, y + 8, 110, v.rssi)
            end
        end
    end

    -- Mode guidance
    local mode_label = modes[state.mode]
    text("Mode: " .. mode_label, 8, 118, "bold")
    if mode_label == "SCAN" then
        text("Ambient RF sonar.", 8, 134, "small")
        text("SELECT: passive scan.", 8, 146, "small")
    elseif mode_label == "BROADCAST" then
        text("You are loud & visible.", 8, 134, "small")
        text("Use for performance/vibe.", 8, 146, "small")
    else
        text("Stealth guidance.", 8, 134, "small")
        text("Limit AP/BLE beacons.", 8, 146, "small")
    end
end

function draw()
    onion.display_begin()
    onion.clear_display()
    draw_header()

    if state.scan_phase ~= "idle" and state.scan_phase ~= "done" then
        centered("SCANNING...", 76, "large", 12)
        centered(state.status, 106, "small", 6)
    elseif state.page == 1 then
        draw_summary()
    elseif state.page == 2 then
        draw_list(state.wifi, 36, 5, "wifi")
    elseif state.page == 3 then
        draw_list(state.ble, 36, 5, "ble")
    elseif state.page == 4 then
        draw_list(state.subghz, 36, 5, "subghz")
    else
        draw_security()
    end

    line(6, H - 22, W - 6, H - 22)
    text(state.status, 8, H - 16, "small")
    onion.display_commit()
    state.dirty = false
end

----------------------------------------------------------------
-- Mode switching
----------------------------------------------------------------

local function next_mode()
    state.mode = state.mode + 1
    if state.mode > #modes then state.mode = 1 end
    state.status = "Mode: " .. modes[state.mode]
end

----------------------------------------------------------------
-- Main
----------------------------------------------------------------

detect_caps()
onion.log("stealth_rf_hud: start")
wait_for_release()

while true do
    if state.dirty then draw() end

    update_scan()
    poll_viewers()

    local buttons = onion.buttons()
    local pressed = edge(buttons)
    if pressed then state.dirty = true end

    -- Track select hold for mode change
    if buttons.select and not state.select_down_ms then
        state.select_down_ms = onion.millis()
    elseif not buttons.select and state.select_down_ms then
        local held_ms = onion.millis() - state.select_down_ms
        state.select_down_ms = nil
        if held_ms > 800 then
            next_mode()
        elseif pressed == "select" then
            -- Short press SELECT behavior depends on mode
            if state.mode == 3 then
                -- STEALTH: avoid auto-scan, require long SELECT for mode changes only
                state.status = "Stealth: manual only. Hold SELECT: mode."
                state.dirty = true
            else
                start_scan()
            end
        end
    end

    if pressed == "cancel" then
        break
    elseif pressed == "right" then
        state.page = state.page + 1
        if state.page > #pages then state.page = 1 end
    elseif pressed == "left" then
        state.page = state.page - 1
        if state.page < 1 then state.page = #pages end
    end

    state.last_buttons = buttons
    onion.sleep(POLL_MS)
end

if state.caps.subghz and has("subghz_end") then onion.subghz_end() end
onion.log("stealth_rf_hud: done")
onion.release_display()