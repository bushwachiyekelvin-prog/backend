import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

console.log('🧪 Testing Webhook with Persistent Data...\n');

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
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait longer for processing
}

async function runPersistentTest() {
  console.log('🎯 Testing DocuSign Webhook with Persistent Data');
  console.log(`   Envelope ID: ${ENVELOPE_ID}`);
  console.log(`   ngrok URL: ${NGROK_URL}`);
  console.log('');
  console.log('⚠️  Note: This test will NOT clean up the data so webhooks can process it');
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
  
  // Wait a bit before the next event
  console.log('⏳ Waiting 3 seconds before next event...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
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
  
  console.log('🎉 Persistent webhook test completed!');
  console.log('');
  console.log('📋 Next Steps:');
  console.log('   1. Check your server logs for detailed webhook processing');
  console.log('   2. The offer letter should now be found in the database');
  console.log('   3. Database should show status updates');
  console.log('   4. Audit trail should have entries');
  console.log('');
  console.log('💡 If still getting "No offer letter found", the issue might be:');
  console.log('   • Database cleanup happening too early');
  console.log('   • Different envelope ID in database vs webhook');
  console.log('   • Database transaction timing issue');
}

runPersistentTest().catch(console.error);
