import Link from "next/link";
import { listExercises } from "@/lib/queries";
import ExerciseManager from "./ExerciseManager";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const exercises = await listExercises();

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <h1>動作庫</h1>
          <div className="sub">{exercises.length} 個動作</div>
        </div>
        <Link href="/">
          <button className="btn ghost small" type="button">
            返回
          </button>
        </Link>
      </div>

      <ExerciseManager exercises={exercises} />
    </main>
  );
}
