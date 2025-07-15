import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  const current = payload.current;

  // Log scope changes since we're not using a database
  if (session) {
    console.log(`Session ${session.id} scopes updated to: ${current.toString()}`);
  }

  return new Response();
};
