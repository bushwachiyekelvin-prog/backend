import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

console.log('🔧 DocuSign Webhook Setup Guide\n');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const WEBHOOK_URL = `${APP_URL}/webhooks/docusign`;

console.log('📋 Webhook Configuration:');
console.log(`   App URL: ${APP_URL}`);
console.log(`   Webhook URL: ${WEBHOOK_URL}`);
console.log('');

console.log('🚀 Step-by-Step Setup Instructions:\n');

console.log('1️⃣  Set up a public URL (if testing locally):');
console.log('   Option A - Using ngrok:');
console.log('     • Install ngrok: https://ngrok.com/download');
console.log('     • Run: ngrok http 3000');
console.log('     • Copy the HTTPS URL (e.g., https://abc123.ngrok.io)');
console.log('     • Update your webhook URL to: https://abc123.ngrok.io/webhooks/docusign');
console.log('');

console.log('   Option B - Deploy to a server:');
console.log('     • Deploy your app to Heroku, Railway, or similar');
console.log('     • Use your production URL');
console.log('');

console.log('2️⃣  Configure DocuSign Connect:');
console.log('   a) Go to DocuSign Admin Console: https://admin.docusign.com');
console.log('   b) Navigate to: Integrations → Connect');
console.log('   c) Click "Add Configuration"');
console.log('   d) Fill in the details:');
console.log(`      • Name: Melanin Kapital Webhook`);
console.log(`      • URL: ${WEBHOOK_URL}`);
console.log(`      • Logging Level: Information`);
console.log('   e) Select events to monitor:');
console.log('      ✅ Envelope Sent');
console.log('      ✅ Envelope Delivered');
console.log('      ✅ Envelope Completed');
console.log('      ✅ Envelope Declined');
console.log('      ✅ Envelope Voided');
console.log('   f) Authentication: None (for now)');
console.log('   g) Save the configuration');
console.log('');

console.log('3️⃣  Test the webhook:');
console.log('   • Run: bun test-webhook.js');
console.log('   • Or manually trigger events in DocuSign');
console.log('   • Check your server logs for webhook events');
console.log('');

console.log('4️⃣  Monitor webhook events:');
console.log('   • DocuSign Connect will send HTTP POST requests to your webhook URL');
console.log('   • Your server will process these events and update offer letter status');
console.log('   • Check the audit trail in your database for status updates');
console.log('');

console.log('🔍 Troubleshooting:');
console.log('   • Make sure your server is running and accessible');
console.log('   • Check server logs for webhook processing errors');
console.log('   • Verify the webhook URL is correct in DocuSign Connect');
console.log('   • Test with the health endpoint: GET /webhooks/health');
console.log('');

console.log('📚 Webhook Event Types:');
console.log('   • envelope-sent: Offer letter was sent to recipient');
console.log('   • envelope-delivered: Recipient received the email');
console.log('   • envelope-completed: Recipient signed the document');
console.log('   • envelope-declined: Recipient declined to sign');
console.log('   • envelope-voided: Document was voided/cancelled');
console.log('');

console.log('🎯 Expected Behavior:');
console.log('   • When envelope is completed → offer letter status = "signed"');
console.log('   • When envelope is declined → offer letter status = "declined"');
console.log('   • Loan application status will also be updated accordingly');
console.log('   • Audit trail entries will be created for all status changes');
console.log('');

console.log('Ready to set up your webhook! 🚀');
