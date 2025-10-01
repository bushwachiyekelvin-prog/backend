import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

console.log('🧪 Testing DocuSign Webhook Integration...\n');

// Test webhook payload for different DocuSign events
const testWebhookPayloads = {
  envelopeSent: {
    event: "envelope-sent",
    data: {
      envelopeSummary: {
        envelopeId: "96e44204-cb6e-4009-ad8f-4814ef73d9c1", // Use the latest envelope ID from our test
        status: "sent",
        statusChangedDateTime: new Date().toISOString(),
        uri: "/envelopes/96e44204-cb6e-4009-ad8f-4814ef73d9c1",
        name: "Loan Offer Letter"
      }
    }
  },
  
  envelopeDelivered: {
    event: "envelope-delivered",
    data: {
      envelopeSummary: {
        envelopeId: "96e44204-cb6e-4009-ad8f-4814ef73d9c1",
        status: "delivered",
        statusChangedDateTime: new Date().toISOString(),
        uri: "/envelopes/96e44204-cb6e-4009-ad8f-4814ef73d9c1",
        name: "Loan Offer Letter"
      }
    }
  },
  
  envelopeCompleted: {
    event: "envelope-completed",
    data: {
      envelopeSummary: {
        envelopeId: "96e44204-cb6e-4009-ad8f-4814ef73d9c1",
        status: "completed",
        statusChangedDateTime: new Date().toISOString(),
        uri: "/envelopes/96e44204-cb6e-4009-ad8f-4814ef73d9c1",
        name: "Loan Offer Letter"
      }
    }
  },
  
  envelopeDeclined: {
    event: "envelope-declined",
    data: {
      envelopeSummary: {
        envelopeId: "96e44204-cb6e-4009-ad8f-4814ef73d9c1",
        status: "declined",
        statusChangedDateTime: new Date().toISOString(),
        uri: "/envelopes/96e44204-cb6e-4009-ad8f-4814ef73d9c1",
        name: "Loan Offer Letter"
      }
    }
  }
};

async function testWebhookEndpoint(payload, eventName) {
  // Handle multiple URLs in APP_URL (comma-separated)
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const baseUrl = appUrl.includes(',') ? appUrl.split(',')[1].trim() : appUrl;
  const webhookUrl = `${baseUrl}/webhooks/docusign`;
  
  console.log(`📡 Testing ${eventName}...`);
  console.log(`   URL: ${webhookUrl}`);
  console.log(`   Payload:`, JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`   ✅ Success:`, result);
    } else {
      const error = await response.text();
      console.log(`   ❌ Error (${response.status}):`, error);
    }
  } catch (error) {
    console.log(`   ❌ Network Error:`, error.message);
  }
  
  console.log('');
}

async function testHealthEndpoint() {
  // Handle multiple URLs in APP_URL (comma-separated)
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const baseUrl = appUrl.includes(',') ? appUrl.split(',')[1].trim() : appUrl;
  const healthUrl = `${baseUrl}/webhooks/health`;
  
  console.log('🏥 Testing webhook health endpoint...');
  console.log(`   URL: ${healthUrl}`);
  
  try {
    const response = await fetch(healthUrl);
    
    if (response.ok) {
      const result = await response.json();
      console.log(`   ✅ Health check passed:`, result);
    } else {
      console.log(`   ❌ Health check failed (${response.status})`);
    }
  } catch (error) {
    console.log(`   ❌ Health check error:`, error.message);
  }
  
  console.log('');
}

async function runTests() {
  // Handle multiple URLs in APP_URL (comma-separated)
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const baseUrl = appUrl.includes(',') ? appUrl.split(',')[1].trim() : appUrl;
  
  console.log('🔧 Webhook Configuration:');
  console.log(`   APP_URL: ${appUrl}`);
  console.log(`   Using Base URL: ${baseUrl}`);
  console.log(`   Webhook URL: ${baseUrl}/webhooks/docusign`);
  console.log(`   Health URL: ${baseUrl}/webhooks/health`);
  console.log('');
  
  // Test health endpoint first
  await testHealthEndpoint();
  
  // Test different webhook events
  await testWebhookEndpoint(testWebhookPayloads.envelopeSent, 'Envelope Sent');
  await testWebhookEndpoint(testWebhookPayloads.envelopeDelivered, 'Envelope Delivered');
  await testWebhookEndpoint(testWebhookPayloads.envelopeCompleted, 'Envelope Completed (Signed)');
  await testWebhookEndpoint(testWebhookPayloads.envelopeDeclined, 'Envelope Declined');
  
  console.log('🎯 Webhook Testing Complete!');
  console.log('');
  console.log('📋 Next Steps:');
  console.log('   1. Make sure your server is running (bun run dev)');
  console.log('   2. Set up webhook URL in DocuSign Connect');
  console.log('   3. Use ngrok or similar for public URL if testing locally');
}

// Run the tests
runTests().catch(console.error);
