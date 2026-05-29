import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { getGraphConfig } from "@/lib/settings";

export interface MailAttachment {
  filename: string;
  /** base64-encoded file contents */
  contentBytes: string;
  contentType?: string;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

/** Build an authenticated Microsoft Graph client for the shared mailbox. */
export async function getGraphClient(): Promise<Client> {
  const { clientId, tenantId, clientSecret, sharedMailbox } =
    await getGraphConfig();

  if (!clientId || !tenantId || !clientSecret || !sharedMailbox) {
    throw new Error(
      "Microsoft Graph is not fully configured: clientId, tenantId, clientSecret and sharedMailbox are all required."
    );
  }

  const credential = new ClientSecretCredential(
    tenantId,
    clientId,
    clientSecret
  );

  return Client.initWithMiddleware({
    authProvider: {
      getAccessToken: async () => {
        const token = await credential.getToken(GRAPH_SCOPE);
        if (!token?.token) {
          throw new Error("Failed to acquire Microsoft Graph access token.");
        }
        return token.token;
      },
    },
  });
}

/** Send an HTML email (optionally with attachments) from the shared mailbox. */
export async function sendMailViaGraph(opts: SendMailOptions): Promise<void> {
  const { sharedMailbox } = await getGraphConfig();
  if (!sharedMailbox) {
    throw new Error("Microsoft Graph shared mailbox address is not configured.");
  }

  const client = await getGraphClient();

  const message = {
    subject: opts.subject,
    body: {
      contentType: "HTML",
      content: opts.html,
    },
    toRecipients: [{ emailAddress: { address: opts.to } }],
    attachments: (opts.attachments ?? []).map((a) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.filename,
      contentType: a.contentType ?? "application/pdf",
      contentBytes: a.contentBytes,
    })),
  };

  await client
    .api(`/users/${encodeURIComponent(sharedMailbox)}/sendMail`)
    .post({ message, saveToSentItems: true });
}
