import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

console.log('🧪 Testing Real DocuSign Webhook Format...\n');

// Fresh envelope ID from our latest test
const ENVELOPE_ID = "4071f12e-15cd-419d-873b-a133471d6061";
const NGROK_URL = 'https://09bcf1218a50.ngrok-free.app';

async function testRealDocuSignFormat(eventName, eventData) {
  console.log(`📡 Testing ${eventName} (Real DocuSign Format)...`);
  console.log(`   Envelope ID: ${ENVELOPE_ID}`);
  console.log(`   Event: ${eventData.event}`);
  console.log(`   Payload:`, JSON.stringify(eventData, null, 2));
  
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
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function runRealDocuSignTest() {
  console.log('🎯 Testing Real DocuSign Webhook Format');
  console.log(`   Envelope ID: ${ENVELOPE_ID}`);
  console.log(`   ngrok URL: ${NGROK_URL}`);
  console.log('');
  
  // Test with real DocuSign format (envelope-delivered)
  await testRealDocuSignFormat('Envelope Delivered (Real Format)', {
    event: "envelope-delivered",
    apiVersion: "v2.1",
    uri: `/restapi/v2.1/accounts/a6a37058-88e9-4f41-bec6-598f9efc8f67/envelopes/${ENVELOPE_ID}`,
    retryCount: 0,
    configurationId: 21899018,
    generatedDateTime: new Date().toISOString(),
    data: {
      accountId: "a6a37058-88e9-4f41-bec6-598f9efc8f67",
      userId: "b3fabbe7-7b33-4b34-bf0d-d353a4902731",
      envelopeId: ENVELOPE_ID
    }
  });
  
  // Test with real DocuSign format (envelope-completed)
  await testRealDocuSignFormat('Envelope Completed (Real Format)', {
    event: "envelope-completed",
    apiVersion: "v2.1",
    uri: `/restapi/v2.1/accounts/a6a37058-88e9-4f41-bec6-598f9efc8f67/envelopes/${ENVELOPE_ID}`,
    retryCount: 0,
    configurationId: 21899018,
    generatedDateTime: new Date().toISOString(),
    data: {
      accountId: "a6a37058-88e9-4f41-bec6-598f9efc8f67",
      userId: "b3fabbe7-7b33-4b34-bf0d-d353a4902731",
      envelopeId: ENVELOPE_ID
    }
  });
  
  console.log('🎉 Real DocuSign format test completed!');
  console.log('');
  console.log('📋 Expected Results:');
  console.log('   1. No more 500 errors');
  console.log('   2. Webhook processing should work');
  console.log('   3. Check server logs for detailed processing');
  console.log('   4. Database should be updated (if offer letter exists)');
}

runRealDocuSignTest().catch(console.error);
