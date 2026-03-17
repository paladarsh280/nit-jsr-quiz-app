// ============================================================
// NIT JSR Quiz App — Load Test (150 Concurrent Students)
// ============================================================
// Chalane ka tarika:
//   1. k6 install karo: winget install k6
//   2. QUIZ_ID update karo (niche)
//   3. Run: k6 run load-test.js
// ============================================================

import ws from 'k6/ws';
import { sleep, check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// ─── CONFIG ─────────────────────────────────────────────────
const SUPABASE_URL = 'https://ldndzmwcahhwexfcjajp.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbmR6bXdjYWhod2V4ZmNqYWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzkxMDMsImV4cCI6MjA4OTE1NTEwM30.lkox7aCLmWRc8kATdI_pYT4CjT-2mBMfsp6VBTtT7ys';

// ⚠️  YAHAN APNA LIVE QUIZ ID DALO (professor ne quiz start kiya ho)
// URL se copy karo (http://localhost:3000/professor/quiz/cmm... jaisa lamba ID, NOT the 6-letter join code)
const QUIZ_ID = 'cmmv4f553001ag8v31pgzsuq2';
// ─────────────────────────────────────────────────────────────

// Custom Metrics
const eventsReceived = new Counter('realtime_events_received');   // Kitne Realtime events mile
const connectionTime = new Trend('ws_connection_time_ms');        // Connection kitni fast hui
const eventLatency = new Trend('event_delivery_latency_ms');    // Event milne mein kitna time

// Test Configuration
export const options = {
    stages: [
        { duration: '15s', target: 50 },  // 0 → 50  students in 15s
        { duration: '20s', target: 150 },  // 50 → 150 students in 20s  ← PEAK LOAD
        { duration: '60s', target: 150 },  // 150 students hold for 1 min
        { duration: '10s', target: 0 },  // Ramp down
    ],
    thresholds: {
        // Yeh pass hone chahiye (fail = red output)
        'ws_connection_time_ms': ['p(95)<3000'],       // 95% connections < 3 sec mein
        'realtime_events_received': ['count>0'],        // Atleast 1 event mila
        'event_delivery_latency_ms': ['p(95)<2000'],   // 95% events < 2 sec mein deliver
    },
};

export default function () {
    const startTime = Date.now();

    // Cloudflare/WAF DDoS protection bypass - Stagger connections
    sleep(Math.random() * 5); // Random delay between 0 and 5 seconds

    const wsUrl = `${SUPABASE_URL.replace('https://', 'wss://')}/realtime/v1/websocket?apikey=${ANON_KEY}&vsn=2.0.0`;

    const res = ws.connect(wsUrl, {}, function (socket) {
        // Connection time record karo
        connectionTime.add(Date.now() - startTime);

        socket.on('open', function () {
            // Supabase Realtime heartbeat - Send exactly ONCE every 15 seconds
            socket.setInterval(function timeout() {
                socket.send(JSON.stringify({
                    topic: 'phoenix',
                    event: 'heartbeat',
                    payload: {},
                    ref: String(Date.now())
                }));
            }, 15000);

            // Quiz table changes subscribe karo (bilkul real student browser jaisa)
            socket.send(JSON.stringify({
                topic: `realtime:quiz_changes_${QUIZ_ID}`,
                event: 'phx_join',
                payload: {
                    config: {
                        broadcast: { ack: false, self: false },
                        presence: { key: "" },
                        postgres_changes: [{
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'Quiz',
                            filter: `id=eq.${QUIZ_ID}`
                        }]
                    },
                    access_token: ANON_KEY
                },
                ref: '2'
            }));
        });

        socket.on('message', function (data) {
            try {
                const msg = JSON.parse(data);

                // Subscription confirm hua?
                if (msg.event === 'phx_reply' && msg.payload?.status === 'ok') {
                    // Good — subscribed successfully
                }

                // Postgres UPDATE event mila? (Professor ne question change kiya)
                if (msg.event === 'postgres_changes' || msg.payload?.type === 'broadcast') {
                    eventsReceived.add(1);
                    const latency = Date.now() - startTime;
                    eventLatency.add(latency);
                    console.log(`[VU ${__VU}] 🎯 Got Realtime event! Latency: ${latency}ms`);
                }
            } catch (e) {
                // Ignore parse errors
            }
        });

        socket.on('error', function (e) {
            console.error(`[VU ${__VU}] ❌ WS Error: ${e.error()}`);
        });

        socket.on('close', function () {
            // Connection closed
        });

        // 90 second tak connected raho 
        sleep(90);
    });

    check(res, {
        '✅ WebSocket connected (101)': (r) => r && r.status === 101,
    });
}

export function handleSummary(data) {
    // Final summary print karo
    const checks = data.metrics.checks;
    const passed = checks?.values?.passes || 0;
    const failed = checks?.values?.fails || 0;
    const connTime = data.metrics.ws_connection_time_ms;
    const events = data.metrics.realtime_events_received;
    const lat = data.metrics.event_delivery_latency_ms;

    const summary = `
╔══════════════════════════════════════════════════════╗
║         NIT JSR Quiz — Load Test Results             ║
╠══════════════════════════════════════════════════════╣
║ CONNECTIONS                                          ║
║  ✅ Successful : ${String(passed).padEnd(35)}║
║  ❌ Failed     : ${String(failed).padEnd(35)}║
║  Avg Connect  : ${String(Math.round(connTime?.values?.avg || 0) + 'ms').padEnd(35)}║
║  P95 Connect  : ${String(Math.round(connTime?.values?.['p(95)'] || 0) + 'ms').padEnd(35)}║
╠══════════════════════════════════════════════════════╣
║ REALTIME EVENTS                                      ║  
║  Events Got   : ${String(events?.values?.count || 0).padEnd(35)}║
║  Avg Latency  : ${String(Math.round(lat?.values?.avg || 0) + 'ms').padEnd(35)}║
║  P95 Latency  : ${String(Math.round(lat?.values?.['p(95)'] || 0) + 'ms').padEnd(35)}║
╚══════════════════════════════════════════════════════╝
`;
    return {
        stdout: summary,
        'load-test-result.txt': summary,  // File mein bhi save hoga
    };
}
