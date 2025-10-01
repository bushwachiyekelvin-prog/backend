import 'dotenv/config';
import { docuSignService } from './src/services/docusign.service.js';

async function testDocuSignAuth() {
  try {
    console.log('🔐 Testing DocuSign authentication...');
    
    // Test getting access token
    console.log('📋 DocuSign Configuration:');
    console.log('Integration Key:', process.env.DOCUSIGN_INTEGRATION_KEY ? 'Set ✓' : 'Missing ✗');
    console.log('User ID:', process.env.DOCUSIGN_USER_ID ? 'Set ✓' : 'Missing ✗');
    console.log('Account ID:', process.env.DOCUSIGN_ACCOUNT_ID ? 'Set ✓' : 'Missing ✗');
    console.log('Private Key:', process.env.DOCUSIGN_PRIVATE_KEY ? 'Set ✓' : 'Missing ✗');
    console.log('Base URL:', process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi');
    
    if (process.env.DOCUSIGN_PRIVATE_KEY) {
      console.log('Private Key Length:', process.env.DOCUSIGN_PRIVATE_KEY.length);
      console.log('Private Key Starts with:', process.env.DOCUSIGN_PRIVATE_KEY.substring(0, 50) + '...');
    }
    
    console.log('\n🔑 Testing access token...');
    const accessToken = await docuSignService.getAccessToken();
    console.log('✅ Access token obtained successfully!');
    console.log('Token length:', accessToken.length);
    console.log('Token starts with:', accessToken.substring(0, 20) + '...');
    
    console.log('\n🏢 Testing account ID...');
    const accountId = await docuSignService.getAccountId();
    console.log('✅ Account ID obtained successfully!');
    console.log('Account ID:', accountId);
    
  } catch (error) {
    console.error('❌ DocuSign authentication failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Provide troubleshooting tips
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Verify your DocuSign credentials in .env.local');
    console.log('2. Make sure you\'re using the correct environment (demo vs production)');
    console.log('3. Check that your private key is properly formatted with \\n for newlines');
    console.log('4. Ensure your Integration Key has the correct permissions');
    console.log('5. Verify your User ID matches your DocuSign account');
  }
}

testDocuSignAuth();
