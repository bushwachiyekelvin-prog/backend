import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

console.log('🧪 Testing DocuSign Webhook via ngrok...\n');

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

async function testNgrokWebhook() {
  const ngrokUrl = 'https://09bcf1218a50.ngrok-free.app';
  
  console.log('🌐 Testing via ngrok...');
  console.log(`   URL: ${ngrokUrl}/webhooks/docusign`);
  console.log(`   Payload:`, JSON.stringify(testPayload, null, 2));
  console.log('');
  
  try {
    const response = await fetch(`${ngrokUrl}/webhooks/docusign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true' // Skip ngrok browser warning
      },
      body: JSON.stringify(testPayload)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`   ✅ ngrok webhook test successful:`, result);
    } else {
      const error = await response.text();
      console.log(`   ❌ ngrok webhook test failed (${response.status}):`, error.substring(0, 500));
    }
  } catch (error) {
    console.log(`   ❌ ngrok webhook test error:`, error.message);
  }
  
  console.log('');
  
  // Test health endpoint via ngrok
  try {
    const healthResponse = await fetch(`${ngrokUrl}/webhooks/health`, {
      headers: {
        'ngrok-skip-browser-warning': 'true'
      }
    });
    
    if (healthResponse.ok) {
      const result = await healthResponse.json();
      console.log(`   ✅ ngrok health check successful:`, result);
    } else {
      console.log(`   ❌ ngrok health check failed (${healthResponse.status})`);
    }
  } catch (error) {
    console.log(`   ❌ ngrok health check error:`, error.message);
  }
}

testNgrokWebhook().catch(console.error);
