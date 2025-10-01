import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

console.log('🧪 Testing Webhook with New Envelope...\n');

// Fresh envelope ID from our latest test
const ENVELOPE_ID = "4071f12e-15cd-419d-873b-a133471d6061";
const NGROK_URL = 'https://09bcf1218a50.ngrok-free.app';

async function testWebhookEvent(eventName, eventData) {
  console.log(`📡 Testing ${eventName}...`);
  console.log(`   Envelope ID: ${ENVELOPE_ID}`);
  console.log(`   Event: ${eventData.event}`);
  console.log(`   Status: ${eventData.data.envelopeSummary.status}`);
  
  try {
    const response = await fetch(`${NGROK_URL}/webhooks/docusign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify(eventData)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`   ✅ ${eventName} successful!`);
      console.log(`   Response:`, result);
    } else {
      const error = await response.text();
      console.log(`   ❌ ${eventName} failed (${response.status}):`, error.substring(0, 200));
    }
  } catch (error) {
    console.log(`   ❌ ${eventName} error:`, error.message);
  }
  
  console.log('');
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function runWebhookTest() {
  console.log('🎯 Testing DocuSign Webhook with Fresh Envelope');
  console.log(`   Envelope ID: ${ENVELOPE_ID}`);
  console.log(`   ngrok URL: ${NGROK_URL}`);
  console.log('');
  
  // Test envelope delivered event
  await testWebhookEvent('Envelope Delivered', {
    event: "envelope-delivered",
    data: {
      envelopeSummary: {
        envelopeId: ENVELOPE_ID,
        status: "delivered",
        statusChangedDateTime: new Date().toISOString(),
        uri: `/envelopes/${ENVELOPE_ID}`,
        name: "Loan Offer Letter"
      }
    }
  });
  
  // Test envelope completed (signed) event
  await testWebhookEvent('Envelope Completed (Signed)', {
    event: "envelope-completed",
    data: {
      envelopeSummary: {
        envelopeId: ENVELOPE_ID,
        status: "completed",
        statusChangedDateTime: new Date().toISOString(),
        uri: `/envelopes/${ENVELOPE_ID}`,
        name: "Loan Offer Letter"
      }
    }
  });
  
  console.log('🎉 Webhook test completed!');
  console.log('');
  console.log('📋 What to check:');
  console.log('   1. Check your server logs for webhook processing');
  console.log('   2. Database should show offer letter status = "signed"');
  console.log('   3. Loan application status should be "offer_letter_signed"');
  console.log('   4. Audit trail should have entries for status changes');
  console.log('');
  console.log('📧 Email Issue Summary:');
  console.log('   • DocuSign sends email with working signing link');
  console.log('   • Your app sends email with fallback URL (may not work)');
  console.log('   • Consider using only DocuSign emails or fixing the signing URL');
}

runWebhookTest().catch(console.error);
