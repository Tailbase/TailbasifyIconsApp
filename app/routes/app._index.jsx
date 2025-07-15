// app/routes/app._index.jsx
import { Card, Page, DropZone, Thumbnail, LegacyStack, Text, Banner, Spinner, TextField, Button } from "@shopify/polaris";
// ...existing code...
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { useState, useCallback } from "react";
import shopify from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await shopify.authenticate.admin(request);
  
  // console.log("Checking current metafield...");
  const response = await admin.graphql(`
    query {
      shop {
        id
        metafields(first: 1, keys: ["custom.store_icon"]) {
          edges {
            node {
              id
              namespace
              key
              value
              type
              reference {
            ... on MediaImage {
              id
              image {
                url
              }
            }
            ... on File {
              id
              alt
              fileStatus
              preview {
                image {
                  url
                }
              }
            }
          }
            }
          }
        }
      }
    }
  `);

  const { data } = await response.json();
  const metafield = data?.shop?.metafields?.edges[0]?.node;
  //console.log("Current metafield data:", JSON.stringify(metafield, null, 2));
    const imageUrl = metafield?.reference?.image?.url || 
                  metafield?.reference?.preview?.image?.url;
  
  return {
    ownerId: data.shop.id,
    metafield: metafield,
    currentImageUrl: imageUrl
  };
};

export async function action({ request }) {
  const { admin } = await shopify.authenticate.admin(request);
  const formData = await request.formData();
  const imageData = formData.get("imageData");
  const ownerId = formData.get("ownerId");
  const title = formData.get("title");
  const description = formData.get("description");

  try {
    // console.log("Starting file upload process...");

    // 1. Create staged upload
    const stagedResponse = await admin.graphql(`
      mutation CreateStagedUploads($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        input: [{
          filename: "store-icon.png",
          mimeType: "image/png",
          resource: "FILE",
          httpMethod: "POST"
        }]
      }
    });

    const { data: stagedData } = await stagedResponse.json();
    // console.log("Staged upload response:", stagedData);

    if (stagedData?.stagedUploadsCreate?.userErrors?.length > 0) {
      throw new Error(stagedData.stagedUploadsCreate.userErrors[0].message);
    }

    const { url, parameters, resourceUrl } = stagedData.stagedUploadsCreate.stagedTargets[0];

    // 2. Prepare file upload
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const blob = new Blob([buffer], { type: 'image/png' });

    // 3. Create form data with all required parameters
    const formDataUpload = new FormData();
    parameters.forEach(({ name, value }) => {
      formDataUpload.append(name, value);
    });
    formDataUpload.append('file', blob, 'store-icon.png');

    // console.log("Uploading file to URL:", url);
    // console.log("Resource URL:", resourceUrl);
    // console.log("Form data parameters:", [...formDataUpload.entries()].map(([key, value]) => key));

    // 4. Upload file
    const uploadResponse = await fetch(url, {
      method: "POST",
      body: formDataUpload
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Upload failed:", errorText);
      throw new Error("Failed to upload file: " + errorText);
    }

    // console.log("File upload successful");
    // const uploadData = await uploadResponse.text();
    // console.log("Upload response:", uploadData);

    // 5. Create file record in Shopify
    const fileResponse = await admin.graphql(`
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            preview {
              image {
                url
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        files: [{
          alt: "Store Icon",
          contentType: "IMAGE",
          originalSource: resourceUrl
        }]
      }
    });

    const { data: fileData } = await fileResponse.json();
    // console.log("File creation response:", fileData);

    if (fileData?.fileCreate?.userErrors?.length > 0) {
      throw new Error(fileData.fileCreate.userErrors[0].message);
    }
    const fileId = fileData.fileCreate.files[0].id;
    console.log("**fileId = ", fileId);

    // Function to get media file status and URL
    async function getMediaFileWhenReady(admin, fileId) {
      const maxAttempts = 10;
      const delayBetweenAttempts = 1000; // 1 segundo

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const response = await admin.graphql(`
          query getMediaImage($id: ID!) {
            node(id: $id) {
              ... on MediaImage {
                image {
                  url
                }
                fileStatus
              }
            }
          }
        `, { variables: { id: fileId } });

        const data = await response.json();
        const mediaNode = data.data?.node;

        if (mediaNode && mediaNode.fileStatus == 'READY') {
          const url = mediaNode.image?.url;
          return url;
        }
        await new Promise(resolve => setTimeout(resolve, delayBetweenAttempts));
      }
      throw new Error("Timeout waiting for media file to be ready");
    }

    // Get the URL when the file is ready
    const imageUrl = await getMediaFileWhenReady(admin, fileId);

    const iconsBag = [
      {
        mediaId: fileId,
        url: imageUrl,
        title: title,
        description: description,
        productTag: 'en_Category_Mattresses',
      }
    ];
    // 6. Create metafield with file reference
    // console.log("***Creating metafield with file ID");
    // console.log("***iconsBag = ", iconsBag);

    const metafieldResponse = await admin.graphql(`
      mutation metafieldSet($metafield: MetafieldsSetInput!) {
        metafieldsSet(metafields: [$metafield]) {
          metafields {
            id
            namespace
            key
            value
            type
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        metafield: {
          namespace: "custom",
          key: "store_icon",
          type: "json",
          value: JSON.stringify({ iconsBag: iconsBag }),
          ownerId: ownerId
        }
      }
    });
    const { data: metafieldData } = await metafieldResponse.json();
    // console.log("Metafield creation response:", JSON.stringify(metafieldData, null, 2));

    if (metafieldData?.metafieldsSet?.userErrors?.length > 0) {
      const error = metafieldData.metafieldsSet.userErrors[0];
      console.error("Metafield error:", error);
      throw new Error(`Error creating metafield: ${error.message} (${error.code})`);
    }

    return json({
      status: "success"
    });

  } catch (error) {
    console.error("Error in action:", error);
    return json({ status: "error", message: error.message }, { status: 500 });
  }
}

export default function IconsApp() {
  const { ownerId, currentImageUrl } = useLoaderData();
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const submit = useSubmit();
  const navigation = useNavigation();
  const isUploading = navigation.state === "submitting";

  const handleDrop = useCallback((_, acceptedFiles) => {
    const f = acceptedFiles[0];
    if (!f) return;

    // File size validation (max 20MB)
    if (f.size > 20 * 1024 * 1024) {
      setError("The file is too large. Maximum size is 20MB.");
      return;
    }

    // File type validation
    if (!f.type.startsWith('image/')) {
      setError("Only image files are allowed.");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(f);
    reader.onload = () => {
      const imageData = reader.result;
      setFile({
        name: f.name,
        type: f.type,
        size: f.size,
        base64: imageData
      });

      // Do not submit here; submission is handled by the Save button
      setError(null);
      setSuccess(false);
    };
    reader.onerror = () => {
      setError("Error reading the file.");
      setFile(null);
      setSuccess(false);
    };
  }, []);

  const handleSubmit = () => {
    if (!file) {
      setError("You must upload an image.");
      return;
    }
    if (!title || !description) {
      setError("Please complete the title and description.");
      return;
    }
    const formData = new FormData();
    formData.append("imageData", file.base64);
    formData.append("ownerId", ownerId);
    formData.append("title", title);
    formData.append("description", description);
    submit(formData, { method: "post" });
  };

  return (
    <Page title="Icons App">
      <Card sectioned>
        {isUploading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Spinner size="large" />
          </div>
        )}

        {error && (
          <Banner status="critical" onDismiss={() => setError(null)}>
            <p>{error}</p>
          </Banner>
        )}

        {success && !error && !isUploading && (
          <Banner status="success" onDismiss={() => setSuccess(false)}>
            <p>Image uploaded successfully!</p>
          </Banner>
        )}

        <LegacyStack vertical>
          <Text variant="headingMd">Upload your store icon</Text>

          {currentImageUrl && (
            <div style={{marginBottom: "1rem"}}>
              <Text variant="bodyMd">Current icon:</Text>
              <img src={currentImageUrl} alt="Current store icon" style={{maxWidth: "200px", marginTop: "0.5rem"}} />
            </div>
          )}

          <TextField
            label="Title"
            value={title}
            onChange={setTitle}
            autoComplete="off"
          />
          <TextField
            label="Description"
            value={description}
            onChange={setDescription}
            autoComplete="off"
          />

          <DropZone accept="image/*" type="image" onDrop={handleDrop} allowMultiple={false}>
            {!file && <DropZone.FileUpload actionHint="or drag and drop" />}
            {file && !isUploading && (
              <div style={{padding: "1rem"}}>
                <Thumbnail source={file.base64} alt={file.name} />
                <div style={{marginTop: "1rem"}}>
                  <Text variant="bodyMd">Name: {file.name}</Text>
                  <Text variant="bodyMd">Size: {(file.size / 1024).toFixed(2)} KB</Text>
                </div>
              </div>
            )}
          </DropZone>
          <Button
            primary
            onClick={handleSubmit}
            loading={isUploading}
            disabled={!file || !title || !description}
          >
            Save
          </Button>
        </LegacyStack>
      </Card>
    </Page>
  );
}
