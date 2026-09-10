import { notFound } from "next/navigation";
import { getSessionDetail, getPreviousPerformance } from "@/lib/queries";
import TrainingRunner from "./TrainingRunner";

export const dynamic = "force-dynamic";

export default async function TrainPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const detail = await getSessionDetail(sessionId);
  if (!detail) notFound();

  // 「上次這個動作練什麼」——拿來預填輸入框、顯示參考值
  const previous = await getPreviousPerformance(sessionId);

  // Map 不能直接跨 server/client 邊界，轉成普通物件
  const logs = Object.fromEntries(detail.logs);

  return (
    <TrainingRunner
      session={detail.session}
      card={detail.card}
      logs={logs}
      previous={previous}
    />
  );
}
