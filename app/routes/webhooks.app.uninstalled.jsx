import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Log uninstall event since we're not using a database
  if (session) {
    console.log(`App uninstalled for shop: ${shop}, session: ${session.id}`);
  }

  return new Response();
};
