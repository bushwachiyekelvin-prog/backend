import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

console.log('🧪 Testing DocuSign Webhook Locally...\n');

// Test webhook payload
const testPayload = {
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
};

async function testLocalWebhook() {
  const localUrl = 'http://localhost:8080';
  
  console.log('🔧 Testing locally first...');
  console.log(`   URL: ${localUrl}/webhooks/docusign`);
  console.log(`   Payload:`, JSON.stringify(testPayload, null, 2));
  console.log('');
  
  try {
    const response = await fetch(`${localUrl}/webhooks/docusign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`   ✅ Local webhook test successful:`, result);
    } else {
      const error = await response.text();
      console.log(`   ❌ Local webhook test failed (${response.status}):`, error);
    }
  } catch (error) {
    console.log(`   ❌ Local webhook test error:`, error.message);
  }
  
  console.log('');
  
  // Test health endpoint
  try {
    const healthResponse = await fetch(`${localUrl}/webhooks/health`);
    
    if (healthResponse.ok) {
      const result = await healthResponse.json();
      console.log(`   ✅ Health check successful:`, result);
    } else {
      console.log(`   ❌ Health check failed (${healthResponse.status})`);
    }
  } catch (error) {
    console.log(`   ❌ Health check error:`, error.message);
  }
}

testLocalWebhook().catch(console.error);
