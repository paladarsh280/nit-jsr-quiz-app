// node debug-supabase.js
const { createClient } = require('@supabase/supabase-js');

// Mock WebSocket to log what supabase-js sends
class MockWebSocket {
    constructor(url) {
        console.log('Connecting to:', url);
        this.url = url;
        setTimeout(() => this.onopen && this.onopen(), 100);
    }
    send(data) {
        console.log('--- SENT ---');
        console.log(JSON.stringify(JSON.parse(data), null, 2));
    }
    close() {}
}

global.WebSocket = MockWebSocket;

const SUPABASE_URL = 'https://ldndzmwcahhwexfcjajp.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbmR6bXdjYWhod2V4ZmNqYWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzkxMDMsImV4cCI6MjA4OTE1NTEwM30.lkox7aCLmWRc8kATdI_pYT4CjT-2mBMfsp6VBTtT7ys';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

const quizId = 'IK1DEL';

const channel = supabase
    .channel(`quiz_changes_${quizId}`)
    .on(
        'postgres_changes',
        {
            event: 'UPDATE',
            schema: 'public',
            table: 'Quiz',
            filter: `id=eq.${quizId}`
        },
        (payload) => console.log('Got payload!', payload)
    )
    .subscribe((status) => {
        console.log('Status:', status);
    });

setTimeout(() => process.exit(0), 1000);
