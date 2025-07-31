import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  
  // Shop redact payload contains:
  // - shop_id: The shop's ID
  // - shop_domain: The shop's domain
  
  try {
    const { shop_id, shop_domain } = payload;
    
    console.log(`Shop redaction request for shop ${shop_domain} (ID: ${shop_id})`);
    
    // TODO: Implement your shop data deletion logic here
    // You need to:
    // 1. Delete ALL data associated with this shop
    // 2. This includes shop settings, configurations, analytics, logs, etc.
    // 3. This webhook is sent 48 hours after app uninstallation
    // 4. Complete the deletion within 30 days
    
    // Example: If you had a database, you would delete all shop data here
    // await deleteShopData(shop_id);
    // await deleteShopConfigurations(shop_id);
    // await deleteShopAnalytics(shop_id);
    // await deleteShopLogs(shop_id);
    
    console.log(`All data for shop ${shop_domain} (ID: ${shop_id}) has been deleted`);
    
    // Respond with 200 to acknowledge receipt and completion
    return new Response(null, { status: 200 });
    
  } catch (error) {
    console.error('Error processing shop redaction:', error);
    return new Response(null, { status: 500 });
  }
};
