import { config } from 'dotenv';
import { db } from './src/db/client.js';
import { offerLetters } from './src/db/schema/offerLetters.js';
import { eq, and, isNull } from 'drizzle-orm';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

console.log('🔍 Debugging Webhook Issues...\n');

async function checkDatabase() {
  console.log('📊 Checking database for offer letters...');
  
  try {
    // Get all recent offer letters
    const recentOffers = await db.query.offerLetters.findMany({
      where: isNull(offerLetters.deletedAt),
      orderBy: (offerLetters, { desc }) => [desc(offerLetters.createdAt)],
      limit: 5,
      with: {
        loanApplication: true,
      }
    });
    
    console.log(`Found ${recentOffers.length} offer letters:`);
    recentOffers.forEach((offer, index) => {
      console.log(`\n${index + 1}. Offer Letter:`);
      console.log(`   ID: ${offer.id}`);
      console.log(`   Offer Number: ${offer.offerNumber}`);
      console.log(`   Status: ${offer.status}`);
      console.log(`   DocuSign Status: ${offer.docuSignStatus}`);
      console.log(`   DocuSign Envelope ID: ${offer.docuSignEnvelopeId}`);
      console.log(`   Offer Letter URL: ${offer.offerLetterUrl}`);
      console.log(`   Created: ${offer.createdAt}`);
    });
    
    return recentOffers;
  } catch (error) {
    console.error('❌ Database error:', error);
    return [];
  }
}

async function testWebhookWithCorrectEnvelope(envelopeId) {
  const NGROK_URL = 'https://09bcf1218a50.ngrok-free.app';
  
  const testPayload = {
    event: "envelope-completed",
    data: {
      envelopeSummary: {
        envelopeId: envelopeId,
        status: "completed",
        statusChangedDateTime: new Date().toISOString(),
        uri: `/envelopes/${envelopeId}`,
        name: "Loan Offer Letter"
      }
    }
  };
  
  console.log(`\n📡 Testing webhook with envelope: ${envelopeId}`);
  console.log(`   URL: ${NGROK_URL}/webhooks/docusign`);
  
  try {
    const response = await fetch(`${NGROK_URL}/webhooks/docusign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify(testPayload)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`   ✅ Webhook successful:`, result);
    } else {
      const error = await response.text();
      console.log(`   ❌ Webhook failed (${response.status}):`, error.substring(0, 300));
    }
  } catch (error) {
    console.log(`   ❌ Webhook error:`, error.message);
  }
}

async function debugWebhook() {
  // Check database first
  const offers = await checkDatabase();
  
  if (offers.length > 0) {
    // Test with the most recent envelope ID
    const latestOffer = offers[0];
    if (latestOffer.docuSignEnvelopeId) {
      await testWebhookWithCorrectEnvelope(latestOffer.docuSignEnvelopeId);
    } else {
      console.log('\n❌ Latest offer letter has no DocuSign envelope ID');
    }
  } else {
    console.log('\n❌ No offer letters found in database');
  }
  
  console.log('\n📋 Summary of Issues:');
  console.log('   1. Update DocuSign Connect URL to: https://09bcf1218a50.ngrok-free.app/webhooks/docusign');
  console.log('   2. The signing URL issue is likely due to the fallback URL being used');
  console.log('   3. Check that the envelope ID in the webhook matches an existing offer letter');
}

debugWebhook().catch(console.error);
