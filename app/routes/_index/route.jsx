import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Tailbasify Icons App</h1>
        <p className={styles.text}>
          Easily manage and display custom product icons in your Shopify store.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Icon Upload</strong>. Upload custom icons and store them directly in your Shopify admin with titles and descriptions.
          </li>
          <li>
            <strong>Theme Integration</strong>. Display your uploaded icons seamlessly in your storefront using our theme extension blocks.
          </li>
          <li>
            <strong>Easy Management</strong>. Simple interface to manage your store icons and organize them by product categories.
          </li>
        </ul>
      </div>
    </div>
  );
}
