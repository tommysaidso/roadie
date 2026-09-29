import { Page } from "@/components/ui";
import InboxConsole from "./InboxConsole";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  return (
    <Page
      title="Inbox"
      sub="One shared mailbox. Replies land on the venue or band they came from, and whoever did the outreach owns the follow-up."
    >
      <InboxConsole />
    </Page>
  );
}
