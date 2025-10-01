import 'dotenv/config';
import { db } from './src/db/client.js';
import { users } from './src/db/schema/users.js';
import { businessProfiles } from './src/db/schema/businessProfiles.js';
import { loanApplications } from './src/db/schema/loanApplications.js';
import { offerLetters } from './src/db/schema/offerLetters.js';
import { loanProducts } from './src/db/schema/loanProducts.js';
import { eq } from 'drizzle-orm';
import { OfferLettersService } from './src/modules/offer-letters/offer-letters.service.js';

async function testFullOfferLetter() {
  try {
    console.log('🚀 Testing full offer letter workflow with DocuSign...');
    
    // Use existing user or create with unique email
    const testEmail = 'kelybush+sign@gmail.com';
    let testUser = await db.query.users.findFirst({
      where: eq(users.email, testEmail),
    });
    
    if (!testUser) {
      const testClerkId = `test_clerk_${Date.now()}`;
      const [newUser] = await db.insert(users).values({
        clerkId: testClerkId,
        email: testEmail,
        firstName: 'Kely',
        lastName: 'Bush',
        phoneNumber: '+1234567890',
      }).returning();
      testUser = newUser;
    }
    
    console.log('✅ Using test user:', testUser.email);
    
    // Create test business profile
    const [testBusiness] = await db.insert(businessProfiles).values({
      userId: testUser.id,
      name: 'Test Business LLC',
      description: 'A test business for offer letter testing',
      country: 'US',
      city: 'Test City',
      address: '123 Test St, Test City, TC 12345',
    }).returning();
    
    console.log('✅ Created test business:', testBusiness.name);
    
    // Get a loan product
    const [loanProduct] = await db.select().from(loanProducts).limit(1);
    if (!loanProduct) {
      throw new Error('No loan products found. Please create a loan product first.');
    }
    
    console.log('✅ Using loan product:', loanProduct.name);
    
    // Create loan application
    const [loanApp] = await db.insert(loanApplications).values({
      userId: testUser.id,
      businessId: testBusiness.id,
      loanProductId: loanProduct.id,
      applicationNumber: `TEST-${Date.now()}`,
      loanAmount: 50000,
      loanTerm: 12,
      currency: 'USD',
      purpose: 'business_expansion',
      purposeDescription: 'Funding for new equipment and hiring',
      isBusinessLoan: true,
      status: 'approved',
    }).returning();
    
    console.log('✅ Created loan application:', loanApp.applicationNumber);
    
    // Create offer letter
    const [offerLetter] = await db.insert(offerLetters).values({
      loanApplicationId: loanApp.id,
      offerNumber: `OFFER-${Date.now()}`,
      offerAmount: '50000.00',
      currency: 'USD',
      offerTerm: 12,
      interestRate: '12.5',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      specialConditions: 'This is a test offer letter for demonstration purposes.',
      requiresGuarantor: true,
      requiresCollateral: false,
      status: 'draft',
      docuSignStatus: 'not_sent',
      recipientEmail: testEmail,
      recipientName: 'Kely Bush',
      createdBy: testUser.id,
    }).returning();
    
    console.log('✅ Created offer letter:', offerLetter.offerNumber);
    
    // Send the offer letter using DocuSign
    console.log('📧 Sending offer letter via DocuSign...');
    const result = await OfferLettersService.sendOfferLetter(
      testUser.clerkId,
      offerLetter.id,
      {
        recipientEmail: testEmail,
        recipientName: 'Kely Bush',
        docuSignTemplateId: 'default', // This will create a minimal envelope
      }
    );
    
    console.log('✅ Offer letter sent successfully!');
    console.log('📋 Result:', result);
    
    // Cleanup test data
    console.log('🧹 Cleaning up test data...');
    await db.delete(offerLetters).where(eq(offerLetters.id, offerLetter.id));
    await db.delete(loanApplications).where(eq(loanApplications.id, loanApp.id));
    await db.delete(businessProfiles).where(eq(businessProfiles.id, testBusiness.id));
    // Don't delete the user as it might be used elsewhere
    
    console.log('✅ Test completed successfully!');
    console.log('📧 Check your email at kelybush+sign@gmail.com for the DocuSign envelope');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

testFullOfferLetter();
