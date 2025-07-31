import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  
  // Customer data request payload contains:
  // - shop_id: The shop's ID
  // - shop_domain: The shop's domain
  // - orders_requested: Array of order IDs (if any)
  // - customer: Customer object with ID and email
  
  try {
    const { shop_id, shop_domain, customer, orders_requested } = payload;
    
    console.log(`Data request for customer ${customer.id} (${customer.email}) from shop ${shop_domain}`);
    
    // TODO: Implement your data retrieval logic here
    // You need to:
    // 1. Collect all personal data you have stored for this customer
    // 2. Format it appropriately 
    // 3. Provide it to the store owner (outside of this webhook)
    
    // For now, just log the request
    if (orders_requested && orders_requested.length > 0) {
      console.log(`Orders requested: ${orders_requested.join(', ')}`);
    }
    
    // Respond with 200 to acknowledge receipt
    return new Response(null, { status: 200 });
    
  } catch (error) {
    console.error('Error processing customer data request:', error);
    return new Response(null, { status: 500 });
  }
};
