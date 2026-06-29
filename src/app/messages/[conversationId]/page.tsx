import ConversationThread from "./conversation-thread";

type ConversationPageProps = {
  params: Promise<{
    conversationId: string;
  }>;
};

export default async function ConversationPage({
  params,
}: ConversationPageProps) {
  const { conversationId } = await params;

  return <ConversationThread conversationId={conversationId} />;
}
