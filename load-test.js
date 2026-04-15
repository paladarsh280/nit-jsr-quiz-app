

import ws from 'k6/ws';
import { sleep, check } from 'k6';
import { Counter, Trend } from 'k6/metrics';


const SUPABASE_URL = 'https://ldndzmwcahhwexfcjajp.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbmR6bXdjYWhod2V4ZmNqYWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzkxMDMsImV4cCI6MjA4OTE1NTEwM30.lkox7aCLmWRc8kATdI_pYT4CjT-2mBMfsp6VBTtT7ys';

const QUIZ_ID = 'cmmv4f553001ag8v31pgzsuq2';

const eventsReceived = new Counter('realtime_events_received');
const connectionTime = new Trend('ws_connection_time_ms');
const eventLatency = new Trend('event_delivery_latency_ms');


export const options = {
    stages: [
        { duration: '15s', target: 50 },
        { duration: '20s', target: 150 },
        { duration: '60s', target: 150 },
        { duration: '10s', target: 0 },
    ],
    thresholds: {

        'ws_connection_time_ms': ['p(95)<3000'],
        'realtime_events_received': ['count>0'],
        'event_delivery_latency_ms': ['p(95)<2000'],
    },
};

export default function () {
    const startTime = Date.now();


    sleep(Math.random() * 5);

    const wsUrl = `${SUPABASE_URL.replace('https://', 'wss://')}/realtime/v1/websocket?apikey=${ANON_KEY}&vsn=2.0.0`;

    const res = ws.connect(wsUrl, {}, function (socket) {

        connectionTime.add(Date.now() - startTime);

        socket.on('open', function () {

            socket.setInterval(function timeout() {
                socket.send(JSON.stringify({
                    topic: 'phoenix',
                    event: 'heartbeat',
                    payload: {},
                    ref: String(Date.now())
                }));
            }, 15000);


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


                if (msg.event === 'phx_reply' && msg.payload?.status === 'ok') {

                }


                if (msg.event === 'postgres_changes' || msg.payload?.type === 'broadcast') {
                    eventsReceived.add(1);
                    const latency = Date.now() - startTime;
                    eventLatency.add(latency);
                    console.log(`[VU ${__VU}] 🎯 Got Realtime event! Latency: ${latency}ms`);
                }
            } catch (e) {
            }
        });

        socket.on('error', function (e) {
            console.error(`[VU ${__VU}] ❌ WS Error: ${e.error()}`);
        });

        socket.on('close', function () {

        });


        sleep(90);
    });

    check(res, {
        '✅ WebSocket connected (101)': (r) => r && r.status === 101,
    });
}

export function handleSummary(data) {

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
        'load-test-result.txt': summary,
    };
}
