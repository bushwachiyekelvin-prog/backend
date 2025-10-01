import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

console.log('🧪 Testing Real DocuSign Webhook Events...\n');

// Real envelope ID from our latest test
const ENVELOPE_ID = "89a51f21-7743-44cd-8e11-0e8ade958d58";
const NGROK_URL = 'https://09bcf1218a50.ngrok-free.app';

// Realistic DocuSign webhook payloads
const webhookEvents = [
  {
    name: "Envelope Sent",
    event: {
      event: "envelope-sent",
      data: {
        envelopeSummary: {
          envelopeId: ENVELOPE_ID,
          status: "sent",
          statusChangedDateTime: new Date().toISOString(),
          uri: `/envelopes/${ENVELOPE_ID}`,
          name: "Loan Offer Letter"
        }
      }
    }
  },
  {
    name: "Envelope Delivered",
    event: {
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
    }
  },
  {
    name: "Envelope Completed (Signed)",
    event: {
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
    }
  }
];

async function sendWebhookEvent(eventData, eventName) {
  console.log(`📡 Sending ${eventName} webhook...`);
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
      console.log(`   ✅ ${eventName} webhook successful!`);
      console.log(`   Response:`, result);
    } else {
      const error = await response.text();
      console.log(`   ❌ ${eventName} webhook failed (${response.status}):`, error.substring(0, 200));
    }
  } catch (error) {
    console.log(`   ❌ ${eventName} webhook error:`, error.message);
  }
  
  console.log('');
  
  // Wait a bit between events
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function testWebhookFlow() {
  console.log('🎯 Testing Complete DocuSign Webhook Flow');
  console.log(`   Using envelope: ${ENVELOPE_ID}`);
  console.log(`   ngrok URL: ${NGROK_URL}`);
  console.log('');
  
  for (const webhookEvent of webhookEvents) {
    await sendWebhookEvent(webhookEvent.event, webhookEvent.name);
  }
  
  console.log('🎉 Webhook flow test completed!');
  console.log('');
  console.log('📋 Expected Results:');
  console.log('   1. Check your server logs for webhook processing');
  console.log('   2. Database should show offer letter status updates');
  console.log('   3. Audit trail should have entries for status changes');
  console.log('   4. Final status should be "signed" for offer letter');
  console.log('   5. Loan application status should be "offer_letter_signed"');
  console.log('');
  console.log('🔍 Check your server terminal for webhook processing logs!');
}

testWebhookFlow().catch(console.error);
