import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // After successful authentication, redirect to the main app UI
  return redirect("/app");
};
