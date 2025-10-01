import { config } from 'dotenv';
import { db } from './src/db/client.js';
import { offerLetters } from './src/db/schema/offerLetters.js';
import { eq, and, isNull } from 'drizzle-orm';

// Load environment variables
config({ path: '.env.local' });
config({ path: '.env' });

console.log('🧪 Testing Complete DocuSign + Webhook Flow...\n');

async function checkRecentOfferLetters() {
  console.log('📊 Checking recent offer letters in database...');
  
  try {
    const recentOffers = await db.query.offerLetters.findMany({
      where: isNull(offerLetters.deletedAt),
      orderBy: (offerLetters, { desc }) => [desc(offerLetters.createdAt)],
      limit: 3,
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
      console.log(`   Created: ${offer.createdAt.toLocaleString()}`);
    });
    
    return recentOffers;
  } catch (error) {
    console.error('❌ Database error:', error);
    return [];
  }
}

async function testWebhookWithRealEnvelope(envelopeId) {
  const NGROK_URL = 'https://09bcf1218a50.ngrok-free.app';
  
  console.log(`\n📡 Testing webhook with real envelope: ${envelopeId}`);
  
  const webhookEvents = [
    {
      name: "Envelope Delivered",
      event: {
        event: "envelope-delivered",
        data: {
          envelopeSummary: {
            envelopeId: envelopeId,
            status: "delivered",
            statusChangedDateTime: new Date().toISOString(),
            uri: `/envelopes/${envelopeId}`,
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
            envelopeId: envelopeId,
            status: "completed",
            statusChangedDateTime: new Date().toISOString(),
            uri: `/envelopes/${envelopeId}`,
            name: "Loan Offer Letter"
          }
        }
      }
    }
  ];
  
  for (const webhookEvent of webhookEvents) {
    console.log(`\n   Testing: ${webhookEvent.name}`);
    
    try {
      const response = await fetch(`${NGROK_URL}/webhooks/docusign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify(webhookEvent.event)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`   ✅ ${webhookEvent.name} webhook successful!`);
      } else {
        const error = await response.text();
        console.log(`   ❌ ${webhookEvent.name} webhook failed (${response.status}):`, error.substring(0, 200));
      }
    } catch (error) {
      console.log(`   ❌ ${webhookEvent.name} webhook error:`, error.message);
    }
    
    // Wait between events
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function checkStatusAfterWebhook(envelopeId) {
  console.log(`\n🔍 Checking offer letter status after webhook...`);
  
  try {
    const offer = await db.query.offerLetters.findFirst({
      where: and(
        eq(offerLetters.docuSignEnvelopeId, envelopeId),
        isNull(offerLetters.deletedAt)
      ),
      with: {
        loanApplication: true,
      }
    });
    
    if (offer) {
      console.log(`   ✅ Found offer letter:`);
      console.log(`   Status: ${offer.status}`);
      console.log(`   DocuSign Status: ${offer.docuSignStatus}`);
      console.log(`   Signed At: ${offer.signedAt || 'Not signed'}`);
      
      if (offer.loanApplication) {
        console.log(`   Loan Application Status: ${offer.loanApplication.status}`);
      }
    } else {
      console.log(`   ❌ No offer letter found for envelope ${envelopeId}`);
    }
  } catch (error) {
    console.error('❌ Error checking status:', error);
  }
}

async function runCompleteTest() {
  console.log('🎯 Complete DocuSign + Webhook Integration Test\n');
  
  // Check database first
  const offers = await checkRecentOfferLetters();
  
  if (offers.length > 0) {
    const latestOffer = offers[0];
    console.log(`\n📋 Using latest offer letter: ${latestOffer.offerNumber}`);
    
    if (latestOffer.docuSignEnvelopeId) {
      // Test webhook with real envelope
      await testWebhookWithRealEnvelope(latestOffer.docuSignEnvelopeId);
      
      // Check status after webhook
      await checkStatusAfterWebhook(latestOffer.docuSignEnvelopeId);
      
      console.log('\n📧 Email Issues to Address:');
      console.log('   1. DocuSign sends its own email with signing link');
      console.log('   2. Your app sends a separate email with offer details');
      console.log('   3. The signing URL in your app email may not work');
      console.log('   4. Consider using only DocuSign emails or improving the app email URL');
      
    } else {
      console.log('\n❌ Latest offer letter has no DocuSign envelope ID');
    }
  } else {
    console.log('\n❌ No offer letters found. Run the offer letter test first.');
  }
  
  console.log('\n🎉 Test completed! Check your server logs for webhook processing details.');
}

runCompleteTest().catch(console.error);
